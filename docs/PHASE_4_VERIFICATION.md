# Phase 4 verification â€” candidate 0.4.0

**Status: implementation checkpoint; Phase 4 is not fully verified.** The complete live assignment/tutorial suite has not passed. No Phase 5 work was started.

## New Gemini key smoke test — 15 October 2026 (Asia/Manila)

**This session stopped at the requested basic-generation gate.**

- Preserved the existing Phase 4/PDF work in local checkpoint `3213f50` on `codex/phase-4`. Student rows, uploaded files, usage history, UI and provider integrations were not modified by this session.
- Updated ignored root `.env` and hosted Supabase project `vhmdgfydvoljzqztuxmu` with the new server-only `GEMINI_API_KEY` and `GEMINI_FREE_TIER_CONFIRMED=true`. The flag reflects the owner's project confirmation; no billing setting was changed. No key value is recorded here or in source control.
- Authenticated Google model lookup returned HTTP 200 for `models/gemini-3.8-flash`, advertising `generateContent` and `countTokens`. Google's [model catalog](https://ai.google.dev/gemini-api/docs/models) also lists this exact ID.
- Ran the production backend `generate` function locally with the new key: one short LED/resistor question, `analysis:false`, no media or structured-output fields. `countTokens` succeeded. Exactly one `generateContent` request was sent using the existing text configuration with `retry503:false`; no fallback was invoked.
- Generation returned **HTTP 503**, code `503`, status `UNAVAILABLE`, message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."
- Per the owner's stop condition, did not test PNG/PDF, change routing/request architecture, deploy an Edge Function, run the end-to-end workflow, or rerun unit/typecheck/build/security suites. This local backend-module probe is not a successful hosted Edge Function test.
- Removed the temporary secret-upload file and checked tracked files for the new key. Phase completion, tutorial accuracy and saved progress using the new Gemini configuration remain unverified. No completion push, main merge or Phase 5 work occurred.

Next continuation must first pass basic Gemini generation, then test each media format and the Gemini PDF workflow. This HTTP 503 does not establish an HTTP 400 schema fix.

## Implemented

- Authenticated `ohmi-ai` Edge Function, independent user verification, private owned document/context reads, server-only provider keys, and RLS-protected conversations, messages, analyses, progress and usage.
- Primary `gemini-3.8-flash` on each new request; `gemini-3.6-flash` then Groq `qwen/qwen3.8-27b` fallbacks. Groq accepts PNG/JPG and text; raw PDFs are never forwarded to it.
- Bounded deadlines, one primary HTTP 503 retry, conservative accounting for abandoned attempts, atomic saves, cached analysis and request replay. No billing activation or purchased credits.
- Signed-in chat/history and explicit private assignment analysis/tutor controls. Existing guest samples, manual steps, UI, mascot, Google login and pending SMTP remain intact.
- Retry recovery for abandoned jobs, strict clarification/status/quantity validation, immediate account-switch invalidation, concealed private views during revalidation, and current-step context without all unrelated tutorial steps.

## Actual results, 14 October 2026

| Check | Result |
| --- | --- |
| Unit tests | 45 passed across eight files. Includes provider order, retries, free-plan gates, rejected auth/unsafe output, accounting and parser boundaries. |
| TypeScript and production build | Passed; version 0.4.0, approximately 2.26 MB. |
| Existing browser regressions | Passed: Phase 1/2 mascot, drag, motion, responsive layout, navigation, isolation and Phase 3 Account UI. Simulated editor with temporary Chromium profiles. |
| Account-switch browser test | Passed with deliberately delayed responses, sign-out, stale response rejection and same-owner draft preservation. |
| Tutor UI fixture | Passed: completion, next/current step, hint context, general chat, saved resume and 360px layout. Uses fictional mocked backend/provider responses; does not establish live generation. |
| Fresh local migration replay | Passed, all five migrations in order. Existing live project was preserved. |
| Local backend security/quota tests | Passed: two-user RLS, denied forged AI writes/client quota RPCs, atomic saves, replay, stale jobs, concurrency, minute/user-day/project-day/token limits, bounded progress and retained cost accounting after deletion. |
| Live authentication/ownership | Missing JWT and foreign conversation/document ownership were rejected. |
| Live Gemini 3.8 chat | One real response was generated and saved through the deployed Edge Function. Subsequent calls experienced 503s/timeouts. It remains primary. |
| Live Gemini 3.6 chat | Electronics/Arduino response, saved messages, actual usage, duplicate replay and cross-owner denial passed through the Edge Function. Direct electronics/Arduino generation also passed. |
| Live Groq chat | Direct electronics/Arduino generation passed. |
| Live Groq PNG | Direct structured response passed the then-current checks. Output quality exposed malformed quantities and unsafe invented checks; validation/prompt constraints were tightened. This is not proof of reliable tutor quality. |
| Live PDF/JPG and complete tutor flow | **Not passed.** Gemini PDF generation returned 503/timeouts and generic HTTP 400. Groq JPG returned HTTP 400. Private image analysis through the Edge Function failed, then its next reservation was blocked by the daily project cap. |
| Live security advisor | Only the pre-existing leaked-password-protection Auth warning; no table/RLS/storage findings. No paid upgrade. |

Google's diagnostic response explicitly reported high demand for HTTP 503. A generic HTTP 400 does not establish its exact cause. Removed an unsupported `store` field from Gemini's stateless generateContent request and retained supported legacy structured-output fields for 3.6; successful live file generation is still required to confirm compatibility.

Final live inspection confirmed five AI tables with RLS, zero disposable test accounts remaining, and 400,574 conservatively budgeted tokens today. A new analysis reserves 160,000 tokens, so it cannot fit under the 500,000-token cap; this does not mean every chat request is exhausted. Usage records were preserved after fixture cleanup.

Free access is documented for both Gemini models and Groq Qwen. The owner confirmed both key accounts use free plans with paid billing off. Account-tier dashboards could not be independently verified. References: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [Google REST API](https://ai.google.dev/api/generate-content), [Groq model](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [Groq free limits](https://console.groq.com/docs/rate-limits).

## Remaining completion gates

1. After capacity recovers and the UTC project budget resets, pass real PDF/PNG/JPG analysis through the Edge Function. Daily reset is 08:00 Philippine time. Do not erase usage records or raise limits to bypass this gate.
2. Verify cached analysis, saved tutorial resume/completion, current-step questions, English/Filipino/Taglish, and deletion/isolation in the complete live suite. Its implementation exists; unsuccessful runs are not counted as passing.
3. Verify tutor accuracy against the fictional fixture: component quantities, 5 V supply, 220-ohm series resistor, 2 V LED drop, approximately 13.6 mA, safe polarity and complete untested D9 blink code. Reject invented board sizes and unsafe resistor-bypass suggestions.
4. Repeat a normal Google login and real student workflow in the owner's Chrome/Tinkercad environment. Automated browser checks use a simulated editor; they do not verify the signed-in Tinkercad page or electrically verify a circuit.

Email confirmation/reset remain pending custom SMTP. Previously requested privileged-key rotation and distribution manifest identity remain the Phase 3 follow-ups.

## Reproduction and secrets

Run `npm test`, `npm run typecheck`, `npm run build`, `node tests/ai-backend.mjs`, and `node tests/account-switch.mjs`. Set `OHMI_CHROMIUM_PATH` to an installed Chromium when needed. `OHMI_SCREENSHOT_DIR` selects regression screenshot output.

`OHMI_AI_TEST=1` selects the full live suite in `tests/backend-live.mjs`. It creates guarded disposable fixtures, preserves failed fixtures for diagnosis, and deletes only their recorded files/accounts through `tests/cleanup-live.mjs`. Real usage remains budgeted after fixture deletion.

Provider-only tests use an ignored temporary environment file and delete it in `finally`; every case reports its own success/error. The script finishing does not mean all models passed. Never commit or print those keys. Hosted secrets are `GEMINI_API_KEY`, `GROQ_API_KEY`, `GEMINI_FREE_TIER_CONFIRMED`, and `GROQ_FREE_TIER_CONFIRMED`. The confirmation flags are operator assertions, not automatic billing detection.

This checkpoint belongs on `codex/phase-4`; keep the verified Phase 3 `main` until the remaining live gates pass.

## Continuation from 3a80e04

On 14 October at 13:26 Philippine time, a fresh live read still showed 400,574 budgeted tokens. The daily allowance had **not reset**. No new model generation was attempted, and no limits or billing settings were changed. Next reset: 15 October at 08:00 Philippine time.

Offline checks confirmed readable PDF instructions, valid PNG/JPG decoding, correct MIME signatures, and byte-for-byte base64 round trips using the Edge Function's encoding method. These checks rule out damaged test fixtures or encoding loss; they do not establish the cause of a provider HTTP 400.

Deployed diagnostics now capture only allowlisted provider codes, error categories, known field paths, model/request format and media metadata. Raw messages, generated answers, document bytes, prompts and credentials are excluded. In particular, a Groq `json_validate_failed` response can now be distinguished from a rejected request parameter. Generic Gemini `INVALID_ARGUMENT` remains inconclusive without a more specific field/category.

Targeted provider/parser regression tests: **16 passed**. TypeScript check passed. Existing successful UI/security checks were not repeated because this continuation changes server diagnostics and the live-test runner only.

Run one format at a time after reset, using the guarded fixture harness:

```powershell
$env:OHMI_AI_FILE_TYPE='pdf' # then png or jpg, in separate runs
node tests/backend-live.mjs
```

On the last successful format, set `OHMI_AI_LANGUAGES='1'` to verify Filipino/Taglish explanations of the saved current step without repeating earlier successful formats. English is checked by the assignment's initial language preference and generated teaching guide.

The harness first reads UTC allowance and refuses an analysis that cannot fit, before creating test accounts or invoking AI. A successful format checks declared quantities, structured teaching steps, saved progress, cache reuse, UI and two-user isolation. Live generation, complete tutor accuracy and multilingual explanations remain unverified in this continuation; Phase 4 stays incomplete.


## Usage policy update — 14 October 2026

The owner explicitly authorized removing OHMI's internal daily token cap. This supersedes the earlier allowance/reset gate above. Migration `20261014055307_request_based_ai_usage.sql` is applied to the existing live project; `ohmi-ai` is redeployed. No usage rows were deleted or reset by the migration.

- Removed the 500,000-token daily project cap and internal daily request-count gates (30/account, 100/project), so those artificial daily gates cannot block available free-provider quota.
- Preserved verified authentication, service-only AI RPCs, RLS, ownership, replay protection, six requests/account/minute, one active request/account, stale-request recovery, request/file/context bounds, timeouts and bounded retries.
- Reservations now estimate text bytes, document MIME/size, output allowance and eligible attempts. The fixture PDF estimates 29,460 tokens; PNG/JPG estimate 45,056, replacing the fixed 160,000 charge. Estimates are telemetry rather than limits on valid actual usage. Gemini countTokens supplies the estimate for uncertain fallback attempts; successful provider-reported input/output usage remains separately recorded.
- Retained per-request estimate/accounting ceilings (64,000 chat; 160,000 analysis) and actual-result validation. No provider settings, keys, paid billing or official quotas changed. HTTP 429 moves to an eligible confirmed-free fallback without retrying the exhausted model; exhausted eligible providers report a quota error. HTTP 400 is not treated as quota exhaustion.
- Updated AI usage copy, database types, README and live harness; no visual redesign or mascot changes.

Verification: **49 unit tests passed**, TypeScript check passed, production Chrome extension build passed. Local two-account database tests passed, including admission above the former daily token/count gates, usage-history retention, saving actual usage above an estimate, excessive per-request usage rejection, service-only RPCs, RLS, atomic saves, minute/concurrency limits and bounded tutorial progress.

Live requests ran one format at a time through the authenticated Edge Function: **PDF, PNG and JPG all passed the removed budget gate but failed Gemini generateContent with HTTP 400**. No successful assignment analysis was produced. Quantity accuracy, live saved tutorial/progress, and Filipino/Taglish step explanations remain blocked behind assignment generation; the harness correctly did not claim those checks passed. The dashboard log session requires sign-in, so this run did not obtain a more specific provider field/category. Do not infer the cause of the HTTP 400 from the generic error. Failed fixture files/accounts were cleaned through the guarded harness; their usage rows were retained.

Phase 4 remains incomplete due to the live assignment provider error. Keep changes on `codex/phase-4`; do not merge into main or begin Phase 5.


## Structured-output investigation from a1107ad — 14 October 2026

Phase 4 is still blocked; the following results supersede the older file-analysis status above.

### Evidence and changes

- Read sanitized hosted Edge Function logs through the existing authorized Supabase CLI account's Management API access. No provider keys were exported, returned to clients or printed.
- Gemini 3.8 returned HTTP 400 `INVALID_ARGUMENT`, category `media_format_rejected`, with field `generation_config.response_format`. The rejected setting concerns structured output; valid input MIME signatures, image/PDF decoding and base64 round trips passed. Lowercase output MIME alone did not resolve this rejection.
- Gemini 3.6 returned generic HTTP 400 `INVALID_ARGUMENT` with no field details. Its exact original cause cannot be established from that response. Do not describe schema simplification as a confirmed fix for all Gemini errors.
- Both Gemini models now use the simpler OpenAPI `responseMimeType: application/json` / `responseSchema` form, with uppercase type names. Provider schema conversion strips `additionalProperties` and `maxItems`; OHMI's strict parser still enforces component/list/step/string limits and clarification rules. The shared strict JSON Schema remains unchanged for Groq.
- Diagnostic logs contain allowlisted codes/categories/field paths plus bounded numeric retry delays and quota-window labels. Product errors remain readable and do not include raw provider responses. No HTTP 400 retry was added.
- Groq remains eligible for PNG/JPEG and text only. PDF now skips Groq and preserves the actual Gemini failure and retry hint, rather than replacing it with an unsupported-PDF message.
- Review of the generated guide exposed incorrect arithmetic. Added an explicit current-calculation instruction and a fixture assertion for `(5 V - 2 V) / 220 ohms = approximately 13.6 mA`. This prompt correction has not yet passed a fresh live generation.

### Actual live results

| Check | Result |
| --- | --- |
| Small PNG, 69,083 bytes, 1100 x 760 | Groq `qwen/qwen3.8-27b` generated and saved a seven-step English tutorial after Gemini 3.8 quota exhaustion and Gemini 3.6 HTTP 503. Arduino Uno, red LED, 220-ohm resistor and breadboard quantities were each 1; jumper wires were as needed. Code contained setup()/loop(). |
| PNG cache/progress/isolation | Passed: a cached request created no new usage row, saved progress returned the expected current/completed step, and a second account could not access the analysis. |
| PNG accuracy review | Failed one current statement: expected results said approximately 9 mA, whereas the declared ratings imply 13.6 mA. Structural generation passing does not establish full tutor accuracy. Prompt/test tightened; correction unverified live. |
| Filipino current-step explanation | Passed before later quota exhaustion. |
| Taglish current-step explanation | Blocked: both Gemini models and Groq returned HTTP 429. |
| JPG, 148,650 bytes, 1100 x 760 | Blocked: all three configured providers returned HTTP 429. No successful JPG result was produced. |
| PDF, 1,812 bytes, one page | Blocked: both compatible Gemini models returned HTTP 429. Groq cannot accept raw PDF. |
| Final Gemini structured generation | Not verified: latest calls encountered HTTP 429/503, so they do not prove the final schema format generates successfully. |
| Real saved tutor UI flow | Not completed in this run. The language failure interrupted the first PNG harness before UI checks; subsequent formats did not generate. Existing mocked UI regressions remain the earlier evidence. |

Gemini's PDF responses at 06:34:48–49 UTC included Retry-After values of 62,711/62,710 seconds: approximately **15 October 2026, 08:00 Philippine time**. Groq's reset was not established; do not assume it resets with Gemini. No further generation was attempted after confirming these limits. No quotas were raised or bypassed, and paid billing remained disabled as previously confirmed by the owner.

Verification: **53 unit tests passed** across eight files, TypeScript passed and the production Chrome extension build passed. Fixture accounts/files were cleaned using the guarded harness; a live query confirmed zero disposable test accounts. Their usage history was retained. UI, mascot, auth, private storage, provider order and configurations were preserved; no database migration was needed.

After provider quota becomes available, run one file at a time in this order:

```powershell
$env:OHMI_AI_FILE_TYPE='png' # then jpg, then pdf in separate runs
$env:OHMI_AI_UI='1' # use once for the saved tutor UI checks
$env:OHMI_AI_LANGUAGES='1' # use once for Filipino/Taglish current-step checks
node tests/backend-live.mjs
```

The harness now rejects the known incorrect 9 mA statement and accepts the correct 13.6 mA value at reasonable precision. Clearing local counters or replacing provider keys is not a prerequisite and would not resolve provider restrictions. Keep this checkpoint on `codex/phase-4`; do not merge into main or begin Phase 5.

References: [Google structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [Groq model/vision compatibility](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [Groq structured output](https://console.groq.com/docs/structured-outputs), [Groq rate-limit headers](https://console.groq.com/docs/rate-limits), [Supabase log queries](https://supabase.com/docs/guides/observability/advanced-log-filtering).

## Recovery implementation — 14 October 2026

This section supersedes earlier verification results. Implementation plan: [Phase 4 recovery](superpowers/plans/2026-10-14-phase-4-recovery.md). Work remains on `codex/phase-4`; Phase 5 and the main merge are not authorized.

### Deployed fixes

- Added migration `20261014065738_provider_quota_backoff.sql` to the existing linked project. Provider cooldowns persist across Edge Function workers, are service-only, and concurrent updates cannot shorten the reset time. Students cannot read or change them. Expiry restores Gemini 3.8 preference automatically.
- HTTP 429 records the bounded provider retry delay, or a conservative one-minute pause when no delay is supplied. Eligible confirmed-free fallbacks remain available. A 503 with Retry-After does not trigger an immediate repeat. Invalid HTTP 400 requests are never retried.
- Retained the corrected Gemini OpenAPI structured-output format from the earlier investigation. Its live success is still unverified because both Gemini models are quota-blocked. MIME signatures and payload handling remain validated; raw PDF is never sent to Groq.
- Groq's input estimate now includes schema/image overhead and estimates text tokens from UTF-8 bytes instead of treating every byte as a token. Existing output ceilings, timeouts and bounded attempts remain intact.
- Successful provider token usage is recorded before guide validation, so rejected output no longer loses reported usage. Existing usage history is retained.
- Added explicit server arithmetic for generated LED-current markers. `(5 V - 2 V) / 220 ohms` resolves to 13.6364 mA; invalid ratings, unresolved expressions and inconsistent derived claims in structured expected results are rejected before saving. This checks arithmetic, not whether AI extracted the correct operands or whether a circuit works. Rating statements and breadboard labels have separate regression checks.
- Groq's integer/unknown quantity-schema experiment produced incorrect unknown labels and was removed. Both providers retain OHMI's string quantity interface, with explicit instructions to preserve stated counts. Blink-period and Tinkercad simulation instructions were tightened after live review.

### Verification

- **71 unit tests passed**, TypeScript passed and the production Chrome extension build passed. Local two-user AI database tests passed: RLS/service-only operations, replay, concurrency, atomic saves, progress bounds, cooldown validation and monotonic updates.
- Browser regressions passed for Phase 1/2 controls, accessibility/focus, dragging, persistence, responsive bounds, animation/reduced motion, SPA navigation and browser errors. Phase 3 account UI and account-switch privacy regressions passed. These editor pages are simulated; no new logged-in Tinkercad test is claimed.
- Real Supabase fixture-backed tutor checks passed: saving/resuming/completing steps across reload, current-step/general-chat context, 360px layout, ownership isolation and owner deletion. The fixture is explicitly labeled `offline-test-fixture`; this does not prove fresh AI assignment generation.
- Changed source/build credential scan passed, and the approved mascot PNG matches the build byte-for-byte. No dependency, billing, key, UI or mascot change was made.

### Live acceptance gates

PNG and JPG requests generated structured Groq tutorials through the actual authenticated Edge Function without HTTP 400. Review still exposed incorrect unknown component counts and, in one PNG response, incorrect units and an unstated resistor example. These responses do **not** pass full tutor acceptance. The test preserves the response before quality assertions and refuses to report these cases as successful.

PDF returned a clear persisted Gemini quota/reset error rather than HTTP 400. Both Gemini models are deferred until **15 October 2026, approximately 08:00 Philippine time**. Groq does not support the raw PDF input. No request was sent to a known-blocked Gemini model.

Live English, Filipino and Taglish current-step explanations all passed through Groq via the authenticated Edge Function, with actual input/output tokens and completed requests recorded. The saved assignment context was the deterministic fixture, not a newly accepted AI-generated tutorial. Responses used the series-resistor/polarity context and Taglish included approximately 13.6 mA. Each Groq explanation was paced one minute apart after an initial minute-quota rejection. The Filipino/Taglish responses were understandable but contained awkward phrasing; the language assertions do not establish native-level fluency.

The final JPG check passed through Groq: the four specified component quantities were each 1, jumper wires were as needed, the current was 13.6364 mA, and the guide included five teaching steps, complete D9 setup()/loop() code and 0.5 Hz blink timing. Cache reuse created no new usage row; saved progress and second-account isolation passed. Manual review still found an invented starter-kit reference and an unspecified breadboard rail label; automated acceptance does not prove every sentence correct.

The first final PNG check was rejected by summary current validation. A unit counterexample reproduced a false rejection of a stated maximum rating in summary prose. Validation now checks raw numeric claims only in structured expected results; explicit arithmetic markers are still resolved throughout the guide.

The corrected PNG check **passed live** through Groq: all four stated counts were 1, current was 13.6364 mA, blink frequency was 0.5 Hz, and six teaching steps included complete D9 setup()/loop() code. Cache reuse, saved progress and cross-account isolation passed. Manual review confirmed the series-resistor/polarity instructions and matching stated ratings. Some uncertainty wording was unnecessary; the guide is AI output and still requires student review.

| Final gate | Status |
| --- | --- |
| PNG and JPG Edge Function analysis | Passed Groq automated acceptance and saved-data checks; prose limitations noted above. |
| English / Filipino / Taglish step explanations | Passed live, using an explicitly deterministic saved assignment context. |
| Real saved tutor UI / private progress / account isolation | Passed fixture-backed Supabase and browser checks. |
| Gemini 3.8 / 3.6 final structured generation | Blocked by provider quota; priority automatically restores after expiry. |
| Raw PDF generation | Blocked by compatible Gemini quota; clear reset error returned, no unsupported Groq call. |

Phase 4 remains incomplete until genuine Gemini/PDF generation is verified. No main merge or Phase 5 work occurred. Disposable accounts/files were cleaned while usage history was retained.
