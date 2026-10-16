# OHMI Phase 5 Verification Report — AI Circuit Checker

**Date:** 16 October 2026 (Asia/Manila)  
**Status:** Milestone 1, 2 & 3 (M1, M2 & M3) Verified & Complete  
**Base Commit:** `8270725288974b5ca0685d04ca19fa8fd92b5abf` (on `codex/stabilize-phases-1-3`)  
**Extension ID:** `ikemolangalcofljjajakagdnfdpnakh` (Version 0.3.0 preserved)  
**Mascot Front PNG SHA-256:** `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382`  
**Mascot Turnaround Sheet SHA-256:** `2645d82b363645a23e348a53dd9a03f0723e096aded2dca33e6619a8fa8b07fe`  

---

## 1. Milestone 1 Deliverables Summary

Milestone 1 delivers **local screenshot capture, session handoff, and trusted private preview with AI disconnected**:

1. **Toolbar Capture Coordinator (`src/capture.ts`):**
   - Coordinates toolbar-initiated screenshot capture (`captureFromAction(tab)`) triggered exclusively from `browser.action.onClicked`.
   - Validates active window focus, active tab, incognito rejection, and editor URL gating (`/things/<design>/editel`).
   - Executes content script hide/restore handshake with request nonces, double `requestAnimationFrame` paint wait, and a 2-second timeout.
   - Detects intervening tab switches and SPA navigation, invalidating the capture before pixels can be misattributed.
   - Restores the overlay in `finally` and includes a 3-second companion watchdog that recovers overlay visibility if the worker terminates.
   - Stores at most one pending capture handoff in `browser.storage.session` with an opaque UUID, owner scope, and 5-minute TTL.
   - Binds handoff to the opened review tab ID and purges the session record immediately upon claim.
   - Raw pixels and data URLs are never transmitted to Tinkercad content scripts.

2. **Trusted Review Page (`/check.html`):**
   - Created `entrypoints/check/index.html`, `entrypoints/check/main.tsx`, and `src/CircuitReviewPage.tsx`.
   - Narrowly validated in `src/backend/validation.ts` (`trustedCheck` sender allows `capture.claim`, `account.state`, `profile.language`; preserves `account.html`-only restriction for credentials and upload authorization).
   - Provides local screenshot upload fallback (PNG/JPEG $\le$ 4 MiB) and code-only review options.
   - First-time use explanation banner (`?intro=1#capture-intro`) explaining local viewport capture and privacy boundaries.
   - Interactive crop controls with accessible numeric boundary inputs (X, Y, Width, Height), Cancel, Apply Crop, and "Use full image" confirmation.
   - Optional secondary close-up detail image support with aggregate bounds ($\le$ 4,000,000 pixels, $\le$ 4 MiB).
   - Optional Arduino code input ($\le$ 8,000 characters) with live character counter.
   - Optional simulation diagnostics input ($\le$ 2,000 characters) with live character counter.
   - Board selector (default `unknown` or `uno-r3`).
   - "Clear all evidence" control to revoke object URLs and clear in-memory state.
   - Account-switch isolation: clearing of preview/code/diagnostics when the signed-in account changes.
   - Send button explicitly disabled with label `"Send for analysis (AI Disconnected in M1)"`.

3. **Assistant Panel Integration (`src/AssistantPanel.tsx`):**
   - Added `"Open Circuit Review"` action (`circuit.open`) and clear toolbar capture explanation in Check section.
   - Preserved sample circuit diagnostic flow and demo buttons for unauthenticated testing without breaking existing tests.

---

## 2. Milestone 2 Deliverables Summary

Milestone 2 delivers the **bounded AI Circuit Checker handler offline** with strict schemas, validation invariants, version dispatch, and mock provider regression tests:

1. **Contracts & Schemas (`src/backend/contracts.ts`):**
   - Added `CircuitRequestV2`, `CircuitImageItem`, `CircuitEvidence`, `CircuitCheckResult`, `CircuitFinding`, `CircuitComparison`, `CircuitStep`, `EvidenceReference`, and `CircuitResponseDataV2`.
   - Enforces `schemaVersion: 2`, status enums (`reviewed`, `needs_clarification`, `unsupported`), and severity/certainty enums.

2. **Validation Engine & Prompt Builder (`src/ai/circuit.ts` & `supabase/functions/ohmi-ai/circuit.ts`):**
   - `validateCircuitRequest`: Enforces allowlisted keys, mutual exclusivity of assignment artifacts vs `requirementText`, mode constraints (`check` requires images or code; `follow_up` requires `previousCheckId` and no images), aggregate image bounds ($\le$ 4 MiB decoded, $\le$ 4,000,000 pixels, max 4,096 px per side), universal Base64 decode, and strict UUID formatting.
   - `validateCircuitResult`: Enforces allowlisted keys, sequential 1-based step numbering (1..8), code line references ($1 \le start \le end \le total$, max 20 lines), exact simulation substring citations ($\le 160$ chars), and requirement references matching server evidence.
   - `buildCircuitPrompt`: Separates trusted system instructions from untrusted inputs with clear rules on physical breadboard uncertainty and unobserved wiring.

3. **Production Edge Function Version Dispatch (`supabase/functions/ohmi-ai/handler.ts`):**
   - Implemented request body size gating: 6 MiB overall ceiling (`MAX_BODY_BYTES_V2`), dispatching `version: 1` to 32 KiB limit and `version: 2` to `handleCircuitCheckRequest`.
   - `handleCircuitCheckRequest`:
     * Validates V2 schema and authenticates account ID.
     * Compiles server-verified `CircuitEvidence` (server-selected image IDs, line count, unowned/foreign check/assignment rejection with 404).
     * Computes canonical input SHA-256 hash including individual image hashes and conversation IDs.
     * Reserves quota atomically via `ohmi_reserve_ai` (`p_kind: 'circuit_check'`).
     * Handles exact replay on completed requests during cooldown without calling the AI provider (0 provider calls).
     * Handles in-flight reservation with 429 (`Retry-After: 10`) and parameter conflicts with 409.
     * Invokes Gemini (`gemini-3.5-flash-lite`, 24s timeout, max 3,072 tokens, temperature 0.1, responseMimeType `application/json`).
     * Validates response size ($\le$ 64 KiB), candidate finish reason (`STOP`), non-empty answer, and result schema.
     * Rejects non-STOP (`SAFETY`, `MAX_TOKENS`, incomplete) and malformed results via `ohmi_fail_ai` and returns controlled error categories.
     * Persists exact structured response atomically via `ohmi_complete_ai`.

4. **Service Worker `ai.circuit` Action (`src/backend/validation.ts` & `src/backend/service.ts`):**
   - Restricted `ai.circuit` exclusively to trusted `/check.html` sender (`frameId === 0`).
   - Added authenticated owner verification and stale-account guard before dispatching request.
   - Client abort controller with 28-second deadline.

---

## 3. Milestone 3 Deliverables Summary

Milestone 3 delivers **secure circuit-check persistence, exact result recovery, account-isolated durable history, owned deletion, and assignment requirement comparisons**:

1. **Additive Forward Migration (`supabase/migrations/20261016170000_ohmi_phase5_circuit_check_artifacts.sql`):**
   - **Check Constraint Extensions:**
     * `ohmi_analyses_artifact_kind_check`: Expands allowed kinds to `('analysis', 'tutorial', 'circuit_check')`.
     * `ohmi_analyses_schema_version_check`: Expands allowed schema versions to `(1, 2)`.
     * `ohmi_analyses_assignment_id_required`: Relaxes foreign key constraint to `(artifact_kind != 'analysis') OR (assignment_id IS NOT NULL)`, enabling standalone circuit checks while strictly preserving the mandatory assignment link for Phase 4 analyses.
     * `ohmi_ai_requests_kind_check`: Expands ledger request kinds to `('chat', 'analyze', 'circuit_check')`.
   - **RLS & Deletion Policy:**
     * Granted `DELETE` on `ohmi_analyses` to authenticated users.
     * Created RLS policy `owner_delete`: `((select auth.uid()) = user_id)`.
   - **Reconciled Edge Ledger Routines (`ohmi_reserve_ai` & `ohmi_complete_ai`):**
     * `ohmi_reserve_ai`: Supports `circuit_check` kind with atomic quota reservation, cooldown replay, rate limit enforcement, and token bounds.
     * `ohmi_complete_ai`: Stores exact `CircuitCheckResult` with `artifact_kind = 'circuit_check'`, `schema_version = 2`, neutral conversation user message (`"Circuit review requested"` or `"Follow-up on circuit review requested"`), and a unique per-request fingerprint:  
       `encode(sha256((job.user_id::text || ':' || job.id::text || ':circuit_check')::bytea), 'hex')`.
     * Guarantees two distinct request UUIDs with identical evidence maintain independent result records and separate tutorial progress.

2. **Durable History & Recovery Backend Actions (`src/backend/validation.ts` & `src/backend/service.ts`):**
   - **`analyses.delete`:**
     * Allows owners to delete their circuit checks or analyses (`where id = payload.id and user_id = user.id`).
     * Automatically cascades to linked conversations and tutorial progress without deleting assignments or user-defined manual steps.
     * Protected by account verification and stale-account rejection.
   - **`ai.request.get`:**
     * Recovers exact status, model, operation, timestamps, and completed structured payload for a given `requestId`.
     * Account-isolated: non-owners cannot inspect other users' requests.
     * Returns `status: 'unavailable'` and `result: null` if the corresponding analysis record was deleted.

3. **Requirement Extraction & Edge Comparison Handling (`supabase/functions/ohmi-ai/handler.ts` & `circuit.ts`):**
   - **Assignment Analysis Requirements:** Verified requirement extraction from `assignmentAnalysisId`, passing up to 8 server-selected items into evidence.
   - **Manual Requirement Parsing:** Parses user-supplied `requirementText` into normalized `manual-1` .. `manual-8` requirement items.
   - **Prompt Comparison Directives:** Updated `buildCircuitPrompt` to format active requirements into instructions for model comparisons (`supported`, `possible_mismatch`, `not_observable`).
   - **Envelope Result Identifiers:** Edge handler returns `resultId` and `conversationId` in response envelopes for client linking.
   - **Deleted Check Replay Protection:** Replaying a deleted circuit check immediately yields HTTP 404 with category `'unavailable'`; zero regeneration and zero dummy data resurrection.

4. **Disposable Database Invariants Test Suite (`tests/phase5-database.test.ts`):**
   - Developed isolated test suite verifying all 8 M3 database invariants:
     1. `two_users_cannot_read_or_link_each_others_checks`: RLS simulation proves foreign checks cannot be read, deleted, or linked as `previousCheckId`.
     2. `old_artifacts_survive_forward_migration`: Verified that legacy analysis rows satisfy all updated migration check constraints.
     3. `concurrent_reservation_calls_admit_one_generation`: Concurrency simulation verifies exactly one worker proceeds while duplicate is rejected or placed in-progress.
     4. `same_request_cannot_double_finalize`: Finalizing an already completed request throws immediately.
     5. `two_uuids_with_identical_inputs_keep_distinct_results_and_progress`: Independent fingerprints guarantee separate analyses and isolated tutorial step progress.
     6. `lost_response_restores_exact_result`: Client reconnection via `ai.request.get` recovers exact completed payload.
     7. `deleted_result_stays_unavailable`: Deleted check returns 404 unavailable on replay with zero regeneration.
     8. `assignment_delete_cascade_preserves_unrelated_manual_steps`: Deleting a check or assignment cascades only to its linked conversations/progress, preserving unrelated assignments and manual steps.

---

## 4. Test Execution & Verification Evidence

- **Unit Tests:** 152 tests passed across 15 test files in 1.22s (`npm test`):
  * `tests/phase5-database.test.ts`: 8 tests covering all Milestone 3 database invariants.
  * `supabase/functions/ohmi-ai/circuit.test.ts`: 24 tests covering all request and result schema validation rules.
  * `supabase/functions/ohmi-ai/handler.test.ts`: 24 tests covering version dispatch, unowned check rejection, completed replay with `resultId`, 404 on deleted check replay, and `requirementText` comparison parsing.
  * `src/backend/validation.test.ts`: 17 tests including `analyses.delete` and `ai.request.get` payload validation.
  * `src/backend/service.test.ts`: 15 tests including `analyses.delete` owner check and `ai.request.get` state recovery.
  * `src/capture.test.ts`: 9 tests covering toolbar coordinator, focus/tab invalidation, and claim handoff.
  * All previous mathematical, Arduino, PDF, image, and Gemini tests passing.
- **TypeScript Typecheck:** 0 errors (`npm run typecheck`).
- **Production Build:** Extension bundle built cleanly with Vite 8.3.4 and WXT 0.21.4 (`npm run build`):
  * Total size: 2.28 MB with zero warnings and no externalized node modules.
- **Playwright Browser Tests:** All test suites passed cleanly (`npm run test:browser`):
  * Phase 1 & 2 mascot movement, Shadow DOM isolation, antenna animation.
  * Phase 3 trusted account UI, Google sign-in.
  * Account privacy resets across synthetic accounts with zero hosted writes.
  * Phase 5 M1 trusted `/check.html` review UI, crop controls, and zero AI network requests.

---

## 5. Invariants & Constraints Maintained

1. **Strictly Offline & No Remote Migrations:** Forward migration `20261016170000_ohmi_phase5_circuit_check_artifacts.sql` was authored and validated locally. Zero migrations were executed on the hosted Supabase project (`vhmdgfydvoljzqztuxmu`), and zero live AI provider calls were made.
2. **Second Brain Boundary:** Strictly obeyed `.agents/rules/ohmi-local-second-brain.md`; external vault was never accessed.
3. **Mascot Invariance:** Approved pixel-art mascot PNGs (`ohmi-pixel-front.png` and turnaround sheet) remain bit-for-bit identical to source hashes.
4. **Non-Disruptive:** Existing Phase 4 assignment analyses, tutorial progress, and conversation models remain 100% functional and backward-compatible.
5. **Phase Gate:** Milestone 3 is complete; stopped and awaiting user approval before Milestone 4.
