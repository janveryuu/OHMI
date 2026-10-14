# Phase 4 design: Gemini tutor

The owner authorizes autonomous Phase 4 implementation, live secrets/function deployment, necessary non-destructive migrations, verification, and the standing phase-completion GitHub push. Preserve Phase 1–3, existing identity/PNG/layout/motion, and pending SMTP. No Phase 5 capture, live monitoring, or manipulation.

## Verified configuration

Existing Supabase `vhmdgfydvoljzqztuxmu` remains linked and accessible. Google documentation and an authenticated model request confirm `gemini-3.8-flash` supports generateContent/countTokens. Owner's key was transferred to Supabase `GEMINI_API_KEY` only, using an ignored temporary file that was deleted. Never put it in WXT, source, output, logs, or user data.

## Architecture and builder decisions

Use one authenticated `ohmi-ai` Edge Function with default JWT verification and an independent server getUser check. Existing background messaging validates sender/account snapshot and forwards the user's token; content never receives credentials. Use official Gemini REST rather than another frontend dependency.

New tables: conversations, messages, assignment analyses, tutorial progress, and AI usage requests. Every table has RLS/explicit grants/indexes. Conversations can be created/deleted by their owner. AI messages/analyses/usage are server-written only. Composite owner FKs prevent cross-account links. Progress is saved through an authenticated, ownership-checking invoker RPC. Existing deployed migration stays untouched.

Service-only invoker RPCs reserve quota and atomically persist completed turns/analyses. They revoke PUBLIC/anon/authenticated execution; the function uses Supabase's built-in server service credential solely for these operations after user verification. Document download/conversation/context lookup uses user RLS. No privileged pasted Phase 3 keys are used.

Quota decisions: 30 AI requests/user/UTC day, 6/minute, one active/user; 100/project/day and 500,000 reserved/actual tokens/project/day. Reserve conservatively before paid calls; failures remain counted. Fixed context/output caps and provider countTokens prevent oversized prompts. Request UUID plus canonical input hash prevents duplicate/replayed requests producing another bill; completed requests return saved results, changed inputs reject. Pending jobs older than two minutes become failed but remain budgeted. Limits are intentionally conservative for the student MVP; no billing-plan change.

Chat uses the last 12 persisted messages, bounded token count, current account language, and optional saved analysis/current step. Save user+assistant turns atomically only after valid completion; never persist fabricated success. Code stays plain text/fenced code, rendered without HTML. OHMI explains electronics/Arduino, asks about missing values, labels proposed code untested, never claims to inspect/electrically verify actual circuits. Documents/messages are untrusted data, never system instructions/tools.

Analysis explicitly sends the selected owned ready PDF/PNG/JPG to Google, inline under the existing 10 MiB limit. Strict structured schema contains summary/objectives/components/expected results/assumptions/uncertainties and ordered steps with instruction, why, check, optional code. Validate bounds/types/status before saving. Cache immutable analysis by assignment+language; retries/follow-up chats reuse it. Upload replacement requires a new assignment, preserving source consistency. No automatic analysis on upload.

Tutorial shows one step, previous/next, completion and saved resume position. Questions/hints open a conversation bound to that owned analysis/current step. Step text explains why; no circuit auto-build. Retain manual saved steps and explicit local demos separately.

Preserve existing layout/classes. Add signed-in chat/history, Analyze/AI guide controls beside private files, and one compact tutor component. Guests keep Phase 2 demos; signed-in AI states are labeled real. Clear account-scoped views on switches. Cache selection survives reload by restoring owned progress/history, not putting transcripts in host/local storage.

Function returns JSON with early whitespace/periodic keepalive while generating, so Chrome receives headers promptly. Background uses bounded keepalive only during active AI requests. Provider/file/network calls have explicit deadlines; errors are sanitized and actionable, never provider credentials/raw payloads. Failed UI requests can retry with the same request UUID; saved history recovers responses after disconnection.

## Proof

RED→GREEN core validation/provider failure tests, local two-user RLS/atomic-quota/progress tests, live auth/ownership/caching/idempotency checks, real Gemini chat/Arduino/English/Filipino/Taglish and PDF/image analysis using disposable fixtures, extension signed-in workflow/reload/history/tutorial checks, and all old regressions. Fresh whole-change review before completion; scan secrets/source/build; verify remote push. AI accuracy has scenario-based evidence, not a guarantee.

References: Google models/API keys/structured outputs/document understanding and Supabase Edge Function authentication docs checked during preflight. Pricing/Google project quota depend on owner's provider account; cap requests/tokens rather than claiming a dollar guarantee. SMTP, key rotation, and distributed manifest identity remain the Phase 3 limits.
