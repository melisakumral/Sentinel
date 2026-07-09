# Sentinel Contracts (Soroban / Rust) — Crowdfunding + Registry

A Cargo workspace with two contracts:

- **`.` (sentinel-contract)** — the crowdfunding campaign. Donations are collected in real token (native XLM) by the contract; once the deadline passes, funds go to the owner if the goal was reached, or donors get refunded if it wasn't. After `claim`/`refund` it reports the outcome to the Registry via an **inter-contract call**.
- **`registry/` (sentinel-registry)** — an independent, separately deployed contract. Records the final outcome of any campaign, idempotently.

## Functions — Campaign (`sentinel-contract`)

| Function | Description |
|-----------|----------|
| `initialize(recipient, token, registry, target, deadline)` | Sets up the campaign once (goal in stroops, deadline as a unix timestamp, registry contract address). |
| `deposit(donor, amount)` | Transfers `amount` of the token from the donor to the contract (requires signature). Publishes a `deposit` event on-chain. |
| `claim()` | After the deadline, if the goal was reached, transfers all funds to the owner, publishes a `claim` event, and notifies the Registry. |
| `refund(donor)` | After the deadline, if the goal wasn't reached, refunds the donor, publishes a `refund` event, and notifies the Registry. |
| `get_state()` | 0=Running, 1=Success, 2=Failed. |
| `get_total() / get_target() / get_deadline() / get_recipient() / get_registry() / get_contribution(addr) / is_claimed()` | Read-only views. |

> Unit: `1 XLM = 10_000_000 stroops`.

## Functions — Registry (`sentinel-registry`)

| Function | Description |
|-----------|----------|
| `record(campaign, recipient, total, target, success)` | Records a campaign's final outcome. `campaign.require_auth()` ensures only that campaign contract can write on its own behalf (contract-to-contract auth). Idempotent: a second call is ignored. |
| `get_result(campaign)` | Returns the recorded result (`Option<CampaignResult>`). |
| `count()` | Total number of records. |

## Requirements

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
```

## Build & Test

```bash
cargo test --workspace
cargo build --workspace --target wasm32-unknown-unknown --release
# Output: target/wasm32-unknown-unknown/release/sentinel_contract.wasm
#         target/wasm32-unknown-unknown/release/sentinel_registry.wasm
```

> `registry/Cargo.toml` deliberately uses only `crate-type = ["cdylib"]` — adding `"rlib"`
> (e.g. to import it at the Rust level from the campaign's tests) produced a `reference-types`
> wasm feature that the Soroban host rejects. Because of that, the campaign's `test.rs` tests
> the inter-contract call against a local `MockRegistry` sharing the same ABI, instead of
> importing the registry crate's Rust type.

## Deploy (Testnet)

```bash
# 1) Create and fund an identity
stellar keys generate alice --network testnet --fund
export OWNER=$(stellar keys address alice)

# 2) Deploy the registry
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_registry.wasm \
  --source alice --network testnet
export REGISTRY=<resulting_C...>

# 3) Deploy the campaign contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_contract.wasm \
  --source alice --network testnet
export CID=<resulting_C...>

# 4) Get the native XLM token (SAC) address
stellar contract id asset --asset native --network testnet
export TOKEN=<C...native_sac>

# 5) Initialize the campaign (example: 50 XLM goal = 500000000 stroops, deadline as a unix timestamp)
stellar contract invoke --id $CID --source alice --network testnet -- \
  initialize --recipient $OWNER --token $TOKEN --registry $REGISTRY --target 500000000 --deadline 1767225600
```

Write `CID` into `frontend/.env` as `VITE_CONTRACT_ID`.

> If you're using the older `soroban` CLI, use `soroban` instead of `stellar`.
