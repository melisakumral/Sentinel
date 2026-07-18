// Helpers that talk to the Sentinel Crowdfunding contract.
// Reads -> simulation. Writes (deposit/claim/refund) -> prepare + sign + send + await confirmation.
import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  Asset,
} from '@stellar/stellar-sdk';
import { kit, WalletNetwork } from './wallet';

export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID as string | undefined;
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const NETWORK_PASSPHRASE = Networks.TESTNET;

// Soroban reads are simulated, and simulation still needs *some* existing
// funded account to build the transaction against, even though nothing is
// signed or spent. This is a public, keyless (we never held/use its secret),
// friendbot-funded testnet-only account for read-only requests — e.g. the
// Explore page listing campaign data before a visitor has connected a wallet.
export const PUBLIC_READ_SOURCE = 'GDUAMU4FYDURVTPE7VP4A5SOSTSJMTLDG5KQCF3JPHDGKQZMB34FYKRP';

// Pure (dependency-free, testable) stroop <-> XLM conversion lives in `stroops.ts`.
export { STROOPS_PER_XLM, toStroops, fromStroops } from './stroops';

const server = new rpc.Server(RPC_URL);

// Native XLM is itself a Stellar Asset Contract (SAC) on Soroban; its contract
// id is derived deterministically, no network round-trip needed.
const NATIVE_TOKEN_ID = Asset.native().contractId(NETWORK_PASSPHRASE);

function requireContractId(): string {
  if (!CONTRACT_ID) {
    throw new Error(
      'VITE_CONTRACT_ID is not set. Add the Contract ID (C...) you got after deploying to frontend/.env.',
    );
  }
  return CONTRACT_ID;
}

const i128 = (v: bigint) => nativeToScVal(v, { type: 'i128' });
const addr = (a: string) => new Address(a).toScVal();

// --- Generic read (simulation) against an arbitrary contract ---
// A single read (e.g. getCampaignFor) fires up to 6 of these in parallel
// against the public testnet RPC, which occasionally drops/errors one call
// under that concurrent load even though the others succeed — retrying once
// clears it almost every time without meaningfully slowing down the common
// (already-succeeding) case.
async function simReadOnAttempt(contractId: string, sourceAddress: string, fn: string, args: any[]): Promise<any> {
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed (${fn}): ${sim.error}`);
  }
  return scValToNative(sim.result!.retval);
}

async function simReadOn(contractId: string, sourceAddress: string, fn: string, args: any[] = []): Promise<any> {
  try {
    return await simReadOnAttempt(contractId, sourceAddress, fn, args);
  } catch (e) {
    console.warn(`simReadOn(${fn}) failed once, retrying:`, e);
    return simReadOnAttempt(contractId, sourceAddress, fn, args);
  }
}

// Level 1 requirement: fetch the connected wallet's own native XLM balance
// (independent of any campaign contribution) by simulating a `balance` call
// against the native XLM SAC.
export async function getXlmBalance(address: string): Promise<bigint> {
  const raw = await simReadOn(NATIVE_TOKEN_ID, address, 'balance', [addr(address)]);
  return BigInt(raw ?? 0);
}

export interface Campaign {
  total: bigint;
  target: bigint;
  deadline: bigint; // unix seconds
  recipient: string | null;
  claimed: boolean;
  contribution: bigint; // the connected wallet's own contribution
}

// Fetches the full state of an arbitrary campaign contract in one shot.
// Powers the Explore page, which lists more than just VITE_CONTRACT_ID.
export async function getCampaignFor(contractId: string, sourceAddress: string): Promise<Campaign> {
  const [total, target, deadline, recipient, claimed, contribution] = await Promise.all([
    simReadOn(contractId, sourceAddress, 'get_total'),
    simReadOn(contractId, sourceAddress, 'get_target'),
    simReadOn(contractId, sourceAddress, 'get_deadline'),
    simReadOn(contractId, sourceAddress, 'get_recipient'),
    simReadOn(contractId, sourceAddress, 'is_claimed'),
    simReadOn(contractId, sourceAddress, 'get_contribution', [addr(sourceAddress)]),
  ]);
  return {
    total: BigInt(total ?? 0),
    target: BigInt(target ?? 0),
    deadline: BigInt(deadline ?? 0),
    recipient: recipient ? String(recipient) : null,
    claimed: Boolean(claimed),
    contribution: BigInt(contribution ?? 0),
  };
}

// Fetches the full campaign state in one shot (for live tracking).
export function getCampaign(sourceAddress: string): Promise<Campaign> {
  return getCampaignFor(requireContractId(), sourceAddress);
}

// --- Write path, split so the sponsored (fee-bump) flow can reuse the same
// build + prepare + wallet-sign step and only diverge at submission. ---

// Builds, prepares (Soroban footprint/auth/resource-fee), and signs the
// invocation with the connected wallet. Returns the signed XDR — nothing is
// submitted yet.
async function signInvocation(sourceAddress: string, fn: string, args: any[] = []): Promise<string> {
  const id = requireContractId();
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(id);

  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(30)
    .build();

  // Prepares the Soroban footprint + auth. Insufficient-balance etc. also surface here.
  tx = await server.prepareTransaction(tx);

  const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), {
    address: sourceAddress,
    networkPassphrase: WalletNetwork.TESTNET,
  });
  return signedTxXdr;
}

// Submits an already-signed transaction (as its own fee-paying transaction —
// not a fee-bump) and awaits confirmation.
async function submitSigned(signedTxXdr: string): Promise<{ hash: string; returnValue: any }> {
  const signed = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signed);

  if ((sent.status as string) === 'ERROR') {
    throw new Error('Transaction could not be submitted to the network: ' + JSON.stringify(sent.errorResult));
  }

  let got = await server.getTransaction(sent.hash);
  while (got.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    await new Promise((r) => setTimeout(r, 1500));
    got = await server.getTransaction(sent.hash);
  }
  if (got.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error('Transaction failed on-chain: ' + got.status);
  }

  const returnValue = got.returnValue ? scValToNative(got.returnValue) : null;
  return { hash: sent.hash, returnValue };
}

// --- Generic write: prepare + sign + submit + await confirmation ---
async function invoke(
  sourceAddress: string,
  fn: string,
  args: any[] = [],
): Promise<{ hash: string; returnValue: any }> {
  const signedTxXdr = await signInvocation(sourceAddress, fn, args);
  return submitSigned(signedTxXdr);
}

// Black Belt "Fee Sponsorship": the user signs the same inner transaction as
// `invoke()`, but instead of paying its own fee, the signed XDR is handed to
// a server-side sponsor (see api/sponsor-fee-bump.ts) that wraps it in a
// CAP-15 fee-bump transaction and pays the network fee on the user's behalf.
async function invokeSponsored(sourceAddress: string, fn: string, args: any[] = []): Promise<{ hash: string }> {
  const signedTxXdr = await signInvocation(sourceAddress, fn, args);

  const res = await fetch('/api/sponsor-fee-bump', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTxXdr }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Sponsored transaction failed (${res.status})`);
  }
  return { hash: data.hash };
}

// --- Write functions ---
export function deposit(donor: string, amountStroops: bigint) {
  return invoke(donor, 'deposit', [addr(donor), i128(amountStroops)]);
}

export function depositSponsored(donor: string, amountStroops: bigint) {
  return invokeSponsored(donor, 'deposit', [addr(donor), i128(amountStroops)]);
}

export function claim(recipient: string) {
  return invoke(recipient, 'claim');
}

export function claimSponsored(recipient: string) {
  return invokeSponsored(recipient, 'claim');
}

export function refund(donor: string) {
  return invoke(donor, 'refund', [addr(donor)]);
}

export function refundSponsored(donor: string) {
  return invokeSponsored(donor, 'refund', [addr(donor)]);
}

// --- Real-time event streaming ---
// The contract publishes an event on deposit/claim/refund (see contract/src/lib.rs).
// The frontend listens for these via the Soroban RPC `getEvents` to power a live activity feed.
export interface ActivityEvent {
  id: string;
  type: 'deposit' | 'claim' | 'refund';
  actor: string;
  amount: bigint;
  ledger: number;
  closedAt: string; // ISO timestamp, from the RPC's ledgerClosedAt
  txHash: string;
}

export async function getLatestLedger(): Promise<number> {
  const { sequence } = await server.getLatestLedger();
  return sequence;
}

const EVENT_TYPES = new Set(['deposit', 'claim', 'refund']);

// Returns new contract events starting at (and including) `sinceLedger`.
export async function getRecentEvents(
  sinceLedger: number,
): Promise<{ events: ActivityEvent[]; latestLedger: number }> {
  const id = requireContractId();
  const resp = await server.getEvents({
    startLedger: sinceLedger,
    filters: [{ type: 'contract', contractIds: [id] }],
  });

  const events: ActivityEvent[] = [];
  for (const e of resp.events) {
    const topics = e.topic.map((t) => scValToNative(t));
    const kind = topics[0];
    if (typeof kind !== 'string' || !EVENT_TYPES.has(kind)) continue;
    const actor = topics[1] ? String(topics[1]) : '';
    const value = scValToNative(e.value);
    events.push({
      id: `${e.ledger}-${e.id}`,
      type: kind as ActivityEvent['type'],
      actor,
      amount: BigInt(value ?? 0),
      ledger: e.ledger,
      closedAt: e.ledgerClosedAt,
      txHash: e.txHash,
    });
  }
  return { events, latestLedger: resp.latestLedger };
}
