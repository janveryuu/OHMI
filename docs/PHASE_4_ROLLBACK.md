# Phase 4 rollback — 15 October 2026

OHMI is restored to the verified Phase 3 foundation, version 0.3.0. Phase 4 will be redesigned from scratch with Antigravity. This rollback does not approve rebuilding Phase 4, starting Phase 5 or merging into main.

## Baseline and recovery

- Verified Phase 3 baseline: `b8da85dbc4544a2475863015ce0ccd053ecd73a2`, the documentation follow-up to Phase 3 implementation `f189335`. A fresh remote check confirmed main at that baseline before rollback; main was not overwritten.
- Dedicated rollback branch: `codex/rollback-phase-4-to-phase-3`, created from Phase 4 so its commit history remains intact.
- Remote backup: `codex/phase-4-backup-2026-10-15` at `981a51f905098c9624e70f5cda6cdda33ecf82de`. The original Phase 4 branches remain available.
- A complete verified local Git bundle and private runtime/graph/build archives are outside the checkout at `C:/Users/LEGION/Documents/OHMI-backups/phase-4-rollback-2026-10-15`. They are not published. Existing ignored credentials and linked-project settings remain in place.

## Restored and removed

Application source, mascot assets, configuration, dependency manifest/lockfile, tests and local migration source were restored from Phase 3. This preserves the floating mascot, animations, six-section sample UI, Chrome extension identity setup, Supabase authentication/Google login, private PDF/PNG/JPG uploads, signed retrieval, account/language settings and student-written assignment steps.

Removed the Phase 4 chat/history/tutor interfaces and backend actions, provider routing, analysis/usage helpers, PDF extraction/offscreen entry point and permission, PDF.js and Phase 4-only direct development dependencies, AI tests/fixtures and old Phase 4 plans/verification documents. Their source and history remain recoverable in the backup. Sample AI/circuit screens remain the original Phase 3 demonstrations, not working analysis features.

## Live Supabase audit and cleanup

The existing linked project is unchanged. Deleted only the deployed Phase 4 Edge Function `ohmi-ai`; a subsequent function listing was empty. No provider requests, paid billing, key rotation, Auth configuration change, bucket deletion, table deletion, migration repair or database rollback was performed.

Preserved the Phase 3 `ohmi_profiles`, `ohmi_assignments` and `ohmi_assignment_steps` tables, their RLS/policies, Auth accounts/Google identities, and the private `ohmi-assignments` bucket. The bucket retains its 10 MiB PDF/PNG/JPEG limits. No separate Phase 4 bucket was introduced by the archived migrations.

These obsolete live resources remain intentionally preserved and require a separately approved cleanup decision:

- Six RLS-protected tables: `ohmi_analyses`, `ohmi_conversations`, `ohmi_messages`, `ohmi_tutorial_progress`, `ohmi_ai_requests`, `ohmi_ai_provider_backoffs`. Phase 4 rows exist; this rollback does not erase them.
- Five SQL routines: `ohmi_check_tutorial_progress`, `ohmi_complete_ai`, `ohmi_defer_ai_provider`, `ohmi_reserve_ai`, `ohmi_save_tutorial_progress`, plus the progress-table trigger and associated policies/constraints. Only the progress-save routine allows authenticated execution; none allow anonymous execution. They perform no provider calls after the Edge Function is removed.
- Six applied Phase 4 migration records: `20261013172020`, `20261013173243`, `20261013174603`, `20261013181631`, `20261014055307`, `20261014065738`. The Phase 3 record `20261012141823` remains. Original SQL is in the backup branch/bundle.
- Existing Gemini/Groq provider secrets and free-tier flags remain server-side as requested. Credentials are not copied into this document or the rollback commit.

At rollback time, the checkout had only Phase 3 migration source. The subsequent [Phase 1–3 stabilization](PHASES_1-3_STABILIZATION.md) recovered the six original Phase 4 migration files without executing SQL. All seven now match hosted history. Retained schema/data still require deliberate forward-compatible integration; never mark remote migrations unapplied or run destructive reset/drop operations to conceal them. New local databases replay all seven files.

## Verification

Actual checks completed against the restored foundation:

| Check | Result |
| --- | --- |
| Source comparison with `b8da85d` | Application source, entry points, mascot assets, tests, manifests/lockfile, WXT/TypeScript settings and Supabase source match exactly. Only README/context/this rollback record add current status. |
| `npm ci` | Passed using the original Phase 3 lockfile; no PDF.js package, zero reported dependency vulnerabilities. |
| `npm test` | 24 passed across five files. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed; version 0.3.0, approximately 2.23 MB. Permissions are `storage` and `identity`; no offscreen/PDF-analysis entry point. Approved mascot source/build bytes match. |
| `npm run test:browser` | Passed Phase 1/2 mascot, drag, animation, focus, responsive layout, persistence, navigation/isolation and Phase 3 Account UI checks. Installed Playwright Chromium; simulated editor. |
| `node tests/backend-live.mjs` | Passed actual hosted profile/settings/assignment/manual-step CRUD; login/logout and refresh after browser restart; interrupted upload recovery; private upload/open/delete; account switching; anonymous/cross-owner denial; content-script credential/storage/message isolation. Only guarded disposable fixtures were created and cleaned. |
| After-cleanup Supabase audit | All before/after table row counts, schema/RLS/policy/routine metadata, migration history and private bucket settings matched. Secret names remained unchanged. No Edge Functions remain. |
| Credential/build scan | No provider key patterns found in tracked source or build; ignored `.env` remains excluded. |

Current test screenshots and audit output are kept in the private local backup, while committed Phase 3 reference screenshots retain their baseline bytes. No local Docker database replay was needed: source is the verified Phase 3 baseline and the actual existing hosted project passed its essential isolation/CRUD checks.

Reload the 0.3.0 build in the existing Chrome extension installation, then refresh Circuits. Google consent in the owner's regular Chrome profile and SMTP remain the pre-existing manual checks described in [Phase 3 verification](PHASE_3_VERIFICATION.md); fixture login does not re-verify Google's consent window. No AI provider calls or Phase 4 rebuild work were performed.
