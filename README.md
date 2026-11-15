# DS Market Lab — 0.4.3 cloud paper experiment

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
