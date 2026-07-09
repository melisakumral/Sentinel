import { describe, expect, it } from 'vitest';
import { Keypair, scValToNative } from 'stellar-sdk';
import { encodeArg, encodeArgs } from './argEncoding';

describe('encodeArg', () => {
  it('round-trips a bool', () => {
    expect(scValToNative(encodeArg({ type: 'bool', value: 'true' }))).toBe(true);
    expect(scValToNative(encodeArg({ type: 'bool', value: 'false' }))).toBe(false);
  });

  it('round-trips a string', () => {
    expect(scValToNative(encodeArg({ type: 'string', value: 'hello' }))).toBe('hello');
  });

  it('round-trips a u32', () => {
    expect(scValToNative(encodeArg({ type: 'u32', value: '42' }))).toBe(42);
  });

  it('round-trips an i128', () => {
    expect(scValToNative(encodeArg({ type: 'i128', value: '-12345678901234567890' }))).toBe(
      -12345678901234567890n,
    );
  });

  it('round-trips a Stellar address', () => {
    const addr = Keypair.random().publicKey();
    expect(scValToNative(encodeArg({ type: 'address', value: addr }))).toBe(addr);
  });

  it('trims whitespace before encoding', () => {
    expect(scValToNative(encodeArg({ type: 'u32', value: '  7  ' }))).toBe(7);
  });

  it('throws on a malformed address', () => {
    expect(() => encodeArg({ type: 'address', value: 'not-an-address' })).toThrow();
  });

  it('throws on a non-numeric integer input', () => {
    expect(() => encodeArg({ type: 'u64', value: 'abc' })).toThrow();
  });
});

describe('encodeArgs', () => {
  it('encodes multiple args in order', () => {
    const encoded = encodeArgs([
      { type: 'u32', value: '1' },
      { type: 'bool', value: 'true' },
    ]);
    expect(encoded.map(scValToNative)).toEqual([1, true]);
  });

  it('labels which argument failed', () => {
    expect(() =>
      encodeArgs([
        { type: 'u32', value: '1' },
        { type: 'address', value: 'bad' },
      ]),
    ).toThrow(/Argument #2 \(address\)/);
  });
});
