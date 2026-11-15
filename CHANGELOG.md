# Release notes

## 0.5.0 — 2026-11-15

- Owner compensation credited $29.07 to AlphaBot for the reported interruption, restoring $100 available. Original settlement retained; adjustment is not trading profit. Paused accounts with open positions continue conservative exits and settlement monitoring.

- Added Home, Recorded Tickers, Agent Trading, Profiles, Requests and Settings with black/charcoal styling and persistent navigation. Polls stage updates instead of replacing reading content.
- Preserved permanent AlphaBot/Beta IDs and introduced the agreed display names; Beta can choose short or longer horizons across discovered categories.
- Added owner-protected market recording/candle history, replay, exact-market links, buy/sell markers, CSV-free JSON export and explicit missing-history labels.
- Added separate approval applications for $5 fake-profit picture purchases, one free agent-chosen picture per ID, private saved images and a $1 API image reservation cap.
- Improved exact blocked-entry reasons and recorded decision market snapshots; retained delayed fill, fee, cash and settlement checks. Existing balances/history and owner control state preserved.


## 0.4.3 — 2026-11-15

- Added visible Back and Home controls, including on the sign-in screen. Back returns to the previous in-app screen; Home returns to Trading. Back never sends the user outside DS Market Lab.
- Includes the recoverable sign-in connection fix from 0.4.2. Product name remains DS Market Lab.
- Corrected the Netlify dashboard build command from extracting the obsolete 0.1.0 ZIP to running current checks/tests. The old extraction overwrote the deployed security headers and blocked the app's own API connection.
- Verification: all 44 tests and syntax checks pass; deployed headers allow only the app and DS HUB connections. Safari shows Connected / Ready to sign in, enables Sign in, and Back returns from Accounts to Trading. Credential sign-in was not exercised; agents remain paused.

## 0.4.2 — 2026-11-15

- Fixed a failed first connection permanently disabling Sign in. Startup now retries three times with a timeout, shows accurate connection status, and offers Retry connection after failure. Reconnecting or returning to the page can recover without losing entered credentials.
- Added release-specific frontend URLs to refresh stale assets. Product name remains DS Market Lab; Glass Lab is only the selected icon concept label, not a rename.
- Preserved accounts, paper balances, loans, API budgets and experiment state.

## 0.4.1 — 2026-11-15

- Bounded initial cloud verification to ten minutes, with a $0.05 API ceiling and no automatic transition into the month-long experiment.
- Explicit owner start transitions into the 30-day phase after successful scheduled tick verification.
- Server-only Netlify credentials configured securely. Three automatic cloud runs, three archives and model HOLD decisions verified; estimated API cost $0.0041. Paused after short verification, pending owner start of the 30-day phase. See VERIFICATION-0.4.1.md.

## 0.4.0 — 2026-11-15

- Added authenticated Trading, Agent Accounts, Loan Applications, and Kalshi Markets screens; old practice and browser saves remain separate.
- Added $100/$500 paper agents with API decision summaries, self-selected names, shared research hypotheses, delayed fills and official settlement reconciliation.
- Added owner-approved fake loans, annual 23/28/33% interest, $100/$500 principal ceilings, repayments and net-of-debt accounts.
- Added isolated DS HUB ledger, atomic worker leases, scheduled Netlify jobs, compressed raw archives, storage guard, $1 daily/$30 total app API budget, and days 10/20/30 checkpoints.
- Kept real-money trading absent. Server-backed release requires repository deployment; no static release ZIP generated.
- Existing 30-day API key retained; December 10 renewal reminder created, with conservative December 14 runtime safety stop.
- Local checks: syntax checks and all 37 tests pass. Public Kalshi series/book fee metadata and Coinbase reference verified; isolated database initialized paused and invalid session rejected. Live cloud deployment and scheduled-operation results are recorded in the final handoff.


## 0.3.0 — 2026-11-13 (local changes)

- Added a manually started, read-only public Kalshi REST collector for KXBTC15M Bitcoin 15-minute contracts. No credentials, orders, OpenAI, Supabase, or startup service.
- Added a separate Live data page with market identity, receipt timing, top quotes/depth, raw timing distinctions, finalized outcomes and stale/error warnings. Fictional sessions and Strategy Lab remain separate.
- Save timestamped raw responses and normalized snapshots in private NDJSON files outside the repository. Missing exchange timestamps and unavailable outcomes remain explicit.
- Documented local operation, recording format, official API sources and limits. App/package display version is 0.3.0; the existing 0.1.0 practice-recording format and archived 0.1.0 ZIP remain unchanged.
- Verification: syntax checks passed; all 27 tests passed (20 existing, 7 observation tests). Local browser verified collection status, stopped/stale warnings, and a separate fictional Strategy Lab evaluation. The live page has no horizontal overflow at 360px. Local endpoint returned 200, source/recording paths returned 404, and a foreign Host header returned 403.
- Live sample: four snapshots received November 13, 2026, 7:41:15–7:41:30 PM EST for KXBTC15M-26NOV131945-45; five earlier finalized outcomes recorded. Last YES bid 24¢ / 2,368.93 contracts; derived YES ask 25¢ / 1,460.38 contracts. Quote exchange timestamp and this active contract's verified outcome were unavailable. These are observed snapshots, not trading-performance evidence.
- Bounded collection is stopped. The local dashboard remains open at http://localhost:8081/#live. Changes are local, uncommitted and unpushed; no release ZIP or deployment was requested or made.

## 0.2.0 — existing source baseline

Strategy Lab with versioned deterministic paper tests and editable app sources (main commit 8e6cde0).
