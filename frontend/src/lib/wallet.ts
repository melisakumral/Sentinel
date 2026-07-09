// Çoklu cüzdan desteği için StellarWalletsKit yapılandırması + hata sınıflandırma.
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit';

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

// Saf (bağımlılıksız, test edilebilir) hata sınıflandırması `errors.ts`'e taşındı.
export { classifyError, type AppError, type AppErrorType } from './errors';
