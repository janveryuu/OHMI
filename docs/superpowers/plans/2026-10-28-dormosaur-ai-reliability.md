# Dormosaur-to-OHMI AI Reliability Implementation Plan

> **Superseded implementation proposal:** The owner explicitly rejected retaining OHMI token quotas. Follow `2026-10-28-dormosaur-exact-provider-parity.md` for implementation. This document remains historical analysis only; its proposed quota gates and attempt-ledger design are not the approved direction.

> **For agentic workers:** After owner approval, use superpowers:executing-plans to implement task by task. This document authorizes no implementation or deployment.

**Goal:** Adapt Dormosaur's bounded provider failover and honest degraded responses to OHMI while correcting excessive admission pressure.

**Architecture:** Keep OHMI's authenticated Supabase Edge gateway, existing transports, immutable request results, and private student records. Add bounded text-chat candidates and attempt accounting inside that gateway. Keep multimodal workflows on a verified capable Gemini route.

**Tech stack:** Existing TypeScript, Deno Edge Functions, PostgreSQL/Supabase, Next.js PWA, Vitest and Node tests. No new runtime dependencies.

**Spec:** Owner's 28 October 2026 request: investigate DORMOSAUR and OHMI, explain every AI integration, then provide a plan only. Existing constraints: `docs/PROJECT_CONTEXT.md` and `docs/ai-reliability/`.

## Evidence and limits

- Reviewed OHMI checkout `cdf9548` and DORMOSAUR checkout `4dc750f`. Both began clean. Source findings describe these checkouts, not independently downloaded production functions.
- Inspected DORMOSAUR's public landing page through Agent Reach's Jina reading path. The landing page loads, but reveals neither runtime credentials nor successful authenticated model calls.
- Ran `node scripts/test-copilot.mjs` in DORMOSAUR: **39 tests passed, zero failed**. These are offline tests with provider doubles. They establish logic behavior, not present provider availability or production latency.
- DORMOSAUR `.env.local` contains nonempty `GROQ_API_KEY` and `GEMINI_API_KEY`; no matching DORMOSAUR provider/model overrides were found there. Values were not printed. Present does not mean valid or identical to production.
- No fresh Graphify graph exists in either checkout. Scoped source searches supplied the evidence.
- Did not run billable inference, inspect provider account dashboards, read student conversations, change settings, apply migrations, push or deploy.
- Prior OHMI notes describe chat output budget 1536. **Current reviewed handler passes 2560 for ordinary chat.** Runtime budget must be verified against deployed source; older memory is not authoritative.

## 1. Exact failure mechanism in OHMI

The screenshot's message is an exact match for the SQL exception in `supabase/migrations/20261025155935_ai_reliability_snapshots_and_admission.sql:121`.

`ohmi_reserve_ai` sums the preceding minute's rows for the selected model, then adds this request's estimate:

```text
SUM(MAX(reserved_tokens, accounted_tokens OR 0)) + new_estimate > configured_tpm
```

This runs before a fresh provider call. The handler returns its text as HTTP 429 with a fixed 60-second retry hint. Therefore this specific message identifies OHMI's admission gate; it does not establish that Groq returned a 429.

The checked-in provider-limit seed sets both Groq models to 6400 TPM / 160000 TPD / 24 RPM / 800 RPD. The 120B model is enabled; 20B is disabled. Gemini entries use 32000 TPM / 12 RPM / 1200 RPD. Those are application configuration values, not proof of today's account entitlement.

Contributors supported by source:

1. **Completed reservations never shrink in this calculation.** A response using fewer tokens still contributes at least its original reservation throughout the minute and day windows.
2. **The reservation includes maximum output.** The current chat estimate reserves 2560 output tokens plus approximately half the UTF-8 byte count of policy, question, code and retained history. Short visible answers can therefore consume large local reservations.
3. **History still costs tokens.** OHMI already limits canonical history to at most eight messages, 4000 characters total, and 2000 characters each. Dormosaur allows more history; blindly copying its limits would increase OHMI's prompt pressure.
4. **Quota is shared across users for that model.** A new conversation or a short greeting does not reset earlier requests' reservations.
5. **No automatic alternate route exists.** `provider-policy.ts` explicitly prohibits cross-provider fallback. The configured 20B alternative is allowlisted but not automatically attempted.
6. **The estimator does not describe the final prompt completely.** The handler appends calculations, Arduino warnings, prior circuit observations and operation instructions after admission. A corrected estimator must use the final assembled payload, with safe multimodal allowances.

Illustration, not a measurement of the screenshot: two reservations of 3500 tokens exceed 6400 TPM even when both visible replies are short. If one request's own estimate exceeds its model cap, waiting cannot fix it. The handler must trim eligible context or report an oversized request separately.

Unknown without read-only runtime evidence: exact stored TPM value, current ledger rows, request estimate, deployed handler budget, other users' traffic, upstream quota, and whether the same provider organization serves both projects. The failure origin is established in source; the exact trigger remains unmeasured.

## 2. What Ask Dormosaur actually does

Source root: `C:/Users/LEGION/Documents/DORMOSAUR`.

1. `app/api/chat/route.ts` authenticates a non-anonymous Supabase user and applies a 20-request/minute, per-user Copilot bucket.
2. `lib/copilot/input.ts` bounds the request body at 64 KiB, accepts only user/assistant roles, requires a final user message, and retains at most 24 messages / 16000 characters. Individual user messages cannot exceed 3000 characters.
3. `lib/copilot/context.ts` fetches the current user's profile, classes, alarms and deadlines concurrently with five-second aborts. Ownership filters and session-bound clients protect records. Normalization allowlists fields; snapshot assembly strips record IDs.
4. `lib/copilot/service.ts` checks request scope and safety, then answers narrow recorded-data questions deterministically. These successful local responses invoke no model.
5. Other questions use the candidate chain below. Each attempt receives at most 6500 ms, with a shared 22000 ms generation deadline. The route's overall Vercel limit is 40 seconds.
6. Each AI response must contain valid JSON with a nonempty `reply` and a supported `scope` value. The service rejects false action claims, exposed key patterns and prompt leakage.
7. A repeated answer can trigger one extra generation across the whole turn, within the same deadline. Persistent repetition advances to another candidate.
8. If every candidate fails, `fallbackReply` returns a clearly marked limited-mode response. Social replies, recorded facts and general planning suggestions can still appear useful without successful AI inference.
9. The API supplies `mode`, model identity and label. `components/ai/chat-widget.tsx` renders AI/model, Local reply, or Limited mode badges. A provider's returned model identity takes precedence over its configured alias.

### Models and routing

| Integration | Provider/model in reviewed source | Behavior |
|---|---|---|
| Ask Dormosaur primary | Groq `openai/gpt-oss-120b` | Default when Groq key exists |
| Ask Dormosaur second candidate | Groq `openai/gpt-oss-20b` | Same Groq key; different model |
| Ask Dormosaur third candidate | Google `gemini-2.5-flash` | Independent Gemini key and chat prompt |
| Schedule image/PDF/text extraction | Google `gemini-3.8-flash` default | Separate `lib/gemini.ts`; schedule override supported |
| Deadline text extraction | Groq `openai/gpt-oss-20b` | Up to 3000 output tokens; local parser fallback |
| Deadline image/PDF extraction | Schedule Gemini adapter | If needed, OCR followed by text extraction/local parsing |
| Schedule edit interpretation | Groq `openai/gpt-oss-20b` | Up to 300 tokens; deterministic extraction first; validates explicit changes |
| Recipe generation | Groq `openai/gpt-oss-20b` | Up to 1600 tokens; validates recipe; safe local recipe fallback |
| Schedule-aware recipe selection | Groq `openai/gpt-oss-20b` | Up to 500 tokens; selects only allowed recipes; local selection fallback |
| Smart alarm nudge | Groq `openai/gpt-oss-20b` | Up to 60 tokens; deterministic text fallback |
| Weekly digest | Groq `openai/gpt-oss-20b` | Up to 180 tokens; deterministic digest fallback |

These are existing hosted models, not a custom model trained by Dormosaur. Groq is the inference provider for OpenAI's GPT-OSS models; Google supplies Gemini.

`providerConfigs` can reorder chat candidates through `DORMOSAUR_COPILOT_PROVIDER`. Primary model override is `DORMOSAUR_COPILOT_MODEL`; provider-specific overrides are `DORMOSAUR_COPILOT_GROQ_MODEL` and `DORMOSAUR_COPILOT_GEMINI_MODEL`. The small Groq fallback has its own `DORMOSAUR_COPILOT_GROQ_FALLBACK_MODEL`. Schedule uses `DORMOSAUR_SCHEDULE_MODEL` independently.

### Request details and specialized paths

- Chat Groq adapter: raw server-side fetch; temperature 0.45; `max_completion_tokens: 1600`; JSON-object response. Gemini chat: temperature 0.45; `maxOutputTokens: 1800`; JSON MIME output. Both carry bounded recent history and a separate read-only data snapshot.
- A failed chat attempt returns null and advances. This includes 429, authentication, model unavailable, provider error, network, timeout and invalid output. That broad fallback policy preserves availability but can mask configuration failures unless diagnostics are reviewed.
- Specialized Groq SDK clients disable implicit retries. Timeouts are 8 seconds for nudge/digest, 10 seconds for recipes, and 12 seconds for deadline parsing/schedule editing.
- Schedule Gemini calls use a 25-second timeout, JSON MIME and temperature 0.1; no explicit output-token ceiling is set in that adapter.
- Schedule uploads get at most two image attempts, only for empty extraction. Known auth/quota/model failures do not trigger the same-provider OCR-text retry. OCR/local parsing and paste-text paths remain available. A transient network/provider failure may get one OCR-text Gemini pass.
- Deadline import first tries Gemini for media, then OCR if needed, then Groq on extracted text, then a deterministic date parser. Successful extraction still requires normalization.
- The code has two real AI providers. OCR, template responses, rule-based parsing and local recipe selection are not additional AI providers.

### Why it can feel faster and more reliable

Small deterministic features avoid model latency. Narrow model outputs are cheaper than open-ended tutoring. A failed primary can be replaced by another model/provider. A full outage can still yield a useful response. None of this removes upstream quotas.

Dormosaur's API guard uses an in-memory Map, with a source comment acknowledging that it is not a distributed quota ledger. It has no equivalent durable per-model token-minute admission check in these paths. This explains why OHMI's exact local error does not appear there; it does not prove unlimited capacity.

Its chat response-size check happens after `response.text()` and does not record provider token usage. OHMI already has stronger bounded-body transport and usage accounting. Preserve those protections.

## 3. Recommended adaptation

Copy the reliability pattern into OHMI's existing backend. Do not transplant Dormosaur's schedule/domain code or replace OHMI's gateway.

- Plain Ask OHMI and Playground help: eligible candidate order **Groq 120B, Groq 20B, Gemini text**. Keep 120B primary initially; evaluate 20B quality and latency before making it primary.
- Use OHMI's existing approved `gemini-3.5-flash-lite` as the proposed Gemini text candidate, subject to actual account readiness and qualification. Dormosaur's `gemini-2.5-flash` is an observed source default, not a reason to downgrade OHMI automatically.
- PDF, image, tutorial, circuit review and artifact-grounded follow-up: preserve the capable Gemini route and current schemas. Do not send images/PDFs to GPT-OSS or present local text as an analysis result.
- Route-ready, local quota-full, upstream 429/5xx, unavailable model and invalid response may advance to another independently eligible candidate. Global/user daily caps, disabled AI, safety refusals and authorization failures must not be bypassed.
- A timeout can leave upstream work running. Do not overlap attempts; preserve its unknown usage reservation. Proceed only within a bounded cancellation/accounting policy, otherwise return recoverable limited status.
- Reserve each actual attempt atomically. One user turn remains one logical request with one persisted answer and one recovery UUID.
- Keep genuine local capability small: identity/status, existing deterministic calculations and curated Library references. During outage, state limitations. Never fabricate circuit findings or claim electrical verification.

## 4. Implementation tasks after approval

### Task 1: Establish runtime evidence and reproduce the admission failure

**Files:** `docs/ai-reliability/README.md`; `supabase/functions/ohmi-ai/handler.test.ts`; `supabase/tests/ai_reliability.sql`.

- [ ] Read deployed handler version, installed function definitions, limit rows and redacted aggregate request usage. Record estimates, actuals and timestamps without conversation content or user identifiers.
- [ ] Read account-specific Groq/Gemini limits, model access and free-only eligibility. Check whether both apps share organization/project quota; compare account identity privately, not key strings in logs.
- [ ] Add a failing reproduction using two short completed requests with large reservations. Add single-request-over-cap and unknown-usage failure cases.
- [ ] Distinguish application TPM, upstream TPM, per-user daily cap and in-flight contention in the expected API codes.
- [ ] Verify failure before changing behavior. Record baseline latency by stage using synthetic data only.

**Acceptance:** Explain one reproduced failure numerically; identify actual runtime/source differences. Do not raise limits based on public examples.

### Task 2: Correct prompt budgeting and admission semantics

**Files:** `supabase/functions/ohmi-ai/handler.ts`, `handler.test.ts`, `reliability.test.ts`; a new timestamped migration after the latest repository migration; matching SQL regression tests. Do not edit historical migrations.

- [ ] Assemble final provider prompt before estimating. Reuse that exact prepared payload for transport; include all appended context and verified media allowances.
- [ ] Set ordinary plain-chat output ceiling to **1536** initially; retain tutorial 4096, PDF 3072, image 2048 and circuit review 3072. Preserve complete code/safety responses and explicit continuation.
- [ ] Fit recent history to the remaining token budget. Keep the current question, safety policy, owned artifact references and language. Drop oldest eligible history first; do not silently truncate the current task.
- [ ] Reject a single oversized request with a specific code and an actionable shorten/split instruction. A waiting hint must not imply time can fix an intrinsically oversized prompt.
- [ ] Separate conservative provider admission from actual application usage. Pending and unknown-usage attempts retain reservations. Completed known usage can release excess only where verified provider quota semantics permit; otherwise retain a clearly named provider reservation window. Do not mechanically replace `greatest` with actual usage for every provider/window.
- [ ] Compute retry time from relevant expiring reservations/cooldowns rather than always 60 seconds. Return machine-readable cause and seconds.
- [ ] Preserve existing user/project daily protection, global pending lease, free readiness switches, RLS and replay-before-admission behavior.

**Acceptance:** Tiny completed replies do not consume unexplained local daily overestimates; pending/unknown usage stays conservative. Boundary tests cover exact cap, one token over, multibyte text, full prompts, midnight/day windows and concurrent reservation.

### Task 3: Add bounded candidates with per-attempt accounting

**Files:** `supabase/functions/ohmi-ai/provider-policy.ts`, `provider-policy.test.ts`, `handler.ts`, `handler.test.ts`, `groq.ts` and transport tests in that directory where needed; new additive attempt-ledger migration; `src/backend/database.types.ts` and `web-app/src/lib/backend/database.types.ts` if generated schema contracts require updates.

- [ ] Add server-owned `resolveChatCandidates` using existing allowlisted models. Missing/disabled/unqualified candidates stay unavailable. The browser cannot override providers or keys.
- [ ] Add `ohmi_ai_attempts` keyed by logical request UUID and unique attempt index. Store provider/model, reservation, start/finish, outcome, usage and sanitized failure category. Apply owner-only read policy where exposed and service-only writes.
- [ ] Atomically admit each attempt under the existing logical-request lease. Count user/project request caps once per turn, provider calls/usage per attempt. Preserve legacy request accounting without counting both the parent and its new attempt rows.
- [ ] Keep original request hash independent of which candidate eventually succeeds. Preserve actual successful provenance in the result snapshot and messages; adapt completion validation for permitted candidate changes.
- [ ] Use at most three candidates, no hidden SDK retries and no anti-repeat regeneration initially. Proposed chat budget: 6.5 seconds per candidate, 22 seconds total generation, inside current 50-second overall request budget with 5 seconds reserved for persistence and the 60-second lease.
- [ ] Skip unavailable/local-quota-full candidates before network work. Honor upstream retry hints and account-level backoff; do not assume changing Groq models escapes an organization-wide limit.
- [ ] Treat 401/403 as a configuration alert and candidate disable/cooldown; an independently qualified provider may continue. No repeated calls with known-invalid credentials. Safety and invalid user input never trigger failover.
- [ ] If any valid response finishes, persist once. If persistence fails, recover using the same UUID rather than regenerate. No provider request may outlive the logical lease and later overwrite a result.

**Acceptance:** Simulated primary 429 reaches eligible 20B/Gemini; primary success makes exactly one call. All-candidate failure is bounded. Concurrent/replayed requests cannot duplicate generation, bypass daily limits or double-save. Accounting includes failed and unknown attempts.

### Task 4: Add honest local and limited responses across callers

**Files:** `web-app/src/components/Chat.tsx`, `PlaygroundHelp.tsx`, `web-app/src/lib/backend/ai.ts`, `web-app/src/app/api/ai/route.ts`, UUID recovery route, `src/backend/` request/response contracts and extension callers found by search; focused UI and recovery tests.

- [ ] Reuse current response contracts where possible; add a validated response mode only if needed: `ai`, `local`, `limited`. Persist mode/provenance in the original result snapshot so replay preserves it.
- [ ] Display useful local/limited text with an honest badge. Do not mark a quota-blocked question delivered as a complete AI answer; preserve draft, attachment and explicit retry/continue controls.
- [ ] Apply returned retry seconds to retry availability and accessible status. Reuse existing visual design and status components.
- [ ] Clear pending state/history on account switch. Keep private no-store recovery and ownership checks.

**Acceptance:** Outages preserve the question and attachments; reload restores exact result/mode; account switch leaks nothing. AI badge only appears after actual validated provider success.

### Task 5: Qualify, document and prepare release

**Files:** existing focused Edge/SQL/PWA/extension tests; `docs/ai-reliability/README.md`; `web-app/docs/BACKEND_INTEGRATION.md`; relevant environment examples with names only.

- [ ] Run focused provider-policy, transport, handler, SQL admission, replay and account-isolation tests. Then root/PWA test suites, typechecks and production builds appropriate to changed callers.
- [ ] Exercise mocked browser flows: local TPM block, primary 429, all-provider outage, provider timeout, cancellation, persistence failure, reload, continuation and keyboard-accessible retry.
- [ ] After account readiness verification, agree a small explicit live-call/token budget. Use synthetic concept, calculation, Arduino, Taglish and artifact-follow-up prompts. Record actual provider/model, total usage, latency and schema/quality outcomes. Stop on quota or billing uncertainty.
- [ ] Compare true provider success, fallback success, local response rate, upstream/app 429 rate and p50/p95 latency separately. Do not claim a local template as successful AI inference.
- [ ] Document rollout/rollback flags. Enable new routing gradually; keep existing route as rollback. Retain additive ledgers, result snapshots and student records.
- [ ] Present verified phase result to owner before any next phase. Follow current release authorization at execution time; this planning request does not authorize implementation or publication.

**Acceptance:** Recoverable user flow under simulated outage, no duplicate charges/results, no weakened auth/RLS, complete structured analyses, bounded latency, and documented live-test limits.

## 5. API details and credential handling

Existing DORMOSAUR server endpoint: `POST https://dormosaur.vercel.app/api/chat`. It requires the authenticated app session; it is not a public anonymous provider proxy.

Groq upstream: `POST https://api.groq.com/openai/v1/chat/completions`, with server-only `Authorization: Bearer <GROQ_API_KEY>`.

Gemini upstream: `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`, with server-only `x-goog-api-key: <GEMINI_API_KEY>`.

Both local keys are in `C:/Users/LEGION/Documents/DORMOSAUR/.env.local`. They can be transferred directly into OHMI's server-side secret store during approved implementation without pasting credentials into a persisted chat or plan. No keys were copied or changed during this audit. Reusing a key does not grant more quota; separate keys may still share the same organization/project limits. Prefer project-specific credentials for revocation and attribution.

## 6. External verification

- [Groq rate-limit documentation](https://console.groq.com/docs/rate-limits): limits are organization-level; exact account limits belong in the console. Includes RPM, RPD, TPM and TPD, with additional input/output dimensions for some organizations.
- [Groq model catalog](https://console.groq.com/docs/models): GPT-OSS 120B and 20B are listed production models. Public catalog access is not proof of this account's model access or free entitlement.
- [Gemini rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits): quotas are project-level, not per API key. Active values depend on model and account tier.
- [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models): verify target model support before enabling an additional route.

**Not checked:** Authenticated production inference, live quota dashboards, current deployment/source parity and measured production latency.
**Risk:** Copying fallback without correct admission and attempt accounting can multiply calls and exhaust shared quota faster. No architecture guarantees zero rate-limit errors.
