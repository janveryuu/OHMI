# OHMI Phases 1–3 stabilization

15 October 2026, Asia/Manila. This record supersedes outdated readiness statements in earlier phase reports. Scope: six findings from the same-day audit, safe stabilization, and Antigravity handoff. No Phase 4/5 implementation, main overwrite, database reset, history repair, credential rotation, paid-service activation, or provider call.

## Findings

| Finding | Status | Result |
| --- | --- | --- |
| F1 — missing migration source | FIXED | Restored all six original SQL files from Git; all seven local versions and SQL match hosted history. Dry-run reports up to date with no pending migrations. No SQL was applied. |
| F2 — path-dependent extension ID | PARTIALLY FIXED | Preserved original folder, registered ID and OAuth settings. Build warns about portability. Existing runtime callback guard remains. Owner has no registered public key and explicitly chose preservation. Portable identity remains blocked on owner action. |
| F3 — account-switch privacy | FIXED | Panel keyed by current user ID; changed identity/sign-out remounts all panel state and cancels sample timers. Same-account refresh/navigation keep messages/draft/attachments. Focused browser regression passes. |
| F4 — password/privileged-key security | PARTIALLY FIXED | Read-only advisor and non-revealing key metadata reviewed. Rotation remains UNVERIFIED, as owner confirmed. Leaked-password protection remains disabled and requires Pro or above. No credentials, Auth settings or billing changed. Manual steps documented. |
| F5 — misleading upload copy | FIXED | Disabled control says analysis is unavailable; notice directs real uploads to private Assignments. Sample analysis and working private storage are explicitly distinguished. CSS/assets unchanged. |
| F6 — unavailable email workflows | FIXED | Registration, confirmation and reset entry controls disabled when delivery is false. Mode guard and existing worker gate remain. Unconfirmed-account error explains pending delivery. Google and existing confirmed-password login remain enabled. |

## Migration reconciliation

Source: `981a51f905098c9624e70f5cda6cdda33ecf82de`, also preserved by remote `codex/phase-4-backup-2026-10-15`. Recovered files have the original Git blob IDs below. The original Phase 3 migration is unchanged.

| Version | Name | Original Git blob |
| --- | --- | --- |
| 20261013172020 | ohmi_gemini_tutor | `edac87196de49c99bff3dd383053ccd4c0e528b1` |
| 20261013173243 | preserve_ai_cost_accounting | `f61de2734a23aa4e4d68c84f165b7f5987f524a8` |
| 20261013174603 | account_for_bounded_ai_retry | `100053ed994d22f86d2b37850714b1e39f325346` |
| 20261013181631 | recover_ai_requests_and_provider_fallbacks | `9d5bb9944c7f9ac0a5763bd38966dc48b1b82e0e` |
| 20261014055307 | request_based_ai_usage | `5cc1dfbaa41e038159804d7b1a8882a3ad189a08` |
| 20261014065738 | provider_quota_backoff | `59edb387d07c837880d106a679a8eff34f90b9b4` |

Compared the complete `statements` arrays from hosted `supabase_migrations.schema_migrations` to all seven originals, reconstructing statement terminators and normalizing whitespace. All matched. `migration list --linked` pairs every local/remote version. `db push --linked --dry-run --skip-vault` returned `upToDate: true`, empty migrations/seeds/roles. Historical SQL includes its original alterations; restoring files did not execute them. Fresh local databases now include the retained schema rather than diverging silently from hosted history.

## Verification

- `npm test`: **25 passed**, five files. New error-copy regression covers email delivery disabled/enabled; existing tests cover OAuth serialization/cancellation/exact callback/exchange failure, message boundaries, stale-account mutation denial, file/config validation, storage failure ordering, placement/routes/preferences.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**, production 0.3.0, approximately 2.23 MB. Only storage/identity permissions; no offscreen/AI endpoint. Approved PNG preserved.
- `npm run test:browser`: **passed** on installed Playwright Chromium 153.0.8010.12 against a simulated editor. Mascot loading/layering, route/SPA detection, mouse/touch-cancel/keyboard drag, persistence, panel controls/focus, host interaction/style isolation, small bounds, six sections, navigation, motion/reduced motion and preferences passed. New synthetic A/B/sign-out regression covers cleared conversation/draft/attachments/pending reply and retained same-account state. Both signed-in and signed-out email entry controls are gated.
- Hosted migration/metadata checks: **passed** as above; nine OHMI tables have RLS; private bucket retains 10 MiB and PDF/PNG/JPEG allowlist. Security advisor returned only `auth_leaked_password_protection`.
- API-key metadata (without `--reveal`) lists legacy anon/service_role and default publishable/secret key entries. Default entries have update timestamp 2026-10-12T10:18:30.455943+00:00. This cannot establish exposed-key revocation; no key values were logged or copied into documentation.

- `node tests/backend-live.mjs`: **passed** against existing hosted OHMI using two marked disposable accounts. Verified profile/language/assignment/manual-step CRUD; private PDF upload/open/delete; interrupted-upload cleanup; signed URL opening; anonymous/cross-owner read/write/delete denial; stale-account mutation rejection; two Account pages; A/B language restoration; trusted-storage/sensitive-message denial; browser restart with forced token expiry and successful refresh. Fixture login does not test Google consent or email delivery. Only marked fixtures were removed.
- The live runner initially failed on two outdated navigation assumptions: opening Settings before initial account load completed, and expecting Settings to survive an account switch. Updated it to await loaded/signed-out account states and reopen Settings after identity changes. Both interrupted runs' guarded fixtures were cleaned. The final complete run passed, including cleanup.
- Final integrity: row counts and aggregate content digests for nine OHMI tables plus Auth users/identities and Storage objects/buckets (**13 tables**) match the pre-test snapshot. Schema/RLS/policies/routines/triggers/private bucket/migration metadata also match. No Edge Functions remain; no disposable fixture records remain. Existing student data was preserved.
- Public Auth settings still report Google/email enabled and email confirmation required. Anonymous requests to all three Phase 3 tables returned HTTP 401 / `42501`. Built credential-pattern scan found no matches in seven text artifacts. This is not an exhaustive historical secret audit.
- Mascot source/build SHA-256 matches `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382`. Assets, CSS, message contracts/validation, active database types, entry points and dependency manifests/lockfile remain identical to Phase 3. Small chat and account screenshots were visually inspected; reference screenshots were not overwritten.

These results establish continued Phase 1–3 behavior in simulated-editor and actual hosted fixtures. They do not establish current regular-profile Google/Tinkercad acceptance, portable extension identity, or AI readiness.

## Git and recovery

- Start: clean rollback `2d81a9e576aef30a51fac638434210c4c66adfad`, whose application matched Phase 3 `b8da85d`.
- Pre-edit checkpoint: `codex/backup-phase-3-before-stabilization-2026-10-15` at that rollback commit.
- Work branch: `codex/stabilize-phases-1-3`. Commit/push only this branch and the backup ref. Do not overwrite main. Commit identity is available from `git log -1`; the final response records the confirmed remote SHA.
- Existing Phase 4 backup and private bundle are preserved. No credentials, dependencies, generated build/cache, synthetic screenshots or fixture records belong in the commit.

## Remaining gates and recommendation

**NOT READY for an unrestricted portable handoff.** Owner accepted preserving the original build path while work continues. Public identity key and privileged-key rotation verification remain owner gates. See [Antigravity handoff](ANTIGRAVITY_HANDOFF.md) and [manual setup](PHASE_3_SETUP.md).

Regular-profile Google consent/cancel/retry, a second intended Google account, current signed-in Tinkercad controls/zoom, screen readers, minimum Chrome, physical touch and long-session performance remain unverified in this run. No SMTP delivery, leaked-password protection, AI output, PDF parsing, circuit analysis or electrical verification is claimed. Fresh local database replay was not performed because Docker was unavailable in the preceding audit; this run uses the existing hosted database and recovered SQL/history comparison.
