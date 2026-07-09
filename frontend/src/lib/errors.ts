// Classifies wallet/transaction errors into 3 main types (+ unknown). No
// dependencies, tested in isolation.
export type AppErrorType =
  | 'wallet_not_found'
  | 'user_rejected'
  | 'insufficient_balance'
  | 'unknown';

export interface AppError {
  type: AppErrorType;
  message: string;
}

export function classifyError(e: unknown): AppError {
  const raw =
    (e as any)?.message?.toString?.() ??
    (typeof e === 'string' ? e : JSON.stringify(e ?? ''));
  const msg = (raw || '').toLowerCase();

  // 1) Wallet not found / not installed
  if (
    msg.includes('not found') ||
    msg.includes('no wallet') ||
    msg.includes('not installed') ||
    msg.includes('could not be found') ||
    msg.includes('unavailable')
  ) {
    return {
      type: 'wallet_not_found',
      message: 'Wallet not found. Please install Freighter (or another supported wallet) and try again.',
    };
  }

  // 2) User rejected the transaction
  if (
    msg.includes('reject') ||
    msg.includes('denied') ||
    msg.includes('declined') ||
    msg.includes('cancell') ||
    msg.includes('user refused')
  ) {
    return {
      type: 'user_rejected',
      message: 'The transaction was rejected in your wallet.',
    };
  }

  // 3) Insufficient balance
  if (
    msg.includes('insufficient') ||
    msg.includes('underfunded') ||
    msg.includes('balance is not sufficient') ||
    msg.includes('not enough') ||
    msg.includes('#10') // token contract error: insufficient balance
  ) {
    return {
      type: 'insufficient_balance',
      message: 'Insufficient balance. Make sure your wallet has enough test XLM (fund it via Friendbot).',
    };
  }

  return {
    type: 'unknown',
    message: raw || 'An unknown error occurred.',
  };
}
