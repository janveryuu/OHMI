# OHMI Phase 5 Verification Report — AI Circuit Checker

**Date:** 16 October 2026 (Asia/Manila)  
**Status:** Milestone 1 & 2 (M1 & M2) Verified & Complete  
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

## 3. Test Execution & Verification Evidence

- **Unit Tests:** 137 tests passed across 14 test files in 1.38s (`npm test`):
  * `supabase/functions/ohmi-ai/circuit.test.ts`: 24 tests covering all request and result schema validation rules.
  * `supabase/functions/ohmi-ai/handler.test.ts`: 21 tests covering V1/V2 body size limits (32 KiB vs 6 MiB), version dispatch, 404 on unowned assignments, 400 on visual follow-up misuse, successful atomic completion, cooldown replay without provider call, 409 conflict, 429 in-progress, non-STOP failure ledger recording, and malformed schema rejection.
  * `src/backend/validation.test.ts`: 16 tests including `ai.circuit` sender gating, account UUID validation, and payload validation.
  * `src/backend/service.test.ts`: 12 tests including `ai.circuit` bearer token forwarding and stale-account rejection.
  * `src/capture.test.ts`: 9 tests covering toolbar coordinator, focus/tab invalidation, and claim handoff.
  * All previous mathematical, Arduino, PDF, image, and Gemini tests passing.
- **TypeScript Typecheck:** 0 errors (`npm run typecheck`).
- **Production Build:** Extension bundle built cleanly with Vite 8.3.4 and WXT 0.21.4 (`npm run build`):
  * Total size: 2.28 MB with zero warnings and no externalized node modules.
- **Playwright Browser Tests:** All test suites passed cleanly (`npm run test:browser`):
  * Phase 1 & 2 mascot movement, Shadow DOM isolation, antenna animation.
  * Phase 3 trusted account UI, Google sign-in.
  * Account privacy resets across synthetic accounts with zero hosted writes.

---

## 4. Invariants & Constraints Maintained

1. **Strictly Offline:** Zero live AI provider calls and zero remote Supabase changes were executed during M2 development and verification.
2. **Second Brain Boundary:** Strictly obeyed `.agents/rules/ohmi-local-second-brain.md`; external vault was never accessed.
3. **Mascot Invariance:** Approved pixel-art mascot PNGs (`ohmi-pixel-front.png` and turnaround sheet) remain bit-for-bit identical to source hashes.
4. **Non-Disruptive:** Existing V1 chat, tutorial, and multimodal analysis flows remain untouched and 100% covered by regression tests.
5. **Phase Gate:** Milestone 2 is complete; stopped and awaiting user approval before Milestone 3.
