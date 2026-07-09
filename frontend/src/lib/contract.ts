// Sentinel Crowdfunding sözleşmesi ile konuşan yardımcılar.
// Okuma -> simülasyon. Yazma (deposit/claim/refund) -> prepare + imzala + gönder + onay bekle.
import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
} from 'stellar-sdk';
import { kit, WalletNetwork } from './wallet';

export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID as string | undefined;
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const NETWORK_PASSPHRASE = Networks.TESTNET;

// Saf (bağımlılıksız, test edilebilir) stroop <-> XLM dönüşümü `stroops.ts`'e taşındı.
export { STROOPS_PER_XLM, toStroops, fromStroops } from './stroops';

const server = new rpc.Server(RPC_URL);

function requireContractId(): string {
  if (!CONTRACT_ID) {
    throw new Error(
      'VITE_CONTRACT_ID tanımlı değil. frontend/.env dosyasına deploy sonrası aldığın Contract ID (C...) değerini ekle.',
    );
  }
  return CONTRACT_ID;
}

const i128 = (v: bigint) => nativeToScVal(v, { type: 'i128' });
const addr = (a: string) => new Address(a).toScVal();

// --- Genel okuma (simülasyon) ---
async function simRead(sourceAddress: string, fn: string, args: any[] = []): Promise<any> {
  const id = requireContractId();
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(id);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simülasyon hatası (${fn}): ${sim.error}`);
  }
  return scValToNative(sim.result!.retval);
}

export interface Campaign {
  total: bigint;
  target: bigint;
  deadline: bigint; // unix saniye
  recipient: string | null;
  claimed: boolean;
  contribution: bigint; // bağlı cüzdanın katkısı
}

// Tüm kampanya durumunu tek seferde çeker (canlı takip için).
export async function getCampaign(sourceAddress: string): Promise<Campaign> {
  const [total, target, deadline, recipient, claimed, contribution] = await Promise.all([
    simRead(sourceAddress, 'get_total'),
    simRead(sourceAddress, 'get_target'),
    simRead(sourceAddress, 'get_deadline'),
    simRead(sourceAddress, 'get_recipient'),
    simRead(sourceAddress, 'is_claimed'),
    simRead(sourceAddress, 'get_contribution', [addr(sourceAddress)]),
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

// --- Genel yazma: prepare + imzala + gönder + onay bekle ---
async function invoke(
  sourceAddress: string,
  fn: string,
  args: any[] = [],
): Promise<{ hash: string; returnValue: any }> {
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

  // Soroban footprint + auth hazırlığı. Yetersiz bakiye vb. burada da yakalanır.
  tx = await server.prepareTransaction(tx);

  const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), {
    address: sourceAddress,
    networkPassphrase: WalletNetwork.TESTNET,
  });

  const signed = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signed);

  if ((sent.status as string) === 'ERROR') {
    throw new Error('İşlem ağa gönderilemedi: ' + JSON.stringify(sent.errorResult));
  }

  let got = await server.getTransaction(sent.hash);
  while (got.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    await new Promise((r) => setTimeout(r, 1500));
    got = await server.getTransaction(sent.hash);
  }
  if (got.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error('İşlem zincirde başarısız oldu: ' + got.status);
  }

  const returnValue = got.returnValue ? scValToNative(got.returnValue) : null;
  return { hash: sent.hash, returnValue };
}

// --- Yazma fonksiyonları ---
export function deposit(donor: string, amountStroops: bigint) {
  return invoke(donor, 'deposit', [addr(donor), i128(amountStroops)]);
}

export function claim(recipient: string) {
  return invoke(recipient, 'claim');
}

export function refund(donor: string) {
  return invoke(donor, 'refund', [addr(donor)]);
}
