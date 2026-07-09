# Sentinel Frontend (React + TypeScript + Vite)

Crowdfunding dApp UI. Connects via multiple wallets (StellarWalletsKit), displays the connected wallet's XLM balance, calls `deposit / claim / refund` on the Soroban contract, and shows live progress plus a real-time activity feed.

## Run it

```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
# .env -> VITE_CONTRACT_ID=<deployed Contract ID>
npm run dev
```

## Key files

- `src/lib/wallet.ts` — StellarWalletsKit setup.
- `src/lib/errors.ts` — error classification (wallet not found / rejected / insufficient balance).
- `src/lib/stroops.ts` — stroop <-> XLM conversion.
- `src/lib/contract.ts` — contract reads/writes + wallet balance + event streaming (Soroban RPC).
- `src/App.tsx` — UI: wallet balance, progress bar, activity feed, transaction status, mobile responsive.

See the root `../README.md` for full setup and deployment instructions.

> `_backup/App.freighter.tsx`: the previous Freighter-only version (kept for reference).
