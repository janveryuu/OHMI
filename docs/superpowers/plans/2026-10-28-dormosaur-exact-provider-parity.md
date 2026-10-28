# Dormosaur Provider Parity Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans after implementation is authorized. This request is plan only.

**Goal:** Remove OHMI's application-imposed AI consumption quotas and reproduce Dormosaur's provider behavior, rather than retaining OHMI's current quota architecture.

**Architecture:** Port Dormosaur's provider configuration, provider adapters, sequential failover, deadlines, validation and limited-mode behavior into the existing OHMI server gateway. Keep authenticated ownership, private storage, request UUID recovery and OHMI's electronics behavior. Token usage may be recorded but must never block a request.

**Tech stack:** Existing TypeScript, Supabase Edge Functions/PostgreSQL, Next.js and existing tests. No new SDK or runtime dependency is necessary for chat: Dormosaur uses fetch there.

**Spec:** Owner's explicit 28 October 2026 correction: remove token limits and copy Dormosaur exactly; produce an implementation plan only. This supersedes the previous plan's quota-preservation and new attempt-ledger recommendations.

## Exact requested result

- No OHMI token-per-minute or token-per-day admission check.
- No token reservation requirement before dispatching a provider request.
- No OHMI provider RPM/RPD or user/project daily consumption quota replacing the removed token quotas.
- Remove OHMI's 10/user/day, 40/project/day, 6/user/minute and single-project-wide-pending restrictions. Match Dormosaur's authenticated 20 chat requests/user/minute abuse guard instead.
- No OHMI database cooldown that prevents the next user turn from trying Dormosaur's candidate chain.
- No new quota dashboard, account inspection prerequisite, attempt-ledger table or synthetic token budget gate.
- Existing usage counters are observational only. Do not drop historical records.

Dormosaur itself retains response-length ceilings, bounded history and a request-rate guard. Copy those exact settings; these are not cumulative token quotas. External provider enforcement still exists outside either app.

## 1. Exact provider configuration to copy

Source: `C:/Users/LEGION/Documents/DORMOSAUR/lib/copilot/providers.ts`.

Default chat candidates, in order:

1. Groq `openai/gpt-oss-120b`.
2. Groq `openai/gpt-oss-20b`, using the same Groq credential.
3. Google `gemini-2.5-flash`, using the Gemini credential.

Copy `providerConfigs` semantics, including missing-key handling, primary selection, model validation, duplicate fallback suppression and optional provider/model overrides. Use OHMI-prefixed equivalents of Dormosaur's configuration names. Keep keys server-only as `GROQ_API_KEY` and `GEMINI_API_KEY`.

If no Groq key exists, Gemini becomes the default primary. A missing provider key removes that candidate; it must not block the configured other provider. Never send one provider's key to the other endpoint.

| Setting | Exact Dormosaur chat behavior |
|---|---|
| Groq endpoint | `https://api.groq.com/openai/v1/chat/completions` |
| Gemini endpoint | `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` |
| Groq temperature | 0.45 |
| Groq maximum completion | 1600 tokens |
| Groq response format | JSON object |
| Gemini temperature | 0.45 |
| Gemini maximum output | 1800 tokens |
| Gemini response format | `application/json` |
| Per-attempt deadline | Up to 6500 ms |
| Total generation deadline | 22000 ms |
| Repetition regeneration | At most once per user turn, within total deadline |
| Implicit SDK retries | None |
| Valid AI result | Nonempty `reply`, at most 10000 characters, plus supported `scope` |
| Scope values | `in_scope`, `out_of_scope`, `unsafe` |

Do not replace Gemini chat with OHMI's current 3.5 model. Exact Dormosaur parity means `gemini-2.5-flash` for chat fallback.

## 2. Exact request and fallback flow to copy

Sources: Dormosaur `lib/copilot/input.ts`, `service.ts`, `replies.ts`, `app/api/chat/route.ts`, and `lib/api-security.ts`.

1. Authenticate the user. Keep OHMI's existing ownership checks and trusted server data.
2. Bound chat JSON bodies at 64 KiB. Accept only user/assistant messages; require final user message.
3. Match history limits: 24 recent messages, 16000 total characters, 3000 characters per message. Reject oversized user messages; clip historical assistant messages as Dormosaur does. Existing upload endpoints retain separate media validation.
4. Apply the same 20 chat requests/user/minute in-memory guard. It is a burst-abuse guard, not a distributed token quota. Remove stricter OHMI consumption gates rather than layering them underneath it.
5. Answer narrow deterministic requests locally when supported. Reuse OHMI identity/status and existing deterministic calculations. Do not copy Dormosaur's class, dorm-meal or alarm facts into OHMI.
6. Send other eligible text questions through the exact candidate list and settings above.
7. On provider failure, continue to the next configured candidate within the shared deadline. Match Dormosaur's handling of 429, authentication, model unavailable, 5xx, network errors, timeouts and invalid output. Log sanitized categories.
8. Validate scope and reject false action claims, exposed credentials and prompt disclosure. A valid refusal returns the appropriate response; it is not retried to bypass safety.
9. Detect repeated generic replies and allow one regeneration within the shared budget. Then continue to remaining candidates as Dormosaur does.
10. Persist the first accepted answer once, including actual provider/model and reply mode.
11. If no candidate succeeds, return labelled limited mode with useful local capability or a truthful temporary-unavailability response. Preserve the student's original question.

Copy provider behavior exactly. Adapt product-specific prompts and data to OHMI; keep circuit uncertainty, language support and educational safeguards.

## 3. Other Dormosaur AI paths

The source uses two providers across specialized tasks. Those tasks do not share one universal chat adapter:

| Dormosaur feature | Actual source configuration | OHMI mapping |
|---|---|---|
| Schedule media/text extraction | Gemini `gemini-3.8-flash`, temperature 0.1, JSON MIME, 25-second timeout, no explicit output-token ceiling in adapter | Assignment/media analysis adapter |
| Deadline extraction | Gemini media first; OCR if needed; Groq 20B text, 3000 output tokens, 12-second timeout; local parser last | Use extraction fallback only when source text can be safely obtained |
| Schedule edits | Deterministic parsing first; Groq 20B, 300 tokens, 12-second timeout | No equivalent schedule feature to create |
| Recipes | Groq 20B, 1600 tokens, 10-second timeout; validated local recipe fallback | No recipe feature to create |
| Schedule-aware selection | Groq 20B, 500 tokens, 10-second timeout; local selection fallback | Existing curated OHMI content can provide local references |
| Alarm nudge | Groq 20B, 60 tokens, 8-second timeout; template fallback | No alarm feature to create |
| Weekly digest | Groq 20B, 180 tokens, 8-second timeout; template fallback | No digest feature to create |

For full provider parity, change OHMI's Gemini multimodal model to Dormosaur's `gemini-3.8-flash`. Reuse its 25-second extraction transport deadline and JSON settings for analogous extraction calls. Preserve OHMI's task-specific response schemas and complete-output validation: schedule JSON cannot substitute for circuit findings or tutorials.

Dormosaur retries schedule images only after empty extraction, at most twice. It uses OCR/local parsing next. Known authentication/quota/model failures do not trigger another same-provider OCR-text pass; transient failures may. Transfer that behavior only to supported extraction tasks. Do not pretend OCR can replace visual circuit review, or pass images/base64 into text-only GPT-OSS.

Its specialized Groq SDK clients use `maxRetries: 0`. Reuse existing OHMI fetch transports to match behavior without adding the SDK.

## 4. Implementation tasks

### Task A — Remove OHMI consumption gates without breaking saved requests

**Files:** New timestamped migration under `supabase/migrations/`; `supabase/tests/ai_reliability.sql`; `supabase/functions/ohmi-ai/handler.ts`; `handler.test.ts`.

- [ ] Add failing tests proving historical token usage cannot reject a fresh valid request. Cover minute/day totals and requests previously blocked by user/project daily quotas.
- [ ] Replace the current `ohmi_reserve_ai` definition through a new migration. Retain ownership, target validation, UUID/input-hash consistency, same-request duplicate suppression, stale-request handling and completed-result replay.
- [ ] Remove TPM/TPD/RPM/RPD consumption checks, global single-pending restriction, user/project consumption caps and pre-dispatch cooldown checks from this path.
- [ ] Stop requiring `p_estimated_tokens` to admit requests. Preserve RPC compatibility where useful, but estimates must not influence permission to call providers.
- [ ] Stop model-limit-table enable flags from accidentally disabling Dormosaur's 20B/Gemini fallback candidates. Use the same server configuration/key eligibility as Dormosaur for candidate selection.
- [ ] Remove dependencies on manually asserted free-tier readiness flags for this copied provider path. Preserve authentication and an explicit operational AI-off switch; no billing setting is changed.
- [ ] Retain historical usage and result records. Keep token totals as optional telemetry, including zero provider usage for local responses.
- [ ] Prove completed UUID replay does not generate again; two different users can request concurrently; the same UUID cannot run twice.

**Acceptance:** OHMI never emits its application token-minute/token-day quota messages. High historical usage cannot block a valid turn.

### Task B — Port exact provider chain and chat behavior

**Files:** `supabase/functions/ohmi-ai/provider-policy.ts`, `provider-policy.test.ts`, `handler.ts`, `handler.test.ts`, `groq.ts`, `groq.test.ts`, `reliability.test.ts`; add `copilot.ts` in that directory only if needed to hold the ported orchestration cleanly.

- [ ] Port configuration and response validation from Dormosaur's `providers.ts` with the model order and request settings above.
- [ ] Port service loop, shared deadline, failure progression, runtime model identity and one repetition regeneration.
- [ ] Adapt OHMI's plain-text transport result to the validated `reply`/`scope` envelope. Keep OHMI electronics prompts and avoid mixing chat envelopes with structured circuit/tutorial results.
- [ ] Match input/history bounds. Retain canonical server ownership and existing recovery watermarks.
- [ ] Record successful fallback provenance without requiring the final model to equal the initial route. Update completion allowlists for exact candidate models, including Gemini 2.5 chat and Gemini 3.8 media.
- [ ] Keep the existing request/result table; do not add a provider-attempt ledger or admission service. Use sanitized operational diagnostics like Dormosaur.
- [ ] Keep existing bounded response reading where compatible; it must not create a token quota or alter valid Dormosaur responses.

**Acceptance:** Primary success makes one call. Mocked 120B failure reaches 20B; two failures reach Gemini 2.5. All failures return limited mode within the shared deadline. No implicit retries or duplicate saved answers.

### Task C — Match multimodal configuration and preserve OHMI output contracts

**Files:** `provider-policy.ts`, `handler.ts`, `schemas.ts`, existing PDF/image/circuit/tutorial tests; current Gemini transport seam.

- [ ] Select `gemini-3.8-flash` for analogous media/extraction work instead of current 3.5 model.
- [ ] Copy Dormosaur extraction temperature, JSON MIME and timeout. Do not introduce an application consumption quota around it.
- [ ] Keep raw media on Gemini. Transfer empty-result retry/OCR-text fallback only for extraction tasks that support it.
- [ ] Preserve task-specific schemas, citation grounding, image uncertainty and complete structured results. Do not fabricate a successful analysis when the provider fails.
- [ ] Keep final owned artifact follow-ups coherent with their source artifact; record exact provider/model.

**Acceptance:** Media reaches the exact Gemini model; malformed/incomplete analyses are not saved as successful findings; no local token quota prevents dispatch.

### Task D — Match visible AI/local/limited responses across callers

**Files:** `web-app/src/components/Chat.tsx`, `PlaygroundHelp.tsx`, `web-app/src/lib/backend/ai.ts`, `web-app/src/app/api/ai/route.ts`, UUID recovery route; `src/backend/` response contracts; affected extension callers and database types.

- [ ] Carry Dormosaur-equivalent mode and successful model identity through OHMI's existing response envelope.
- [ ] Reuse existing UI components for AI, local and limited states. Keep current design.
- [ ] Retain unsent questions, attachments and explicit retry. A limited response must not impersonate completed circuit analysis.
- [ ] Ensure saved-result recovery retains original mode/provenance and never regenerates automatically after an ambiguous save.
- [ ] Clear private state on account change.

**Acceptance:** Provider outages produce the same availability pattern as Dormosaur: fallback AI first, then honest limited mode, with the student's work preserved.

### Task E — Verify parity and prepare release

**Files:** Existing Edge/SQL/PWA tests; `docs/ai-reliability/README.md`; `web-app/docs/BACKEND_INTEGRATION.md`; environment examples containing variable names only.

- [ ] Port relevant Dormosaur tests with fetch doubles. Assert exact endpoint, models, request fields, candidate order, timeouts, repetition limit and mode behavior.
- [ ] Add regressions: historical usage above former TPM/TPD still allows dispatch; two users can run concurrently; missing primary key still allows Gemini; authentication remains enforced.
- [ ] Run focused tests, root/PWA suites, relevant typechecks/builds and recovery/browser checks.
- [ ] Exercise a small synthetic end-to-end chat through each available provider. Record actual AI success separately from local/limited success. Provider errors must advance/return limited mode rather than recreate OHMI's quota gate.
- [ ] Document removed limits and copied settings. Retain normal revert/redeploy rollback and saved student data.
- [ ] Present completed implementation for review before the next phase. No implementation, push or deployment occurs under this planning request.

## 5. Credentials and unchanged external constraints

Dormosaur's local `GROQ_API_KEY` and `GEMINI_API_KEY` are in `C:/Users/LEGION/Documents/DORMOSAUR/.env.local`. During authorized implementation, transfer server-side values directly if reuse is desired. Do not put them in browser bundles, tests, repository documentation or committed environment files.

No extra API, subscription, dependency or dashboard is required by this plan. Groq/Google may still return their own rate-limit errors; the copied provider chain handles them as Dormosaur does. Removing OHMI checks cannot change enforcement inside an external provider.

## Plan-only completion

Only this plan and the prior plan's superseded notice were written in the repository. No app code, credentials, database settings or deployment changed.

**Not checked:** Live inference, current production configuration and actual account quotas.
**Risk:** Removing application consumption caps removes their spending protection; provider-side restrictions still apply. Bounded output/history settings remain exactly because Dormosaur uses them.
