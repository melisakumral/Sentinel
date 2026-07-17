import { describe, expect, it } from 'vitest';
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
} from 'stellar-sdk';
import { validateSponsorable } from './validateSponsorable';

const NETWORK = Networks.TESTNET;
const CONTRACT_ID = 'CAGE4RJ5C4MAAWVT5I5F7XOUE25GVMWUTPXRQRIMPCEIJUD6E3DT5LR3';
const OTHER_CONTRACT_ID = 'CBYJEVF3ZBKAPLUTRHSGS6VGJNM7ZKO4YNTQVOA4E5A67EL462JTO3GL';

function account() {
  return new Account(Keypair.random().publicKey(), '1');
}

function invokeTxXdr(contractId: string, fn: string, args: unknown[] = []) {
  const src = account();
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(contract.call(fn, ...(args as never[])))
    .setTimeout(30)
    .build();
  return tx.toXDR();
}

describe('validateSponsorable', () => {
  it('accepts a deposit call to the configured contract', () => {
    const addrArg = new Address(Keypair.random().publicKey()).toScVal();
    const amountArg = nativeToScVal(10_000_000n, { type: 'i128' });
    const xdr = invokeTxXdr(CONTRACT_ID, 'deposit', [addrArg, amountArg]);

    const result = validateSponsorable(xdr, CONTRACT_ID, NETWORK);
    expect(result.ok).toBe(true);
  });

  it('accepts claim and refund, the other two allowed functions', () => {
    for (const fn of ['claim', 'refund']) {
      const xdr = invokeTxXdr(CONTRACT_ID, fn, [new Address(Keypair.random().publicKey()).toScVal()]);
      expect(validateSponsorable(xdr, CONTRACT_ID, NETWORK).ok).toBe(true);
    }
  });

  it('rejects a call to a different contract (the core anti-abuse check)', () => {
    const xdr = invokeTxXdr(OTHER_CONTRACT_ID, 'deposit', []);
    const result = validateSponsorable(xdr, CONTRACT_ID, NETWORK);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toMatch(/campaign contract/i);
    }
  });

  it('rejects a disallowed function on the right contract (e.g. initialize)', () => {
    const xdr = invokeTxXdr(CONTRACT_ID, 'initialize', []);
    const result = validateSponsorable(xdr, CONTRACT_ID, NETWORK);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('rejects a non-invocation operation (e.g. a plain payment)', () => {
    const src = account();
    const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: NETWORK })
      .addOperation(Operation.payment({ destination: src.accountId(), asset: Asset.native(), amount: '10' }))
      .setTimeout(30)
      .build();

    const result = validateSponsorable(tx.toXDR(), CONTRACT_ID, NETWORK);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('rejects a transaction with more than one operation', () => {
    const src = account();
    const contract = new Contract(CONTRACT_ID);
    const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: NETWORK })
      .addOperation(contract.call('deposit'))
      .addOperation(contract.call('claim'))
      .setTimeout(30)
      .build();

    const result = validateSponsorable(tx.toXDR(), CONTRACT_ID, NETWORK);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('rejects garbage input instead of throwing', () => {
    const result = validateSponsorable('not-a-valid-xdr', CONTRACT_ID, NETWORK);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
