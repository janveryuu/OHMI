# OHMI critical multimodal reliability — AGY execution plan

**Status: investigation and plan only. Owner approval required before implementation.**

Scope: Circuit Checker and assignment-specific PNG/PDF Your Path generation. No source, migration, secret, deployment, student record or Git-history changes were made for this investigation. Only this plan is created. No inference was invoked.

## 1. Verified baseline and evidence boundaries

- Repository/production frontend source: `537d3667314c3339e5de11bce0b8b48bc8556ec0`; Vercel latest production deployment is READY at that SHA.
- Supabase project: `vhmdgfydvoljzqztuxmu`. Current `ohmi-ai` version22 and `ohmi-web` version14 are ACTIVE. Existing gateway `verify_jwt=false` relies on handler JWT verification; preserve that verification.
- Current media route is hardcoded `gemini-3.8-flash` in `supabase/functions/ohmi-ai/provider-policy.ts`. Chat's Groq route is unrelated and must remain unchanged. The previous release downloaded and matched deployed handler/policy source; current versions remain those matched versions.
- The incident timestamps precede the latest Ask-only release. Do not claim the current version produced those exact historical requests; their media transport/error paths are unchanged by that chat release.
- Sanitized aggregate database read over48hours found **two failed `circuit_check` requests**, modelGemini3.8, code`timeout`, average elapsed40.75s, latest `2026-10-28 08:31:57 UTC` (16:31:57 Manila).
- It found **one failed `tutorial`**, modelGemini3.8, code`unavailable`, elapsed7.76s, timestamp `2026-10-28 08:38:47 UTC` (16:38:47 Manila). No user messages, files, identity fields or result payloads were retrieved.
- Installed `ohmi_reserve_ai` definition checks show **no application token-minute gate and no cooldown lookup**. Prior owner-approved parity migration removed provider RPM/RPD/TPM/TPD, user/project daily and global-one-pending admission checks. Request-key idempotency and60s request leases remain.
- Stored Gemini limit rows show enabled=true,12RPM,1200RPD,32000TPM,TPD=null for3.8/3.6/3.5Flash-Lite. These are historical configuration rows, **not verified Google entitlements and not currently enforced admission quotas**. Do not blindly re-enable or raise them.
- A more detailed sanitized-error/usage query failed because the CLI temporary database role could not authenticate (`SQLSTATE 28P01`); other bounded read-only queries succeeded. Do not change credentials to work around this during planning. Underlying HTTP status, Retry-After, original provider body, per-request image dimensions, prompt bytes, stage timing and actual usage are not established. No provider-console quota/billing access was asserted.

### Root-cause classification

**Confirmed mechanisms:**

1. Circuit Checker reaches the bounded Gemini transport, which times out before returning a validated result. `providerTimeout(true)` allows at most40s within50s overall, reserving5s for persistence. Transport abort covers headers and body. Database elapsed40.75s fits that mechanism. This is not proof of CPU image processing taking40s.
2. The tutorial's generic message conflates rate limiting and availability. Gemini HTTP429 maps to `rate_limit`; HTTP502/503 maps to `unavailable`. Both are displayed as “busy or rate limited.” Its stored `unavailable` code supports the availability path, **not a confirmed429**. Raw original status remains unknown.
3. Gemini request construction removes `maxOutputTokens` whenever an image/PDF is present. Thus caller budgets tutorial4096/check3072 are **not sent for the failing media workflows**. This is a confirmed bounded-output configuration regression and a plausible contributor to latency, not proof of the provider's actual internal delay.
4. Fresh tutorial completion saves through `ohmi_complete_ai`, but the V1 response omits the created artifact ID. `GuideGenerator` expects `analysisId`; its fallback reads `app.analyses` captured before `await app.refresh()`. A successful generation can therefore select an old guide or fail to activate the newly saved guide. This is independent of the current upstream failures.

**Unverified hypotheses requiring the limited evidence work below:** provider overload; account/model quota/capacity; time to first byte versus body generation; excessive image detail/prompt/schema length; repeated tutorial instructions; hidden reasoning consuming generation time. Image crop resolution or schema complexity may contribute, but no incident-specific dimensions/tokens prove it. Validation/persistence cannot explain the observed transport-timeout message because those stages follow successful transport; they still need regression testing.

## 2. Exact path and compatibility map

- Checker: `web-app/src/components/circuit-checker.tsx` crops/encodes evidence and sends V2 through `askBackend`; `web-app/src/app/api/ai/route.ts` authenticates/proxies to `ohmi-web`; shared `handler.ts` validates media/ownership and registers the request, builds `circuit.ts` prompt and `schemas.ts` output contract, calls Gemini, validates grounded output, then atomically saves.
- Guide: `web-app/src/components/saved-guides.tsx` sends V1 `operation:tutorial` plus selected `assignmentId`. Handler retrieves the owned ready original from private Storage, validates PNG/PDF, assembles tutorial instructions/schema, calls Gemini, validates with `tutorial.ts`, completes the artifact, then generator refreshes and activates it. `guide.tsx` derives the interactive steps/progress from the saved tutorial.
- Time envelopes: extraction image/PDF operations25s; tutorial/checker40s; overall Edge50s with5s save reserve; frontend proxy55s; Vercel route maxDuration60s; DB lease60s. Preserve these relationships initially. Do not increase deadlines as the first fix.
- Supporting contracts: `src/backend/contracts.ts`, both backend `database.types.ts` files, `web-app/src/lib/backend/ai.ts`, `guards.mjs`, `data.ts`, request recovery route `web-app/src/app/api/ai/requests/[id]/route.ts`, `src/backend/service.ts`, and `supabase/migrations/20261028063000_dormosaur_provider_parity.sql`.

## 3. Sequential implementation milestones

### M0 — Close only the incident evidence gap

Read-only first. Recover sanitized provider-status metadata for the three incidents if available. Do not retrieve student prompts, images, signed URLs or full provider error bodies. Check any configured Supabase logs capability before using it; existing database codes alone cannot distinguish502 from503. If incident logs have expired, record that and proceed with deterministic offline reproductions rather than rerunning student inference.

Proposed files: `handler.ts`, `groq.ts` shared transport helpers, `handler.test.ts`, `reliability.test.ts`.

Add bounded operational fields/events for request correlation, operation/model, provider HTTP status, normalized reason, Retry-After seconds, input byte/dimension counts, prompt/schema byte counts, output ceiling, first-header/body timing and save/validation durations. Never log credentials, prompts, image bytes, IDs of students, signed URLs or raw generated text. Keep public `Server-Timing`; persist only minimal sanitized categories if necessary. Prefer existing diagnostics over a new table. Any schema change requires a separate reviewed additive migration.

**Acceptance:** fixtures separately demonstrate local admission rejection, upstream429, upstream503, timeout before headers, timeout during body, schema rejection and save failure. Each has an accurate code and phase. No screenshot progress label is treated as backend telemetry.

### M1 — Restore bounded generation and accurate availability handling

Files: `handler.ts`, `schemas.ts`, `provider-policy.ts` only if error/readiness typing requires it; `handler.test.ts`, `reliability.test.ts`.

1. Write failing assertions that image-backed tutorial and V2 checker serialize their existing4096/3072 `maxOutputTokens`; PDF tutorial must do the same. Then remove the media exception that discards the caller's output ceiling. Include reasoning in usage accounting; never expose it.
2. Keep current model, key,40s tutorial/check timeout and overall save reserve. Verify supported Gemini reasoning parameters against current official model documentation before changing them. Do not copy incompatible Gemini2.5 settings or assume changing hidden-reasoning display reduces computation.
3. Preserve provider429 vs503/502 distinction and safe Retry-After metadata. Return a specific quota/capacity message when classification is supported; otherwise say the provider is unavailable, not that a minute will definitely fix it. Do not retry automatically, rotate keys, or invoke chat fallback for media.
4. Unknown usage must remain explicitly unknown or conservatively estimated in diagnostics. A compatibility reservation value of1 is not measured usage or proof of free capacity. Never rewrite historical usage or completed snapshots.

**Acceptance:** all media request-body fixtures contain the intended ceiling, no incomplete structured answer is saved, timeout/503/429 are distinct, one user action invokes at most one multimodal inference. No new TPM limits are inferred from stale rows.

### M2 — Reduce proven media/prompt costs without losing circuit evidence

Files: `web-app/src/components/circuit-checker.tsx`, `supabase/functions/ohmi-ai/image.ts`, `pdf.ts`, `circuit.ts`, `tutor-policy.ts`, `schemas.ts`, corresponding focused tests.

- Measure source dimensions, encoded size, prompt/schema length and preparation duration on synthetic supported screenshots before selecting a resize threshold. Existing crop creates a canvas at selected source resolution; do not equate byte limits with pixel/token efficiency.
- Reuse existing crop/validation. Test a bounded overview plus explicit detail crop when needed; only downscale if labels, pin numbers and wire endpoints remain legible in reviewed fixtures. Keep private original files intact. Do not add mandatory OCR, send base64 to Groq, or claim wire connectivity from pixels alone.
- Remove duplicated tutorial instructions in handler/policy only after comparing full assembled prompts. Keep electronics safety, language, source grounding, concise steps and complete required Arduino sketch. Bound verbose schema fields with justified limits while retaining all required evidence/uncertainty fields.
- PDF: preserve page boundaries and citations; select relevant extracted pages/text only when confidently applicable. Retain native document/image evidence for diagrams. Never treat empty extraction as an empty assignment or replace unreadable diagram content with guesses.

**Acceptance:** no cropped-off labels in fixture comparison; code/schema remains complete; ambiguous screenshots request clarification; frontend preparation plus mocked provider roundtrip has reproducible before/after timing. Claims about real Gemini improvements wait for approved live verification.

### M3 — Repair the saved Your Path contract

Files: `handler.ts`, `web-app/src/components/saved-guides.tsx`, `guide.tsx` only as needed, `web-app/src/lib/backend/ai.ts`, request recovery route, `src/backend/contracts.ts` and service response normalization where needed. Reuse existing DB completion function unless tests reveal a persistence defect.

1. Add a failing PNG/PDF tutorial test proving completion creates an owned `tutorial` artifact linked to the selected assignment.
2. Return the exact committed artifact ID from `completeRes.data.id` as a stable tutorial `analysisId`/`resultId` contract. Normalize recovery responses to the same identifier. Do not generate a client placeholder or select “latest guide.”
3. Generator must activate that specific ID after refresh, without reading stale closure state. Keep selection/goal until save and display are confirmed; if refresh fails, recover the same UUID and artifact without regeneration. Add a synchronous submit guard if absent; preserve explicit cancellation/account-change sequence checks.
4. Keep `needs_clarification` distinct from successful tutorial. Validate sequential1–24steps, nonempty instruction/why/check, components, objective and complete code when needed. Preserve source references and original assignment hash/ID. Never fabricate defaults that make an invalid guide look successful.
5. Regression: old curated guides, prior generated guides and saved step progress stay readable. No in-place migration/backfill of student content.

**Acceptance:** PNG A and PDF B produce separate assignment-specific guides; the newly committed guide opens even when older guides exist. Reload/UUID replay opens the same artifact, and ambiguous save produces no duplicate artifact/inference. Cross-account file/guide access fails.

### M4 — Offline verification gate

Extend existing `supabase/functions/ohmi-ai/handler.test.ts`, `reliability.test.ts`, `circuit.test.ts`, `tutorial` validation coverage; `supabase/tests/ai_reliability.sql`; `web-app/tests/ai-recovery.test.mjs` and a focused generator/checker browser test using the current Auth/API fixture.

Required matrix: PNG/PDF/no attachment; correct vs foreign/unready/missing assignment; complete/clarification/malformed/truncated output;429/502/503/timeouts; save acknowledgement loss; refresh failure; duplicate click; cancel/account switch; same UUID replay; older guides present; old progress preserved; English/Filipino/Taglish; visible observations versus unobserved wiring; full Arduino sketch.

Run focused failing tests before fixes, then root/PWA suites, both relevant typechecks/builds and Deno checks for both Edge entrypoints. SQL tests must use synthetic users and rollback-only transactions. Mock provider timing and payload limits; do not silently invoke live suites. Record actual counts rather than reusing historical passing totals.

**Gate:** all offline contracts pass, one invocation/action, no partial structured save, exact artifact recovery, no ownership regressions and comparable synthetic timing reported. Passing mocks do not prove provider availability or educational accuracy.

## 4. Free-capacity and live verification gate — separate approval

Before any inference, owner must approve the exact model, requests and token envelope after read-only account-console evidence establishes current free eligibility, active model-specific RPM/RPD/input/output quotas and remaining capacity. Do not activate billing or infer eligibility from `FREE_TIER_CONFIRMED`, model listing, API-key presence or historical limit rows. Shared Dormosaur keys share project capacity; an idle app does not establish unlimited/free capacity.

Proposed maximum: **three explicit calls**, one synthetic checker image, one PNG tutorial and one PDF tutorial, each with a fresh request UUID and the existing output ceilings (3072/4096/4096). Set a conservative input envelope before approval from prepared media/prompt sizes; approve only if the actual free capacity covers it plus a safety margin. Space requests according to verified quotas, not a guessed universal wait. No automatic retries or fallback; stop on the first429, unknown billing eligibility or ambiguous completion. Query recovery before another action. Use synthetic owner-controlled materials and remove only disposable test accounts/records afterward with authorization.

Record exact model, timings by stage, usage including reasoning, output completeness, correct source-specific electronics facts, saved guide ID, reload/recovery and owner isolation. Targets: zero upstream errors across these three calls and completion within existing budgets; a small smoke test is not an uptime guarantee. If Gemini3.8 remains unusable, present an evidence-backed free-capable model alternative for **separate owner approval**, never silently switch.

## 5. Deployment and rollback — execution only after approval

1. Preserve baseline SHA537d366 and current Edge versions22/14. Create a focused branch/worktree at execution time; preserve any newer work.
2. Ship backward-compatible response/error fields first. If a migration is actually required, rehearse it and RLS checks in rollback-only transactions, then apply only that additive migration. Do not re-enable historical quotas without verified entitlement and explicit policy approval.
3. Deploy both `ohmi-ai` and `ohmi-web` because they share the handler. Preserve gateway configuration and handler Auth checks. Inspect ACTIVE versions and download/compare the deployed changed source.
4. After explicit release approval, commit/push reviewed source/tests/docs and deploy the PWA. Verify exact SHA and production READY status. Any production inference remains behind the separate live gate above.
5. Roll back with ordinary revert/redeploy, never force-push/reset or delete student rows. Keep additive fields, request snapshots, request IDs, original private files and progress. Do not silently restore older global/TPM restrictions while rolling back UI/transport code. Pause the affected workflow through the existing operational switch if safe availability cannot be established.

## Stop condition

This is the deliverable for owner review and AGY execution. No implementation, commit, push, migration, secret update, deployment or paid/live inference is authorized by creating this plan. Exact Google-side timeout/availability causes remain unproven until sanitized phase evidence and separately approved free-capacity tests establish them. Free operation depends on verified provider terms/capacity; no application change can guarantee perpetual free provider availability.
