// RPC helpers behind Sentinel Watch. Unlike frontend/src/lib/contract.ts
// (which is hard-wired to the Sentinel campaign contract), everything here is
// contract-agnostic: it works against whatever Contract ID the user types in,
// because Watch is meant to monitor and dry-run *any* Soroban contract.
import { rpc, Contract, TransactionBuilder, BASE_FEE, scValToNative, type xdr } from 'stellar-sdk';
import { RPC_URL, NETWORK_PASSPHRASE } from '../../lib/contract';
import type { WatchEvent } from '../types';

const server = new rpc.Server(RPC_URL);

export async function getLatestLedger(): Promise<number> {
  const { sequence } = await server.getLatestLedger();
  return sequence;
}

function toNumericValue(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  return null;
}

// Fetches every contract event emitted since (and including) `sinceLedger`
// for `contractId`, decoding topics/value on a best-effort basis so one
// malformed event can't break the whole poll.
export async function fetchWatchEvents(
  contractId: string,
  sinceLedger: number,
): Promise<{ events: WatchEvent[]; latestLedger: number }> {
  const resp = await server.getEvents({
    startLedger: sinceLedger,
    filters: [{ type: 'contract', contractIds: [contractId] }],
  });

  const events: WatchEvent[] = [];
  for (const e of resp.events) {
    try {
      const topics = e.topic.map((t) => scValToNative(t));
      const value = scValToNative(e.value);
      const kind = typeof topics[0] === 'string' ? topics[0] : 'event';
      events.push({
        id: `${e.ledger}-${e.id}`,
        ledger: e.ledger,
        closedAt: e.ledgerClosedAt,
        txHash: e.txHash,
        kind,
        topics,
        value,
        numericValue: toNumericValue(value),
      });
    } catch {
      // Skip events we can't decode rather than aborting the whole poll.
    }
  }
  return { events, latestLedger: resp.latestLedger };
}

export interface SimulationResult {
  success: boolean;
  returnValue?: unknown;
  error?: string;
  minResourceFee?: string;
  needsRestore?: boolean;
  latestLedger: number;
}

// Dry-runs `fn(args)` on `contractId` as if sent by `sourceAddress`, via the
// Soroban RPC's simulateTransaction — no signature, no fee spent, no state
// change. `sourceAddress` only needs to exist on the network (any funded
// testnet account works, it does not need to belong to the caller).
export async function simulateCall(
  contractId: string,
  sourceAddress: string,
  fn: string,
  args: xdr.ScVal[],
): Promise<SimulationResult> {
  let account;
  try {
    account = await server.getAccount(sourceAddress);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`Source account not found on testnet — fund it via Friendbot first. (${reason})`);
  }

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
    return { success: false, error: sim.error, latestLedger: sim.latestLedger };
  }
  return {
    success: true,
    returnValue: sim.result ? scValToNative(sim.result.retval) : null,
    minResourceFee: sim.minResourceFee,
    needsRestore: rpc.Api.isSimulationRestore(sim),
    latestLedger: sim.latestLedger,
  };
}
