# 🪐 Sentinel — Merkeziyetsiz Kitle Fonlama (Crowdfunding)

Sentinel, Stellar/Soroban üzerinde çalışan bir **kitle fonlama** dApp'idir. Proje sahibi bir hedef tutar ve süre belirler; bağışçılar cüzdanlarını bağlayıp doğrudan sözleşmeye XLM gönderir. Süre dolduğunda:

- **Hedefe ulaşıldıysa** → fonlar proje sahibine aktarılır (`claim`).
- **Ulaşılamadıysa** → bağışlar otomatik olarak bağışçılara iade edilir (`refund`).

Aracı yok, her hareket zincirde şeffaf, süreç akıllı sözleşmeyle otomatik.

## 🏆 Level 2 Gereksinimleri — Karşılanma

| Gereksinim | Durum |
|-----------|-------|
| StellarWalletsKit ile çoklu cüzdan | ✅ `frontend/src/lib/wallet.ts` |
| 3 hata tipi (wallet not found, rejected, insufficient balance) | ✅ `classifyError()` |
| Testnet'e deploy edilmiş sözleşme | ✅ Aşağıda Contract ID |
| Frontend'den sözleşme çağırma (deposit/claim/refund) | ✅ `frontend/src/lib/contract.ts` |
| İşlem durumu görünür (pending/success/fail) | ✅ App.tsx durum kutusu |
| Gerçek zamanlı takip (event/state senkronu) | ✅ 8 sn polling + ilerleme çubuğu |
| 2+ anlamlı commit | ✅ Git geçmişine bak |

## 🔗 Teslim Bilgileri

| Alan | Değer |
|------|-------|
| **Contract ID** | [`CBAEOBYIN2LT3TAZFFYIDBYSCIIU27GU7CE7D3NQDLMXILNQKKDNAXID`](https://stellar.expert/explorer/testnet/contract/CBAEOBYIN2LT3TAZFFYIDBYSCIIU27GU7CE7D3NQDLMXILNQKKDNAXID) |
| **Deploy işlemi (tx hash)** | [`76e5fc26...`](https://stellar.expert/explorer/testnet/tx/76e5fc26a38adf8e913f18680e85e79c0b44962c3c32fe7e56281ecdbfc9a127) |
| **Örnek kontrat çağrısı — `deposit` (tx hash)** | [`3da931af...`](https://stellar.expert/explorer/testnet/tx/3da931af2c9b1f99c880065ebfb8809dbfc63d3a6b2d78a64f4185674faa2364) |
| **Kampanya hedefi / süre** | 50 XLM · 7 gün (initialize ile ayarlandı) |
| **Canlı Demo (opsiyonel)** | `https://... (Vercel'e deploy edip buraya ekle)` |
| **Ekran görüntüsü: cüzdan seçenekleri** | `docs/wallet-options.png (ekle)` |
| **Ekran görüntüsü: bağlı cüzdan + bakiye/ilerleme** | `docs/connected-progress.png (ekle)` |
| **Ekran görüntüsü: başarılı işlem** | `docs/tx-success.png (ekle)` |

> Ekran görüntüleri, uygulamayı `npm run dev` ile çalıştırıp Freighter ile gerçek bir cüzdan bağlayarak alınmalı — bu adım tarayıcı + cüzdan onayı gerektirdiği için elle tamamlanmalı.

## 🗂️ Proje Yapısı

```
Sentinel/
├─ contract/            # Rust / Soroban crowdfunding sözleşmesi
│  └─ src/
│     ├─ lib.rs         # initialize, deposit, claim, refund, get_state...
│     └─ test.rs        # başarı/başarısızlık + claim/refund testleri
└─ frontend/            # React + TypeScript + Vite
   └─ src/
      ├─ App.tsx        # ilerleme çubuğu, işlem durumu, canlı takip
      └─ lib/
         ├─ wallet.ts   # StellarWalletsKit + 3 hata tipi
         └─ contract.ts # deposit / claim / refund / getCampaign
```

## 🛠️ Teknolojiler

Rust + `soroban-sdk` v22 · React 19 + TypeScript + Vite · `@creit.tech/stellar-wallets-kit` · `stellar-sdk` (Soroban RPC) · Stellar Testnet.

## 🚀 Baştan Sona Kurulum

### 1) Sözleşme — derle, test, deploy, başlat

```bash
cd contract
rustup target add wasm32-unknown-unknown
cargo test
cargo build --target wasm32-unknown-unknown --release

stellar keys generate --global alice --network testnet --fund
export OWNER=$(stellar keys address alice)

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_contract.wasm \
  --source alice --network testnet
export CID=<gelen_Contract_ID>

stellar contract id asset --asset native --network testnet
export TOKEN=<gelen_native_SAC>

# Örnek: hedef 50 XLM, deadline = ileri bir unix saniye
stellar contract invoke --id $CID --source alice --network testnet -- \
  initialize --recipient $OWNER --token $TOKEN --target 500000000 --deadline 1767225600
```

### 2) Frontend — çalıştır

```bash
cd ../frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
# .env içine:  VITE_CONTRACT_ID=<CID>
npm run dev
```

`http://localhost:5173` → Cüzdan Bağla → Bağış Yap. Süre dolunca sahip `claim`, başarısızsa bağışçı `refund` görür.

### 3) Test cüzdanı fonlama

Bağış yapabilmek için cüzdanında test XLM olmalı: https://friendbot.stellar.org adresine cüzdan adresini gir.

## 📦 Git

Repo yerel olarak commit'lendi. Kendi GitHub'ına bağlamak için:

```bash
git branch -M main
git remote add origin https://github.com/<kullanıcı>/sentinel.git
git push -u origin main
```

> Not: Eski (Freighter-only) frontend sürümü `frontend/_backup/App.freighter.tsx` içinde referans olarak duruyor. Vercel'e deploy ederken **Root Directory = frontend** seç ve `VITE_CONTRACT_ID` ortam değişkenini ekle.
