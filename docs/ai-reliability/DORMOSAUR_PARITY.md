# Dormosaur provider parity — 28 October 2026

The owner explicitly approved implementation, removal of OHMI consumption quotas, GitHub push and production deployment. The approved downloaded plan matches `docs/superpowers/plans/2026-10-28-dormosaur-exact-provider-parity.md`.

## Delivered behavior

- Removed OHMI TPM/TPD, provider RPM/RPD, 10/user/day, 40/project/day, 6/user/minute and global one-pending-request admission gates. Historical usage/limit records remain; they do not gate inference.
- Request registration retains service-only permissions, ownership/target checks, request UUID/hash consistency, stale replay handling and exact saved-result recovery. A request-key advisory lock suppresses duplicate generation; a conversation-row completion lock allocates unique message positions when requests run concurrently.
- Plain chat matches Dormosaur's candidates: Groq `openai/gpt-oss-120b`, Groq `openai/gpt-oss-20b`, Google `gemini-2.5-flash`. Missing credentials remove a candidate. Server configuration supports OHMI-prefixed provider/model overrides.
- Copied temperature0.45, JSON scope/reply validation, Groq1600/Gemini1800 response ceilings,6.5s attempt deadlines,22s generation deadline, one repetition regeneration, and sequential failure handling. Added an explicit JSON example after a live20B response returned an object instead of the required scope string; invalid responses remain rejected.
- Matched full conversation bounds at24messages/16000characters,3000characters per message,64KiB V1 request bodies. Current independently validated Arduino code remains complete in a separate read-only snapshot, outside conversational clipping.
- Copied20chat requests/user/minute per-runtime abuse guard. This is not a token or daily consumption quota. No new quota service, dashboard, dependency or attempt table.
- Local identity and supported deterministic calculations invoke no AI. Complete outage returns labelled limited mode, preserves the question, and offers deliberate retry. Model questions use successful runtime metadata rather than generated identity claims.
- Saved snapshots carry mode/provider/model. PWA, Playground help and extension distinguish local/limited output; recovery retains metadata. PWA retry preserves unrelated composer work. Playground clears private help on account change.
- Gemini media/structured routes use `gemini-3.8-flash`; extraction uses temperature0.1, JSON where required and25s ceiling. Media requests do not impose an explicit output-token ceiling. Existing complete tutorial/circuit-review schemas, grounding and40s structured deadline remain. Unknown visual evidence is never fabricated.
- Removed manually asserted free-tier-confirmation prerequisites. Operational switches, Auth, ownership, RLS, file validation and response-memory bounds remain. Billing settings were not changed.

## Verification

- Root312tests pass; PWA53tests pass; root/PWA typechecks and production builds pass. Deno checks pass for both Edge entrypoints.
-13focused parity tests cover exact settings/order, credential isolation, primary and cross-provider failure, strict validation, secret rejection, limited/local responses, repetition bounds, truthful model identity, inclusive history limits, complete code snapshot and hung upstreams.
- SQL regression first failed against old installed admission. Migration rehearsal then passed in a rollback-only transaction. Applied migration `20261028063000_dormosaur_provider_parity.sql` and reran installed checks successfully.45fresh requests with existing pending/high-usage rows were admitted; exact replay, fallback provenance, zero-usage local replies, stale completion rejection, owner RLS and service-only RPCs passed. All SQL fixtures rolled back.
- Two local browser suites pass: saved local/limited labels, original-question retry, composer preservation, continuation with original PDF, exact UUID recovery, signed-out401 and cross-account404. Test providers/auth are synthetic doubles.
- Live synthetic calls succeeded with Groq120B, Groq20B and Gemini2.5. The first20B probe returned invalid scope JSON; the explicit example corrected it and the recheck passed. Actual successful calls are distinguished from limited-mode output.
- Production Edge checks used two disposable authenticated accounts concurrently. Both returned actual Groq120B answers with correct5mA calculation. Same-UUID replay preserved original answer/mode, owner recovery returned one snapshot, another account saw no row, and unsigned POST returned401. All disposable accounts and dependent records were removed.
- The owner's existing Dormosaur Groq/Gemini credentials were transferred directly to OHMI's server-side secret store. No values enter source, browser bundles, logs in this report or second-brain notes.
- Supabase `ohmi-ai` and `ohmi-web` deployed ACTIVE; handler-level JWT verification remains mandatory with existing gateway `verify_jwt=false`. Security advisor names are unchanged; only the prior leaked-password-protection warning remains.

## Rulings and limits

Exact parity applies to provider orchestration, model selection, input/output settings and availability behavior. OHMI retains electronics-specific safety/grounding, schemas, code validation, private storage and idempotent persistence. Dormosaur's schedule/meal/alarm features were not imported. No new OCR subsystem was added: OHMI already extracts supported PDF text, and OCR cannot replace circuit visual review.

Complete tutorial/circuit review retains its existing40s ceiling rather than incorrectly applying the schedule extractor's25s ceiling to a longer structured task. Old recovery rows remain readable. Historical migrations are unchanged; the new migration supersedes their consumption checks.

Gemini3.8 model metadata confirms access. Synthetic generation probes timed out at6.5s and25s; the final actual media-adapter probe also returned timeout/504 at25.012s. Therefore live Gemini3.8 media success is **not** claimed. External model latency is not an application quota. Provider-side rate limits, latency and service failures remain outside OHMI's control. The copied in-memory burst guard has Dormosaur's per-instance limitation. Removing consumption caps also removes their spending protection.

GitHub/Vercel release identifiers are recorded in the final handoff after deployment completes. Roll back application source normally; retain the additive migration and saved student records. Restoring removed consumption restrictions requires a deliberate new policy change, not an implicit rollback side effect.
