# DS Market Lab 0.8.0 verification

## Local implementation
- Version established from actual package metadata and Git history (0.7.0 / 9ec6fb5). Current app/package/export labels advance to 0.8.0. Persisted ledger format remains 0.5.0. Lockfile changes only the two root version labels; no dependencies changed.
- 86 Node tests pass plus all module syntax checks. New tests cover exact-run confirmation, unchanged other profile, preserved obligations, separate fresh counters, chosen replacement names, remembered sign-in and scoped storage clearing, once-only 9 PM Eastern reviews, resumable archives, portrait byte preservation, missing-picture activation blocking and ZIP path protection.
- Isolated PostgreSQL-compatible PGlite 0.5.16 test compiled existing schema and additive migration, rejected anonymous reads, allowed owner reads but denied owner worker operations/direct private tables, paged all 501 agent events and 6,001 frames, excluded later-imported history, retained frozen metadata, rejected premature/invalid activation and verified selected-only replacement with running mode preserved. Test engine installed under /tmp, not a production dependency.
- Local browser fixture verified preserved current profile names/portraits, two-step dialog and Cancel, separate AlphaBot/Beta folders, archived detail/portrait/results/usage/download controls and nightly review area. No production replacement, loan, cash adjustment or picture-generation action was used in verification.
- Live read-only check at 2026-11-15 19:49 UTC confirmed running, last tick current and error null. A held no position; B retained one existing position. Existing v4 decision provenance was preserved. These observations show active monitoring, not profitability.

## Product limits
- Archive contains saved agent-specific canonical records, not nonexistent observations or every shared raw debug feed. Records are never fabricated. Original source records remain.
- Archive closing-event statistics can include partial closes and legacy gaps; no whole-trade win rate is inferred. Recorded successful research token usage is distinct from provider invoices, failed-call and image costs.
- Browser complete ZIP export is limited to 50 MiB; larger archives remain retained but need a server-side export implementation. Initial file previews show selected first-page files; complete ZIP contains all verified pages.
- Current identities are preserved. Only a confirmed future replacement chooses a new display name and first image, using existing global image budget/key deadline. Failed onboarding stays blocked until an owner retry succeeds; no automatic repeat charges.
- Remembered login depends on device/browser storage and Supabase session policy. Passwords are not persisted by this feature.
- Nightly review is a saved account report on the first monitored tick at/after 9 PM Eastern, without extra model calls, automatic funds or phone notification. A fully idle paused experiment does not bypass its monitoring safeguards to create a report.

## Release status
Owner authorized Supabase, GitHub push and Netlify publication on 2026-11-15. Backend migration market_lab_agent_archives applied successfully. GitHub/Netlify verification is recorded below after release. No live agent has been replaced or reset.

Tonight (2026-11-15) is retained as an interrupted day and explicitly excluded from full-day comparison, per owner report of roughly six hours interrupted. Tomorrow's review is eligible. This affects review labeling only: historical financial records and balances are preserved.

Post-migration security advisor checked: Market Lab archive tables intentionally use deny-by-default RLS without direct client policies; access is through the owner/worker checked RPC. No new Market Lab exposed-definer or mutable-search-path warning. Other DS HUB app advisories were not changed in this release.

## Hosted release verification
- GitHub main pushed at 5adb582. Netlify production deploy 6afa39e9a31cc437c6cc643d reached ready for that exact commit.
- Production /api/lab/config reports 0.8.0 and workerConfigured=true. Anonymous /api/lab/archives returns HTTP 401.
- Hosted archive tables have RLS enabled and no direct SELECT privilege for anon or authenticated. Supabase migration succeeded without replacing or resetting an agent.
- Scheduled worker readback at 2026-11-15 23:03:11 UTC: releaseVersion=0.8.0, mode=running, reviewRequired=false, error=null, agentRulesVersion=paper-research-v5; both agents lifecycle=active. AlphaBot recorded a new v5 HOLD decision at 23:03:07 UTC. Beta's prior v4 HOLD remains correctly tagged and will receive v5 at its next normal 30-minute decision; no forced extra call was made. Research spend readback $0.3352556 of existing $1/day and $30 total limits, reserved=0.
