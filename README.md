# 🪐 Sentinel — Merkeziyetsiz Kitle Fonlama (Crowdfunding)

![CI](https://github.com/melisakumral/CoreSplit/actions/workflows/ci.yml/badge.svg)

Sentinel, Stellar/Soroban üzerinde çalışan bir **kitle fonlama** dApp'idir. Proje sahibi bir hedef tutar ve süre belirler; bağışçılar cüzdanlarını bağlayıp doğrudan sözleşmeye XLM gönderir. Süre dolduğunda:

- **Hedefe ulaşıldıysa** → fonlar proje sahibine aktarılır (`claim`).
- **Ulaşılamadıysa** → bağışlar otomatik olarak bağışçılara iade edilir (`refund`).

Her iki durumda da kampanya sözleşmesi, nihai sonucu ayrı bir **Sentinel Registry** sözleşmesine gerçek bir inter-contract call ile bildirir. Aracı yok, her hareket zincirde şeffaf, süreç akıllı sözleşmeyle otomatik.

## 🏗️ Mimari

```
                 deposit / claim / refund
   Bağışçı ───────────────────────────────▶  Sentinel Campaign (contract/)
                                                  │  │
                                          token   │  │  invoke_contract("record", …)
                                        transfer   │  │  (claim/refund sonrası)
                                                  ▼  ▼
                                     Native XLM SAC   Sentinel Registry (contract/registry/)
                                                          │
                                                          ▼
                                                idempotent kayıt: campaign → {recipient, total, target, success}
```

- **`contract/`** — kampanya sözleşmesi (`SentinelContract`). `deposit`/`claim`/`refund` sırasında zincir üstü **event** yayınlar (`env.events().publish`) ve `claim`/`refund` sonrası **inter-contract call** ile Registry'yi bilgilendirir (`env.invoke_contract`, derleme zamanı bağımlılığı yok — sadece ABI'ye bağımlı).
- **`contract/registry/`** — bağımsız, ayrı deploy edilen **Sentinel Registry** sözleşmesi (`SentinelRegistry`). `record(...)` **idempotent**'tir: bir kampanya için ilk kayıt kalıcıdır, sonraki çağrılar (örn. her donor'un ayrı `refund` çağrısı) yok sayılır.
- **`frontend/`** — React + TypeScript. Kontrat durumu 8 sn'de bir poll edilir; ayrıca `getEvents` RPC'si ile kontrat event'leri 6 sn'de bir dinlenerek gerçek zamanlı bir **Aktivite Akışı** gösterilir.
- **`.github/workflows/ci.yml`** — her push/PR'da kontrat (`cargo test --workspace`, wasm build) ve frontend (`lint`, `vitest`, `tsc`+`vite build`) doğrulanır.

## 🏆 Level 2 Gereksinimleri — Karşılanma

| Gereksinim | Durum |
|-----------|-------|
| StellarWalletsKit ile çoklu cüzdan | ✅ `frontend/src/lib/wallet.ts` |
| 3 hata tipi (wallet not found, rejected, insufficient balance) | ✅ `classifyError()` (`frontend/src/lib/errors.ts`) |
| Testnet'e deploy edilmiş sözleşme | ✅ Aşağıda Contract ID |
| Frontend'den sözleşme çağırma (deposit/claim/refund) | ✅ `frontend/src/lib/contract.ts` |
| İşlem durumu görünür (pending/success/fail) | ✅ App.tsx durum kutusu |
| Gerçek zamanlı takip (event/state senkronu) | ✅ 8 sn state polling + ilerleme çubuğu |
| 2+ anlamlı commit | ✅ Git geçmişine bak |

## 🥇 Level 3 Gereksinimleri — Karşılanma

| Gereksinim | Durum |
|-----------|-------|
| Gelişmiş akıllı kontrat mantığı | ✅ Kampanya + Registry, idempotent kayıt, event yayını |
| Inter-contract communication | ✅ `env.invoke_contract` ile canlı testnet çağrısı (bkz. aşağıdaki `claim` tx) |
| Event streaming & gerçek zamanlı güncellemeler | ✅ `getEvents` polling → Aktivite Akışı (`frontend/src/lib/contract.ts` → `getRecentEvents`) |
| CI/CD pipeline | ✅ `.github/workflows/ci.yml` (contract + frontend job'ları) |
| Kontrat deploy iş akışı | ✅ Aşağıda `stellar contract deploy`/`invoke` adımları, gerçek deploy |
| Mobil uyumlu frontend | ✅ `app-shell`/`app-card` + `@media (max-width: 480px)` (`frontend/src/App.css`) |
| Hata yönetimi & loading state | ✅ `classifyError`, `loadingCampaign` state, işlem durum kutusu |
| Kontrat + frontend testleri | ✅ 8 Rust testi (`cargo test --workspace`) + 7 Vitest testi (`npm run test`) = **15 test** |
| Production-ready mimari | ✅ Cargo workspace, saf/test edilebilir modüller (`stroops.ts`, `errors.ts`), CI |
| Dokümantasyon & demo sunumu | ✅ Bu README + aşağıdaki teslim bilgileri |
| Public GitHub repo | ✅ https://github.com/melisakumral/CoreSplit |
| 10+ anlamlı commit | ✅ Git geçmişine bak |
| Canlı demo linki (Vercel vb.) | ⬜ Manuel — bkz. "Kalan Manuel Adımlar" |
| Ekran görüntüleri (mobil, CI, test çıktısı) | ⬜ Manuel — bkz. "Kalan Manuel Adımlar" |
| Demo videosu (1-2 dk) | ⬜ Manuel — bkz. "Kalan Manuel Adımlar" |

## 🔗 Teslim Bilgileri

### Ana kampanya (frontend'in kullandığı, uzun ömürlü)

| Alan | Değer |
|------|-------|
| **Campaign Contract ID** | [`CAGE4RJ5C4MAAWVT5I5F7XOUE25GVMWUTPXRQRIMPCEIJUD6E3DT5LR3`](https://stellar.expert/explorer/testnet/contract/CAGE4RJ5C4MAAWVT5I5F7XOUE25GVMWUTPXRQRIMPCEIJUD6E3DT5LR3) |
| **Registry Contract ID** | [`CAAW34RVSG7O2ZS6LRKDVUCD2LELEEWTC4FWROIAXR2PZH636EMZDJW6`](https://stellar.expert/explorer/testnet/contract/CAAW34RVSG7O2ZS6LRKDVUCD2LELEEWTC4FWROIAXR2PZH636EMZDJW6) |
| **Deploy işlemi (tx hash)** | [`5fa0c816...`](https://stellar.expert/explorer/testnet/tx/5fa0c816e13b6c7c5a0402ff907c9bd5ee38cef68f8d221b2211029772e2eefb) |
| **`initialize` (tx hash)** | [`ec8c51c4...`](https://stellar.expert/explorer/testnet/tx/ec8c51c4c65987ea7fdef65d6a9f190a551ff3160e385b80f404c9ff97910be4) |
| **Örnek kontrat çağrısı — `deposit` (tx hash)** | [`999380b4...`](https://stellar.expert/explorer/testnet/tx/999380b4da5ac05ab367cc8fbf50f9371d223a6120d005815803c8516723d634) |
| **Kampanya hedefi / süre** | 50 XLM · 7 gün |

### İnter-contract call kanıtı (kısa süreli test kampanyası)

Registry ile gerçek, canlı bir inter-contract call'ı testnet'te kanıtlamak için hedefi 1 XLM, süresi 70 sn olan ayrı bir kampanya deploy edildi, dolduruldu ve `claim` çağrıldı:

| Alan | Değer |
|------|-------|
| **Demo Campaign Contract ID** | [`CBYJEVF3ZBKAPLUTRHSGS6VGJNM7ZKO4YNTQVOA4E5A67EL462JTO3GL`](https://stellar.expert/explorer/testnet/contract/CBYJEVF3ZBKAPLUTRHSGS6VGJNM7ZKO4YNTQVOA4E5A67EL462JTO3GL) |
| **`claim` (tx hash) — inter-contract call tetikleyici** | [`97531e7a...`](https://stellar.expert/explorer/testnet/tx/97531e7a436301b657aba85b4f73c8d52b90691a089c354e08fc574e77596607) |

Bu tek işlem aynı anda 3 event üretti: token transferi, kampanyanın kendi `claim` event'i **ve** Registry'nin `logged` event'i (`CAAW34RVSG7O2ZS6LRKDVUCD2LELEEWTC4FWROIAXR2PZH636EMZDJW6` üzerinde) — yani kampanya sözleşmesi Registry sözleşmesini gerçekten zincir üstünde çağırdı. Doğrulama:

```bash
stellar contract invoke --id CAAW34RVSG7O2ZS6LRKDVUCD2LELEEWTC4FWROIAXR2PZH636EMZDJW6 \
  --source <herhangi-bir-hesap> --network testnet -- \
  get_result --campaign CBYJEVF3ZBKAPLUTRHSGS6VGJNM7ZKO4YNTQVOA4E5A67EL462JTO3GL
# → {"recipient":"G...","reported_at":1783605572,"success":true,"target":"10000000","total":"10000000"}
```

### Ekran görüntüleri / demo

| Alan | Değer |
|------|-------|
| **Canlı Demo (Vercel)** | `https://... (bkz. Kalan Manuel Adımlar)` |
| **Ekran görüntüsü: cüzdan seçenekleri** | `docs/wallet-options.png (ekle)` |
| **Ekran görüntüsü: bağlı cüzdan + bakiye/ilerleme** | `docs/connected-progress.png (ekle)` |
| **Ekran görüntüsü: başarılı işlem** | `docs/tx-success.png (ekle)` |
| **Ekran görüntüsü: mobil responsive UI** | `docs/mobile.png (ekle)` |
| **Ekran görüntüsü: CI pipeline çalışırken** | `docs/ci-run.png (ekle)` |
| **Ekran görüntüsü: test çıktısı (3+ geçen test)** | `docs/test-output.png (ekle)` |
| **Demo videosu (1-2 dk)** | `(ekle)` |

## ⬜ Kalan Manuel Adımlar

Aşağıdakiler tarayıcı, hesap girişi veya ekran kaydı gerektirdiği için otomatik tamamlanamadı:

1. **Vercel'e deploy** — `frontend/` dizininde `vercel` (veya Vercel dashboard'dan import) ile deploy et, `VITE_CONTRACT_ID` env değişkenini ekle (Root Directory = `frontend`), linki yukarıdaki tabloya ekle.
2. **Ekran görüntüleri** — `npm run dev` ile uygulamayı çalıştır, Freighter ile bağlan, sırasıyla: cüzdan seçenekleri modalı, bağlı+bakiye/ilerleme ekranı, başarılı işlem kutusu, tarayıcıyı daraltıp mobil görünüm, `docs/` klasörüne kaydet.
3. **CI ekran görüntüsü** — bu commit push'landıktan sonra GitHub → Actions sekmesinde çalışan pipeline'ın ekran görüntüsünü al.
4. **Test çıktısı ekran görüntüsü** — `cargo test --workspace` ve/veya `npm run test -- --run` çıktısının ekran görüntüsü.
5. **Demo videosu** — uygulamanın 1-2 dakikalık kısa bir kullanım videosu (cüzdan bağlama → bağış → sonuç).

## 🗂️ Proje Yapısı

```
Sentinel/
├─ .github/workflows/ci.yml   # CI: contract testleri/build + frontend lint/test/build
├─ contract/                  # Cargo workspace
│  ├─ src/
│  │  ├─ lib.rs               # SentinelContract: initialize/deposit/claim/refund + event + invoke_contract
│  │  └─ test.rs              # 5 test (mock registry ile inter-contract call doğrulaması dahil)
│  └─ registry/                # SentinelRegistry: bağımsız, ayrı deploy edilen sözleşme
│     └─ src/
│        ├─ lib.rs             # record/get_result/count, idempotent kayıt
│        └─ test.rs            # 3 test
└─ frontend/                  # React + TypeScript + Vite
   └─ src/
      ├─ App.tsx               # ilerleme çubuğu, aktivite akışı, işlem durumu, mobil responsive
      ├─ App.css                # @media (max-width: 480px) responsive kuralları
      └─ lib/
         ├─ wallet.ts           # StellarWalletsKit kurulumu
         ├─ errors.ts           # classifyError — saf, test edilebilir (errors.test.ts)
         ├─ stroops.ts          # stroop <-> XLM dönüşümü — saf, test edilebilir (stroops.test.ts)
         └─ contract.ts         # deposit/claim/refund/getCampaign + getRecentEvents (event streaming)
```

## 🛠️ Teknolojiler

Rust + `soroban-sdk` v22 (Cargo workspace: kampanya + registry) · React 19 + TypeScript + Vite · Vitest · `@creit.tech/stellar-wallets-kit` · `stellar-sdk` (Soroban RPC, `getEvents`) · GitHub Actions · Stellar Testnet.

## 🧪 Testler

```bash
# Kontratlar (workspace: campaign + registry) — 8 test
cd contract && cargo test --workspace

# Frontend — 7 test (stroop dönüşümü + hata sınıflandırma)
cd frontend && npm run test -- --run
```

## 🚀 Baştan Sona Kurulum

### 1) Sözleşmeler — derle, test, deploy, başlat

```bash
cd contract
rustup target add wasm32-unknown-unknown
cargo test --workspace
cargo build --workspace --target wasm32-unknown-unknown --release

stellar keys generate alice --network testnet --fund
export OWNER=$(stellar keys address alice)

# 1. Registry'yi deploy et
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_registry.wasm \
  --source alice --network testnet
export REGISTRY=<gelen_Registry_Contract_ID>

# 2. Kampanyayı deploy et
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_contract.wasm \
  --source alice --network testnet
export CID=<gelen_Campaign_Contract_ID>

stellar contract id asset --asset native --network testnet
export TOKEN=<gelen_native_SAC>

# 3. Kampanyayı başlat (registry adresini de geçir)
# Örnek: hedef 50 XLM, deadline = ileri bir unix saniye
stellar contract invoke --id $CID --source alice --network testnet -- \
  initialize --recipient $OWNER --token $TOKEN --registry $REGISTRY --target 500000000 --deadline 1767225600
```

### 2) Frontend — çalıştır

```bash
cd ../frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
# .env içine:  VITE_CONTRACT_ID=<CID>
npm run dev
```

`http://localhost:5173` → Cüzdan Bağla → Bağış Yap. Süre dolunca sahip `claim`, başarısızsa bağışçı `refund` görür. Kontrat event'leri "Canlı Aktivite" kutusunda gerçek zamanlı listelenir.

### 3) Test cüzdanı fonlama

Bağış yapabilmek için cüzdanında test XLM olmalı: https://friendbot.stellar.org adresine cüzdan adresini gir.

## 📦 Git

```bash
git remote add origin https://github.com/<kullanıcı>/sentinel.git
git push -u origin main
```

> Not: Eski (Freighter-only) frontend sürümü `frontend/_backup/App.freighter.tsx` içinde referans olarak duruyor. Vercel'e deploy ederken **Root Directory = frontend** seç ve `VITE_CONTRACT_ID` ortam değişkenini ekle.
