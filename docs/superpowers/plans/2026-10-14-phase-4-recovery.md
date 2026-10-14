# Phase 4 recovery implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, task by task. The owner has approved immediate execution and has not authorized subagents or merging into main.

**Goal:** Finish recoverable Phase 4 defects, prove saved tutorial behavior, and complete live AI acceptance only when the configured free providers permit generation.

**Architecture:** Preserve the extension and shared AI handler/provider layer. Persist only provider-reported quota backoffs in a service-only table; skip unavailable providers until their reported reset, then automatically prefer Gemini 3.8 again. Test persistence/UI using explicitly labeled deterministic fixtures independently of live model generation.

**Tech Stack:** TypeScript, existing Supabase Edge Function/Postgres/Auth/Storage, Vitest and Playwright. No new dependencies.

**Spec:** `docs/PROJECT_CONTEXT.md`, `docs/PHASE_4_VERIFICATION.md`, and the owner's approved Phase 4 requirements. The original brief is attached at `C:/Users/LEGION/.codex/attachments/34854662-289e-4c1b-bf9b-76006d893538/Pasted text.txt`.

## Global constraints

- Continue from `e6ffefe` on `codex/phase-4`; no main merge or Phase 5.
- Gemini 3.8 primary, Gemini 3.6 fallback, Groq only for compatible text/PNG/JPEG.
- Keys remain server-side. No paid billing, quota bypass, secret logging or deletion of usage history.
- Preserve UI/mascot, verified authentication, ownership/RLS, request limits, timeouts and bounded retries.
- No more speculative schema changes: the final Gemini format requires real acceptance after its provider quota reset.
- A fixture-backed UI pass is not a live AI-generation pass. Incorrect arithmetic cannot count as a quality pass.

## Review focus

1. Concurrent quota responses must never shorten a provider's blocked-until time (Task 1 DB test).
2. A user must not read or alter global provider backoffs (Task 1 RLS test).
3. A blocked primary must not prevent an eligible free fallback, and an expired block must restore primary preference (Task 1 provider tests).
4. PDF must not be forwarded to Groq; invalid HTTP 400 must not loop (existing tests retained, Task 3).
5. Saved tutor completion/resume/account isolation must be testable when AI generation is unavailable (Task 2 real backend/UI check).

### Task 1: Honor provider quota reset times across Edge Function instances

**Files:** new migration from Supabase CLI; `supabase/functions/_shared/ai-core.ts`, `ai-providers.ts`, `ai-handler.ts`; `src/backend/database.types.ts`; `src/ai/providers.test.ts`; `tests/ai-backend.mjs`.

**Interfaces:** `ProviderError(status, message, retryAfterSeconds?)`; `generateWithFallback(keys,input,fetcher,options?)`, where options supplies `backoffs: Record<string,string>` and `onQuota(model:string,seconds:number): Promise<void>`. SQL `ohmi_defer_ai_provider(p_model text,p_retry_after integer)` records an atomic, monotonically extending backoff.

- [x] Write provider tests: a future backoff makes zero calls to that model; expiry restores primary; HTTP 429 records the supplied delay; all eligible providers blocked produces a reset hint without provider calls.
- [x] Run targeted tests; observe expected failures before implementation.
- [x] Add `ohmi_ai_provider_backoffs(model,blocked_until)` with RLS and service-only grants; whitelist existing models. Validate seconds in 1..172800; use greatest(existing deadline,new deadline). Do not modify prior migrations/history.
- [x] Wire bounded service-only reads/writes to the existing handler and record provider Retry-After/RetryInfo. Use a conservative 60-second pause only when HTTP 429 has no valid delay; never imply that it confirms quota availability.
- [x] Add local two-account tests for denied client reads/writes/RPCs, rejected invalid model/delay, and a shorter concurrent update retaining the longer deadline.
- [x] Run unit suite, local DB checks, TypeScript; commit verified implementation.

### Task 2: Verify saved tutor/UI flows without consuming provider quota

**Files:** `tests/saved-tutor-live.mjs`, `tests/fixtures/phase-4/tutorial.json`, `tests/backend-live.mjs`, `tests/ai-extension.mjs` only where needed.

**Interfaces:** `testSavedTutorLive(env,clients,fixtures,query)` uses the existing guarded fixture query and cleanup; `OHMI_AI_SAVED_TUTOR=1` selects it. Model metadata must explicitly say `offline-test-fixture`, not impersonate an AI provider.

- [x] Create a concise manually verified LED fixture: 5 V, 2 V drop, 220 ohms, approximately 13.6 mA; quantities 1 each; series resistor/polarity; complete D9 setup()/loop() code labeled untested.
- [x] Add a self-check that rejects the recorded 9 mA error and validates the fixture with the actual parser, before any live fixture writes.
- [x] Create only guarded disposable users/owned file/analysis rows; assert second-account denial, progress save/reload and deletion. No AI requests or fabricated usage rows.
- [x] Run the real extension against Supabase with a simulated editor: saved tutor resume/completion, current-step chat context, general chat, responsive layout. Capture output in this plan's ignored workspace.
- [x] Report it as a real backend/UI fixture check, not fresh AI generation; commit passing changes.

### Task 3: Final deployment, controlled live checks and report

**Files:** `docs/PHASE_4_VERIFICATION.md`, this plan and necessary test fixes only.

- [ ] Review the diff for security, eligibility, cooldown expiry/races, arithmetic checks and preserved UI; no subagent dispatch.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and relevant DB/UI regressions. Scan changed/build files for credentials; verify mascot hash.
- [ ] Apply only the tested new migration to the existing linked project, run advisors and deploy `ohmi-ai`.
- [ ] Reuse authoritative provider reset observations to seed backoffs without sending known-blocked Gemini requests. Test only an eligible free provider once to establish its current availability/reset.
- [ ] If quota is available, test PNG, JPG, PDF one at a time, checking 13.6 mA, component quantities, code, cache, ownership and progress; then English/Filipino/Taglish step explanations.
- [ ] If quota is still exhausted, stop live generation until provider reset. Record exact blocked gates and retry time; do not mark Phase 4 complete.
- [ ] Clean only recorded disposable fixtures; retain usage history. Commit/push verified changes to `codex/phase-4` and confirm the remote commit.

## Completion rule

Phase 4 is complete only after genuine live Gemini file generation, PNG/JPG/PDF analysis, correct tutor arithmetic, saved tutor behavior and English/Taglish responses pass. Provider quota is an external blocker, not a code error that can be truthfully removed through retries or an offline fixture.
