# OHMI PWA Backend Integration Implementation Plan

> For agentic workers: use superpowers:executing-plans inline. The owner approved M2-M5 and continuous execution; do not ask for repeated milestone approval.

Goal: replace the PWA demonstration with existing ownership-scoped Supabase services and verified AI, preserving the approved app and unified origin.
Architecture: a web Supabase session/data client uses the existing schema and RLS. Authenticated Next endpoints validate files using actual bytes and preserve private storage ownership. A thin ohmi-web entry reuses the existing validated AI handler; deployed legacy ohmi-ai remains untouched; provider secrets never enter Vercel/browser code.
Tech stack: existing Next/React/Radix/Motion, pinned Supabase clients, existing validated Markdown/math and media validators.
Spec: docs/PWA_BACKEND_INTEGRATION_M1_AUDIT.md plus the owner's full integration brief and M2-M5 approval.

## Global constraints
- Preserve /app, landing, mascot, extension, existing data/policies/branches. No paid services, destructive changes or unapproved fallback chains.
- Reuse tables and private bucket; no schema migration unless a concrete reviewed need survives implementation.
- Real success only after confirmed persistence; bounded media; no private service-worker or shared HTTP caching.
- Native Google consent needs the owner's disposable accounts. Owner subsequently confirmed Gemini free-only billing protection before live generation (see execution ledger).

## Review focus
- Account switch/logout while queries/upload/AI responses are pending: abort and discard stale results.
- OAuth cookie and PKCE behavior through official-origin external rewrites; reject untrusted redirect destinations.
- Partial storage success or canceled request: show pending recovery, avoid fake success and destructive ambiguous rollback.
- Empty/unknown/truncated provider response or failed persistence: no success response; preserve request accounting and prevent duplicate sends.
- Mobile independent translate vs transform, short viewports/keyboard and safe-area dock overlap.

## Task 1 - M2 auth and persistence
Files: web-app/src/lib/backend/*, app/auth/callback, app/api/files, components/app-provider, assignments, settings, chat/history, guide/progress.
- [x] Add failing pure boundary/session/query ownership tests; run RED.
- [x] Add pinned web Supabase client and server JWT verification, exact official PKCE callback and account state lifecycle.
- [x] Integrate profiles, private files, conversations/analyses/tutorial progress with existing grants; load/refetch on focus and mutation.
- [x] Validate actual upload/preview/download bytes server-side and preserve pending deletion/retry semantics; test malformed/oversized/unowned inputs.
- [x] Run unit/type/build and auth/data browser fixtures; commit milestone.

## Task 2 - M3 live AI gateway and intelligence
Files: existing supabase/functions/ohmi-ai, web-app chat/checker/guide/rich-text, evaluation harness.
- [x] Test authenticated request contracts, current function/SQL compatibility, persistence failure, history and uncertainty guards.
- [x] Wire real chat/evidence/check/tutorial requests, safe Markdown/math, saved analyses and guide progress. No simulated streaming/success.
- [x] Keep Gemini only; qualify free-only billing protection before bounded live generation. Qwen remains an unqualified candidate.
- [x] Verify reviewed handler release preserves extension contracts and default Gemini; commit milestone.

## Task 3 - M4 UI improvements
Files: layout/theme bootstrap, app-provider, app-shell/dialog CSS, decorative icons.
- [x] Add production/browser regression for More element containment and new-user light theme before hydration.
- [x] Default light without flash; preserve saved modes; remove decorative sparkles only.
- [x] Fix inherited translations and implement the five-control floating dock with safe-area/keyboard behavior; desktop/tablet unchanged.
- [x] Batch desktop/mobile inspection and one fix/confirmation pass; commit milestone.

## Task 4 - M5 verification and release
- [x] Two-account real auth/privacy, upload/preview/download/delete, persistent history/progress, provider errors and approved live evaluation.
- [x] Run unit/type/build, browser/a11y, narrow/short/touch/keyboard/reduced-motion, manifest/offline/cache and official-origin routing.
- [x] Fresh whole-branch review, fix material findings, save concise evidence and rollback record.
- [x] Push approved production branch, confirm Vercel READY/remote commit, run production checks; report exact limits.

## Execution ledger
- M1 b138dd8 supplies the approved audit; primary checkout's unrelated extension work remains untouched.
- 2026-10-24: user approved M2-M5 and can complete two disposable Google sign-ins. Gemini billing/free quota remains unverified; do not generate until qualified.

- Ruling: preserve deployed legacy ohmi-ai for extension continuity; add a thin ohmi-web Edge entry reusing current handler, with separate web feature gates. Existing production v13 lacks the application kill switch and must not be blindly replaced.
- Ruling: retain existing schema/RLS. Curated guide enrollment needs a trusted server write into existing tutorial artifacts; add it to the thin web entry without an AI call or fabricated accounting.

- M2 evidence: two distinct real Google accounts; own private uploads/download/delete and separate saved guide progress pass. Symmetric authenticated-role probes pass; all mutation probes roll back.
- M4 evidence: More reproduced x=-195 at 390px. CSS optimization removed translate:none; explicit zero translation and Tailwind-variable reset fixes the built sheet. Six-size browser matrix passes with zero axe violations.
- Final: fixed conversation hydration and pagination-flag preservation — active-selection and owner-filtered message readiness tests RED to GREEN; sends wait for loaded history.
- Final: fixed terminal AI retry identity — terminal/ambiguous classification test RED to GREEN; all three callers use the shared structured failure.
- Final: fixed checker retry lockout — real paused-service UI reproduced disabled Review; request errors no longer disable retry. Built confirmation pending.
- Final: fixed missing complete Arduino sketch — complete-sketch renderer test RED to GREEN.
- Final: minor (deferred): question statistics count loaded messages.
- Final: minor (deferred): optional checker comparisons/codeSuggestion are not rendered.
- Final: Ruling: keep live AI gated while billing is unconfirmed — prevents unapproved charges — cost: live model quality remains unqualified.
- Final: Ruling: retain explicit recent-list bounds — avoids an unrequested history redesign — cost: records older than 100 files/50 conversations/50 analyses need later pagination.
- Final suite after fixes: 280 root tests and 14 web tests pass; production build/browser confirmation pending.

- Owner subsequently confirmed free-only billing protection; both web and Supabase AI gates enabled for bounded Gemini evaluations. Qwen remains inactive.
- Live evaluation: English calculations, restored-context Taglish and Arduino correction pass; Filipino missing-values clarification passes. Typical-rating safety wording was overconfident, so tutor policy v3 adds an explicit actual-rating requirement; policy regression RED to GREEN, root suite 281/281.
- Live PDF exposed two integration defects: Edge errors are top-level string/code (normalization regression RED to GREEN), and existing completion SQL referenced missing ohmi_analyses.updated_at (hosted 42703). Owner explicitly approved the prepared one-column additive repair; migration 20261024041136 applied. Metadata and rolled-back synthetic completion pass; live retest pending.
- Complete tutorial code now also enters the existing JSON persistence payload; handler regression RED to GREEN.
- Browser-native PDF embeddings were blank in IAB; existing PDF library now renders bounded private pages locally, with page controls and accessible text. Actual page image confirmed.

- Live PDF retest now confirms persisted page-1 facts and explicit missing ratings after the approved migration.
- Live checker correctly rejected a provider response that included steps under needs_clarification. Prompt v4 now explicitly matches validator status invariants; policy regression RED to GREEN. Same-image retry accepted with a fresh identity; result pending.
- Tutorial clarification now stays visible without clearing the goal or claiming a saved complete guide; regression RED to GREEN.
- Latest source checks: root 282/282, web 16/16; both typechecks pass. Private PDF renders actual page 1 with page controls/text in the real IAB.

- M3 final local evidence: saved v2 circuit clarification survives refresh; actual eight-step Arduino tutorial persists complete sketch and step-0 progress. New artifacts remain invisible/undeletable to the other authenticated account.
- Source and tests ready for production: 282 root tests, 16 web tests, both typechecks; built six-size browser matrix zero errors/axe violations. M5 production checks remain.

- M5 production: source bff5592 remote-confirmed on codex/ohmi-web-app-pwa; automatic Vercel deployment dpl_8gRKwfw6bMPCYVCEwi1ecP5khwLv READY. Official-origin six-size browser, landing links/hash, refresh, PWA installability/scope/offline and real two-account PKCE/private file flows pass.
- M5 live production: 5284 KiB upload/preview/download/delete, PDF page rendering, restored full sketch/guide progress, correct saved parallel-resistor calculation after refresh, and missing-value clarification preserving goal all pass. Evidence and exact remaining limits are in web-app/docs/BACKEND_INTEGRATION.md.
- Final review completed; no further review cycle needed. Existing student data, legacy extension function, landing and automatic deployments preserved. Rollback tag ohmi-app-before-backend-integration-2026-10-24 is remote-confirmed at 11f6bbf. Final documentation checkpoint is a normal production-branch push.
