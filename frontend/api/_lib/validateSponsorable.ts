// Pure validation extracted from sponsor-fee-bump.ts so the security-critical
// check — "does this signed transaction only touch our contract's allowed
// write functions?" — can be unit-tested without a live network/RPC call.
import { Address, Transaction, TransactionBuilder } from 'stellar-sdk';

export const ALLOWED_FUNCTIONS = new Set(['deposit', 'claim', 'refund']);

export type ValidationOk = { ok: true; tx: Transaction };
export type ValidationFail = { ok: false; status: number; error: string };
export type ValidationResult = ValidationOk | ValidationFail;

// An explicit type predicate narrows more reliably than inline `!result.ok`
// control-flow analysis across every TS module-resolution mode the
// consuming build might use (Vite's bundler resolution locally vs.
// Vercel's node16/nodenext resolution for the serverless function).
export function isValidationFail(result: ValidationResult): result is ValidationFail {
  return result.ok === false;
}

export function validateSponsorable(signedTxXdr: string, contractId: string, networkPassphrase: string): ValidationResult {
  let parsed;
  try {
    parsed = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
  } catch {
    return { ok: false, status: 400, error: 'signedTxXdr is not a valid transaction envelope.' };
  }

  if (!(parsed instanceof Transaction) || parsed.operations.length !== 1) {
    return { ok: false, status: 400, error: 'Only single-operation transactions can be sponsored.' };
  }

  const op = parsed.operations[0];
  if (op.type !== 'invokeHostFunction') {
    return { ok: false, status: 400, error: 'Only contract invocations can be sponsored.' };
  }

  try {
    const invoked = op.func.invokeContract();
    const targetContract = Address.fromScAddress(invoked.contractAddress()).toString();
    const fnName = invoked.functionName().toString();
    if (targetContract !== contractId) {
      return { ok: false, status: 403, error: 'This endpoint only sponsors calls to the Sentinel campaign contract.' };
    }
    if (!ALLOWED_FUNCTIONS.has(fnName)) {
      return { ok: false, status: 403, error: `Sponsorship is not available for "${fnName}".` };
    }
  } catch {
    return { ok: false, status: 400, error: 'Could not verify the invocation target.' };
  }

  return { ok: true, tx: parsed };
}
