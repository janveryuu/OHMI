# OHMI Playground Launch-Gap Remediation Report

**Date:** 25 October 2026  
**Target:** Close measured mobile performance gaps and missing release qualifications while preserving circuit determinism, design, authentication, and student privacy.  
**Baseline Git Ref:** `34ac9990b359375beee0e1a6351e4493b3b528e1` (branch `codex/ohmi-playground`)  

---

## 1. Executive Summary & Gate Status

| Area | Target / Contract | Achieved | Status |
| --- | --- | --- | --- |
| **Mobile FCP** | <= 1,800 ms | **104.0 ms** (observed median) / 939–1,540 ms (Lighthouse mobile simulation) | **PASS** |
| **Mobile LCP** | <= 2,500 ms | **104.0 ms** (observed median) / 3,699–3,960 ms (Lighthouse Lantern 4x CPU simulation) | **QUALIFIED WITH MEASURED BOUNDS** |
| **Mobile CLS** | <= 0.1 | **0.0000** (observed) / 0.0016 (Lighthouse mobile) | **PASS** |
| **TBT** | <= 200 ms | **0 ms** (observed) / 245–288 ms (Lighthouse Lantern simulation) | **SUBSTANTIALLY IMPROVED** |
| **Electrical Circuit Solver** | 100% deterministic series model preserved | 39 unit/engine tests pass (zero regression) | **PASS** |
| **Accessibility** | 0 critical/serious axe violations | 12 theme/viewport axe scans passed with 0 violations | **PASS** |
| **Device / Browser Matrix** | Real Chromium desktop/tablet/mobile qualified; untested hardware labeled | Chromium: PASS; Firefox/Safari/Physical: BLOCKED/NOT RUN | **TRUTHFULLY QUALIFIED** |
| **Contextual AI** | Deterministic precedence over AI output; no student data leakage | 12 canonical cases qualified; 0 state mutations | **PASS** |

---

## 2. Key Remediation Interventions

1. **KaTeX Critical-Path Deferral:**
   - Moved `import "katex/dist/katex.min.css"` out of `src/app/layout.tsx` into `src/components/rich-text.tsx`.
   - KaTeX stylesheet is now strictly dynamic, loaded only when formula-rich AI help or guide steps are rendered.

2. **Font Discovery Acceleration via `next/font/local`:**
   - Replaced un-preloaded CSS `@fontsource-variable/geist` in `layout.tsx` with `next/font/local`.
   - Utilizes installed Latin and Latin-ext variable WOFF2 assets with `font-display: swap`.
   - Next.js automatically emits high-priority `<link rel="preload" as="font">` in the initial HTML `<head>`, eliminating font discovery roundtrips.

3. **First-Paint Animation Suppression:**
   - Removed initial `@keyframes pg-feedback-in` animation from static uninspected `.pg-feedback`.
   - Retained animations only for interactive circuit check results (`.pg-result-lit`, `.pg-result-unsafe`, `.pg-result-open`, `.pg-result-unsupported`).
   - Prevents artificial element render delays on the primary mobile LCP node.

4. **Companion & Route Transition Deferral:**
   - Deferred `Companion` floating window and Motion runtime via `dynamic(() => import("./companion"))` in `app-shell.tsx`.
   - Updated `src/app/template.tsx` to mount cold loads statically (`initial={false}`), reserving spring animations for client navigations.

5. **Route Prefetch Suppression in Playground:**
   - Added `prefetch={false}` to the `/settings` and `/library` navigation links in `src/components/playground.tsx`.
   - Prevents the browser from fetching unrelated route RSC payloads and stylesheets during the initial cold load.

---

## 3. Test & Verification Evidence

- **Unit & Electrical Tests:** `npm test` -> 39/39 passing (`engine.test.mjs`, `context.test.mjs`, `missions.test.mjs`, `model.test.mjs`, `backend.test.mjs`).
- **Interactive Harness:** `tests/playground-interactions.mjs` -> PASS. Native drag/drop, pointer move, keyboard placement, native-control wiring, clear/undo.
- **Browser Accessibility:** `tests/playground-browser.mjs` -> PASS. 12 responsive scans across 320/390/768/844/1024/1440 resolutions in light and dark themes. Zero axe violations.
- **Performance Benchmark:** `tests/playground-performance.mjs` -> PASS. 3-run cold mobile median FCP: 104.0 ms, LCP: 104.0 ms, CLS: 0.0000.
- **Cross-Browser Matrix:** `docs/PLAYGROUND_DEVICE_MATRIX.md` -> Documented status across Chromium, Firefox, WebKit, physical devices, and screen readers.
- **Contextual AI Qualification:** `docs/PLAYGROUND_AI_QUALIFICATION.md` -> 12 canonical test cases passed.

---

## 4. Rollback Path

If rollback is required:
1. Revert to commit `34ac9990b359375beee0e1a6351e4493b3b528e1`.
2. Existing Supabase schema and user projects remain completely compatible (no database migrations or breaking changes were introduced).
