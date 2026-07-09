# Sentinel Contract (Soroban / Rust) — Crowdfunding

Testnet üzerinde çalışan bir **kitle fonlama** sözleşmesi. Bağışlar gerçek token (native XLM) olarak sözleşmede toplanır; süre sonunda hedefe ulaşıldıysa fon sahibe aktarılır, ulaşılamadıysa bağışçılar iadesini alır.

## Fonksiyonlar

| Fonksiyon | Açıklama |
|-----------|----------|
| `initialize(recipient, token, target, deadline)` | Kampanyayı bir kez kurar (hedef stroop, deadline unix saniye). |
| `deposit(donor, amount)` | Bağışçıdan sözleşmeye `amount` token aktarır (imza gerekir). |
| `claim()` | Deadline sonrası hedefe ulaşıldıysa tüm fonu sahibe aktarır. |
| `refund(donor)` | Deadline sonrası hedefe ulaşılamadıysa bağışçıya iade eder. |
| `get_state()` | 0=Running, 1=Success, 2=Failed. |
| `get_total() / get_target() / get_deadline() / get_recipient() / get_contribution(addr) / is_claimed()` | Görünümler. |

> Birim: `1 XLM = 10_000_000 stroop`.

## Gereksinimler

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
```

## Derleme & Test

```bash
cargo test
cargo build --target wasm32-unknown-unknown --release
# Çıktı: target/wasm32-unknown-unknown/release/sentinel_contract.wasm
```

## Deploy (Testnet)

```bash
# 1) Kimlik oluştur ve fonla
stellar keys generate --global alice --network testnet --fund
export OWNER=$(stellar keys address alice)

# 2) Sözleşmeyi yükle -> Contract ID (C...) alırsın
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_contract.wasm \
  --source alice --network testnet
export CID=<yukarıdan_gelen_C...>

# 3) Native XLM token (SAC) adresini al
stellar contract id asset --asset native --network testnet
export TOKEN=<C...native_sac>

# 4) Kampanyayı başlat (örnek: hedef 50 XLM = 500000000 stroop, deadline unix saniye)
stellar contract invoke --id $CID --source alice --network testnet -- \
  initialize --recipient $OWNER --token $TOKEN --target 500000000 --deadline 1767225600
```

`CID`'yi `frontend/.env` içine `VITE_CONTRACT_ID` olarak yaz.

> Eski `soroban` CLI kullanıyorsan `stellar` yerine `soroban` yazabilirsin.
