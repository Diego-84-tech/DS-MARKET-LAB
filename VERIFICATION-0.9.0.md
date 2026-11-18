# DS Market Lab 0.9.0 verification

Release established from actual 0.8.0 package metadata and Git history (d98b35d). Compatible ledger version remains 0.5.0; package, UI, API configuration, exports and legacy app release labels advance together. No production dependencies changed.

## Implemented
- Six dashboard destinations, no bottom bar, Back/Home/Settings retained. Agent cards deep-link to the chosen profile. Replace is behind Manage agent. Per-agent activity filters and older-page controls reduce the initial journal.
- 16px sign-in/editor fields, responsive phone layout, non-flow update indicator. Reading anchors, expanded details, drafts and route-return position preserved; recording refresh preserves replay timestamp.
- Complete recorded source inventory: current full prompts and operating code, 45 recovered historical source versions at initial audit, explicit coverage gaps, original commit dates and authorship caveat. History seeding is idempotent and appends original tracked source into numbered private journal entries without activating it. Future release notes append rather than rewrite older entries.
- Owner-authored instructions target both agents or one profile, require exact-text confirmation and are included verbatim in later agent prompts. Retirement adds an entry. Supported technical policy changes are separately confirmed and journal before/after values. Existing defaults and spending caps remain unchanged. Optional allowance pacing is owner-controlled.
- Give paper money: amount, target agent, optional reason, gift or bank loan. Requires confirmation and exact current run. Request IDs prevent duplicate funding. Capital is separated from realized trading earnings and API allowance. Bank loans retain existing annual rates, bank cash and eligibility. No production funding was used as a test.
- Per-run conversations keep both sides, original timestamps, model/usage provenance, queued/failed replies and older pages. Chats are read-only after retirement. Rules discussion has its own thread. Chat cannot trade or apply instructions. Replies share existing research budgets and key deadline. UI supports dictation where the browser exposes it, with typing/phone-keyboard dictation fallback.
- Appreciation stays scoped to the selected run and is shown to later decisions. No cash, borrowing power or API budget is awarded.
- Archives freeze conversation and instruction cutoffs, wait for outstanding replies, export all saved messages and owner entries plus source inventory, and retain the original profile. Old archive formats remain readable.
- Corrected input presentation provides explicit raw units/dollars/cents and code-computed one-contract costs. Invalid prior prose is not recycled; latest validation feedback is provided. Prompt provenance is paper-research-v6. This does not establish profitability.

## Verification
- 97 Node regression and feature tests pass, plus all module syntax checks.
- Isolated PGlite test compiled base/archive/workspace migrations. Verified pinned owner reads/writes, denial to anonymous/other users, no direct client table access, confirmation, duplicate request protection, append-only instruction retirement, 125-message chronological paging, unchanged cash after likes/instructions, archive cutoff and retired read-only behavior. Test engine remains outside production dependencies.
- Local browser fixture: all six destinations render; agent card opens exactly AlphaBot; Like becomes Liked without balance changes; saved chat displays owner and fixture reply; using chat text as an instruction only fills a draft; confirmation applies a numbered entry; paper funding confirmation shows amount and exact agent and cancellation sends no funding action.
- 390px viewport: document width equals 390px (no horizontal overflow), email/password/editor computed fonts 16px, bottom bar absent. Manual background update preserved scrollY 742.5 and the visible agent's top at 296.578125 exactly.
- No production account, loan, profile picture, replacement, or trade was changed to manufacture a test result.

## Limits and device checks
- Historical material is limited to recoverable tracked source; unavailable earlier conversations are not invented. The original chat integration starts retaining messages with this release.
- Full saved chats remain readable, but model reply context uses at most 30 recent messages. Agent chat messages do not automatically become trading instructions.
- Microphone permission, native keyboard behavior, persisted iPhone page zoom and reopening an installed web app still need checking on the owner's physical device. Browser-native speech services may process dictated audio; unsupported browsers expose a clear keyboard-dictation fallback.
- All current code-enforced controls are visible; arbitrary text cannot silently change accounting, real-money isolation or spending caps. Supported trading checks can be changed explicitly in their settings form. Owner instructions do not guarantee profitable decisions.
- Browser complete archive ZIP remains limited to 50 MiB; larger archives remain stored but need the future server export. Source records and old archives are not deleted.

## Hosted release
Pending the authorized backend migration, GitHub push and Netlify deployment. Verification is appended after publication.
