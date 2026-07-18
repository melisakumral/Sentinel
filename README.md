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

## 🥉 Level 1 Requirements — Coverage

| Requirement | Status |
|-----------|-------|
| Freighter wallet set up, Stellar Testnet | ✅ `frontend/src/lib/wallet.ts` (`WalletNetwork.TESTNET`, `FREIGHTER_ID`) |
| Wallet connect | ✅ `connectWallet()` in App.tsx |
| Wallet disconnect | ✅ `disconnect()` in App.tsx |
| Fetch the connected wallet's XLM balance | ✅ `getXlmBalance()` (`frontend/src/lib/contract.ts`) |
| Display the balance clearly in the UI | ✅ "Wallet Balance" card in App.tsx |
| Send an XLM transaction on testnet | ✅ `deposit()` — a real XLM transfer to the contract |
| Success/failure feedback shown to the user | ✅ App.tsx transaction status box |
| Transaction hash / confirmation shown | ✅ tx hash linked to stellar.expert |
| Public GitHub repo | ✅ https://github.com/melisakumral/Sentinel |

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
| Contract + frontend tests | ✅ 8 Rust tests (`cargo test --workspace`) + 49 Vitest tests (`npm run test`) = **57 tests** |
| Production-ready architecture | ✅ Cargo workspace, pure/testable modules (`stroops.ts`, `errors.ts`), CI |
| Documentation & demo presentation | ✅ This README + the delivery info below |
| Public GitHub repo | ✅ https://github.com/melisakumral/Sentinel |
| 10+ meaningful commits | ✅ See git history |
| Live demo link (Vercel etc.) | ✅ https://frontend-liart-eight-29.vercel.app |
| Screenshots (mobile, CI, test output) | ⬜ https://www.loom.com/share/990394f3fc3a4d289aecb7e18f242654|
| Demo video (1-2 min) | ⬜(https://www.loom.com/share/990394f3fc3a4d289aecb7e18f242654) |

## 💚 Level 4 Requirements — Coverage

| Requirement | Status |
|-----------|-------|
| Fully functional, production-ready MVP | ✅ Full deposit/claim/refund flow (`App.tsx`), split into a `ConnectGate` (wallet onboarding) and a `Dashboard`, plus the separate **Sentinel Watch** product |
| Stable frontend + smart contract architecture | ✅ Cargo workspace (campaign + registry) + typed React/TS, 8 Rust + 49 Vitest tests |
| Mobile-responsive UI | ✅ `@media` breakpoints across `App.css`/`WatchApp.css` — sidebar collapses to a top bar, stat grids reflow |
| Proper loading states & error handling | ✅ `classifyError()`, `loadingCampaign`/poll-error states, try/catch on every RPC call, **and** a top-level [`ErrorBoundary`](frontend/src/ErrorBoundary.tsx) that catches render crashes instead of blanking the screen |
| 10+ real users onboarded | ⬜ Manual — share the live link; see [Remaining Manual Steps](#-remaining-manual-steps) |
| Proof of wallet interactions | ⬜ Manual — collect testnet tx hashes / stellar.expert links once real users donate |
| Basic user feedback collected | ✅ mechanism: [`FeedbackButton`](frontend/src/FeedbackButton.tsx) — submits open a pre-filled GitHub issue (label `feedback`) on this public repo, no third-party form/account needed. ⬜ Manual — needs real submissions + a written summary |
| Deployed to production | ✅ https://frontend-liart-eight-29.vercel.app |
| Monitoring & analytics integration | ✅ **[Sentinel Watch](#️-sentinel-watch--soroban-monitoring-alerts--simulator)** (`frontend/src/watch/`) — live on-chain event feed, analytics (volume/actors/kinds), and threshold/frequency alerting for the deployed contract |
| Optimized UX | ✅ `ConnectGate` (animated, mouse-reactive), unified "Stellar Blue" theme across both apps, `ProfileMenu` (account/copy/explorer/disconnect) |
| Proper project structure & documentation | ✅ This README, [Project Structure](#️-project-structure) below, pure/testable modules |
| Smart contracts deployed on Stellar Testnet | ✅ see [Delivery Info](#-delivery-info) below |
| 15+ meaningful commits | ✅ See git history |
| Public GitHub repo | ✅ https://github.com/melisakumral/Sentinel |
| Live demo video | ⬜ Manual — see [Remaining Manual Steps](#-remaining-manual-steps) |

## 💙 Level 5 Requirements — Coverage

| Requirement | Status |
|-----------|-------|
| 50+ users onboarded to testnet | ⬜ Manual — see [Remaining Manual Steps](#-remaining-manual-steps) |
| Real transaction activity | ⬜ Manual — needs real users; the Activity feed / [Sentinel Watch](#️-sentinel-watch--soroban-monitoring-alerts--simulator) already surfaces every tx live once it happens |
| Proof of active usage | ⬜ Manual — stellar.expert links + Watch screenshots once real activity exists |
| New features from user feedback | ✅ so far, sourced from direct user testing in this repo's issue tracker: unified EN/TR language toggle, a single top navigation bar across all three screens (previously inconsistent/confusing), account **Profile menu**, in-app **Feedback** button. ⬜ Manual — keep iterating as real `feedback`-labeled issues come in |
| Improved UX/UI & product stability | ✅ [`TopNav`](frontend/src/TopNav.tsx) replaces three different ad-hoc navigation patterns with one; [`ErrorBoundary`](frontend/src/ErrorBoundary.tsx) for crash resilience; unified "Stellar Blue" theme end-to-end |
| Optimized onboarding experience | ✅ animated, mouse-reactive `ConnectGate` with wallet badges + non-custodial reassurance copy, now bilingual (EN/TR, auto-detected from the browser, toggle always visible in `TopNav`) |
| New features based on feedback | ✅ i18n (`frontend/src/i18n/`) and the navigation redesign above were both direct responses to user testing feedback |
| Professional pitch deck (PPT) | ✅ [Sentinel pitch deck (Canva)](https://www.canva.com/design/DAHPsLQnLiE/T-axOd-10_AiIVp6u9qdfw/edit) — problem, solution, market opportunity, architecture, growth strategy, roadmap |
| Demo video (all features + user flow) | ⬜ Manual — see [Remaining Manual Steps](#-remaining-manual-steps) |
| 20+ meaningful commits | ✅ 30 commits as of this update — see git history |
| Updated documentation | ✅ this section + [Project Structure](#️-project-structure) kept current |
| Public GitHub repo | ✅ https://github.com/melisakumral/Sentinel |
| Live deployed app | ✅ https://frontend-liart-eight-29.vercel.app |

### User onboarding data collection (Google Form → Excel)

Per the Level 5 spec, user intake needs a Google Form (wallet address, email, name,
product feedback/rating) with responses exported to Excel and linked here:

* **Feedback Collection:** [Submit Feedback via Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfiymyQYAvNo8m1g6f6vtnWcB5mggLzdIk4ofZ5GEUQmGmo6w/viewform?usp=dialog)
* **Exported Responses (Excel):** [View Raw User Feedback Data](https://docs.google.com/spreadsheets/d/19BNOJRwDtDfTMsks8S1a1hCS4pfWovSWJrJVQs0_Xjk/edit?usp=sharing) — ⬜ still a live Google Sheet; export to `.xlsx` (File → Download → Microsoft Excel) and add the file to `docs/` once there are enough real responses to summarize

### Planned next-iteration roadmap (from user feedback)

This section will summarize concrete next steps once real form/issue feedback comes
in. So far, feedback already acted on:

| Feedback | Change made | Commit |
|---|---|---|
| "The app switches between English and Turkish with no way to choose" | Added a full EN/TR i18n layer (`frontend/src/i18n/`) with a persistent toggle in `TopNav` | `(add commit link)` |
| "Moving between the campaign page and Sentinel Watch is confusing, this UI is too cluttered" | Added a single shared `TopNav` (logo, Overview/Watch links, language toggle) used identically on all three screens, replacing three inconsistent nav patterns | `(add commit link)` |

## ⭐ Level 6 Requirements — Coverage

> **Mainnet note**: everything below that involves real funds — deploying the
> contracts to Stellar **mainnet**, funding a sponsor account, onboarding real
> users — has to be executed by the project owner with their own keys. Code
> and infrastructure are prepared and ready; no agent/assistant should (or
> can) hold the mainnet signing keys or spend real XLM on the owner's behalf.

| Requirement | Status |
|-----------|-------|
| Smart contracts deployed on Stellar mainnet | ⬜ Manual — testnet deployment workflow (below) is proven; mainnet deploy is the same commands against `--network mainnet` with a real funded key, run by the owner. See [Remaining Manual Steps](#-remaining-manual-steps) |
| Public, ready-to-use app live | ⬜ Manual — same Vercel deploy as Level 4/5, pointed at the mainnet contract ID once deployed |
| 20+ verified mainnet users | ⬜ Manual |
| Real on-chain transaction activity | ⬜ Manual — the Activity feed and [Sentinel Watch](#️-sentinel-watch--soroban-monitoring-alerts--simulator) work against any contract ID, mainnet included, so activity is visible live once it exists |
| Smart contract audit **or** team-approved security review | ⬜ Manual — see [Security review](#security-review) below for a starting self-review; a formal audit/approval still needs a human signature |
| Social media launch post (Twitter/X) | ⬜ Manual — draft ready, see [Remaining Manual Steps](#-remaining-manual-steps) |
| Promotional/showcase content | ⬜ Manual |
| Ecosystem contribution (blog / workshop / video / OSS / community session) | ⬜ Manual — this README itself doubles as technical documentation; a dedicated blog post is drafted, see Remaining Manual Steps |
| 30+ meaningful commits | ✅ 30 commits as of this update — see git history |
| Complete documentation & production setup | ✅ this README, [Project Structure](#️-project-structure), [Fee Sponsorship](#-black-belt-fee-sponsorship-gasless-transactions) setup docs below |
| Public GitHub repo | ✅ https://github.com/melisakumral/Sentinel |

### Security review

Self-review notes ahead of a formal audit/team sign-off (updates as the
review deepens):

- **Contracts** (`contract/src/lib.rs`, `contract/registry/src/lib.rs`): `initialize` is a one-time guard (`Already initialized` panic on re-call); `deposit`/`claim`/`refund` all check the deadline/goal/claimed state server-side (in the contract) before moving funds, not just in the frontend; the Registry's `record()` is idempotent by design so a duplicate `refund` call can't double-report. No `unwrap()` on user-controlled input in the write paths (checked during Level 3).
- **Frontend → contract boundary**: every write reads `getAccount`/`prepareTransaction` fresh per call rather than trusting cached state, so a stale UI can't submit a transaction the contract itself would reject.
- **New in this level — Fee Sponsorship** (`frontend/api/sponsor-fee-bump.ts`): the sponsor's secret key lives only in a server-side env var (never `VITE_`-prefixed, never bundled to the client). The endpoint independently re-parses the signed transaction and rejects anything that isn't a single-operation call to *this* deployment's `CONTRACT_ID` on the `deposit`/`claim`/`refund` allowlist — see [`validateSponsorable.ts`](frontend/api/_lib/validateSponsorable.ts) and its [tests](frontend/api/_lib/validateSponsorable.test.ts) — so the endpoint can't be repurposed to sponsor arbitrary transactions. The sponsor's exposure is capped by a fixed per-transaction fee (`SPONSOR_FEE`, 0.1 XLM) and by how much the sponsor account itself is funded with.
- **Still needed**: a second set of eyes (formal audit or advisor/team review) before mainnet — this self-review does not satisfy the Level 6 requirement on its own.

### ⭐ Black Belt: Fee Sponsorship (gasless transactions)

The chosen advanced feature: donors can `deposit`/`claim`/`refund` without
holding any XLM to cover the network fee, via a Stellar [CAP-15 fee-bump
transaction](https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/fee-bump-transactions).

**How it works**: the donor still builds, simulates, and signs the exact same
Soroban invocation as always (their wallet still authorizes the operation —
this is *not* a way to move their funds without consent). The signed
transaction is sent to [`/api/sponsor-fee-bump`](frontend/api/sponsor-fee-bump.ts),
a Vercel serverless function that wraps it in a fee-bump transaction paid for
by a dedicated sponsor account, signs it with the sponsor's key, and submits
it. The donor's own account is never charged a fee.

```
Donor wallet ──sign(inner tx)──▶ /api/sponsor-fee-bump ──wrap + sign(fee-bump)──▶ Soroban RPC
                                        │
                                        └─ rejects anything that isn't
                                           deposit/claim/refund on CONTRACT_ID
```

**Enable it** (optional — the app works normally without it; the "Gasless"
checkbox just shows a clear error if unconfigured):

1. Generate a dedicated sponsor keypair: `stellar keys generate sponsor --network testnet --fund` (or `stellar keys address sponsor` + fund via friendbot).
2. In the Vercel project settings, add an environment variable **`SPONSOR_SECRET_KEY`** with the sponsor's secret (`S...`) — **never** commit this, and never prefix it `VITE_` (that would ship it to the browser).
3. Keep the sponsor account funded — each sponsored transaction costs it up to `SPONSOR_FEE` (0.1 XLM, see `frontend/api/sponsor-fee-bump.ts`).
4. Redeploy. The "Gasless (sponsored fee)" checkbox in the donation panel will start working; `VITE_CONTRACT_ID` is reused server-side to scope which contract can be sponsored.

## 🚀 Level 7 Requirements — Coverage

> Founder Belt is explicitly about running this as a real, ongoing product —
> growth, retention, and community, not a one-time submission. The items
> below that need real users, followers, or social posts genuinely can't be
> produced by an assistant; they're listed so the gap is honest and
> trackable, not skipped.

| Requirement | Status |
|-----------|-------|
| Public GitHub repo | ✅ https://github.com/melisakumral/Sentinel |
| 30+ meaningful commits | ✅ 30 as of this update — see git history; grows with every real iteration |
| Live production app | ⬜ Manual — see [Remaining Manual Steps](#-remaining-manual-steps); `vercel.json` + docs are ready |
| Proof of 50+ new mainnet users | ⬜ Manual — needs a mainnet deployment first (Level 6) |
| Mainnet transaction proof | ⬜ Manual — Activity feed / Sentinel Watch already surface it live once it exists |
| User feedback form | ✅ in-app [`FeedbackButton`](frontend/src/FeedbackButton.tsx) (Level 4) + the [Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfiymyQYAvNo8m1g6f6vtnWcB5mggLzdIk4ofZ5GEUQmGmo6w/viewform?usp=dialog) (Level 5/6) — both funnel into the same feedback loop |
| Product development commitment links | ⬜ Manual — link real commits against real feedback as they land (see the roadmap table below) |
| Monthly growth report | ⬜ Manual — template started below |
| Social growth proof (50+ followers) | ⬜ Manual |
| Product update posts | ⬜ Manual |
| Community contribution proof | ⬜ Manual — carried over from Level 6 |
| Updated documentation | ✅ this README, kept current every level |

### Monthly growth report (template)

Fill in once real usage exists — this is the running record the level asks for:

| Month | New users | Transactions | Notes |
|---|---|---|---|
| `(e.g. 2026-08)` | `(add)` | `(add)` | `(add)` |

### Product commitments (feedback → shipped)

Extends the [Level 5 roadmap table](#planned-next-iteration-roadmap-from-user-feedback) with links once real feedback drives a change:

| Feedback / request | Change | Commit |
|---|---|---|
| `(add as real feedback comes in)` | | |

## 🛰️ Sentinel Watch — Soroban Monitoring, Alerts & Simulator

Alongside the crowdfunding app, `frontend/src/watch/` is a second, self-contained
frontend module with its own "mission control" visual identity (amber/cyan on
near-black, sidebar navigation) — a lightweight "Tenderly for Stellar": live
monitoring, alerting, and transaction dry-runs for **any** Soroban contract, not
just Sentinel's own. Reachable at `#/watch` (a link is shown at the bottom of
the main app), it's a genuinely separate app sharing only the wallet kit and
RPC endpoint config.

| Panel | What it does |
|---|---|
| 📡 **Event Feed** | Polls `getEvents` every 6s for any Contract ID you enter, decoding topics/value on a best-effort basis (contract-agnostic — no fixed event schema) |
| 📊 **Analytics** | Computed client-side from the fetched window: event counts by kind, unique actors, total volume, a cumulative-volume sparkline (hand-rolled SVG, no chart library) |
| 🚨 **Alerts** | User-defined **threshold** rules (`"deposit" > 500 XLM`) and **frequency** rules (`5+ "refund" events in 60s`), evaluated live against incoming events, persisted per-contract in `localStorage`; fires in-app toasts + optional browser `Notification`s |
| 🧪 **Simulator** | Dry-runs any `contract.call(fn, ...args)` via the Soroban RPC's `simulateTransaction` — typed argument encoding (address/string/symbol/bool/u32…i128), no signature, no fee, no state change. "Simulate as" any funded testnet address, not just your own wallet |

Pure logic (`argEncoding.ts`, `alertRules.ts`, `format.ts`) is unit-tested the
same way as the rest of the frontend (`frontend/src/watch/lib/*.test.ts`);
network calls (`sorobanWatch.ts`) follow `lib/contract.ts`'s existing pattern
and are exercised manually against testnet.

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
| **Live Demo (Vercel)** | [frontend-liart-eight-29.vercel.app](https://frontend-liart-eight-29.vercel.app) |
| **Pitch deck (Canva)** | [View / edit](https://www.canva.com/design/DAHPsLQnLiE/T-axOd-10_AiIVp6u9qdfw/edit) |
| **Google Form (user onboarding)** | [Open form](https://docs.google.com/forms/d/e/1FAIpQLSfiymyQYAvNo8m1g6f6vtnWcB5mggLzdIk4ofZ5GEUQmGmo6w/viewform?usp=dialog) |
| **Form responses (Google Sheet)** | [Open sheet](https://docs.google.com/spreadsheets/d/19BNOJRwDtDfTMsks8S1a1hCS4pfWovSWJrJVQs0_Xjk/edit?resourcekey=&gid=1781705798#gid=1781705798) |
| **Screenshot: wallet options** | `docs/wallet-options.png (add)` |
| **Screenshot: connected wallet + balance/progress** | `docs/connected-progress.png (add)` |
| **Screenshot: successful transaction** | `docs/tx-success.png (add)` |
| **Screenshot: mobile responsive UI** | `docs/mobile.png (add)` |
| **Screenshot: CI pipeline running** | `docs/ci-run.png (add)` |
| **Screenshot: test output (3+ passing tests)** | `docs/test-output.png (add)` |
| **Demo video (1-2 min)** | `(add)` |

## ⬜ Remaining Manual Steps

The following couldn't be automated because they require a browser, an account login, real third-party users, or screen recording:

1. ~~**Deploy to Vercel**~~ — ✅ done: https://frontend-liart-eight-29.vercel.app (Root Directory = `frontend`, `VITE_CONTRACT_ID` set, GitHub repo connected for auto-deploy on every push to `main`).
2. **Screenshots** — run the app with `npm run dev`, connect with Freighter, capture in order: the wallet-options modal, the connected+balance/progress screen, the successful-transaction box, the `#/watch` monitoring dashboard, then narrow the browser for the mobile view, and save to `docs/`.
3. **CI screenshot** — after this commit is pushed, screenshot the running pipeline on GitHub's Actions tab.
4. **Test output screenshot** — screenshot the output of `cargo test --workspace` and/or `npm run test -- --run`.
5. **Demo video** — a short walkthrough of the app (connect wallet → donate → result → Sentinel Watch).
6. **Onboard 10+ real users (Level 4)** — share the deployed link; each donor's `deposit`/`claim`/`refund` transaction is a real, on-chain proof of interaction — collect the stellar.expert links (the Activity feed in the app already lists them).
7. **Collect & summarize feedback (Level 4)** — point users at the in-app **Feedback** button (opens a GitHub issue labeled `feedback`); once a few come in, write a short summary here or in a `docs/feedback-summary.md`.
8. **Onboard 50+ users (Level 5)** — broader promotion of the live link than Level 4; same on-chain proof mechanism (Activity feed + Sentinel Watch), just more of it.
9. **Google Form + Excel export (Level 5)** — ✅ form created and linked above ([form](https://docs.google.com/forms/d/e/1FAIpQLSfiymyQYAvNo8m1g6f6vtnWcB5mggLzdIk4ofZ5GEUQmGmo6w/viewform?usp=dialog), [responses sheet](https://docs.google.com/spreadsheets/d/19BNOJRwDtDfTMsks8S1a1hCS4pfWovSWJrJVQs0_Xjk/edit?resourcekey=&gid=1781705798#gid=1781705798)); still ⬜ export the sheet to `.xlsx` once there are enough real responses, and add the file to `docs/`.
10. **Pitch deck (Level 5)** — ✅ done, linked in the [Level 5 table](#-level-5-requirements--coverage) and [Delivery Info](#-delivery-info) above.
11. **Level 5 demo video** — a walkthrough covering every feature (not just the happy path) plus a real user flow.
12. **Fill in the next-iteration roadmap table (Level 5)** — once real feedback/issues come in, record what changed and link the commit, in the table above.
13. **Deploy contracts to mainnet (Level 6)** — same `stellar contract deploy`/`initialize` workflow as [Full Setup](#-full-setup) below, but with `--network mainnet` and a real, funded mainnet key (`stellar keys generate <name> --network mainnet`, funded from an exchange/on-ramp — friendbot doesn't exist on mainnet). **Must be run by the project owner**, not an assistant/agent — it spends real XLM and the resulting contract will hold real user funds.
14. **Deploy the app pointed at mainnet (Level 6)** — new (or updated) Vercel deployment with `VITE_CONTRACT_ID` set to the mainnet contract ID.
15. **Fund a mainnet sponsor account (Level 6, optional)** — only if enabling [Fee Sponsorship](#-black-belt-fee-sponsorship-gasless-transactions) on mainnet; same setup as testnet but with real XLM and mainnet's `SPONSOR_SECRET_KEY`.
16. **Onboard 20+ verified mainnet users (Level 6)** — same on-chain proof mechanism as Levels 4/5, now on mainnet.
17. **Audit or security review sign-off (Level 6)** — the [Security review](#security-review) section above is a starting self-review, not a substitute for a formal audit or advisor/team approval.
18. **Twitter/X launch post (Level 6)** — draft, then post from the project's own account, and link it in the checklist.
19. **Ecosystem contribution (Level 6)** — pick one: technical blog post, workshop, educational video, OSS contribution, or community session; link it once published.
20. **Reuse the Google Form for Level 6** — the same form/Excel export from Level 5 already collects wallet address, email, name, and feedback; keep it running and re-export as mainnet users join.
21. **Onboard 50+ new mainnet users (Level 7)** — same on-chain proof mechanism, now with a retention/growth lens rather than a one-time count.
22. **Monthly growth report (Level 7)** — fill in the [Monthly growth report](#monthly-growth-report-template) table above once real usage data exists.
23. **Grow social following to 50+ (Level 7)** and **post product updates** — pick one channel (Twitter/X is the one already referenced in Level 6) and post consistently; link posts in the checklist.
24. **Community contribution (Level 7)** — same options as Level 6 (blog/workshop/video/OSS/community session); can reuse the Level 6 one if still relevant, or do a fresh one for this level.

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
   ├─ api/                     # Vercel serverless functions (Node, not part of the Vite bundle)
   │  ├─ sponsor-fee-bump.ts    # Black Belt: wraps a signed tx in a sponsor-paid fee-bump transaction
   │  └─ _lib/validateSponsorable.ts  # pure allowlist check (+ .test.ts) — the anti-abuse guard
   └─ src/
      ├─ Root.tsx              # hash router: '#/watch' -> WatchApp, else -> App
      ├─ App.tsx               # ConnectGate (not connected) or Dashboard (connected)
      ├─ ConnectGate.tsx       # split-screen wallet onboarding, mouse-reactive particle field
      ├─ TopNav.tsx            # shared nav bar (Overview/Watch links + EN/TR toggle) on all 3 screens
      ├─ ProfileMenu.tsx       # account dropdown: address, copy, explorer link, disconnect
      ├─ FeedbackButton.tsx    # Level 4 feedback collection -> pre-filled GitHub issue
      ├─ ErrorBoundary.tsx     # top-level render-crash fallback (Reload / Report issue)
      ├─ Logo.tsx, icons.tsx   # shared SVG brand mark + icon set (no emoji, no icon-font dep)
      ├─ App.css               # shared "Stellar Blue" theme + responsive rules
      ├─ i18n/                 # EN/TR translations, LanguageContext/useLanguage
      ├─ lib/
      │  ├─ wallet.ts           # StellarWalletsKit setup
      │  ├─ errors.ts           # classifyError — pure, testable (errors.test.ts)
      │  ├─ stroops.ts          # stroop <-> XLM conversion — pure, testable (stroops.test.ts)
      │  └─ contract.ts         # deposit/claim/refund (+ Sponsored variants), getCampaign, getRecentEvents
      └─ watch/                 # Sentinel Watch — see the section above
         ├─ WatchApp.tsx / .css
         ├─ components/         # EventFeedPanel, AnalyticsPanel, AlertsPanel, SimulatorPanel
         └─ lib/                # sorobanWatch.ts, alertRules.ts, argEncoding.ts, format.ts (+ *.test.ts)
```

## 🛠️ Tech Stack

Rust + `soroban-sdk` v22 (Cargo workspace: campaign + registry) · React 19 + TypeScript + Vite · Vitest · `@creit.tech/stellar-wallets-kit` · `stellar-sdk` (Soroban RPC, `getEvents`, fee-bump transactions) · Vercel serverless functions (fee sponsorship) · GitHub Actions · Stellar Testnet.

## 🧪 Tests

```bash
# Contracts (workspace: campaign + registry) — 8 tests
cd contract && cargo test --workspace

# Frontend — 49 tests (stroop conversion, error classification, Watch's pure
# libs, and the fee-sponsorship allowlist guard)
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
