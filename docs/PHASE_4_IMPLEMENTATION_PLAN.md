# Phase 4 implementation plan — OHMI, Your Circuit Buddy

**Status: proposed blueprint; awaiting owner approval. Planning only.**

Prepared by Codex on 15 October 2026, Asia/Manila, against `codex/stabilize-phases-1-3` at `03a7c9b7f62b5934b3463f1d687941b3a71e6685`. Codex plans and reviews; Antigravity (AGY) implements one approved milestone at a time. This document does not authorize implementation, deployment, migrations, credential changes, billing, or Phase 5.

## 1. Decision and scope

Use the existing extension worker and one authenticated Supabase Edge Function, with one explicitly selected model and native `fetch`. Evaluate **Gemini `gemini-3.5-flash-lite` first**, using synthetic, non-sensitive inputs. This is a candidate recommendation, not a claim that it works for OHMI. No provider is production-approved by this research.

First prove a plain text generation request. Then add authenticated chat, technical tutoring, uploaded images, PDFs, tutorials, and durable learning history. Each feature must pass its own real-output gate before the next feature depends on it. Keep retries at **zero automatic generation retries**. Do not restore the old provider router, offscreen PDF pipeline, validators, or prompt system.

There is a real constraint conflict: Gemini's unpaid service is unsuitable for sensitive/confidential student material. Its current terms also restrict use involving under-18 audiences. A free, adult, non-sensitive class pilot may be feasible; unrestricted private student-document processing is not established. Section 3 defines the decision gate. Do not hide this limitation behind a consent checkbox or a server-only API key.

### Included outcomes

| Capability | Phase 4 behavior | Evidence required |
| --- | --- | --- |
| AI chat and tutor | Contextual help with electronics, Tinkercad concepts, Arduino, and circuits; admits missing information. | Real text requests and follow-up context tests, not fixed sample replies. |
| Assignment analysis | Explain instructions, required components, deliverables, constraints, and readable diagrams from bounded PDF/PNG/JPEG uploads. | Compare against human-reviewed source fixtures; distinguish source requirements from suggested choices. |
| Uploaded circuit images | Describe visible components/connections and possible mistakes, with evidence and uncertainty. | Clear and ambiguous image fixtures; no claim of electrical verification. |
| Learning tutorials | Beginner-friendly ordered steps, explanations, checks, source references, and required code. | Complete source-specific guide; correct quantities, pins, timing, and calculations. |
| Arduino help | Explain, generate, and review complete sketches; state board/library assumptions. | Known-code fixtures, selected compilation checks, and human review. |
| Languages | English, Filipino, and natural Taglish using existing language preferences. | Equivalent technical meaning in all three; code identifiers and units preserved. |
| Saved learning | Owned conversations, analyses, generated tutorials, and progress that survive refresh/sign-in. | Real two-account isolation, reload, duplicate request, and deletion tests. |

### Boundaries

- Preserve WXT, React, TypeScript, Tailwind, Chrome MV3, Supabase Auth, Google OAuth, RLS, private storage, manual steps, and existing student data.
- Preserve the approved mascot PNGs, animation behavior, six-section layout, keyboard/focus behavior, themes, and compact panel styling. Functional additions use existing controls and CSS patterns.
- Uploaded screenshots are in scope. Tab capture, continuous observation, automatic circuit checking, direct Tinkercad control, DOM/netlist extraction, simulation control, and new browser permissions are excluded. Keep the existing Check My Circuit demonstration clearly identified until separately approved.
- No voice, agents, RAG/vector database, paid grounding/search, new hosting platform, multi-provider fallback, background queue, or generic AI framework.
- AI advice is educational. A screenshot cannot prove hidden breadboard continuity, exact resistor values, working simulation, or physical electrical correctness.

## 2. Verified foundation and failure lessons

### 2.1 Evidence inspected and reproduced

Read `AGENTS.md`, `PROJECT_CONTEXT.md`, `ANTIGRAVITY_HANDOFF.md`, `PHASES_1-3_STABILIZATION.md`, `ANTIGRAVITY_VERIFICATION.md`, `PHASE_4_ROLLBACK.md`, mascot/design guidance, the active worker/services/contracts/tests, and all seven migrations. Read the archived failure report with `git show 981a51f:docs/PHASE_4_VERIFICATION.md`; archived code is evidence, not an implementation template.

| Check performed during planning | Result and limit |
| --- | --- |
| Git | Clean starting checkout; local HEAD and `origin/codex/stabilize-phases-1-3` both `03a7c9b7f62b5934b3463f1d687941b3a71e6685`. Latest AGY commit adds verification/bridge documentation; runtime/config/assets/tests match stabilization `8b4834f`. Main was not changed. |
| `npm test` | 25 tests passed across five files. |
| `npm run typecheck` and `npm run build` | Passed; version 0.3.0, approximately 2.23 MB. Existing path-dependent identity warning remains. |
| `npm run test:browser` | Passed using existing Chromium at `C:/Users/LEGION/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe` through `OHMI_CHROMIUM_PATH`. Default expected revision 1248 was missing; no installation or dependency change was needed. Tests use a simulated editor and synthetic account state. |
| Mascot integrity | Source/build SHA-256 both `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382`. |
| Fresh hosted metadata, read-only | Nine OHMI tables have RLS; seven migration versions match local filenames; `ohmi-assignments` remains private with 10 MiB and PDF/PNG/JPEG limits; no deployed Edge Functions. Inspected retained columns, relevant constraints, and five routine signatures/execute grants. |
| Historical hosted evidence | AGY/stabilization reports record successful two-user Auth/Storage/CRUD tests and original SQL/history comparison. Planning did not rerun their write-based fixtures or independently recheck every policy body. |

No live AI request was made. No provider reliability, current quota, billing status, student-output accuracy, regular-profile Google consent, real Tinkercad interaction, or fresh local database replay was certified here. The existing Supabase CLI was used without installation; no SQL mutation was submitted.

### 2.2 Architecture to retain

- `entrypoints/ohmi.content.tsx` mounts the top-level Circuits-only Shadow DOM companion. `src/OhmiApp.tsx` owns placement and remounts the panel on identity changes.
- `src/AssistantPanel.tsx` currently has demonstration chat, guides, and circuit feedback. Do not present demonstrations as provider evidence.
- `src/bridge.ts` sends typed runtime messages. `entrypoints/background.ts` validates senders/actions through `src/backend/validation.ts` and delegates to `src/backend/service.ts`.
- The worker owns the only client-side Supabase client, verified user, auth refresh, account isolation, profiles, assignments, and manual steps. Keep `accountId` as a stale-view guard, never authority.
- Trusted `account.html` owns passwords and uploads. Real files use private owned object paths. `files.finish` verifies stored metadata; `ready` is not server-side media/content validation.
- Shadow DOM protects styles/events, not rendered content from host-page scripts. Never render secrets or promise confidential storage merely because content appears inside OHMI's panel.

### 2.3 Known open gates

1. **Identity:** retain `C:/Users/LEGION/Documents/OHMI - Your Circuit Buddy/.output/chrome-mv3`, ID `ikemolangalcofljjajakagdnfdpnakh`, and existing OAuth callbacks. The owner lacks the matching public manifest key. Portability remains blocked; do not invent a key or move the registered build.
2. **Privileged-key security:** prior key rotation is unverified. Require an owner-controlled verification/remediation before enabling new hosted AI access for real students. AGY must not rotate credentials as part of this plan.
3. **Email delivery:** leave `WXT_EMAIL_DELIVERY_READY=false`; confirmed-account and Google sign-in remain the supported paths. Do not auto-confirm students or change Auth settings.
4. **Acceptance:** regular-profile Google consent/cancel/retry, a second intended Google user, and actual editor wiring/code/simulation/zoom still need manual evidence. Existing browser passes do not close these gates.

### 2.4 Previous failures and required changes in approach

| Historical evidence | What it establishes | New rule |
| --- | --- | --- |
| Gemini 3.8 lookup and `countTokens` succeeded; plain generation returned 503. Gemini 3.6 text/image/PDF each returned 503. | Catalog access is not generation availability. No accepted output existed in those runs. | Plain generation first; stop on first provider failure. Do not debug prompts or schemas from an availability error. |
| Groq `qwen/qwen3.8-27b` generated a PDF response rejected by `text()` with a generic error. | A structural predicate failed; exact field/type/length was not retained and remains unknown. | Named field/reason/type/length diagnostics from the first parser version. Never guess the historical cause or widen limits blindly. |
| Later Groq response passed structural parsing, then failed a requirement for page references in component/step prose. | Schema validity and source-reference validity are separate. Exact offending index remains unknown. | Use explicit source-reference fields and validate them separately. Do not require the literal phrase `page N` in every prose field. |
| Unit/type/build suites passed while the real assignment workflow failed. | Mock transport success is insufficient. | Each modality needs current real output compared with ground truth, followed by its real extension workflow. |
| Previous routing, retries, quotas, PDF preparation, validators, and persistence grew together. | Failures became hard to locate; old results could be mistaken for current evidence. | One provider, one attempt, small contracts, sequential gates, versioned artifacts, and exact run metadata. |

## 3. Provider evaluation and selection gate

Official documentation was checked on 15 October 2026. Quotas and models can change. No current authenticated provider probe was authorized or run.

### 3.1 Candidate comparison

| Candidate | Free access and realistic limits | Technical fit and concerns | Decision |
| --- | --- | --- | --- |
| **Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`) | Current pricing lists free input/output. Actual project RPM/TPM/RPD must be read in AI Studio; capacity is not guaranteed. | Stable documented text/image/PDF input and structured output. Native PDF avoids an extension-side extraction/rendering system. Electronics and Taglish quality remain unproven. Unpaid-data terms are a material restriction. | First synthetic evaluation candidate, subject to eligibility/privacy and availability gates. |
| Gemini 3.8 / 3.6 Flash | Public catalog still lists these models. Listing and model lookup do not prove this project's free generation access. | Relevant OHMI 503 evidence exists for both. A model change within Google does not establish an independent availability fallback. | Do not restore as defaults or automatically fall back to them. Re-evaluate only through a reviewed provider decision. |
| Groq Qwen 3.8 27B (`qwen/qwen3.8-27b`) | Published free table lists 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD; organization limits and actual headers govern. | Text/image input, at most three images per request, JSON schema strict mode advertised; no native PDF input on its model page. Previous generation worked but OHMI validation failed. Currently marked **Preview**. | Alternative evaluation only. Preview status prevents treating it as an unrestricted production recommendation. Requires a separate PDF preparation design if selected. |
| Groq GPT-OSS 120B | Published free table also lists 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD. | Production text reasoning/strict schema candidate; insufficient alone for required vision. | Possible text-only scope decision, not a solution to all seven objectives. |
| OpenRouter free variants | Official tutorial describes 20 RPM and 50 requests/day without credit purchase. Higher daily allowance requires a purchase, excluded here. | Availability/privacy/modality depend on upstream model/provider; adds another routing boundary. | Do not adopt for the baseline. Do not use random free-model routing or paid fallback. |
| Cloudflare Workers AI | 10,000 Neurons/day on Free; exceeding Free allocation fails unless upgraded. | Model-dependent vision/reasoning/structured-output behavior and another account/integration to verify. No OHMI result evidence. | Reserve as a future replacement investigation, not simultaneous integration. |

Sources: [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models), [Flash-Lite capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Groq models](https://console.groq.com/docs/models), [Groq model details](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [Groq limits](https://console.groq.com/docs/rate-limits), [Groq structured outputs](https://console.groq.com/docs/structured-outputs), [OpenRouter free limits](https://openrouter.ai/blog/tutorials/how-to-get-the-lowest-cost-llm-inference-on-openrouter/), and [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

### 3.2 Privacy and eligibility gate

Google's unpaid-service terms permit product/model improvement and human review, prohibit submitting sensitive/confidential/personal information, and restrict API clients directed toward or likely accessed by under-18 users. Confirm intended audience and permitted use before selecting Gemini. Do not assume all college students are adults. Sources: [Gemini terms](https://ai.google.dev/gemini-api/terms) and [available regions](https://ai.google.dev/gemini-api/docs/available-regions).

For a Gemini free pilot:

- Use synthetic/public/non-sensitive prompts and source files only, with an explicitly eligible adult audience.
- Send no account names, emails, auth identifiers, or unrelated assignments to the model.
- Explain external processing before the first request. File upload/storage alone must not trigger AI processing.
- Require a genuinely non-sensitive copy before sending a document. Do not claim automated PII detection, visual black boxes, or removing a filename makes an original PDF safe. Metadata and scanned pages can also contain personal data.
- Do not offer real sensitive/private student-file processing through unpaid Gemini. Consent does not override provider restrictions. Private Supabase access and provider data handling are different boundaries.

Groq documents default non-retention of inference content with exceptions for reliability/abuse and all-customer Zero Data Retention controls. Those controls, actual account settings, eligibility, and any preview restrictions still need verification before selection. No Groq setting was changed during planning. [Groq data controls](https://console.groq.com/docs/your-data).

**If the required audience/data cannot use the chosen free service, stop that rollout.** Return a documented replacement-provider or scope decision to the owner. Do not enable billing, use trial credit as permanent funding, weaken privacy, or claim full Phase 4 acceptance with missing file capabilities. There is no proven unlimited, confidential, production-grade API at ₱0 in this investigation.

### 3.3 Rules for the provider gate

Record exact provider/model, date, free-plan status, project limits, permitted audience/data, latency, response completion status, token usage, schema result, and technical rubric result. Record synthetic fixture IDs and source hashes; never keys or real student content.

1. Confirm the model exists and account has nonzero free generation access. This is a precondition, not a pass.
2. Run one short text request without media, schema, tools, history, or retry. Stop on the first failure.
3. After success, require three valid basic responses across at least two separated test windows. Do not loop until success; resume only through an explicitly authorized test run after a failure.
4. Qualify text tutoring, images, PDFs, and tutorial schema separately in their milestones. A pass is specific to provider, model, prompt/contract version, and modality.
5. If the candidate fails, preserve evidence and stop. A reviewed replacement uses the same gate. Build only the selected provider integration; do not keep parallel production adapters.

### 3.4 Enforce ₱0 and small-class capacity

- Keep both Supabase and AI accounts on verified free plans. No card activation, paid model, credit purchase, search grounding, hosted OCR, or paid email service without owner approval.
- Server-side configuration selects one fixed allowlisted model and an AI enable flag. Missing/unknown configuration disables generation. A `FREE_TIER_CONFIRMED` flag records an owner check; it cannot establish account billing state by itself.
- Initial application limits: one in-flight request per user, one project-wide generation at a time, at most 10 requests/user/day and 40/project/day. Lower every limit to fit the actual provider/project quota with at least 50% headroom. These are proposed application limits, not advertised provider entitlements.
- Enforce project RPM, TPM, and daily limits atomically across Edge instances. Track the provider's reset window, not an assumed Philippine or UTC midnight. Include probes, failures, rejected responses, and unknown timeout usage.
- Count/reserve the complete input, schema, media budget, context, and output budget before generation. Use provider token counting when media cannot be conservatively bounded; token counting also gets a deadline and failure handling. Do not call it as proof generation works.
- Never infer a hard token ceiling from a casual characters/4 estimate. Reconcile actual provider usage, including reasoning where reported. Keep unknown attempts conservatively reserved for their quota window.
- Initial generation output ceilings: 512 tokens for the M1 probe, 2,048 for chat/code/images, and 4,096 for PDF analysis/tutorials. Configure reasoning within that measured budget where supported. Lower ceilings or input scope if actual free quotas require it; never truncate a required sketch/tutorial into an accepted result. Reject provider response bodies above 64 KiB while reading, before JSON parsing.
- Monitor existing Supabase database/storage/egress/function usage. Repeated PDF downloads can exhaust free egress before function invocations. Supabase currently lists 500,000 free function invocations and 1 GB storage, but the project's actual remaining allowance is unknown. Stop new AI work at a conservative usage threshold; preserve existing reads/data. [Supabase pricing](https://supabase.com/pricing).

## 4. Technical architecture and contracts

### 4.1 Request path

```text
Existing panel or trusted Account page
  -> validated extension runtime message
  -> existing background worker + verified active account
  -> HTTPS POST to one Supabase Edge Function: ohmi-ai
  -> independently verified Auth user + owned records under RLS
  -> bounded file/source preparation when explicitly requested
  -> atomic quota/idempotency reservation
  -> one provider fetch
  -> transport + schema + source + calculation validation
  -> account-scoped response; durable result only after persistence milestone
```

Use native `fetch`, `AbortController`, Web Crypto, and the existing Supabase SDK. No LangChain, AI SDK, automatic provider retries, new UI library, or extension-side provider client. Keep generation non-streaming initially so validation completes before display. Do not revive the old streamed-JSON transport to conceal long jobs.

### 4.2 Trust boundaries

1. Extend existing `validateRequest` action/payload allowlists. Verify extension sender, trusted Account page or top-level Circuits context, UUIDs, enum values, sizes, and ownership-sensitive operation arguments. No page `window.postMessage` bridge.
2. Worker reuses `requireUser`, session refresh, and stale-account checks. Attach the access token only within the worker's HTTPS request. Never return tokens to content scripts. Check current account again before delivering asynchronous results.
3. Edge independently verifies the Bearer token with Supabase Auth, obtains the real user ID, and denies expired/invalid/anonymous users before any provider call. Use that JWT for owner-scoped record and Storage reads. CORS/origin checks supplement authentication; they never replace it. Verify current gateway JWT configuration with actual signed-in/unsigned requests. [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth).
4. Use a separate server-only privileged client only for quota reservation and atomic result finalization. Service-role access bypasses RLS, so each routine must recheck owner/target relationships explicitly. Never accept `user_id` as client authority.
5. Model text, uploads, extracted text, and provider JSON are untrusted. Documents cannot override the system policy. No model-selected URLs, remote tools, arbitrary code execution, SQL, or automatic browser actions.
6. Server keys remain in Edge secrets only. Do not add keys to `WXT_*`, extension storage, runtime messages, source, logs, URLs, or build output. Existing unused provider secrets stay dormant; this plan does not authorize deleting/rotating them.

### 4.3 Small request/response contract

Names below are proposed additions, not existing endpoints. Add only the current milestone's operation.

| Field | Contract |
| --- | --- |
| Common request | `version: 1`, UUID `requestId`, operation `chat`, `image`, `pdf`, or `tutorial`, language `english`, `filipino`, or `taglish`. Reject unknown keys and malformed fields. |
| Text | `message` up to 2,000 characters, aligned with existing compose control. Pasted Arduino code uses a separate plain-text field up to 8,000 characters. Bound aggregate request body to 32 KiB. |
| Owned references | Optional `conversationId`, `assignmentId`, and later `analysisId`; each operation requires its applicable owned references. Accept IDs, not Storage paths, arbitrary URLs, or base64 file bodies. |
| Initial chat context | Up to four preceding user/assistant pairs in memory; mark client context as untrusted conversation data. Never accept a client `system` role. Bound combined context before generation. After M7, load owned canonical history server-side. |
| Worker-only guard | `accountId` is checked locally. Server derives identity from Auth whether or not an account guard is present. |
| Successful response | `requestId`, verified `accountId`, operation, language, bounded validated result, provider/model provenance, and later persisted result IDs. Never a credential or signed file URL. |
| Failure response | Stable code, short user-safe message, `requestId`, and optional `retryAfterSeconds`. No raw provider body, document excerpt, or arbitrary exception string. |

Define both server runtime validators and TypeScript contracts. A type assertion is not validation. Start plain text for chat; use a small JSON schema only where structured content is needed. A suitable result envelope contains `status: answer | needs_clarification | unsupported`, `answer`, bounded `questions`, and optional technical evidence. File analysis/tutorial schemas are separate, with explicit references and versioning.

Provider schema constraints and application semantic checks must agree. Use supported JSON-schema features only and test the exact deployed request format. Valid JSON or schema conformance does not establish technical truth. [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).

### 4.4 Account changes, worker lifetime, and rendering

- Retain the panel's identity-based remount. Add request cancellation and an account/request generation marker. Ignore old responses after account change, sign-out, unmount, or superseding context. Recheck in both worker and UI; do not rely solely on React cleanup.
- Cancellation stops local waiting where possible; it does not prove a provider stopped or refund quota. The server may finish only for the original verified owner. Never attach that result to the new account.
- Keep deadlines below the MV3 worker's long-fetch boundary: proposed 20 seconds maximum provider generation, 25 seconds total server request, and 28 seconds worker wait. Auth, storage, parsing, and counting share the total deadline. Qualify these on the real extension; do not hold requests open indefinitely.
- Free Supabase Edge runtime currently allows 256 MB memory and 2 seconds CPU/request, despite a 150-second wall limit. PDF/image CPU work must fit independently of network latency. A timing failure stops that modality; it does not justify adding an unreviewed queue. [Edge limits](https://supabase.com/docs/guides/functions/limits).
- Preserve current visual design. Show explicit idle/loading/success/clarification/failure/limit states, accessible status text, disabled double-submit, and a manual retry control only when eligible.
- Render generated text as React text and code as escaped `<pre><code>`. No raw HTML or `dangerouslySetInnerHTML`. Add Markdown only if later justified and safely rendered. External references come from an approved source registry, not executable model markup.
- Provide the existing trusted Account surface for private history/analysis viewing, with minimal functional controls. Explain that text shown in the Circuits overlay can be inspected by the host page. Do not automatically expose saved history whenever the mascot opens.

## 5. Files, source evidence, calculations, and code

### 5.1 Server-side file validation

For every image/PDF/tutorial operation using a file:

1. Select the assignment by **both** assignment ID and verified owner; require `ready`. Resolve `object_path` only from that owned row and require the canonical owner/assignment prefix.
2. Download from `ohmi-assignments` server-side using owner authorization and a bounded read/deadline. Do not fetch a client URL or send a private signed URL to the provider.
3. Compare actual bytes/length and detected type with metadata. Validate media structure with a maintained parser/decoder; filename, MIME header, magic bytes, and `ready` alone are insufficient.
4. Hash actual original bytes with SHA-256. Reuse that hash for provenance and cache identity. If the original changes or disappears, reject/reanalyze; never reuse an old source result silently.
5. Pass only validated permitted content through the selected provider's documented format. Recheck target existence/owner before saving after a long generation; deletion must not resurrect data.

Initial AI limits are deliberately smaller than the existing **10 MiB storage** limit:

| Input | Initial AI limit | Failure behavior |
| --- | --- | --- |
| PNG/JPEG | One image; at most 4 MiB, 4 megapixels, each side at most 4,096 pixels. | Reject oversized/corrupt images before generation; ask for a clearer crop. Do not change existing stored-file eligibility. |
| PDF | One PDF; at most 2 MiB and six pages; no password/encryption. | Reject unsupported/corrupt/oversized files; explain the supported subset. Never process only the first pages silently. |
| Extracted PDF text | At most 24,000 characters within the measured token/context budget. | Ask for a shorter non-sensitive document; do not silently truncate requirements. |

Before decoding, inspect bounded dimensions/page structure using the chosen library's safe inspection facilities. Protect against compressed bombs and pathological object graphs. Then decode/parse under measured memory/CPU limits. Do not write a bespoke PDF/PNG/JPEG parser or attempt to execute embedded content. Parsing is not malware certification; preserve private downloads without calling uploads universally safe.

Add a file library only when the relevant milestone reaches its runtime gate. Evaluate one Deno-compatible PNG/JPEG decoder, such as a suitably licensed/pinned ImageScript release; verify its decoder limits, license, dependency surface, and Edge compatibility. Its documentation is not proof it fits Edge CPU/memory. [ImageScript source](https://github.com/matmen/ImageScript).

For PDF, evaluate a pinned `pdfjs-dist` release for **server-side structure and text extraction only**. No canvas rendering, offscreen entry point, downloaded extension code, OCR service, or worker permission. Prove the import and representative files run in the actual Edge runtime before adopting it. Do not port the archived offscreen system or pile up Node-global polyfills to force an unsuitable build. [PDF.js documentation](https://mozilla.github.io/pdf.js/getting_started/).

### 5.2 PDF and diagram evidence

Use Gemini's documented inline PDF input only after validation and eligibility pass. OHMI's limits remain smaller than Google's advertised PDF envelope. Do not use the provider Files API initially; it adds external file lifecycle/state without solving OHMI's correctness problem. [Gemini document processing](https://ai.google.dev/gemini-api/docs/document-processing).

Extract page-indexed native text locally on the server to check references independently. Preserve physical page numbers, line/paragraph boundaries, and enough table structure to avoid concatenating unrelated quantities. Native provider PDF viewing supplies diagram understanding; it does not replace source checks.

Each source-derived requirement/component uses a reference such as `{page: 2, excerpt: "..."}`. Validate page bounds and normalized excerpt occurrence in server-extracted text. A matching excerpt verifies location, not that an AI interpretation is true. Compare critical quantities, pins, timing, and constraints separately against source facts. Mark each fact as `source_stated`, `user_confirmed`, `suggested`, or `uncertain`.

Visual-only references contain a page/image location and a clearly provisional observation, without a fabricated text quotation. For scans, illegible tables, ambiguous wire endpoints, or conflicting diagrams, return targeted clarification. Require user confirmation of critical unreadable values before generating a build-ready tutorial. Do not introduce a second LLM as an alleged independent validator.

Keep extraction facts separate from tutorial writing. Do not require citations on general explanatory advice, invent source quantities, replace OCR guesses with defaults, or silently merge repeated table rows. Source ambiguity is a valid product outcome.

### 5.3 Deterministic engineering calculations

Implement a small pure server module for the calculations actually supported by this milestone: Ohm's law, a single LED series resistor, simple series/parallel resistance, and resistor power. Each calculation uses an allowlisted operation and finite typed operands in SI units; no `eval`, arbitrary expressions, symbolic solver, or automatic circuit-netlist inference.

- Keep model-suggested operands distinct from independently sourced or user-confirmed operands. Correct arithmetic on guessed values is still a hypothetical result.
- For LED examples, require supply voltage, stated/assumed LED forward voltage, current target, and topology. A default LED voltage is a labeled assumption, not an inferred screenshot measurement.
- Reject zero/negative resistance, impossible voltage relationships, nonfinite values, unsupported units/topologies, and missing inputs. Handle zero voltage/current where the formula permits it.
- Calculate without display rounding; format units once at the boundary. Server-generated result fields/cards are authoritative. Do not let the model provide the displayed numeric result; suppress contradictory generated numeric conclusions.
- Use structured calculation IDs/operands and server-rendered numeric fields. Do not repair prose by replacing embedded calculation markers or guessing numbers with regexes. Reject a contradictory result, or return a deterministic calculation without the rejected explanation.
- Reference check: `(5 V - 2 V) / 220 ohm = 0.013636... A`, or about **13.64 mA**. This assumes the stated forward voltage and simple series topology; it does not prove an LED rating or GPIO safety.
- `R = (Vs - Vf) / I`, `P = I²R`, `Rs = sum(R)`, and `Rp = 1 / sum(1/R)` need positive applicable operands. Choosing a stock resistor and power rating requires explicit tolerances/ratings and margin, not rounding down blindly.
- Tests must cover unit conversion, boundary values, missing facts, rounding, the historical duplicated-`mA` regression, and disagreement between model prose and deterministic results.

No claim of a general circuit solver. For unsupported electronics calculations, show the reasoning as unverified and ask for authoritative inputs rather than adding a parser that appears more capable than it is.

### 5.4 Arduino and source validation

Maintain a small reviewed reference registry for relevant official Arduino board/API documentation and supplied component datasheets. Store URL, board/component, checked date, and short factual notes; no scraper, vector search, or paid grounding. Begin with [Arduino UNO Rev3](https://docs.arduino.cc/hardware/uno-rev3/). Expand only for covered fixtures.

Distinguish three claims: source requirement matched, sketch compiled for a specified board, and behavior observed in a simulator/hardware. None implies the next. For Tinkercad instructions, provide documented manual guidance and acknowledge uncertainty about current UI controls.

Tutorials/code must state board, pin map, library assumptions, complete `setup()`/`loop()` where requested, and expected behavior. Verify source-stated blink pins, `OUTPUT` setup, HIGH/LOW order, and delay values with focused fixture checks. Do not use a few regexes to certify arbitrary C++ or electrical safety. Review pin capabilities/current limits against official references, not the model's recalled numbers.

Compile a small representative fixture set locally with an existing Arduino toolchain when available. If installation would be needed, report it for the separately approved milestone; compilation is not a runtime service. Never execute generated code on the server or upload it to a board automatically.

## 6. Retained database reconciliation and persistence design

### 6.1 Actual objects, not a blank database

The seven applied files span `20261012141823` through `20261014065738`. Preserve them unchanged. Fresh local installations replay all seven; hosted objects/data already exist.

| Existing object | Reuse and required reconciliation |
| --- | --- |
| `ohmi_profiles`, `ohmi_assignments`, `ohmi_assignment_steps` | Preserve current behavior, ownership constraints, data, and manual steps. Generated tutorials never overwrite student-written steps. |
| `ohmi_conversations` | Owns chat threads, optional owned analysis link, existing composite ownership FK. Reuse for history; no new conversations table. |
| `ohmi_messages` | Reuse role/content/request fields, unique conversation position and `(request_id, role)`. Existing 18,000-character content maximum is an outer bound, not a target response size. |
| `ohmi_analyses` | Reuse for file analysis and generated tutorials. Current payload requires a `steps` array of at most 24, and current `UNIQUE(assignment_id, language)` prevents independent versions/kinds. Add explicit version/provenance before new artifact persistence. |
| `ohmi_tutorial_progress` | Reuse analysis-scoped progress and current bounds trigger/RPC; generated tutorial versions must remain stable for their progress IDs. |
| `ohmi_ai_requests` | Reuse request UUID/input hash/status/usage ledger. Owner becomes null on account deletion; preserve non-content usage history. Existing `kind` permits only `chat`/`analyze`; current reservation needs owned targets. |
| `ohmi_ai_provider_backoffs` | Reuse cooldown storage. Its CHECK and `ohmi_defer_ai_provider` allow only the old three models. Preserve old rows; add the chosen candidate deliberately. |
| Five routines and trigger | Inspect final definitions, not just first migration. `ohmi_reserve_ai` currently has seven arguments and only user minute/in-flight admission; older daily/token gates were superseded. `ohmi_complete_ai` still hard-codes old model IDs and assumes old payload persistence. Only progress-save permits authenticated execution. Replace relevant definitions through reviewed forward migrations; do not invoke blindly. |

### 6.2 Two bounded migration slices, after provider proof

**M2: request accounting/security only.** Reconcile existing reserve/complete/backoff routines with the selected single model and ephemeral chat. Keep existing ledger states `pending`, `completed`, and `failed`; add stable error metadata and an operation discriminator only as needed. Preserve legacy rows with nullable new fields; do not falsely mark old outputs as validated.

- Permit an authenticated ephemeral text request to reserve without a conversation target; require owned assignment targets for media. Existing old overloads must not create bypasses.
- Make provider/model explicit for new requests; eliminate reliance on the old default model. Add the candidate to model checks while retaining historical values for old rows.
- Enforce global/user request and token reservations under a database lock, plus cooldown and one in-flight generation globally. An Edge-instance variable is insufficient.
- Use the existing UUID/input hash for idempotency. Hash canonical operation, owned targets, content/context, original source hash, language, selected model, and prompt/validation versions. Reusing a UUID with a different hash or owner returns conflict.
- One admitted request allows one provider generation. Reserve the maximum bounded cost before dispatch. On a received provider response, record known usage **before** semantic validation. On unknown outcome, keep conservative accounting.
- Expire abandoned pending reservations after a short lease exceeding the 25-second deadline, for example 60 seconds. Mark failed/unknown usage; do not automatically retry or zero their reservation.
- A duplicate pending request reports in progress without generation. A failed request stays terminal. Before M7 there is no durable response cache: a completed replay reports completion without reconstructing a lost answer; a deliberate new request uses a new UUID and quota.

**M7: artifact/history/progress persistence.** Make the smallest forward changes supported by synthetic old/new-row tests:

1. Add nullable artifact metadata to `ohmi_analyses`: schema version, artifact kind, provider, original source hash, prompt/validation version, and canonical input fingerprint. Existing model/created-at fields remain. New rows explicitly fill their required metadata; old rows remain legacy.
2. Replace the old assignment/language uniqueness constraint with an owner-scoped partial unique index for **new** artifact fingerprints. Include operation/kind, assignment identity/hash, source/user-confirmed inputs, language, model, and all relevant versions in the fingerprint. No cross-owner cache reuse. Do not overwrite old analyses with an upsert.
3. Permit a null `assignment_id` only for a standalone generated tutorial. Keep assignment-required checks for new image/PDF artifacts and composite ownership FK for attached records. This supports saved freeform tutorials/progress without fake assignment rows or another tutorials table.
4. Keep `payload.steps=[]` for a non-tutorial analysis; require 1–24 validated steps for a tutorial. Versioned payloads contain requirements, component facts, structured references, assumptions, checks, optional code, and deterministic results. Do not promote a source analysis to a tutorial by mutating the same steps/progress record.
5. Reuse conversation/message tables. Add a nullable versioned structured-result field to messages only if needed to restore code/calculation/reference rendering; store plain content as well. Do not serialize an undocumented JSON object into `content` and hope future renderers understand it.
   Use dedicated assignment/tutorial conversations for `analysis_id` links. Do not attach an unrelated general-chat thread to an analysis: the existing analysis-deletion cascade could erase unrelated conversation content.
6. Adapt `ohmi_complete_ai` to atomically save a validated result, message pair if applicable, and terminal ledger/result link. Lock request/conversation rows; preserve unique positions and replay uniqueness. Never infer result shape solely from historical `kind` when new operations differ.
7. Keep the progress RPC owner-scoped and bound to the exact immutable tutorial version. Test empty analyses, duplicates, invalid indices, cross-owner analysis IDs, and concurrent saves. Initially serialize saves per tutorial and use acknowledged state; on error restore/reload rather than falsely showing progress saved. No realtime/collaboration system.

### 6.3 Preserve data, grants, and deployment compatibility

- Inventory hosted columns, policies, grants, FKs, function bodies, triggers, migration versions, and legacy payload shapes before final SQL. Inspect metadata and synthetic/sanitized samples; do not export student documents to diagnose schemas.
- Never reset/drop tables, rewrite applied files, repair migration history, truncate ledger/cooldowns, or recreate names as if absent. Do not erase old model cooldowns to force a pass.
- Use new reviewed forward migrations. Test all seven existing migrations plus additions on an isolated disposable database. Do not run `db reset` against the linked project. If a disposable runtime is unavailable, record the gate as blocked rather than claiming replay.
- Before an authorized hosted migration: inspect migration list, then `db push --linked --dry-run --skip-vault`; review exactly the pending SQL. No unrelated Auth, bucket, extensions, or grants change.
- User-facing data uses owner RLS and explicit grants. Deny anonymous access. Requests/cooldowns and finalization remain server-write-only. Preserve `security invoker`/explicit `search_path` practices and service-only execute grants; test privileges, not merely `rowsecurity=true`.
- Review the ledger's single-column assignment/conversation FKs: service routines must enforce owner pairing. Do not blindly add cascade-changing composite FKs that would break retained accounting on deletion.
- Legacy artifacts remain viewable with a legacy/unverified label through a bounded defensive renderer. Do not validate them under the new schema and discard them on failure. No automatic reanalysis, model call, silent progress reset, or destructive backfill.
- Deleting a conversation removes its owned messages through existing relationships. Assignment deletion preserves the existing file-first ordering and linked artifact/progress cascades; do not leave readable derived content after deleting its source. Keep non-content request usage as designed. Test partial file deletion failures.
- Release new schema additively before code paths that require it. Disabling AI or rolling application code back must preserve new/old rows and keep Phase 3 Auth/uploads/manual steps usable. No destructive rollback migration.

## 7. Sequential AGY milestones

All milestones below are **proposed**. Owner approval names the allowed milestone; passing it does not authorize the next. AGY must stop and report evidence after each milestone. No parallel implementation or subagents are required.

### M0 — Confirm baseline and resolve release prerequisites

**Objective/features:** establish the unchanged Phase 3 foundation and a precise authorization/data boundary.

**Files/components:** read `AGENTS.md`, the four current handoff/stabilization reports, this plan, `wxt.config.ts`, worker/service/validation/types, seven migrations, and existing tests. Preserve AGY's read-only local memory bridge; do not access/sync the external vault.

**Database/API:** read-only metadata inventory; no migrations, provider request, or deployment.

**AGY instructions:** confirm branch/remote SHA and clean starting diff. Repeat local tests/build/browser checks. Confirm original installation path/ID. Privately obtain owner confirmation of key-rotation status, allowed audience/data, and actual free-tier account limits. Report unresolved gates without changing credentials or billing. Distinguish planning permission, synthetic evaluation permission, and real-student rollout permission.

**Focused tests/pass:** existing 25 tests, typecheck/build/browser pass; mascot hash matches; nine RLS tables/private bucket/seven migrations/no unexpected deployment; written gate checklist with no guessed values.

**Dependencies/risks/stop:** use current source if snapshot disagrees. Stop for unexpected uncommitted work, schema drift, unsafe credential exposure, changed extension identity, or unclear evaluation authorization. Original-path limitation can remain owner-accepted for local development; credential/privacy/audience gates must close before real-student rollout.

### M1 — Prove one minimal AI text request

**Objective/features:** get a real useful response before building AI architecture.

**Files/components:** one small opt-in provider probe and synthetic fixture under the test area; later reuse its verified HTTP shape in the single server provider module. Do not wire UI or restore archived provider code.

**Database/API:** no schema change, Edge deployment, history, media, or structured output. One direct server-side/local test fetch using an already approved server credential; never a browser key.

**AGY instructions:** verify nonzero free access for the exact candidate. Ask one bounded LED/resistor concept question with no schema/tools/history. Record completion, latency, usage, and answer quality. Stop after the first failing response. After initial success, run separately scheduled/authorized probes to reach three passes in two windows; keep each probe one attempt.

**Focused tests/pass:** 3/3 complete nonempty on-topic answers; no unsupported numeric claims, no hidden retry/fallback; each within 20 seconds, target text latency at most 15 seconds. Stubbed 401/403/404/429/503/timeout cases produce correct safe diagnostics. Key scan finds no secrets in tracked files/output.

**Dependencies/risks/stop:** M0 synthetic-test approval and free eligibility. Any provider failure or wrong model/access stops advancement; no media/schema debugging, model roulette, repeated deployments, or key rotation. A later text success alone does not approve file processing.

### M2 — Deliver authenticated text chat through OHMI

**Objective/features:** real signed-in chat in existing Ask OHMI; no durable learning history yet. Signed-out demonstrations stay explicitly samples.

**Files/components:** add `supabase/functions/ohmi-ai/index.ts` plus one provider helper; extend `src/backend/contracts.ts`, `validation.ts`, `service.ts`, `src/bridge.ts` only if needed, and `src/AssistantPanel.tsx`. Extend `service.test.ts`, `validation.test.ts`, browser privacy tests; add focused server tests. Keep `entrypoints/background.ts` as the existing dispatcher.

**Database/API:** first reviewed forward accounting migration from section 6.2; one authenticated POST endpoint, chat operation only. Do not create new history tables or use the old finalizer unchanged. Deploy only when specifically authorized for this milestone and security gates permit.

**AGY instructions:** enforce full request validation, JWT/user verification, quota/idempotency, deadlines, single fetch, response bounds, and account-change discard. Render escaped answer text. Keep a bounded in-memory context; no automatic history or attachment upload. Add honest loading/error/limit states with existing styling.

**Focused tests/pass:** actual extension sends text through worker and authenticated Edge to the selected provider and displays a validated answer. Missing/expired JWT, foreign sender, altered account guard, oversized body, quota collision, double submit, and malformed response are denied. A/B/sign-out with delayed replies shows no stale content. Provider fetch count is exactly one for an admitted request and zero for denied/replayed requests. Phase 1–3 regressions pass.

**Dependencies/risks/stop:** M1 passes. Stop for JWT gateway mismatch, unbounded worker requests, secret leakage, cross-account responses, or any need to bypass RLS. Keep AI disabled if accounting migration/deployment parity is uncertain.

### M3 — Qualify tutoring, languages, calculations, and Arduino help

**Objective/features:** useful electronics explanations and follow-ups, three languages, complete Arduino assistance, and independently calculated supported results.

**Files/components:** server tutor prompt/response contract, small pure calculations module, small reviewed reference registry; existing chat/code rendering and language preference path. Add synthetic electronics/code/language fixtures and focused tests. Do not split into a general agent/tool framework.

**Database/API:** no additional schema needed. Extend chat request for bounded pasted code and validated technical-result fields; client context remains bounded until M7.

**AGY instructions:** separate facts, assumptions, suggestions, and unknowns. Ask for missing board/component values. Implement section 5.3 functions and ensure displayed calculation fields come from those functions. Validate source-specific pin/timing fixtures. Do not execute generated sketches. Use the selected provider's exact supported schema only if a technical response needs it.

**Focused tests/pass:** evaluate at least 12 human-reviewed cases covering all languages, follow-up memory, LED/Ohm's-law/power calculations, missing values, and Arduino explain/generate/review. Require all critical numeric/source/pin assertions and complete-sketch requirements to pass; at least 11/12 meet the beginner clarity/relevance rubric. Review Filipino/Taglish technical equivalence manually. Compile at least two representative sketches for their stated board when the approved toolchain exists. All pure math counterexamples pass locally.

**Dependencies/risks/stop:** M2 passes. Stop for inconsistent current/unit/pin advice, omitted requested code, false source claims, or degraded language meaning. Fix one demonstrated layer using synthetic reproduction; do not relax unrelated security or accuracy validators. Unsupported calculations remain explicitly unverified.

### M4 — Understand a deliberately uploaded circuit image

**Objective/features:** analyze one owned PNG/JPEG chosen by the student; identify visible parts/connections and possible issues with uncertainty.

**Files/components:** server owned-file loader/image validation, image result contract, existing `src/PrivateAssignments.tsx`, `src/AccountPage.tsx`, and chat attachment selection. Add only an Analyze/explain action and existing-style result presentation; retain trusted upload flow. Do not activate tab capture or automate the Check section.

**Database/API:** image operation receives `assignmentId`; reuse request ledger and private bucket. No new bucket or persistent analysis schema yet.

**AGY instructions:** first prove decoder import, structural validation, and memory/CPU behavior locally and in authorized Edge tests. Then send validated image bytes through the chosen provider format. Return observations, possible issues, limitations, and clarification questions. Attach evidence locations to claims; do not invent wire endpoints hidden by overlap.

**Focused tests/pass:** server tests reject foreign assignment IDs/paths, missing objects, spoofed MIME, valid signature plus corrupt body, excessive dimensions/size, compressed bombs, deleted-during-request targets, and document prompt injection. At least four real synthetic images cover clear wiring, one visible planted mistake, ambiguous overlap, and unreadable labels. All known critical observations are correct on clear images; ambiguous cases explicitly abstain. No electrical-verification claim or unexpected provider call occurs. Generation fits the shared deadline; measured parser work fits Edge limits.

**Dependencies/risks/stop:** M3 and image-specific provider/privacy gate pass. If decoder runtime or model vision fails, stop image work; do not infer success from text support. Account-file upload/storage continues to work independently.

### M5 — Analyze PDF assignments with source evidence

**Objective/features:** read a small supported PDF, explain requirements/components/diagrams, and expose uncertainty before generating a tutorial.

**Files/components:** server PDF structure/text preparation and page-reference validation, PDF result contract, same private Assignments analysis controls. Add small synthetic PDF fixtures with known text, quantities, pins, timing, diagram labels, and source hashes. No offscreen/extension rendering system.

**Database/API:** PDF operation by owned assignment ID, existing request accounting, no new persistent artifacts yet. Native bytes go only to a model actually qualified for native PDF.

**AGY instructions:** gate PDF parser import and representative files on actual Edge limits before feature work. Download/parse/hash the original server-side, extract page-indexed text, and submit the original permitted PDF natively. Return requirements/components/deliverables/references/unknowns, not a large build tutorial. Source-check structured references and critical values. A table or scan requiring interpretation gets clarification rather than fabricated certainty.

**Focused tests/pass:** at least four real synthetic PDFs: two-page text+diagram, repeated/table component quantities, scan/visual-only ambiguity, and contradictory instructions. Confirm all explicit critical quantities/pins/timing/deliverables against ground truth; references resolve to actual pages/excerpts. Negative tests cover corrupt/encrypted/oversized/too-many-page files, prompt injection, out-of-range/fabricated references, and cross-owner IDs. Plain-text-only extraction cannot count as diagram understanding. One real extension private upload/analyze flow passes.

**Dependencies/risks/stop:** M4 plus native-PDF eligibility and generation gates. Parser/runtime incompatibility, omitted required source text, citation mismatch, or uncertain critical values stop build-ready output. No OCR service, server migration, or provider switch as an automatic workaround. Keep the unsupported file downloadable by its owner.

### M6 — Generate a source-grounded step-by-step tutorial

**Objective/features:** generate an ordered beginner guide from an owned validated assignment or explicit standalone user facts, including code/calculations when required.

**Files/components:** tutorial schema/prompt/validator, deterministic calculations/source checks, existing Guide Me content and navigation. Keep `src/AssignmentSteps.tsx` for student-written steps. Add a small generated-guide component only if keeping it inside `AssistantPanel.tsx` would duplicate or obscure distinct state.

**Database/API:** tutorial operation; no new durable history until M7. For file-backed tutorials re-read/revalidate original bytes/hash/source server-side; do not trust a client-returned analysis object as authority. A tutorial is one explicit generation, not an automatic second request after analysis.

**AGY instructions:** use a bounded schema with title, objective, source requirements, components, assumptions/questions, and 1–24 ordered steps. Each step has instruction, why, check, and structured source references when applicable; code is a separate field. Keep `needs_clarification` distinct from a ready tutorial. General explanatory steps need no fabricated assignment citation. Use student answers as labeled user-confirmed facts, not source quotations. Never silently omit components, required code, or later steps to fit limits.

**Focused tests/pass:** at least three source-grounded real tutorials and one standalone guide. Include full Arduino blink requirements, repeated component quantities, and missing/contradictory input. All source-critical constraints, arithmetic, sketch completeness, order, and references pass; ambiguous input gets clarification. Guide bounds/focus/code rendering and all languages work. Reject malformed fields with safe field-specific diagnostics and preserve provider usage even on rejection.

**Dependencies/risks/stop:** M5 and earlier technical gates pass. If complete output exceeds the measured token/deadline limit, ask to narrow the assignment; do not save/display an incomplete guide or add automatic repair calls. A passing extraction does not authorize a tutorial with unconfirmed critical diagram details.

### M7 — Save conversations, artifacts, and learning progress securely

**Objective/features:** durable owned chat/history, accepted analyses/tutorials, and exact-version progress. Restore after refresh/sign-out/sign-in without mixing accounts or replacing manual steps.

**Files/components:** second reviewed forward migration; update active `database.types.ts` deliberately; server finalization/retrieval; worker service/contracts/validation; existing Account, Assignments, chat and guide controls. Add focused RLS/RPC/isolation/integration tests. Preserve old data/rendering paths.

**Database/API:** apply section 6 design after disposable replay, old/new-row validation, and authorized dry-run/deployment. New worker actions may include conversation list/open/delete, artifact open, and progress save; all IDs independently owner-checked. Reads are paginated, for example 20 threads and 30 messages/page; model context remains separately bounded.

**AGY instructions:** record usage before output rejection, then finalize accepted result/message pair/ledger link transactionally. Replays return the stored result without a provider call. Reuse fingerprints only within the owner and exact version/input. Full source hash mismatch invalidates reuse. Save only user-acknowledged progress; report failed saves. Display legacy artifacts as legacy and preserve their progress; do not regenerate automatically. Standalone tutorials use an analysis record without a fake assignment.

**Focused tests/pass:** two disposable users complete real private upload, analysis, tutorial, follow-up, progress, refresh, sign-out, same-user sign-in, and history retrieval. A cannot list/read/write/delete B's records/files/progress or use B's IDs through Edge/RPCs. Test concurrent submit/replay, lost network response, failed finalization, assignment deletion during generation, foreign conversation linkage, legacy rows, and deletion cascades. Usage remains charged for rejected/unknown attempts. Exactly one persisted user/assistant pair per successful chat UUID; no duplicated tutorials/progress reset.

**Dependencies/risks/stop:** M6 passes; migration review, runtime deployment parity, security gate, and explicit fixture-test authorization required. If replay/legacy/isolation fails, leave AI persistence disabled; do not erase retained rows or relax grants. Guarded tests clean only their marked fixtures and leave real student data unchanged.

### M8 — Complete Phase 4 acceptance and handoff

**Objective/features:** prove the complete approved workflow and freeze a reviewable Phase 4 result.

**Files/components:** focused tests, verification report, setup/operational notes, current architecture/context/handoff documentation, and `.env.example` containing names/placeholders only. Document exact provider/contract versions and supported media limits. No additional feature work.

**Database/API:** read-only before/after integrity/security checks; no unplanned migration or account-setting change. Verify deployed code/migration/model/config versions match the tested candidate. Keep a server-side disable switch and documented safe rollback to Phase 3 behavior.

**AGY instructions:** run the acceptance checklist below. Validate real regular-profile Google and Tinkercad behavior, not only fixtures. Verify user-visible copy distinguishes sample/live, uncertain/validated, and saved/unsaved states. Record limitations honestly. Submit the milestone report and wait for owner phase review.

**Focused tests/pass:** all section 9 criteria pass with current evidence, no safety/privacy/data loss regression, and no unexplained provider-output failures in the agreed acceptance set. No paid usage. Source/build key scan clean. Two-user fixtures cleaned; retained student rows and migration history preserved.

**Dependencies/risks/stop:** M0–M7 accepted. Missing privacy/provider reliability/manual/security evidence means Phase 4 remains incomplete. On verified user-approved phase completion, follow repository instructions to commit/push all source/assets/tests/config/docs to the existing GitHub remote and confirm remote SHA; preserve main/history and never start Phase 5 automatically. This planning-only document is not phase completion and does not trigger that push.

## 8. Error handling, diagnostics, and test discipline

### 8.1 Failure policy

| Condition | Required behavior |
| --- | --- |
| Missing/invalid JWT | 401; no provider call; request sign-in. Refresh expired session through existing worker once if appropriate, before admission, not as a repeated generation. |
| Unowned/missing target | Safe 404-style unavailable response without confirming another user's object; no provider call. |
| Invalid request/file | 400/413/415 as applicable; precise supported limits; no provider call. |
| UUID reuse with different input | 409; preserve original record; never attach it to another owner. |
| Local quota or provider 429 | Stable rate-limit code and bounded retry time; persist provider cooldown; no automatic retry. Distinguish minute exhaustion from daily quota where evidence permits. |
| Provider 400/401/403/404 | Configuration/request/access fault; fail closed, safe user message, metadata for maintainer. Do not rotate keys, change models, or retry automatically. |
| Provider 503/other 5xx | Unavailable; one attempted call retained; user can try later after cooldown. Availability failure is not a schema-validation failure. |
| Timeout/disconnect | Unknown provider outcome, conservative usage reservation, terminal request failure after lease. No automatic resend. |
| Safety refusal or incomplete/truncated output | Refusal/incomplete result; never parse/save partial tutorial as successful. Do not silently repair or continue in another call. |
| JSON/schema/reference/technical failure | Reject result, preserve usage, return bounded code; log exact controlled field/reason metadata. Do not loosen validators or show unsafe output as a successful answer. |
| Save failure after generation | Report unsaved result/failure truthfully, keep accounting and terminal/recoverable request state. Retry finalization only from an already validated retained result; never regenerate implicitly. |
| Account change | Cancel/discard local work, original-owner server scope retained, no new-account content delivery. |

Default generation retry count is zero in both UI logic and server/SDK configuration. A manual retry after an eligible failure is a new request UUID and consumes the same quotas. After a completed-but-disconnected M7 request, query the original result first. No background polling, retry storm, or provider fallback.

Suggested initial cooldown: 60 seconds for unavailable responses; respect a longer valid provider retry/reset indication within a bounded server policy. No sleeping inside the Edge request. Do not classify every 429 as daily exhaustion or delete historical backoffs to force new calls. [Gemini error documentation](https://ai.google.dev/gemini-api/docs/troubleshooting).

### 8.2 Privacy-safe observability

Log only request ID, operation, provider/model, duration, provider HTTP/completion category, usage/reservation, contract version, stable error code, and controlled validation metadata. Metadata may contain an allowlisted field path, reason, expected type/limit, and actual type/length. Never log values, arbitrary JSON keys, bearer tokens, signed URLs, prompts, code, original filenames, PDF excerpts, or full generated/rejected output.

Protect logs/usage visibility to the right owner/maintainer; do not expose global request history to students. Hashes are pseudonymous identifiers, not proof of anonymization. Use synthetic fixtures to retain complete failure payloads safely when needed; real student failures receive metadata-only diagnosis unless separately authorized under an appropriate data-handling process.

### 8.3 Focused test layers

1. Pure tests: schemas, math/units, source references, byte/file bounds, tutorial invariants, safe diagnostics, and redacted errors. Include counterexamples rather than only mirroring implementation.
2. Stubbed provider tests: exact request format, one fetch, completion checks, malformed JSON, oversized output, refusal, truncation, latency, 429/503, and rejected-output accounting. These prove control flow, not model quality.
3. Database tests: all existing migrations plus proposed forward slices, owner RLS/grants, atomic reservations/finalization, legacy preservation, progress bounds, and deletion behavior. Use an isolated disposable database first.
4. Opt-in real-provider evaluation: synthetic inputs, request caps agreed in advance, one call at a time, no automatic retries. Reuse accepted generation artifacts for human rubric review instead of repeating samples through quota. Initial planning ceiling: 40 generation calls across implementation gates and acceptance, spread across quota windows and subject to lower actual quotas. Budget each milestone before running; stop at the first provider/contract/security failure and report before another live run. This ceiling is not permission to make calls during planning.
5. Real extension/hosted integration: exact provider/version under test, trusted upload, worker transport, owned file reads, result display, follow-up, saved progress, and reload. Guarded disposable fixtures only. A mock or older model's result cannot substitute.

After a failure, identify the failing layer, reproduce it with a synthetic/stubbed case, make the smallest relevant change, and rerun focused checks. No repeated deploy-and-guess loop. Rerun existing unit/type/build/browser suites at integration milestones; rerun broader live suites only for changed boundaries or final acceptance.

## 9. Phase 4 completion criteria

All of these must be true; passing only chat does not complete Phase 4.

- [ ] Owner approved the executed scope/milestones, audience, provider data handling, free-tier constraints, and supported input subset.
- [ ] One selected provider/model passed real text, image, native-PDF or explicitly reviewed replacement-PDF, schema, technical accuracy, and latency gates. No assumption based on catalog metadata or historical success.
- [ ] Current real extension workflow handles a question and context-aware follow-up, one image, a text+diagram PDF, a source-grounded tutorial with complete required Arduino code, and an ambiguity/clarification case.
- [ ] Known critical source quantities, pin/timing constraints, reference locations, and deterministic numeric/unit assertions all pass. No claimed electrical verification or invented source facts.
- [ ] English, Filipino, and Taglish preserve technical meaning, numbers, units, code identifiers, and beginner clarity.
- [ ] Conversations, analyses, standalone/assignment tutorials, and exact-version progress restore correctly after refresh and reauthentication. Student-written steps and legacy artifacts remain intact.
- [ ] Missing/expired JWT, anonymous use, cross-account IDs/files/RPCs, forged paths, malformed files, prompt injection, and stale async responses cannot leak data or authorize a provider call.
- [ ] Actual file bytes/structure and ownership are checked server-side. No API key/token reaches content scripts, page DOM, URLs, tracked source, or build output.
- [ ] Global and per-user quota/idempotency/cooldown behavior works across concurrent requests; rejected/unknown usage remains accounted. There are no automatic retries, paid fallbacks, or hidden repeated generations.
- [ ] Migrations replay on a disposable database, preserve seven-file history/old rows, pass authorized hosted dry-run, and match the deployed contracts. RLS/grants/private bucket settings remain correct.
- [ ] Existing 25 baseline tests plus new focused tests, typecheck/build, simulated browser regressions, actual hosted two-user isolation, and current real-browser Google/Tinkercad acceptance pass.
- [ ] Privileged-key verification is resolved for real-student rollout; original identity/callback/path constraints remain respected; email gating remains honest.
- [ ] No charges or paid-service activation; current provider and Supabase allowances fit the agreed pilot size. Free quota exhaustion and service downtime have tested user-facing behavior. No SLA is implied.
- [ ] Verification report records exact commit/model/deployment/migration/fixture versions, actual checks, remaining supported limitations, fixture cleanup, and before/after data integrity.
- [ ] Phase-completion commit/push and remote SHA confirmation follow owner review/repository rules. Phase 5 remains unstarted.

Do not mark full completion while a required capability is blocked by privacy, unavailable generation, parser incompatibility, weak output, or missing persistence. Present a narrower milestone as partial progress and return the decision to the owner.

## 10. AGY execution contract

For each separately approved milestone:

1. State the milestone, starting commit, affected callers/contracts/tests/config, and stopping condition. Recheck current source; notes may be stale.
2. Implement only that slice using current architecture. Keep credentials, ignored local files, and unrelated changes out of the diff.
3. Run focused tests and the milestone's real-behavior gate. Stop on a live-provider/security/contract failure; return evidence before another live attempt.
4. Report objective met/not met, exact changed files, database/API changes, verification evidence, usage/cost, preserved behavior/data, limitations, and next decision. Distinguish proposed from deployed and mocked from real.
5. Wait for owner review before the next milestone. Do not rotate credentials, buy capacity, widen scope, begin Phase 5, or access/sync the external second brain. Preserve `.agents/rules/ohmi-local-second-brain.md` and its read-only snapshot boundary.

**First implementation authorization to request after this plan is reviewed: M0, followed separately by M1 synthetic text evaluation. Nothing in this planning session has started those milestones.**
