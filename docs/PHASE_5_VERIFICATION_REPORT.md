# OHMI Phase 5 Verification Report — AI Circuit Checker

**Date:** 16 October 2026 (Asia/Manila)  
**Status:** Milestone 1 (M1) Verified & Complete  
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

## 2. Test Execution & Verification Evidence

- **Unit Tests:** 95 tests passed across 13 files in 943ms (`npm test`).
  - All 9 specified capture coordinator tests in `src/capture.test.ts`:
    * `toolbar_only_can_capture`
    * `unsupported_or_unfocused_tab_is_denied`
    * `tab_switch_and_back_invalidates_capture`
    * `spa_navigation_invalidates_capture`
    * `hide_timeout_restores_overlay`
    * `worker_restart_watchdog_restores_overlay`
    * `claim_requires_intended_check_tab_and_owner`
    * `expired_capture_is_unavailable`
    * `raw_pixels_never_reach_content_script`
- **TypeScript Typecheck:** 0 errors (`npm run typecheck`).
- **Production Build:** Extension bundle built cleanly with Vite 8.3.4 and WXT 0.21.4 (`npm run build`).
  - Created `.output/chrome-mv3/check.html` (492 B) and bundle chunks (total extension size: 2.27 MB).
  - Preserved registered version 0.3.0 and identity warnings.
- **Playwright Browser Tests:** All test suites passed cleanly (`npm run test:browser`):
  - Phase 1 & 2: Mascot movement, keyboard controls, Shadow DOM styling isolation, 3 languages, antenna reduced motion.
  - Phase 3: Trusted account page, credential isolation, Google sign-in UI.
  - Account Privacy: Sign-out / account switch completely purges messages, drafts, attachments, active conversations, and tutorials.
  - Phase 5 M1 (`tests/phase5.mjs`):
    * Open Circuit Review button in Check My Circuit section.
    * `/check.html` loaded with `?intro=1#capture-intro` displaying dismissible explanation.
    * Responsive layout at 320px viewport without horizontal overflow.
    * Local screenshot upload and preview rendering (100x100 px).
    * Numeric crop controls applied (cropped to 60x60 px).
    * Code input counter (`73 / 8,000` or `77 / 8,000`) and simulation counter (`21 / 2,000`).
    * Board selector defaulted to `unknown` and switched to `uno-r3`.
    * Send button verified disabled.
    * Clear all evidence cleans preview, code, and diagnostics.
    * Verified **zero network analysis requests** made throughout the entire flow.
- **Mascot Asset Invariance:**
  - Front pixel PNG: `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382` (100% matched).
  - Turnaround sheet: `2645d82b363645a23e348a53dd9a03f0723e096aded2dca33e6619a8fa8b07fe` (100% matched).

---

## 3. Invariants & Constraints Maintained

1. **No External Network Calls:** Local capture, cropping, and preview operate 100% offline; AI is disconnected.
2. **Zero Auto-Uploads:** Screenshots and pasted code stay in transient memory until user explicit action.
3. **Mascot & Design Preservation:** Exact pixel-art PNGs and teal design system maintained.
4. **Second Brain Boundary:** Strictly obeyed `.agents/rules/ohmi-local-second-brain.md`; external vault was never accessed.
5. **No Hosted Database Changes:** No database migrations or function deployments made to remote instances.
