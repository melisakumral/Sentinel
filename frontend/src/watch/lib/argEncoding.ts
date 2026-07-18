// Encodes a raw string typed in the Simulator UI into a Soroban ScVal, given
// a user-picked type tag. Pure (no network), tested in isolation.
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';

export const ARG_TYPES = [
  'address',
  'string',
  'symbol',
  'bool',
  'u32',
  'i32',
  'u64',
  'i64',
  'u128',
  'i128',
] as const;

export type ArgType = (typeof ARG_TYPES)[number];

export interface ArgInput {
  type: ArgType;
  value: string;
}

export function encodeArg({ type, value }: ArgInput): xdr.ScVal {
  const raw = value.trim();
  switch (type) {
    case 'address':
      return new Address(raw).toScVal();
    case 'string':
      return nativeToScVal(raw, { type: 'string' });
    case 'symbol':
      return nativeToScVal(raw, { type: 'symbol' });
    case 'bool':
      // Booleans don't take a `type` hint — nativeToScVal always maps them
      // to scvBool on its own (unlike strings/bytes/numbers, which are
      // ambiguous and need one).
      return nativeToScVal(raw.toLowerCase() === 'true');
    case 'u32':
      return nativeToScVal(Number(raw), { type: 'u32' });
    case 'i32':
      return nativeToScVal(Number(raw), { type: 'i32' });
    case 'u64':
      return nativeToScVal(BigInt(raw), { type: 'u64' });
    case 'i64':
      return nativeToScVal(BigInt(raw), { type: 'i64' });
    case 'u128':
      return nativeToScVal(BigInt(raw), { type: 'u128' });
    case 'i128':
      return nativeToScVal(BigInt(raw), { type: 'i128' });
  }
}

// Encodes a whole arg list, surfacing which row failed (1-based) so the UI
// can point the user at the offending input instead of a generic error.
export function encodeArgs(inputs: ArgInput[]): xdr.ScVal[] {
  return inputs.map((input, i) => {
    try {
      return encodeArg(input);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      throw new Error(`Argument #${i + 1} (${input.type}): ${reason}`);
    }
  });
}
