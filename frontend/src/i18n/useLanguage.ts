import { useContext } from 'react';
import { LanguageContext, type LanguageContextValue } from './LanguageContext';
import type { AppError } from '../lib/errors';

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

// classifyError()'s `message` is always English (it's a pure, dependency-free
// lib tested in isolation). This maps its `type` to a localized string at the
// UI layer instead, falling back to the raw message for the 'unknown' type
// (which wraps an arbitrary underlying error we can't meaningfully translate).
export function translateAppError(t: LanguageContextValue['t'], err: AppError): string {
  switch (err.type) {
    case 'wallet_not_found':
      return t('errWalletNotFound');
    case 'user_rejected':
      return t('errUserRejected');
    case 'insufficient_balance':
      return t('errInsufficientBalance');
    default:
      return err.message;
  }
}
