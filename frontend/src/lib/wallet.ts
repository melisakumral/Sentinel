// StellarWalletsKit setup for multi-wallet support (Freighter and others), Stellar Testnet.
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

// Returns installed/available wallets (used to detect the "wallet not found" case).
export async function getAvailableWallets(): Promise<ISupportedWallet[]> {
  const wallets = await kit.getSupportedWallets();
  return wallets.filter((w) => w.isAvailable);
}

// Pure (dependency-free, testable) error classification lives in `errors.ts`.
export { classifyError, type AppError, type AppErrorType } from './errors';
