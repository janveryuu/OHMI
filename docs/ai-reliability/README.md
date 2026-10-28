# OHMI AI reliability release

> **28 October 2026 update:** The owner approved removing application TPM/TPD and daily consumption gates and copying Dormosaur's provider flow. The historical quota-preservation and no-fallback statements below are superseded by [the parity release](DORMOSAUR_PARITY.md).

Owner requested investigation, fixes, GitHub push and Vercel release. Investigation began25 October2026; verification/release26 October Asia/Manila. [Plan](PLAN.md) was saved before implementation. No live inference was run. No provider/model, key, billing setting, numeric quota cap, onboarding boundary, student data or mascot asset was changed.

## Findings and fixes

1. **Circuit Checker:** client overview/detail IDs were valid. The provider prompt used an undefined `evidenceReference` placeholder, while the validator required `kind`. Explicit examples now define all five variants and supplied IDs; a server-owned Gemini JSON schema reinforces the discriminant. Local source/line/excerpt/ownership checks remain authoritative. Missing kinds produce a helpful contract error. No guessed evidence or screenshot-based electrical verification.
2. **Tutorial:** one observed timeout at24.70s matches the old24s provider ceiling. A successful tutorial took9.69s; neither measurement proves that every request needs40s. The transport deadline now covers headers **and** streamed body reads, even if a stream ignores cancellation. Structured/media work has a40s ceiling, shortened by the remaining50s overall budget with5s reserved for persistence. Concise prompts and a tutorial schema help complete JSON within4096 output tokens. Incomplete structured guides/reviews are rejected, never replaced by generic results. `Server-Timing` reports bounded auth/body/media/context/reservation/provider/validation/persistence/total durations without input text or identity. Historical pre-reservation timing remains unknown; new stage timing is verified with mocks only.
3. **Ask PDF:** the failing request had stored error_code=`truncated` after6.62s. `MAX_TOKENS` was misleadingly presented as a byte-size failure and visible text was discarded. Token-limited plain answers are now saved with an explicit incomplete warning and structured continuation metadata. “Continue answer” performs one deliberate new request through the existing send flow, reusing the owned original PDF/image/artifact and canonical conversation watermark. It preserves unrelated composer text/attachments. Long preceding replies retain their ending in the bounded context window. No automatic continuation or provider retry.
4. **Shared transport/accounting:** Gemini no longer buffers an unbounded response before checking character count. Both transports enforce UTF8 byte bounds and distinguish timeout, network failure, invalid JSON, actual byte overflow and structured token exhaustion. Hidden reasoning is never exposed. Gemini total usage includes thoughts; known rejected structured output is charged too. Unknown usage uses conservative estimates; atomic admission counts the greater of reserved and reported tokens.
5. **Readiness/quota:** per-route readiness was imported but unused. It now checks the master switch, route switch, key presence and existing free-tier-confirmation flag **before admission/media download**. Hosted metadata confirms all five boolean switches/confirmations are currentlytrue; this is an operator assertion, not independent provider-console verification. Hosted SQL confirmed stored TPM/TPD caps were never enforced. The additive migration now enforces those unchanged caps atomically alongside existing RPM/RPD, cooldown, one-pending-request, user and project limits. Exhausted providers enter the existing cooldown path; no fallback or automatic regeneration.
6. **Recovery:** analysis fingerprints can overwrite earlier output, and the extension mistook a chat message ID for an analysis ID. Completed requests now atomically keep an exact private `result_payload`. Recovery uses the original UUID and owner filter, without opening/downloading files or invoking inference. A private/no-store authenticated PWA GET checks snapshots first, then immutable legacy messages (unique circuit artifacts also remain recoverable). Replays never fabricate “Previously completed response.” Ambiguous transport/persistence failures keep their UUID. An expired60s lease allows a deliberate fresh attempt; completion cannot commit after lease expiry. Old non-conversation analyses lacking an immutable original may be unavailable rather than replaying a later answer. Extension recovery also uses request snapshots/messages and preserves its installed identity.

## Limits before / after

| Limit | Before | After |
|---|---:|---:|
| Plain text provider deadline |24s|24s|
| Structured/media provider ceiling |24s|40s, bounded by remaining overall time|
| Overall request budget |No shared bound|50s,5s persistence reserve|
| PWA upstream / extension wait |40s /28s|55s /55s|
| Vercel duration / DB lease |60s /60s|Unchanged|
| Output tokens: chat / PDF / image |1536 /1536 /1536|1536 /3072 /2048|
| Output tokens: tutorial / checker |2048 /3072|4096 /3072|
| Raw provider body |64KiB (Gemini checked characters after buffering)|128KiB UTF8 streamed|
| Visible answer |DB18000 characters|17800 base characters plus explicit incomplete warning; total<18000,64KiB|
| PWA response envelope |128KiB|256KiB|
| Global pending / project daily / user daily / user minute |1 /40 /10 /6|Unchanged|
| Gemini model RPM/RPD/TPM |12 /1200 /32000|Unchanged; token cap now enforced|
| Groq model RPM/RPD/TPM/TPD |24 /800 /6400 /160000|Unchanged; token caps now enforced|
| Media/request input limits |Image4MiB; PDF2MiB/6pages/24000chars; V2two images/6MiB|Unchanged|

Approved routes remain Gemini `gemini-3.5-flash-lite` for PDF/image/tutorial/checker/artifact follow-up and Groq `openai/gpt-oss-120b` for plain Ask. The20b database row remains disabled. No model migration proposal was treated as deployed truth. Downloaded hosted ohmi-ai v17 and ohmi-web v9 match source5403b4c after normalizing CRLF/BOM; no functional source drift was found.

## Verification

- Four original red repro tests failed before fixes, then passed: missing evidence-kind producer contract, lost MAX_TOKENS text/accounting, stalled body and network misclassification.
- Root `npm test`:301 passing; `npm run typecheck`; extension production build; Deno check of both Edge entrypoints pass. Fake clocks cover a complete30s tutorial, stalled provider body and a50s stalled auth stage. Existing grounding, ownership, invalid structured responses, private files, cooldown and replay tests remain passing.
- Full extension browser suite passes on its isolated synthetic build/profile: mascot interactions, account UI/privacy, checker/crops/history, assignments, Ask expansion, beginner guides, paging, canonical watermark and stale-account protection. No registered user installation was changed. The first attempt lacked local public configuration; rerun with synthetic test configuration passed.
- PWA `npm test`:48 passing; production build and typecheck pass. PWA unit tests cover exact completed recovery, unknown IDs, lost POST acknowledgement, pending/expired/failed requests, unavailable authentication and mismatched IDs. Dedicated real-route browser test passes manual PDF continuation, preserved draft/selected attachment,390px layout, one mocked inference, private recovery, cross-account404 and signed-out401.
- `supabase/tests/ai_reliability.sql` passes in rollback-only transactions: exact per-request snapshots despite a later analysis overwrite, immutable replay, duplicate/late completion rejection, total usage including hidden tokens, existing TPM/TPD enforcement, service-only execution and owner RLS. Migration rehearsal and installed-schema check are recorded below. No live inference, Storage objects or student records are used by these tests.
- Existing production build emits the pre-existing unpdf `import.meta` bundler warning. No new runtime dependency.

Browser-harness changes match the new read-only lookup, prevent the development toolbar from intercepting mobile taps (page errors still asserted), and explicitly register the unchanged public-only worker in development with a finite wait. These are test changes, not product layout changes.

- Broad PWA browser suite passes19 checks across six viewports, both themes, private APIs, crops, interaction states, saved preferences, manifest and actual offline fallback; errors=[] and axe violations=[]. Library passes all20 detail routes, image decode/failure, search/categories/keyboard and four sizes/both themes. Playground passes missions, hints, keyboard edits, undo, switch states, pan/zoom and12 size/theme accessibility scans, with no violations. The dedicated continuation test also passes; test evidence is generated under ignored `web-app/test-results/`.

## Reproduction and release

```powershell
npm test
npm run typecheck
npm run build
npx deno check supabase/functions/ohmi-ai/index.ts supabase/functions/ohmi-web/index.ts
cd web-app
npm test
npm run typecheck
npm run build
```

Use the isolated synthetic Auth fixture at127.0.0.1:54329 and a development app at127.0.0.1:3115/app for `node tests/ai-reliability-browser.mjs`, `node tests/browser.mjs`, `node tests/library-browser.mjs` and `node tests/playground-browser.mjs`. No production-mode fixture workaround, real Google account, live provider call or paid/unverified smoke test was used.

Apply only migration20261025155935 after matching local/remote history. Deploy the two existing Edge functions `ohmi-ai` and `ohmi-web` using their existing gateway JWT setting (false); both handlers still verify the user's JWT. Publish to the existing GitHub production branch `codex/ohmi-web-app-pwa` and verify Vercel's exact commit. Retain the audit branch `codex/ai-reliability`.

Rollback: restore the prior Vercel deployment/source5403b4c using a normal revert, and redeploy the prior shared Edge source (ohmi-ai v17 / ohmi-web v9). Retain the additive snapshot column and stricter caps/lease checks: older source remains compatible. Never delete request history, reset private data, move the onboarding rollout boundary or loosen RLS/quota safeguards during rollback.

## Limits of proof

Account-specific free eligibility, actual remaining upstream quota and billing protection were **not independently reverified in provider consoles**. Existing free-confirmation flags are true, but no live smoke test is permitted without separate verified readiness and an explicit call/token budget. Public provider docs cannot establish account eligibility. Synthetic30s success proves timeout coordination, not live latency or answer quality. Physical devices, Safari/Firefox, real account consent and production authenticated inference remain untested. No claim of complete electrical verification from images is made.

References: [Supabase function limits](https://supabase.com/docs/guides/functions/limits), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Groq reasoning](https://console.groq.com/docs/reasoning).

## Changed files

- `docs/ai-reliability/PLAN.md`
- `docs/ai-reliability/README.md`
- `src/ai/circuit.ts`
- `src/backend/database.types.ts`
- `src/backend/service.test.ts`
- `src/backend/service.ts`
- `supabase/functions/ohmi-ai/circuit.ts`
- `supabase/functions/ohmi-ai/groq.test.ts`
- `supabase/functions/ohmi-ai/groq.ts`
- `supabase/functions/ohmi-ai/handler.test.ts`
- `supabase/functions/ohmi-ai/handler.ts`
- `supabase/functions/ohmi-ai/provider-policy.test.ts`
- `supabase/functions/ohmi-ai/provider-policy.ts`
- `supabase/functions/ohmi-ai/reliability.test.ts`
- `supabase/functions/ohmi-ai/schemas.ts`
- `supabase/migrations/20261025155935_ai_reliability_snapshots_and_admission.sql`
- `supabase/tests/ai_reliability.sql`
- `web-app/src/app/api/ai/requests/[id]/route.ts`
- `web-app/src/app/api/ai/route.ts`
- `web-app/src/components/chat.tsx`
- `web-app/src/lib/backend/ai.ts`
- `web-app/src/lib/backend/database.types.ts`
- `web-app/src/lib/backend/guards.mjs`
- `web-app/tests/ai-recovery.test.mjs`
- `web-app/tests/ai-reliability-browser.mjs`
- `web-app/tests/auth-fixture.mjs`
- `web-app/tests/browser.mjs`

## Installed backend verification

Only migration20261025155935 was pending and applied. Its rollback-only test passes against the installed schema, including duplicate/late completion rejection. Both functions deployed successfully: ohmi-ai ACTIVE v18, ohmi-web ACTIVE v10, original gateway settings preserved. Both unauthenticated POST checks return401/auth_error without inference. Downloaded deployed ohmi-web source and all changed shared dependencies match verified local source after line-ending normalization. Existing numeric caps and free-only flags were retained; no provider inference was requested.
