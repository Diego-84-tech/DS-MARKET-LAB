# DS Market Lab — 0.9.0 cloud paper experiment

DS TECHNOLOGY™ · Real Kalshi public data, OpenAI research decisions, FAKE money only.

## Runtime and release

Node 24, `npm ci`, `npm run check`, `npm test`. Deploy the established Git-connected Netlify project `ds-market-lab`. A Netlify HTTP function serves `/api/lab/*`; `paper-tick` runs every minute. No always-open browser, Mac, or artificial keepalive is required. Use scheduled bounded jobs rather than a perpetual loop; each tick acquires a four-minute database lease. Worker executions can restart without duplicating funded loans or ledger changes.

Version 0.4.2 supersedes the uncommitted 0.3.0 local collector and the 0.2.0 GitHub baseline. There is no delivery ZIP: a static ZIP omits the worker. The original 0.1.0 uploaded ZIP remains a historical archive. Practice fixtures retain data format 0.1.0 and their original $50 wallets, separately at `practice.html`; existing browser records are preserved.

## Four screens

Trading, Agent accounts, Loan applications, Kalshi markets. Sign in with the existing DS HUB owner account. Access is pinned to the existing owner user, not all DS HUB users. Session state is scoped to this app's browser session; signing out here does not purge other apps. No password reset or customer invitation is sent.

Agent A: $100 fake cash, BTC 15-minute markets, model review at most every five minutes. Agent B: $500 fake cash, selected BTC hourly/daily and 15-minute contracts with latest expected expiration within 30 days, review at most every 30 minutes. B's supported universe is intentionally bounded and visible, not all Kalshi markets. Each agent chooses its own name on its first API decision. Both may spend available cash including fees, reuse proceeds, submit loan applications, repay debt, hold, or skip. At most eight open positions per agent protects state size, not trade dollars. No automatic bankroll refills.

Initial cloud verification is limited to ten minutes and $0.05; it pauses automatically. The owner must separately start the month-long phase after reviewing verification. Daily experiment API budget $1 UTC, total $30 for the experiment, using `gpt-4.1-mini-2025-04-14`, input $0.40 / million tokens and output $1.60 / million. Each request reserves $0.02 BEFORE network activity; failed/unknown requests retain a conservative charge. Limits cover this app's estimates, not other projects or provider-delayed account billing. Key safety stop December 14, 2026 at 11:59 PM EST, conservatively ahead of the existing 30-day key's expiry. After the test/key deadline, public-data-only reconciliation follows remaining positions to official settlement, without model calls or new entries. A December 10 renewal reminder is configured in the Codex app. Keys never enter dist, source control, exports, or logs.

## Bank policy

$600 fake pool; owner approval for every loan. First maximum $50 / $250 at 23% ANNUAL simple interest. After repayment, up to $100 / $500. Additional borrowing with unpaid debt: maximum $25 / $125 at 28%, then $10 / $50 at 33%; further supplemental requests blocked until debt clears. Outstanding principal ceilings $100 / $500 include all loans; accrued interest remains owed beyond them. Rates on existing loans are fixed. Interest accrues daily, conservatively rounded to cents; due 30 days after funding. Repayment pays interest then principal; available cash is used at deadline and unpaid amounts remain recorded. Loans change cash and debt, never profit. Net account value subtracts principal and accrued interest.

## Paper execution assumptions

Public REST only; no Kalshi credentials, order submission, funding, or live-money API exists. Markets and order books are separate responses. Receipt time is not exchange quote freshness. Coinbase spot reference is NOT the official settlement feed. Market rules, strikes, closing/expiration metadata and official nonprovisional settled/finalized yes/no results are retained; unknown outcomes remain open across rollover.

Whole contracts only, queued limit intents delayed at least 10 seconds, filled at a later tick's quote, 180-second intent expiry, 10% of displayed best-level depth shared across agents. Unfilled remainder is not assumed filled. Models supply probability estimates, not proven skill; buys need a five-percentage-point estimated advantage allowance. Series must report quadratic fee metadata and a valid multiplier or fills are withheld. Taker fees are conservative modeled cents, not exact exchange billing precision. Spread/depth/latency are simplified; no queue model, true market impact, tick-level reconstruction, or guaranteed exit. Near-close exits are attempted; official settlement releases remaining funds only after receipt. Marks can be stale and are not executable guarantees.

Shared memory stores observations and hypotheses, not weight training. Prompt/model version and concise evidence/exit/repayment summaries are recorded. Checkpoints at days 10/20/30 compare net percentage returns, interest, realized results and open positions; this is not proof of profitability.

## Isolated persistence

Supabase DS HUB `lfgmvycxqinoriamprhr`, `market_lab_private`: runtime, events, snapshots. All three tables have RLS, no public grants. The public invoker wrapper calls a private definer gateway that checks the pinned owner for reads and a hashed worker credential for mutations. Schema USAGE and function EXECUTE do not grant table access. The frontend has only a publishable key. Worker secret grants access ONLY to the Market Lab gateway, not other DS HUB apps. SQL is additive in `cloud/schema.sql`; production migration is recorded by Supabase. Existing DS HUB users, tables and data are untouched.

Runtime state is capped at 200 KB; recent charts retain seven days. Financial/decision events remain intact. Compressed raw public data is stored in Netlify Blobs `market-lab-recordings`; archive objects older than 30 days are removed by bounded daily cleanup. Database guard pauses at 460 MiB to protect the shared free project's 500 MB quota. Storage and cloud request usage still need measurement during the short test. UI export contains current state and all paginated financial/decision events; raw recording archival is separate.

## Deployment environment (server only)

`OPENAI_API_KEY` and `MARKET_LAB_WORKER_SECRET` are stored securely in Netlify runtime environment. Do not expose through build outputs. The locally approved `.env.local` is ignored and owner-readable only. All other URLs/keys in code are public configuration. Set Node 24. No Supabase service-role key is used.

## Verification

`npm run check && npm test` includes 41 tests: original accounting/strategy/observer tests plus cloud lending, approval idempotency, interest/partial repayment, debt tiers, delayed/shared-depth fills, settlement rollover, and budget reservations. Live public Kalshi series/book and Coinbase reference were checked during implementation; authorization failures are explicitly rejected. Three automatic cloud ticks, compressed archive readback and actual model responses were verified; the short verification was then paused. The month-long experiment is not started. See VERIFICATION-0.4.1.md.

Release 0.4.2 adds recoverable sign-in startup. Existing cloud session records retain compatible 0.4.1 ledger format; their balances and state are not rewritten for a frontend fix.

Release 0.4.3 adds persistent Back and Home controls. Back stays within the app and Home returns to Trading.

## 0.5.0 — simpler recorded-market workspace
Home links to Recordings, Trading, Profiles and Requests; experiment controls live in Settings. Black/charcoal, white text, blue controls, green gains/red losses. Reading is stable: polls stage new state behind an explicit update button; details and scroll do not get replaced on the polling timer.
Recordings use Kalshi historical one-minute OHLC where available plus actual scheduled quote samples, never invented ticks. Initial histories are read from market open for BTC rounds and up to one hour before tracking for flexible markets. API gaps remain gaps; polls are approximately one minute, not a streaming exchange terminal. Closed historical market imports cannot establish what the agent actually saw before the recording existed. Each decision now retains its supplied market snapshot; old decisions retain original evidence without invented snapshots.
Beta chooses across a bounded discovered set of categories and durations <=30 days. No universal market coverage is claimed. Unverified fees and rules remain blocked, and new entries for AlphaBot stop two minutes before round close. Financial protections remain in force.
One original agent-chosen avatar per permanent ID. Additional image applications cost $5 fake earned profit with owner approval, assessed again at generation. Initial images cost no fake cash. Real API image budget $1 total, conservative $0.10 reservation per attempt, no automatic retries after failure. Private image blobs served only after owner session validation. API billing may differ from the reservation. Avatar job runs as a bounded Netlify background job, separate from trading mode; a paused trading test remains paused.

Pausing prevents new entries and AI decisions, cancels unfilled BUY orders, and keeps existing position exits/official settlement monitoring active. This avoids stranding a position merely because new trading was paused.
Owner adjustments are shown separately from realized trading results and never qualify as earned profit for image purchases.

## 0.6.0 — decision-quality review
Current release 0.6.0 retains the compatible 0.5.0 ledger format and marks `releaseVersion` separately. New purchases remain paused for review. Optional review research uses existing API budget/cadence and records checked proposals without BUY orders; SELL management and settlement continue for existing positions. Owner acknowledgement is necessary to resume entries; a test passing is not proof of profitable forecasting.
Each model call receives actual recent Kalshi candle history where available, server-supplied quote facts, actual closed-trade feedback and a calibration review. Future observations are excluded from historical summaries. A probability estimate is still model-supplied and unverified. The server computes sizing, fees, break-even and estimated net value rather than trusting numerical prose. New purchases need three genuine observations and a numeric timed exit plan. Conservative quote-depth and delayed-fill rules still apply.
`stopPrice` and `takeProfitPrice` are prices of the chosen YES/NO contract, not underlying spot dollars. Triggers cause conservative sale attempts on scheduled observations, not guaranteed fills or continuous second-by-second stops. Legacy holdings keep their original behavior; no invented retrospective stop plan is applied.
Forecast review scores the first pre-close forecast per agent/market against non-provisional official outcomes, compares squared probability error with a neutral 50/50 reference, and retains an explicit `passed:false` because calibration alone is not a profitability test. Old forecasts are labeled by source; new strategy profitability needs prospective/out-of-sample evidence. Owner compensation never becomes an earned-profit reward.

## 0.7.0 — cosmetic achievements and owner-requested full resume
The owner explicitly requested full fake-money trading again. Resume retains balances, positions, all existing gates and the $1/day/$30 research caps. Cosmetic XP/levels and six achievements appear in profiles, with summaries on Home and goals included in agent context. No money, borrowing, API access, automatic image generation or risk allowance is awarded.
Badges are Evidence First (checked history on three distinct markets), First Net Win (a complete position profitable after fees), Plan Keeper (three complete server-plan exits including loss exits), Five Percent (realized qualifying earnings at least 5% of initial bankroll), Steady Earner (three wins among five complete closes with positive net earnings), and Profitable Finish (completed experiment, positive earnings and no obligations). Open losses reduce qualifying earnings; open gains, loans and owner credits never qualify. Stale marks block account-earnings badges.
Position-based statistics start with positions opened after feature activation, rather than reconstructing unknown past partial fills. Partial exits aggregate into one position result. Duplicate events cannot repeat awards; cosmetic awards remain as dated historical achievements if later performance declines. Server-checked research can earn evidence credit without placing a trade. The prompt explicitly rejects badge-chasing, revenge trading, unnecessary borrowing and taking larger risks for achievements.


## 0.8.0 — per-agent archives, confirmation and nightly review

- Profiles → **Replace agent…** opens a confirmation dialog and does nothing until confirmed. Only the selected profile stops opening new investments. Existing exits and settlement remain monitored. Unpaid debt blocks replacement; it is never erased or transferred.
- A private cloud archive freezes the selected run's account, pictures, achievements, hypotheses, full paged events, market observations and account snapshots. Every stored file is hashed and read back before activation. Source records remain intact. Only then is a fresh run created with separately recorded initial capital; the other agent and global experiment budget/clock remain unchanged.
- AlphaBot and Beta remain permanent IDs. Current names/pictures remain. A future replacement chooses a name and its initial picture in the existing budgeted onboarding process. A failed picture can be retried by the owner within the same global image cap. No extra picture was generated to test this feature.
- Profiles → **Saved agent archives** lists each profile's past runs. Archived records and original portrait are read-only. Complete download includes all manifest pages; browser ZIP export is bounded to 50 MiB. Larger archives remain saved but need a future server export. Quick file preview shows selected first-page files. Recorded closing-event counts are not a full-position win rate.
- **Keep me signed in** is opt-in on that browser/device. It stores this app's renewable session, never the password. Sign out clears this app's stored session and requests a local Supabase session logout. Browser privacy settings or server session policy can still require sign-in.
- Each monitored day at/after **9 PM America/New_York**, a ledger review is saved once under Profiles. It costs no extra AI call and makes no cash adjustment. It is a saved report, not a phone notification. A paused experiment without open positions receives its review on the next monitored tick; nightly report creation does not override the key stop or storage safeguards.
- Agent guidance **paper-research-v5** states net profit after costs, no loss-chasing, cosmetic rewards, owner-only replacement, and no promised automatic funding. Evidence/fee/exit checks and HOLD remain valid. No profitability is promised.

Required backend: apply `supabase/migrations/20261115194135_market_lab_agent_archives.sql` only to authorized DS HUB `lfgmvycxqinoriamprhr`, then release the Netlify functions and frontend together. Private tables keep RLS and no direct anonymous/authenticated table grants. Owner read and worker writes use checked RPC functions. No reset or replacement is part of deployment verification.

The 2026-11-15 nightly report is labeled interrupted and excluded from full-day comparison because the owner reported a roughly six-hour interruption. Its financial records remain intact; 2026-11-16 is the first eligible full-day review.


## 0.9.0 — owner workspace and stable phone navigation

Home has six destinations; Back/Home/Settings remain available without a bottom bar. Agent cards deep-link to that exact profile. Inputs use at least 16px. New-activity notification is out of flow; manual updates, open details and route-back navigation preserve reading anchors and drafts. Recording refresh preserves the replay timestamp. Activity has agent filters and incremental older entries.

Rules & instructions displays the current exact operating source and historical tracked versions, regenerated by `precheck`. Coverage gaps are explicit: unrecorded conversations cannot be recovered. Historical versions are evidence, not reactivated policies. Owner instructions are append-only, scope to both agents or one permanent profile, require confirmation and appear in future model context. Retiring an instruction adds a new entry. Technical settings can be changed through a separate confirmed form, with before/after history. Existing defaults and financial/API limits are preserved; pacing is opt-in. Arbitrary written text cannot silently edit code-enforced controls.

The Rules page includes **Give paper money** with amount, exact current agent, optional reason, and a gift/loan choice. Confirmation and request identity prevent duplicate funding. Gifts increase owner capital and cash, not realized trading profits, API credits, or achievement earnings. Owner-initiated loans retain existing bank limits and interest terms. No release verification gives production agents cash or loans.

Each agent has its own saved chat, scoped to run ID. Conversations retain owner/reply timestamps, pending/error states and all messages; older pages remain readable. AI context uses up to the latest 30 messages, with the account and latest decision. The rules builder has its own separate saved discussion. Chat cannot execute trades, fund loans, apply rules or generate pictures. A message becomes an instruction only through the explicit reviewed instruction form. Replies share the existing daily/total research allowance and reserve cost before calling the API. Budget exhaustion preserves a waiting message; interrupted replies are marked rather than silently retried. Cosmetic profile appreciation is included in later decision context.

Dictate uses browser speech recognition where available, starts only on click and lets the owner review text before sending. Unsupported browsers offer typed or phone-keyboard dictation; physical phone permission behavior still requires owner-device testing. Dictation may use the browser's speech service. Microphone permission is limited to this app's origin.

Retired agents have a dedicated dashboard destination. Their conversations are read-only. Future archives freeze a message/instruction cutoff and include the full conversation, owner journal, applicable instructions and source inventory. Archive activation waits for pending replies as well as existing financial obligations. A replacement does not inherit the old agent's personal chat.

Price context now includes exact raw/dollar/cent labels and code-calculated one-contract fee examples. Invalid earlier explanations are not recycled as previous reasoning; validation feedback is supplied explicitly. Prompt provenance advances to paper-research-v6. Default entry checks are not loosened by release.

Required backend: `supabase/migrations/20261118005059_market_lab_owner_workspace.sql` after the 0.8 archive migration. Workspace RPC is pinned-owner/worker checked, with private tables and no direct client table privileges. Scheduled chat dispatch and secret-protected background function are deployed with the app. Existing key and budget retained.
