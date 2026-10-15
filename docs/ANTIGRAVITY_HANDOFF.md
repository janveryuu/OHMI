# Antigravity handoff — Phase 3 stabilization

15 October 2026, Asia/Manila. Version 0.3.0. Start on `codex/stabilize-phases-1-3`, based on rollback `2d81a9e576aef30a51fac638434210c4c66adfad`. Main is not the stabilization branch. Read [stabilization evidence](PHASES_1-3_STABILIZATION.md), [project context](PROJECT_CONTEXT.md), and `AGENTS.md` first.

If a local `docs/antigravity-memory/` snapshot and `.agents/rules` bridge are present, preserve their read-only/no-sync boundary. Copied Phase 4 notes may predate this stabilization; current repository source and this report govern the active architecture. Canonical second-brain updates by Codex do not automatically refresh that local snapshot.

## Active architecture

- WXT / React / TypeScript / Tailwind, Chrome MV3, minimum Chrome 116. `entrypoints/ohmi.content.tsx` mounts one Shadow DOM companion only in the top-level HTTPS Tinkercad Circuits editor. `src/OhmiApp.tsx` owns placement, open state, appearance and motion. Preserve the approved PNGs and current CSS.
- `src/AssistantPanel.tsx` contains six sections. Chat, analysis, circuit review and sample guides are local demonstrations. Changing account identity remounts the panel, discards private drafts/messages/attachments/selected steps, and cancels pending sample timers. Same-account refresh and navigation preserve state. Appearance and position stay device-local.
- `entrypoints/background.ts` validates messages through `src/backend/validation.ts`. `src/backend/service.ts` owns the only Supabase client, verified-user ownership, PKCE OAuth, on-demand session refresh, profiles, assignments and student-written steps. Content scripts cannot invoke Auth or obtain upload authorization/tokens. `src/useAccount.ts` ignores superseded refresh results.
- Trusted `account.html` owns passwords and XHR uploads. Files go to the private `ohmi-assignments` bucket (PDF/PNG/JPEG, 10 MiB); matching pending metadata, signatures and owner paths are required. `ready` means stored size/MIME verified, not safe AI input. Signed URLs last 60 seconds and open through the worker.
- Shadow DOM isolates styles/events, not confidentiality: host-page scripts can inspect rendered email, filenames, steps and chat text. Keep credentials in trusted extension contexts and consider this boundary before showing sensitive future AI content in the editor.
- Active tables/types: `ohmi_profiles`, `ohmi_assignments`, `ohmi_assignment_steps`; explicit grants, owner RLS, immutable owner/path fields, composite assignment/owner FK. Types intentionally describe the Phase 3 application surface.

## Database history and Phase 4 boundaries

Seven local migration files now match the seven hosted records. The six Phase 4 files were recovered unchanged from Git `981a51f`; they preserve already-applied history and are not new Phase 4 application work. See [migration evidence](PHASES_1-3_STABILIZATION.md#migration-reconciliation).

Existing hosted Phase 4 objects remain: `ohmi_analyses`, `ohmi_conversations`, `ohmi_messages`, `ohmi_tutorial_progress`, `ohmi_ai_requests`, `ohmi_ai_provider_backoffs`; five routines and a progress trigger. All nine OHMI tables have RLS. None of the five routines permits anonymous execution; only `ohmi_save_tutorial_progress` permits authenticated execution. Existing rows and server secrets are retained. No Edge Function is deployed. Do not infer an active AI backend from these resources.

For a separately approved Phase 4 rebuild:

1. Inspect retained objects and the seven applied migrations before designing new names or contracts. Never reset the linked database, rewrite applied SQL, falsify history, or recreate existing tables blindly. Add new reviewed forward migrations. Run migration list and `db push --linked --dry-run --skip-vault` before any authorized push.
2. Reuse worker ownership and private-file authorization. A future server endpoint must verify JWT/user and owned assignment again; validate actual stored bytes, media structure and limits independently. Never trust a UI `accountId`, filename, or `ready` status as authorization/content proof.
3. Keep provider keys/server billing controls outside WXT/client bundles. Make any future responses account-scoped and cancel/discard stale async results on account changes. Define new request/response validation before connecting a provider.
4. Keep student-written steps distinct from generated tutorials. Preserve Phase 3 operations while adding AI. Do not revive archived provider routes, PDF extraction/offscreen code, prompts or validators as assumed working architecture.
5. Screenshot capture belongs to a later approved phase, needs explicit user action and documented browser permissions. Images cannot establish electrical verification. No Phase 4 or Phase 5 work is authorized by this stabilization.

## Required configuration and manual gates

**F2 — identity:** preserve `C:\Users\LEGION\Documents\OHMI - Your Circuit Buddy\.output\chrome-mv3` and extension ID `ikemolangalcofljjajakagdnfdpnakh`. Keep the existing installation and Google OAuth configuration. Owner has no matching public manifest key. Moving this build changes its ID and blocks Google sign-in. See [exact identity steps](PHASE_3_SETUP.md#portable-extension-identity-owner-action).

**F4 — security:** privileged-key rotation is UNVERIFIED. Review/revoke any previously exposed Supabase secret/service-role keys through an owner-approved credential task; do not paste secrets into chat. Leaked-password protection remains disabled; current Supabase documentation requires Pro or above. No paid upgrade or credential change was authorized. See [security steps](PHASE_3_SETUP.md#security-actions-owner-only).

The only API credentials allowed in WXT configuration are the Supabase URL and publishable API key. Keep local `.env` ignored. Preserve registered ID/callback; leave `WXT_EMAIL_DELIVERY_READY=false`. UI and worker both gate registration, confirmation and recovery until SMTP/templates/delivery are verified. Existing confirmed-password login and Google remain available. Never auto-confirm real students as a workaround.

Reload the existing 0.3.0 installation, refresh Circuits, and manually check regular-profile Google consent/cancel/retry, a second intended Google user, real editor wiring/code/simulation, and zoom. Current automated editor tests are simulated. Screen-reader, physical-touch, Chrome-116 and sustained performance checks are not certified.

## Reproduce verification

Run `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser`. Set `OHMI_CHROMIUM_PATH` to an installed Playwright-compatible Chromium if needed. Browser captures default to ignored `.superpowers/stabilization-2026-10-15/screenshots`; `OHMI_SCREENSHOTS_DIR` overrides this.

`node tests/backend-live.mjs` uses exactly two marked disposable accounts on the guarded existing project, then removes only those fixtures. It performs real Auth/Storage/REST/extension tests, but does not automate Google consent. See setup for failure cleanup. Keep fixture credentials and generated output ignored. A fresh disposable local migration replay requires Docker and was not completed in this stabilization.

Recommendation: **NOT READY for an unrestricted portable handoff** until identity/security gates are resolved. Repository transfer and Phase 4 planning can proceed with the owner-accepted original-path restriction and these explicit gates. Phases 1–3 remain the supported foundation; AI remains a demonstration.
