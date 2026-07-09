# 🪐 Sentinel — Decentralized Crowdfunding

![CI](https://github.com/melisakumral/Sentinel/actions/workflows/ci.yml/badge.svg)

Sentinel is a **crowdfunding** dApp running on Stellar/Soroban. A project owner sets a funding goal and a deadline; donors connect their wallet and send XLM directly to the contract. Once the deadline passes:

- **If the goal was reached** → funds are transferred to the project owner (`claim`).
- **If it wasn't** → donations are automatically refunded to each donor (`refund`).

In both cases, the campaign contract reports the final outcome to a separate **Sentinel Registry** contract via a real inter-contract call. No middleman, every action is transparent on-chain, and the whole process is automated by smart contracts.

## 🏗️ Architecture

```
                 deposit / claim / refund
   Donor ──────────────────────────────────▶  Sentinel Campaign (contract/)
                                                  │  │
                                          token   │  │  invoke_contract("record", …)
                                        transfer   │  │  (after claim/refund)
                                                  ▼  ▼
                                     Native XLM SAC   Sentinel Registry (contract/registry/)
                                                          │
                                                          ▼
                                            idempotent record: campaign → {recipient, total, target, success}
```

- **`contract/`** — the campaign contract (`SentinelContract`). Publishes on-chain **events** during `deposit`/`claim`/`refund` (`env.events().publish`) and reports the outcome to the Registry via a real **inter-contract call** after `claim`/`refund` (`env.invoke_contract` — no compile-time dependency, only coupled through the ABI).
- **`contract/registry/`** — an independent, separately deployed **Sentinel Registry** contract (`SentinelRegistry`). `record(...)` is **idempotent**: the first record for a campaign is permanent, later calls (e.g. each donor's separate `refund`) are ignored.
- **`frontend/`** — React + TypeScript. Contract state is polled every 8s; contract events are also streamed via the `getEvents` RPC every 6s to power a real-time **Activity Feed**.
- **`.github/workflows/ci.yml`** — every push/PR runs the contract suite (`cargo test --workspace`, wasm build) and the frontend suite (`lint`, `vitest`, `tsc`+`vite build`).

## 🏆 Level 2 Requirements — Coverage

| Requirement | Status |
|-----------|-------|
| Multi-wallet via StellarWalletsKit | ✅ `frontend/src/lib/wallet.ts` |
| 3 error types (wallet not found, rejected, insufficient balance) | ✅ `classifyError()` (`frontend/src/lib/errors.ts`) |
| Contract deployed on testnet | ✅ Contract ID below |
| Calling the contract from the frontend (deposit/claim/refund) | ✅ `frontend/src/lib/contract.ts` |
| Transaction status visible (pending/success/fail) | ✅ App.tsx status box |
| Real-time tracking (event/state sync) | ✅ 8s state polling + progress bar |
| 2+ meaningful commits | ✅ See git history |

## 🥇 Level 3 Requirements — Coverage

| Requirement | Status |
|-----------|-------|
| Advanced smart contract logic | ✅ Campaign + Registry, idempotent recording, event publishing |
| Inter-contract communication | ✅ `env.invoke_contract`, verified live on testnet (see `claim` tx below) |
| Event streaming & real-time updates | ✅ `getEvents` polling → Activity Feed (`frontend/src/lib/contract.ts` → `getRecentEvents`) |
| CI/CD pipeline | ✅ `.github/workflows/ci.yml` (contract + frontend jobs) |
| Smart contract deployment workflow | ✅ `stellar contract deploy`/`invoke` steps below, real deployment |
| Mobile-responsive frontend | ✅ `app-shell`/`app-card` + `@media (max-width: 480px)` (`frontend/src/App.css`) |
| Error handling & loading states | ✅ `classifyError`, `loadingCampaign` state, transaction status box |
| Contract + frontend tests | ✅ 8 Rust tests (`cargo test --workspace`) + 7 Vitest tests (`npm run test`) = **15 tests** |
| Production-ready architecture | ✅ Cargo workspace, pure/testable modules (`stroops.ts`, `errors.ts`), CI |
| Documentation & demo presentation | ✅ This README + the delivery info below |
| Public GitHub repo | ✅ https://github.com/melisakumral/Sentinel |
| 10+ meaningful commits | ✅ See git history |
| Live demo link (Vercel etc.) | ⬜ Manual — see "Remaining Manual Steps" |
| Screenshots (mobile, CI, test output) | ⬜ Manual — see "Remaining Manual Steps" |
| Demo video (1-2 min) | ⬜ Manual — see "Remaining Manual Steps" |

## 🔗 Delivery Info

### Main campaign (the one the frontend uses, long-lived)

| Field | Value |
|------|-------|
| **Campaign Contract ID** | [`CAGE4RJ5C4MAAWVT5I5F7XOUE25GVMWUTPXRQRIMPCEIJUD6E3DT5LR3`](https://stellar.expert/explorer/testnet/contract/CAGE4RJ5C4MAAWVT5I5F7XOUE25GVMWUTPXRQRIMPCEIJUD6E3DT5LR3) |
| **Registry Contract ID** | [`CAAW34RVSG7O2ZS6LRKDVUCD2LELEEWTC4FWROIAXR2PZH636EMZDJW6`](https://stellar.expert/explorer/testnet/contract/CAAW34RVSG7O2ZS6LRKDVUCD2LELEEWTC4FWROIAXR2PZH636EMZDJW6) |
| **Deploy transaction (tx hash)** | [`5fa0c816...`](https://stellar.expert/explorer/testnet/tx/5fa0c816e13b6c7c5a0402ff907c9bd5ee38cef68f8d221b2211029772e2eefb) |
| **`initialize` (tx hash)** | [`ec8c51c4...`](https://stellar.expert/explorer/testnet/tx/ec8c51c4c65987ea7fdef65d6a9f190a551ff3160e385b80f404c9ff97910be4) |
| **Sample contract call — `deposit` (tx hash)** | [`999380b4...`](https://stellar.expert/explorer/testnet/tx/999380b4da5ac05ab367cc8fbf50f9371d223a6120d005815803c8516723d634) |
| **Campaign goal / duration** | 50 XLM · 7 days |

### Proof of inter-contract call (short-lived test campaign)

To prove a real, live inter-contract call to the Registry on testnet, a separate campaign was deployed with a 1 XLM goal and a 70-second deadline, funded, and then `claim`ed:

| Field | Value |
|------|-------|
| **Demo Campaign Contract ID** | [`CBYJEVF3ZBKAPLUTRHSGS6VGJNM7ZKO4YNTQVOA4E5A67EL462JTO3GL`](https://stellar.expert/explorer/testnet/contract/CBYJEVF3ZBKAPLUTRHSGS6VGJNM7ZKO4YNTQVOA4E5A67EL462JTO3GL) |
| **`claim` (tx hash) — inter-contract call trigger** | [`97531e7a...`](https://stellar.expert/explorer/testnet/tx/97531e7a436301b657aba85b4f73c8d52b90691a089c354e08fc574e77596607) |

This single transaction produced 3 events at once: the token transfer, the campaign's own `claim` event, **and** the Registry's `logged` event (on `CAAW34RVSG7O2ZS6LRKDVUCD2LELEEWTC4FWROIAXR2PZH636EMZDJW6`) — meaning the campaign contract genuinely called the Registry contract on-chain. Verification:

```bash
stellar contract invoke --id CAAW34RVSG7O2ZS6LRKDVUCD2LELEEWTC4FWROIAXR2PZH636EMZDJW6 \
  --source <any-account> --network testnet -- \
  get_result --campaign CBYJEVF3ZBKAPLUTRHSGS6VGJNM7ZKO4YNTQVOA4E5A67EL462JTO3GL
# → {"recipient":"G...","reported_at":1783605572,"success":true,"target":"10000000","total":"10000000"}
```

### Screenshots / demo

| Field | Value |
|------|-------|
| **Live Demo (Vercel)** | `https://... (see Remaining Manual Steps)` |
| **Screenshot: wallet options** | `docs/wallet-options.png (add)` |
| **Screenshot: connected wallet + balance/progress** | `docs/connected-progress.png (add)` |
| **Screenshot: successful transaction** | `docs/tx-success.png (add)` |
| **Screenshot: mobile responsive UI** | `docs/mobile.png (add)` |
| **Screenshot: CI pipeline running** | `docs/ci-run.png (add)` |
| **Screenshot: test output (3+ passing tests)** | `docs/test-output.png (add)` |
| **Demo video (1-2 min)** | `(add)` |

## ⬜ Remaining Manual Steps

The following couldn't be automated because they require a browser, an account login, or screen recording:

1. **Deploy to Vercel** — deploy `frontend/` with `vercel` (or import via the Vercel dashboard), add the `VITE_CONTRACT_ID` env var (Root Directory = `frontend`), add the link to the table above.
2. **Screenshots** — run the app with `npm run dev`, connect with Freighter, capture in order: the wallet-options modal, the connected+balance/progress screen, the successful-transaction box, then narrow the browser for the mobile view, and save to `docs/`.
3. **CI screenshot** — after this commit is pushed, screenshot the running pipeline on GitHub's Actions tab.
4. **Test output screenshot** — screenshot the output of `cargo test --workspace` and/or `npm run test -- --run`.
5. **Demo video** — a short 1-2 minute walkthrough of the app (connect wallet → donate → result).

## 🗂️ Project Structure

```
Sentinel/
├─ .github/workflows/ci.yml   # CI: contract tests/build + frontend lint/test/build
├─ contract/                  # Cargo workspace
│  ├─ src/
│  │  ├─ lib.rs               # SentinelContract: initialize/deposit/claim/refund + events + invoke_contract
│  │  └─ test.rs              # 5 tests (including inter-contract call verification via a mock registry)
│  └─ registry/                # SentinelRegistry: independent, separately deployed contract
│     └─ src/
│        ├─ lib.rs             # record/get_result/count, idempotent recording
│        └─ test.rs            # 3 tests
└─ frontend/                  # React + TypeScript + Vite
   └─ src/
      ├─ App.tsx               # progress bar, activity feed, transaction status, mobile responsive
      ├─ App.css                # @media (max-width: 480px) responsive rules
      └─ lib/
         ├─ wallet.ts           # StellarWalletsKit setup
         ├─ errors.ts           # classifyError — pure, testable (errors.test.ts)
         ├─ stroops.ts          # stroop <-> XLM conversion — pure, testable (stroops.test.ts)
         └─ contract.ts         # deposit/claim/refund/getCampaign + getRecentEvents (event streaming)
```

## 🛠️ Tech Stack

Rust + `soroban-sdk` v22 (Cargo workspace: campaign + registry) · React 19 + TypeScript + Vite · Vitest · `@creit.tech/stellar-wallets-kit` · `stellar-sdk` (Soroban RPC, `getEvents`) · GitHub Actions · Stellar Testnet.

## 🧪 Tests

```bash
# Contracts (workspace: campaign + registry) — 8 tests
cd contract && cargo test --workspace

# Frontend — 7 tests (stroop conversion + error classification)
cd frontend && npm run test -- --run
```

## 🚀 Full Setup

### 1) Contracts — build, test, deploy, initialize

```bash
cd contract
rustup target add wasm32-unknown-unknown
cargo test --workspace
cargo build --workspace --target wasm32-unknown-unknown --release

stellar keys generate alice --network testnet --fund
export OWNER=$(stellar keys address alice)

# 1. Deploy the registry
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_registry.wasm \
  --source alice --network testnet
export REGISTRY=<resulting_Registry_Contract_ID>

# 2. Deploy the campaign
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sentinel_contract.wasm \
  --source alice --network testnet
export CID=<resulting_Campaign_Contract_ID>

stellar contract id asset --asset native --network testnet
export TOKEN=<resulting_native_SAC>

# 3. Initialize the campaign (pass the registry address too)
# Example: 50 XLM goal, deadline = a future unix timestamp
stellar contract invoke --id $CID --source alice --network testnet -- \
  initialize --recipient $OWNER --token $TOKEN --registry $REGISTRY --target 500000000 --deadline 1767225600
```

### 2) Frontend — run it

```bash
cd ../frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
# in .env:  VITE_CONTRACT_ID=<CID>
npm run dev
```

`http://localhost:5173` → Connect Wallet → Donate. Once the deadline passes, the owner sees `claim`; if the goal wasn't met, donors see `refund`. Contract events are listed in real time in the "Live Activity" box.

### 3) Fund a test wallet

To donate you need test XLM in your wallet: enter your wallet address at https://friendbot.stellar.org.

## 📦 Git

```bash
git remote add origin https://github.com/<user>/sentinel.git
git push -u origin main
```

> Note: the old (Freighter-only) frontend version is kept for reference in `frontend/_backup/App.freighter.tsx`. When deploying to Vercel, set **Root Directory = frontend** and add the `VITE_CONTRACT_ID` environment variable.
