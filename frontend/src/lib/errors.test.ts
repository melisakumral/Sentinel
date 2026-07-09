import { describe, expect, it } from 'vitest';
import { classifyError } from './errors';

describe('classifyError', () => {
  it('classifies a missing wallet', () => {
    expect(classifyError(new Error('Wallet not found')).type).toBe('wallet_not_found');
  });

  it('classifies a user rejection', () => {
    expect(classifyError(new Error('User declined access')).type).toBe('user_rejected');
  });

  it('classifies an insufficient balance error', () => {
    expect(classifyError(new Error('insufficient balance for transfer')).type).toBe(
      'insufficient_balance',
    );
  });

  it('falls back to unknown for unrecognized errors', () => {
    expect(classifyError(new Error('boom')).type).toBe('unknown');
  });
});
