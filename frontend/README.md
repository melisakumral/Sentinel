# CoreSplit Frontend (React + TypeScript + Vite)

Crowdfunding dApp arayüzü. Çoklu cüzdan (StellarWalletsKit) ile bağlanır, Soroban sözleşmesine `deposit / claim / refund` çağrıları yapar, ilerlemeyi canlı gösterir.

## Çalıştırma

```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
# .env -> VITE_CONTRACT_ID=<deploy edilmiş Contract ID>
npm run dev
```

## Önemli dosyalar

- `src/lib/wallet.ts` — StellarWalletsKit + hata sınıflandırma (wallet not found / rejected / insufficient balance).
- `src/lib/contract.ts` — sözleşme okuma/yazma (Soroban RPC).
- `src/App.tsx` — arayüz, ilerleme çubuğu, işlem durumu, canlı takip.

Detaylı kurulum ve deploy için kök dizindeki `../README.md` dosyasına bak.

> `_backup/App.freighter.tsx`: önceki Freighter-only sürüm (referans).
