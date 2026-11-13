# DS Market Lab — 0.2.0 practice preview

By DS TECHNOLOGY™ · DIEGOAT STUDIOS LLC.

## Strategy Lab update

Version 0.2.0 adds the Strategy page: Bitcoin price waves, per-round YES contract charts with gaps at expiry, and test equity. Select the last 10/100 rounds or 7/30/100 days of reached frames in the active recording. Available history is reported; a larger range never fabricates more data. The sample has only 90 minutes.

The builder supports momentum/reversal rules, lookback, minimum spot movement, entry price ceiling, profit/loss exits, A entry budgets up to $10, and B allocations up to 100% of available cash. It emits one entry signal per market after the first two minutes, and uses only preceding/current data. Saved versions are immutable and stored in this browser; copying a version creates an editable draft. Export versions to retain a copy. Changing a draft invalidates its displayed test output.

Evaluations use fresh $50 wallets, include the same modeled costs, and stay separate from original sessions. A test's recorded BUY and SELL reasons are available from its chart. Opening replay creates a separate session with that exact frozen rule configuration. Trial results are fictional/unverified simulations, not historical backtests or forward tests. These controls are user-authored; AI rule generation, real market collection, phone alerts, and long-term portfolio tracking remain future work.

GitHub source is now maintained in Diego-84-tech/DS-MARKET-LAB. The original uploaded ZIP is retained as an archive. netlify.toml runs checks/tests and publishes dist directly, replacing the earlier ZIP extraction configuration. No dependencies, credentials, or Mac interaction are needed to deploy this browser-only release. Data format remains 0.1.0 for compatibility with earlier recordings.

This version implements the approved two-agent dashboard as a portable, dependency-free web app. Both charts show the same fictional contract and clock. Each agent has its own trade markers, fill details, cost accounting, and recorded explanations.

## Working now

- Compare / Replay / History / Results / Setup views, responsive for phones and desktops.
- Two independent $50 wallets. A caps a position's entry cost, including modeled fees, at $10. B can spend any fraction up to available cash. Neither borrows or automatically refills. Closing a position permits another trade, including in the same market.
- Reuse of principal, proceeds, and profits. Available cash and estimated equity are displayed separately.
- A shared deterministic rule-based signal and shared exit rules, with different position sizing.
- Three explicitly fictional scenarios: mixed, trending, and choppy. Each has six 15-minute rounds with 15-second frames.
- Recorded buy / sell / settlement details, partial-fill accounting, quantity limits, modeled fees, realized net, estimated equity, and drawdown.
- Replay hides later trade markers and results. Prices and events are displayed only up to the selected frame.
- New tests retain previous sessions. Browser storage, JSON export/import, CSV export. Imports are labeled unverified.

This is an interface/accounting test, not an AI forecasting system or a historical backtest. Sample P&L is not evidence of real-world profitability. Data and decisions are fictional; no API credits are used, no orders are sent, and no real funds are involved.

## Hosting

`dist/` contains the complete static website. For Netlify manual deployment, upload the contents of the Netlify ZIP (index.html at its root), or deploy `dist/`. For a Git-connected Netlify project, the included netlify.toml runs `npm run check && npm test` and sets the publish directory to dist. No environment variables are needed for this version.

A separate private review URL may be hosted temporarily for phone testing. It does not mean the app has been deployed to the user's Netlify account.

Browser records belong to that exact browser and website origin. They do not automatically transfer from the review URL to Netlify or from one device to another. Export/import is provided for moving copies. Clearing browser storage can remove local records; export important test sessions.

## Run locally on the Mac later

Install/use Node.js 18+ for checks. Run `npm test` to verify simulator behavior, then `python3 -m http.server 8080 --directory dist` to open the dashboard at http://localhost:8080. Do not open index.html with a file URL because ES modules need HTTP hosting.

This browser version pauses playback when the page is hidden. It is not an unattended market watcher. The actual Mac background runner is a separate next phase and has NOT been installed or started.

For a reproducible command-line accounting run, use `node runner/practice.mjs mixed` (also accepts `trend` or `whipsaw`). It writes a practice recording to the path supplied as its second argument, or prints the final summary. No network requests or credentials are involved.

## Simulation assumptions

Money is integer cents; contract quantity is stored as hundredths. Fractional contracts are a practice assumption and must be checked against a real market's current quantity rules before live-data paper tests. Contract price is integer ten-thousandths of a dollar.

Fees are an illustrative taker-style calculation: round up 0.07 × contracts × price × (1 − price) in dollars to cents. This is a model assumption, not a verified current Kalshi fee schedule. Estimated equity uses the best bid less modeled fees for the whole open position; it is not a guaranteed executable amount. Entries use ask, exits use bid, quantity is limited by provided depth, and stale quotes prevent fills. No network latency, order queue, market impact beyond best-level depth, or adversarial price selection is modeled.

The example signal uses only previous/current spot frames. Each round signals once at two minutes: YES if spot rose over the preceding 60 seconds, otherwise NO. A allocates up to $10; B allocates between 35% and 100% by this example's signal magnitude (90% in the choppy scenario). Exits attempt +12¢, −10¢, or 30 seconds to expiry. Expiry averages the final four fictional spot frames against the target; this is NOT asserted as Kalshi's actual resolution method.

## Next phases — not connected

1. Resolve and verify exact Kalshi BTC market rules, quote units, fees, quantity steps, outcome source, and timestamps. Add a read-only market collector and record real incoming quotes; never manufacture missing target/settlement data.
2. Configure OpenAI access securely on the Mac/server. Use AI for evidence-based structured research and explanations; retain a deterministic accounting/risk gate. Secrets never enter the web bundle, logs, exported files, or repository.
3. Resolve the exact Supabase project. Add isolated sessions, market frames, decisions, fills, wallet snapshots, and runner heartbeats with authentication and owner-only row-level access. Do not modify unrelated DS HUB tables or production data.
4. Run a month of forward paper tests. Track attempted orders, realistic fill limitations, fees, drawdown, losses, and inactivity. Compare against simple baselines and separate strategy changes by version. A month alone does not establish a durable trading advantage.
5. Consider live execution separately only after explicit authorization and appropriate controls. No live-order submission code exists here.

The two wallets should be treated as sizing-policy experiments under the same strategy, not two independently trained AI agents. Reviewing results does not automatically train the underlying model.

## Brand

The name and screen direction are approved. Product icon artwork is still pending Diego's approval. No installable PWA or desktop .app is shipped yet. Add approved icon artwork to browser, Apple Home Screen, manifest, and desktop targets when those targets are actually delivered.

## Verification

`npm test` exercises wallet limits, reusable profits, accounting reconciliation, loss behavior, fee rounding, stale data, partial fills, settlement, complementary quotes, import validation, and reproducible replay. UI checks cover trade detail, rewind, completion, new sessions, and browser reload. Review widths down to 360px before final handoff.
