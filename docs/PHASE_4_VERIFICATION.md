# Phase 4 verification — candidate 0.4.0

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
