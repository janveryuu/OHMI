# Phase 4 verification â€” candidate 0.4.0

**Status: implementation checkpoint; Phase 4 is not fully verified.** The complete live assignment/tutorial suite has not passed. No Phase 5 work was started.

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
