// Çoklu cüzdan desteği için StellarWalletsKit yapılandırması + hata sınıflandırma.
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
  type ISupportedWallet,
} from '@stellar/stellar-wallets-kit';

export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

export { WalletNetwork };

// Kurulu/erişilebilir cüzdanları döner (yoksa "wallet not found" için kullanılır).
export async function getAvailableWallets(): Promise<ISupportedWallet[]> {
  const wallets = await kit.getSupportedWallets();
  return wallets.filter((w) => w.isAvailable);
}

export type AppErrorType =
  | 'wallet_not_found'
  | 'user_rejected'
  | 'insufficient_balance'
  | 'unknown';

export interface AppError {
  type: AppErrorType;
  message: string;
}

// Cüzdan/işlem hatalarını 3 ana tipe (+unknown) sınıflandırır ve TR mesaj döner.
export function classifyError(e: unknown): AppError {
  const raw =
    (e as any)?.message?.toString?.() ??
    (typeof e === 'string' ? e : JSON.stringify(e ?? ''));
  const msg = (raw || '').toLowerCase();

  // 1) Cüzdan bulunamadı / kurulu değil
  if (
    msg.includes('not found') ||
    msg.includes('no wallet') ||
    msg.includes('not installed') ||
    msg.includes('could not be found') ||
    msg.includes('unavailable')
  ) {
    return {
      type: 'wallet_not_found',
      message: 'Cüzdan bulunamadı. Lütfen Freighter (veya desteklenen bir cüzdan) kur ve tekrar dene.',
    };
  }

  // 2) Kullanıcı işlemi reddetti
  if (
    msg.includes('reject') ||
    msg.includes('denied') ||
    msg.includes('declined') ||
    msg.includes('cancell') ||
    msg.includes('user refused')
  ) {
    return {
      type: 'user_rejected',
      message: 'İşlem cüzdanda reddedildi.',
    };
  }

  // 3) Yetersiz bakiye
  if (
    msg.includes('insufficient') ||
    msg.includes('underfunded') ||
    msg.includes('balance is not sufficient') ||
    msg.includes('not enough') ||
    msg.includes('#10') // token: insufficient balance kontrat hatası
  ) {
    return {
      type: 'insufficient_balance',
      message: 'Yetersiz bakiye. Cüzdanında yeterli test XLM olduğundan emin ol (Friendbot ile fonla).',
    };
  }

  return {
    type: 'unknown',
    message: raw || 'Bilinmeyen bir hata oluştu.',
  };
}
