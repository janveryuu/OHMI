# Antigravity verification & handoff report

15 October 2026, Asia/Manila. Application version: 0.3.0. Active branch: `codex/stabilize-phases-1-3`.

This record documents Antigravity's verification of the stabilized Phase 1–3 foundation and completion of the five handoff requirements prior to Codex authoring a new Phase 4 implementation plan.

---

## 1. Project context & foundation verification

- **Active branch & commit**: `codex/stabilize-phases-1-3`, baseline commit `8b4834f8c89514e2ce3a0f73ecfec0677a4f7104`.
- **Application version**: 0.3.0.
- **Approved mascot integrity**: `assets/mascot/ohmi-pixel-front.png` and built output `.output/chrome-mv3/assets/mascot/ohmi-pixel-front.png` match SHA-256 `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382`.
- **Local memory snapshot**: `docs/antigravity-memory/` preserved read-only per `.agents/rules/ohmi-local-second-brain.md`. No external vault (`CodexSecondBrain`) was accessed or modified.

---

## 2. Five handoff tasks

### Task 1 — Supabase security verification
- **RLS & storage**:
  - All 9 public tables have Row Level Security enabled (`rowsecurity = true`): `ohmi_profiles`, `ohmi_assignments`, `ohmi_assignment_steps`, and retained Phase 4 tables (`ohmi_analyses`, `ohmi_conversations`, `ohmi_messages`, `ohmi_tutorial_progress`, `ohmi_ai_requests`, `ohmi_ai_provider_backoffs`).
  - Storage bucket `ohmi-assignments` is private (`public = false`), with a 10 MiB limit (`10485760` bytes) and allowed MIME types `['application/pdf', 'image/png', 'image/jpeg']`.
  - Storage policies (`ohmi_files_insert`, `ohmi_files_select`, `ohmi_files_delete`) strictly require matching records in `ohmi_assignments` owned by `auth.uid()`, with `status = 'pending'` for inserts.
  - Anonymous requests to REST endpoints for `ohmi_profiles`, `ohmi_assignments`, and `ohmi_assignment_steps` return HTTP 401 with SQL error `42501` (*permission denied*).
  - Routines: None allow anonymous execution. Only `ohmi_save_tutorial_progress` allows authenticated execution; the other 4 routines are restricted to `postgres` and `service_role`.
  - Edge Functions: None deployed (`functions list` is empty).
- **Privileged-key rotation**: **UNVERIFIED**.
  - Default secret key metadata has timestamp `2026-10-12T10:18:30.455943+00:00`.
  - Metadata cannot prove revocation of previously exposed keys. Owner must privately review and revoke exposed secrets via Supabase Dashboard → Project Settings → API Keys.
- **Password-protection advisor**: **WARN**.
  - CLI advisor reports `auth_leaked_password_protection`.
  - Supabase requires a Pro or higher plan to enable HaveIBeenPwned leaked password protection. On Free tier, minimum password length (10 chars), email confirmation requirements, and rate limits remain active.
- **Future AI security boundaries**:
  - Shadow DOM isolates CSS/DOM events but does not guarantee data confidentiality against scripts in the top-level Tinkercad page. Never inject provider keys or raw tokens into the content script.
  - Extension UI/worker must never call AI provider APIs directly; requests must route through a dedicated Supabase Edge Function that independently re-verifies JWT, user identity, and assignment ownership.
  - Upload `ready` status validates only file size and MIME magic bytes; the future AI backend must validate file structure and sanitize text before passing to LLM prompts.

### Task 2 — Real Chrome and Tinkercad verification
- **Automated verification**:
  - `npm test`: 25 passed across 5 test files (`service.test.ts`, `validation.test.ts`, `placement.test.ts`, `preview.test.ts`, `editor-url.test.ts`).
  - `npm run typecheck`: Passed cleanly with zero diagnostic errors.
  - `npm run build`: Production build succeeded in 1.01s (2.23 MB, version 0.3.0).
  - `npm run test:browser`: Executed via Playwright Chromium (`chromium-1243`). Verified mascot visibility, layering, drag/touch/keyboard movement, persistence, 6 sections, navigation, reduced motion, host pointer/key passthrough, and account-switching state clearance.
  - `node tests/backend-live.mjs`: Executed against hosted Supabase `vhmdgfydvoljzqztuxmu` with 2 marked disposable accounts. Verified profile CRUD, interrupted upload recovery, private PDF upload, signed URL generation, student steps, cross-owner/anonymous denial, and clean fixture deletion.
- **Manual acceptance checklist (owner-only gate)**:
  1. Open Chrome regular profile with Developer Mode.
  2. Confirm extension ID `ikemolangalcofljjajakagdnfdpnakh` loaded from `C:\Users\LEGION\Documents\OHMI - Your Circuit Buddy\.output\chrome-mv3`.
  3. Load `https://www.tinkercad.com/things/<id>/editel`. Confirm mascot renders and panel opens.
  4. Perform circuit wiring, component placement, and simulation to confirm zero interference.
  5. Test viewport zoom levels (80%, 100%, 125%, 150%).
  6. Test Google OAuth login, cancel, and retry.
  7. Test private assignment upload, signed URL opening, and sign-out in Account view.

### Task 3 — Preserve extension identity and OAuth
- Registered Extension ID: `ikemolangalcofljjajakagdnfdpnakh`.
- Registered Chrome Callback: `https://ikemolangalcofljjajakagdnfdpnakh.chromiumapp.org/`.
- Unpacked Build Directory: `C:\Users\LEGION\Documents\OHMI - Your Circuit Buddy\.output\chrome-mv3`.
- Manifest Key: Omitted (path-derived ID in developer mode).
- Portability limitation: Moving or cloning the project changes the derived ID and breaks Google OAuth redirect. Preserved at original filesystem path.

### Task 4 — Antigravity project integration
- Repository, branch, and working directory confirmed.
- Tooling verified: Node v24.16.0, npm 12.0.2, Supabase CLI 2.120.0.
- All 7 local migrations match remote migrations 1-to-1; `supabase db push --linked --dry-run --skip-vault` reports `{"upToDate": true}`.

### Task 5 — Documentation & memory handoff
- Stale Phase 4 references reconciled against Phase 3 stabilization.
- Local second-brain memory preserved read-only at `docs/antigravity-memory/`.
- `.agents/rules/ohmi-local-second-brain.md` committed to enforce persistent memory boundaries.
- Project ready for Codex Phase 4 planning.
