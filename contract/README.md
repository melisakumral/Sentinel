# Sentinel Contracts (Soroban / Rust) — Crowdfunding + Registry

Cargo workspace ile iki sözleşme:

- **`.` (sentinel-contract)** — kitle fonlama kampanyası. Bağışlar gerçek token (native XLM) olarak sözleşmede toplanır; süre sonunda hedefe ulaşıldıysa fon sahibe aktarılır, ulaşılamadıysa bağışçılar iadesini alır. `claim`/`refund` sonrası sonucu Registry'ye **inter-contract call** ile bildirir.
- **`registry/` (sentinel-registry)** — bağımsız, ayrı deploy edilen sözleşme. Herhangi bir kampanyanın nihai sonucunu idempotent şekilde kaydeder.

## Fonksiyonlar — Kampanya (`sentinel-contract`)

| Fonksiyon | Açıklama |
|-----------|----------|
| `initialize(recipient, token, registry, target, deadline)` | Kampanyayı bir kez kurar (hedef stroop, deadline unix saniye, registry sözleşme adresi). |
| `deposit(donor, amount)` | Bağışçıdan sözleşmeye `amount` token aktarır (imza gerekir). Zincire `deposit` event'i yayınlar. |
| `claim()` | Deadline sonrası hedefe ulaşıldıysa tüm fonu sahibe aktarır, `claim` event'i yayınlar, Registry'yi bilgilendirir. |
| `refund(donor)` | Deadline sonrası hedefe ulaşılamadıysa bağışçıya iade eder, `refund` event'i yayınlar, Registry'yi bilgilendirir. |
| `get_state()` | 0=Running, 1=Success, 2=Failed. |
| `get_total() / get_target() / get_deadline() / get_recipient() / get_registry() / get_contribution(addr) / is_claimed()` | Görünümler. |

> Birim: `1 XLM = 10_000_000 stroop`.

## Fonksiyonlar — Registry (`sentinel-registry`)

| Fonksiyon | Açıklama |
|-----------|----------|
| `record(campaign, recipient, total, target, success)` | Bir kampanyanın nihai sonucunu kaydeder. `campaign.require_auth()` ile yalnızca o kampanya sözleşmesi kendi adına yazabilir (contract-to-contract auth). İdempotent: ikinci çağrı yok sayılır. |
| `get_result(campaign)` | Kayıtlı sonucu döner (`Option<CampaignResult>`). |
| `count()` | Toplam kayıt sayısı. |

## Gereksinimler

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
```

## Derleme & Test

```bash
cargo test --workspace
cargo build --workspace --target wasm32-unknown-unknown --release
# Çıktı: target/wasm32-unknown-unknown/release/sentinel_contract.wasm
#        target/wasm32-unknown-unknown/release/sentinel_registry.wasm
```

> `registry/Cargo.toml` bilinçli olarak yalnızca `crate-type = ["cdylib"]` kullanır — `"rlib"` eklemek
> (örn. campaign testlerinden Rust seviyesinde import etmek için) wasm32 çıktısında Soroban host'unun
> reddettiği bir `reference-types` özelliği doğurdu. Bu yüzden campaign'in `test.rs`'i registry'yi Rust
> tipiyle değil, aynı ABI'ye sahip yerel bir `MockRegistry` ile test eder.

## Deploy (Testnet)

```bash
# 1) Kimlik oluştur ve fonla
stellar keys generate alice --network testnet --fund
export OWNER=$(stellar keys address alice)

# 2) Registry'yi deploy et
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_registry.wasm \
  --source alice --network testnet
export REGISTRY=<yukarıdan_gelen_C...>

# 3) Kampanya sözleşmesini deploy et
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_contract.wasm \
  --source alice --network testnet
export CID=<yukarıdan_gelen_C...>

# 4) Native XLM token (SAC) adresini al
stellar contract id asset --asset native --network testnet
export TOKEN=<C...native_sac>

# 5) Kampanyayı başlat (örnek: hedef 50 XLM = 500000000 stroop, deadline unix saniye)
stellar contract invoke --id $CID --source alice --network testnet -- \
  initialize --recipient $OWNER --token $TOKEN --registry $REGISTRY --target 500000000 --deadline 1767225600
```

`CID`'yi `frontend/.env` içine `VITE_CONTRACT_ID` olarak yaz.

> Eski `soroban` CLI kullanıyorsan `stellar` yerine `soroban` yazabilirsin.
