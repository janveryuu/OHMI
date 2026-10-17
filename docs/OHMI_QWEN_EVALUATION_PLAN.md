# OHMI Qwen evaluation and optional integration plan

**Status:** Planning only; owner approval required before AGY implements any milestone. No provider requests, paid services, deployments, credential changes or database changes are authorized by this document.

**Reviewed:** 18 October 2026. Source `6ca7133`, branch `codex/phase-5-m1-wip`. Concurrent AssistantPanel/browser-test edits are external work; preserve and reconcile them. Read [the six-improvement plan](OHMI_ASSIGNMENTS_CHAT_IMPROVEMENT_PLAN.md), [project context](PROJECT_CONTEXT.md) and [Phase 5 report](PHASE_5_VERIFICATION_REPORT.md). The context document's M1 summary is stale. No Graphify graph exists; findings below were checked in source.

**Recommendation:** Qualify `qwen3.8-flash` first. Use `qwen3.8-max` only as an explicitly selected comparison. Keep Gemini operational and unchanged until a separate production decision. Neither Qwen model has passed an OHMI generation test. Model names, prices and documented capabilities are verified; account access, remaining quota, student eligibility and accuracy are not.

## 1. Verified facts and release gates

| Area | Finding and implication |
|---|---|
| Availability | Alibaba documents both exact IDs in Singapore/International pricing and its vision/PDF/structured-output documentation. This is public availability, not proof of authorization in the owner's workspace. Do not substitute Qwen3-VL, Omni, another region or a snapshot without review. |
| Endpoint | Prefer `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`. Obtain the actual Singapore workspace endpoint from its console. Singapore also has a legacy DashScope endpoint; do not mix keys/endpoints or silently change regions. |
| Residency | Singapore access/storage does **not** guarantee Singapore-only inference: the documented International deployment scope includes nodes outside mainland China. Confirm the required residency/transfer arrangement before sending personal data. [Region documentation](https://www.alibabacloud.com/help/en/model-studio/singapore-regional-access-information). |
| Data use | Model Studio product terms §4.48 say member content is processed on the customer's behalf and is not used to improve its models without separate consent. Customer remains responsible for permissions and lawful transfers. Disable optional logging-to-training/data-delivery features; do not assume consumer Qwen chat terms apply. [Product terms](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0). |
| Retention | Standard inference prompts/responses may be retained up to 30 days, with legal/security exceptions. Stateful files/conversations persist until deleted. Enterprise ZDR is optional and not established for this account. Use inline synthetic inputs rather than provider file stores. [Retention policy](https://www.alibabacloud.com/help/en/model-studio/data-retention-policy). |
| Student audience | **Unresolved.** Alibaba's international privacy policy says it does not knowingly collect personal data of under-18s. This is not enough to establish permission for OHMI's downstream student use. Confirm intended age range, applicable API/customer-data terms, school/guardian requirements and provider clarification where needed before a student pilot. Do not infer “minors allowed” from absence of a model-specific age clause. [Privacy policy](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy), [membership agreement](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-membership-agreement). Synthetic evaluation by an eligible adult operator is a separate gate from student deployment. |
| Free quota | Pricing lists one million tokens per candidate in Singapore, subject to eligibility and a 90-day validity rule. Confirm each exact model's live balance/expiry and general-purpose key authorization. Coding/Token Plan keys are not assumed to use these quotas. |
| Billing protection | Enable **Free Quota Only** separately for both candidates before any evaluation. It is off by default, takes time to apply, and can return `AllocationQuota.FreeTierOnly` when exhausted. Confirm effective status after the documented delay. If unavailable/expired, stop; do not top up or enable pay-as-you-go. Alerts and OHMI's token limits alone are not a no-charge guarantee. [Quota controls](https://www.alibabacloud.com/help/en/model-studio/new-free-quota). |
| Credential incident | A credential was pasted into the chat. Treat it as exposed; owner must revoke it and create a restricted replacement before evaluation. This planner did not use, validate, copy, save or rotate it. Store replacements through a secret manager, never in documents, commits, screenshots or extension configuration. |

Technical capability references: [vision](https://www.alibabacloud.com/help/en/model-studio/vision-model), [PDF understanding](https://www.alibabacloud.com/help/en/model-studio/pdf-understanding), [structured output](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output), [endpoint overview](https://www.alibabacloud.com/help/en/model-studio/what-is-model-studio). Recheck these dated documents at implementation; do not assume all OpenAI-compatible features work identically.

## 2. Current OHMI architecture and integration seams

- Extension sends validated `ai.chat` V1 or trusted-review-only `ai.circuit` V2 messages to the worker. Worker owns Supabase identity and calls `ohmi-ai`; credentials remain server-side. Retain sender validation, authoritative account checks, Google PKCE, RLS/private storage and deliberate screenshot preview/send.
- Local `supabase/functions/ohmi-ai/index.ts` delegates to `handler.ts`. Handler currently requires `GEMINI_API_KEY`, hard-codes `gemini-3.5-flash-lite` and calls Google's `generateContent` in two places. Qwen is a transport adaptation, not a model-name replacement in that URL. `src/ai/gemini.ts` is not the production handler transport.
- Fresh read-only hosted inspection: `ohmi-ai` remains ACTIVE **version 13**, with the same Gemini model and an older V1 bundle lacking the local Phase 5 dispatcher. Compare providers against the same frozen local application contract/prompt; do not mistake deployment drift for a model failure. Reconciliation is already a separate approved-release gate in the six-improvement plan. No deployment here.
- Local controls include `OHMI_AI_ENABLED`, server identity/ownership, reserve/complete/fail RPCs, model cooldown, zero automatic retries, 24-second provider timeout and 64 KiB response cap. Latest migration source has one request in flight per user, 6/minute, 10/user/day and 40/project/day. Preserve them; a benchmark cannot bypass production admission or expand these limits.
- Images remain PNG/JPEG with signature checks, 4 MiB, 4,096px side and 4 MP limits; V2 total request body is 6 MiB. Assignment upload's 10 MiB limit is not its AI analysis limit. PDFs remain 2 MiB, six pages, 24,000 extracted characters, with encryption/corruption checks and citation verification.
- PDF analysis already downloads an owned original server-side, extracts page text and also sends original PDF bytes to Gemini. Qwen needs the documented Chat Completions `file` content part with `file_data: data:application/pdf;base64,...` and a sanitized generic filename. Never expose a private signed URL to the model or copy Gemini's `inlineData` shape into Qwen requests. **Do not use the Responses API for PDFs:** its current docs warn it may return HTTP 200 without passing the PDF to the model.
- Existing tutorial/circuit validators, deterministic electronics helpers, Arduino board registry/static checks, progress and owner-scoped history are reusable. Recent source includes MessageContent Markdown/math rendering and conversation paging. Reuse current work rather than rebuilding the earlier plan; implementation quality has not been reverified by this planner.
- **Persistence blocker:** `20261016170000_ohmi_phase5_circuit_check_artifacts.sql` hard-codes analysis `provider = 'gemini'`. Do not save Qwen results under that label. The schema already has model/provider metadata, but a narrowly reviewed routine migration is needed before durable Qwen writes. Evaluation can stay local without any migration.

## 3. Costs and required configuration

Standard Singapore prices, USD per million billed tokens, checked 18 October 2026:

| Model | Input | Output | Example: 2,000 input + 1,000 output |
|---|---:|---:|---:|
| `qwen3.8-flash` | $0.15 | $0.47 | $0.00077 |
| `qwen3.8-max` | $2.00 | $6.00 | $0.01000 |
| Current `gemini-3.5-flash-lite` | $0.30 | $2.50 | $0.00310 |

Sources: [Singapore Qwen pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). These are estimates, not spending authorization. Include image/PDF and any reasoning tokens, not only visible text. Do not use cheaper Global/China prices for the Singapore/International configuration. No cache, batch, search, OCR service, storage, taxes or other charges are included.

Proposed future configuration, **not created now**:

| Setting | Scope / rule |
|---|---|
| `QWEN_API_KEY` | Replacement general-purpose Singapore sub-workspace secret, restricted to approved models/access where supported. Evaluation process environment initially; Supabase secrets only after release approval. Never `WXT_*`, browser storage or client bundle. |
| `QWEN_BASE_URL` | Exact console-confirmed HTTPS Singapore workspace URL ending `/compatible-mode/v1`. Server allowlist validates host/path; client cannot override it. No redirects to an arbitrary host or request-supplied base URL. |
| `QWEN_MODEL` | Explicit allowlist of the two candidate IDs. Evaluation selects each deliberately. Production selection remains unset until a reviewed decision. Record actual returned model/version and date; an alias can change. |
| Existing Gemini config | Preserve key, model, production behavior and history. Never delete or rotate Gemini credentials incidentally. |
| Optional future `OHMI_AI_PROVIDER` | Server-only manual selection, default `gemini`. A Qwen error returns an error, not automatic Gemini/Max fallback. Require only the selected provider's secret; do not break Gemini when Qwen config is absent. |
| `OHMI_AI_ENABLED` | Preserve server kill switch. Evaluation/production enablement are separate owner decisions. No browser-accessible provider selector or secret-bearing endpoint. |

**Evaluation spend target: $0 charged.** Public free-quota listings are insufficient: owner must confirm effective free-only protections for Qwen and a zero-charge eligible Gemini route before any future generation. Otherwise stop or mark that comparator unavailable; no paid baseline is implicitly allowed. Existing Gemini unpaid-data/audience terms still apply. [Gemini API terms](https://ai.google.dev/gemini-api/terms).

## 4. Milestone Q0 — Owner readiness checkpoint

- [ ] Reconcile current HEAD/diff and the six-improvement plan. Keep landing page, mascot, extension permissions and unrelated work untouched.
- [ ] Owner revokes the exposed credential and provisions a restricted replacement through the secret manager. Record only confirmation, never key fragments or values.
- [ ] Record Singapore workspace/model authorization, free balances/expiry, effective Free Quota Only status, approved adult evaluation operator, data-use/retention settings and no paid ancillary tools. No API call just to “check the key” until this passes.
- [ ] Resolve any applicable evaluation terms. Separately record student-audience/residency questions for written provider/owner review before a student pilot; do not claim eligibility based on marketing pages.

**Exit:** Sanitized readiness checklist reviewed by owner. Missing or uncertain billing protection blocks all live evaluation. No production configuration is touched.

## 5. Milestone Q1 — Offline fixtures and small transport seam

After implementation approval, create synthetic fixtures and mocked tests first. Freeze prompts, schemas, image/PDF hashes, question language and expected facts. Adapt the **actual** handler path through one small internal transport function returning visible text, actual model, usage and normalized finish/error status. Preserve Gemini's request semantics and add `qwen.ts` beside it; no SDK is needed beyond existing `fetch`, no provider registry/framework or automatic fallback.

Qwen transport requirements:

- [ ] Use Chat Completions for text/image/PDF parity. Map roles, image base64 data URLs and native PDF file parts correctly. Use non-streaming, explicit `max_tokens` matching OHMI's operation cap and `enable_thinking: false` initially; thinking is otherwise a different latency/token experiment. Verify parameter compatibility for each exact model.
- [ ] Use `response_format` with the existing circuit/tutorial JSON Schema where supported; run current application validators anyway. Provider JSON promises do not establish circuit truth. If the exact schema is unsupported, record failure; a deliberate JSON-object variant may be benchmarked separately with the same strict validators, never silently retried.
- [ ] Map `choices[].message.content`, finish reason and `usage.prompt_tokens/completion_tokens` to existing accounting. Exclude `reasoning_content` from the student answer; do not subtract thinking tokens twice or ignore them if reported. Reject truncated/empty/invalid/safety-blocked results. Conservatively account missing usage using existing rules and flag measurement unknown, never zero.
- [ ] Bound request/response reads, timeout and cancellation; send once. Normalize auth, quota, `AllocationQuota.FreeTierOnly`, 429, timeout and provider errors without leaking keys, authorization headers or signed URLs. No SDK auto-retry, tool/search invocation, file-store creation or region fallback.
- [ ] Include provider, model and canonical input/prompt identity in future request hashes/replay checks. Reusing a UUID must return its original authorized result or conflict, not compare two models or create a second charge. Keep existing owner checks and atomic persistence.

**Files:** `supabase/functions/ohmi-ai/handler.ts`, new small `qwen.ts`/tests and a Gemini transport extraction only if needed; existing `circuit.ts`, `tutorial.ts`, `pdf.ts` validators; `tests/fixtures/qwen/` and an opt-in local evaluation runner. Inspect both handler call sites and V1/V2 replay/error/accounting paths. Default tests use mocks and must have no network generation. No credential file, migration or browser UI change at Q1.

**Exit:** Mocked text/image/PDF, schema, timeout, usage, invalid input, secret-redaction and Gemini-regression tests pass. Confirm the PDF content part reaches the mocked provider; an HTTP success alone is insufficient.

## 6. Milestone Q2 — Controlled free-only evaluation

This requires a **separate explicit approval** for generation, even after Q1 is implemented. Use an isolated local runner with synthetic inputs and an eligible adult operator; no public endpoint or student traffic. Reuse transports, validators and limits; mirror 6/minute, 10/operator/day and 40/project/day admission in a persistent sanitized evaluation ledger, including after restart. Run one process. With one operator, 78 calls require at least eight days; begin with the six-call smoke stage. Do not create extra accounts, alter production quotas or bypass limits to finish sooner. Any faster evaluation-specific budget requires a separate owner decision. If using the hosted handler, its real admission remains authoritative and no student data is involved.

### Dataset and call budget

Use 12 fixtures total, four primarily in each language: English, Filipino and Taglish. Include:

1. Resistor explanation with a request for a shorter follow-up.
2. Known-input LED calculation, checked against deterministic helpers.
3. Missing voltage/current/value requiring clarification.
4. Uno sketch with a missing pin mode and code/pin inconsistency.
5. Confirmed LED breadboard screenshot with labeled ground truth.
6. Ambiguous rail/crossing/tiny pin screenshot requiring uncertainty.
7. Text PDF assignment with page-numbered requirements.
8. Scanned/diagram PDF with a fact present only in its image, not prompt text.
9. Conflicting assignment and screenshot evidence.
10. Beginner guide using confirmed board/components and explicit checkpoints.
11. Structured educational diagram request with known net connections.
12. Downloadable study notes/minimal Arduino code with safe formatting.

Keep prior follow-up turns fixed in the fixture so one measured generation tests context use; a separate live multi-turn workflow can follow later. Test uncertainty, prompt injection inside a document and multilingual terminology across these fixtures.

- Stage A: two smoke fixtures per model (one PDF-image sentinel, one structured circuit result): **six calls** across Gemini, Flash and Max. Stop a model lane after failure; no repair calls.
- Stage B: 12 fixtures × three models × two repetitions: **72 calls**. Total **78 maximum**, concurrency one, no retries or extra judge-model calls. Existing per-operation output caps remain 1,536 chat, 2,048 tutorial and 3,072 circuit; artifacts use the reviewed comparable cap, never the model's advertised maximum.
- Aim for ≤8,000 billed input tokens per request and cap output at ≤3,072. Bound fixtures before sending; image/PDF tokenization is provider-dependent. Stop the lane if actual usage exceeds its planned budget. Do not claim the input estimate is an exact pre-billing token cap.
- At 26 calls/model, the illustrative 2,000-input/1,000-output profile costs about **$0.36 total** at list rates. At 8,000 input/3,072 output it is about **$1.23 total**. These are reference costs only; **zero paid charges are authorized**. Confirm adequate free balance with safety margin; if exhausted/expired or controls cannot be proven, stop rather than spend these amounts.

### Scoring and decision

Blind-review sanitized outputs against ground truth, not vendor leaderboards. Report separately by task and language: factual correctness, unsupported claims, calculation/units, readable pin/wiring evidence, PDF page/diagram facts, valid structured output, beginner action/why/check quality, follow-up consistency, latency, actual input/output/total tokens and reference cost. Record model alias/version, settings and hashes. Evaluate identical source evidence and constraints; provider-native serialization can differ. A 12-fixture sample is preliminary evidence, not a general accuracy claim.

**Pass thresholds:** zero unsafe invented connections/ratings or claims of electrical verification/compilation; all missing/ambiguous facts acknowledged; all known calculation results correct; all supported schema/security fixtures pass without retries; ≥90% technical correctness overall and ≥4/5 usefulness/naturalness per language; observed p95 provider response ≤20 seconds and none exceeds the existing 24-second deadline. Small-sample p95 is descriptive, not a production SLA. A safety/privacy failure blocks that candidate regardless of averages.

**Choice rule:** Prefer Flash if it passes and stays within five percentage points of Max's technical score with no worse critical misses. Max is only an advanced candidate if repeatable quality gains justify roughly 13× its token cost under these prices. A borderline result gets a separately approved follow-up test, not an automatic switch. Gemini remains unchanged if neither candidate qualifies. If a free Gemini baseline is unavailable, report the comparison incomplete; mocked/historical outputs cannot replace a fresh apples-to-apples comparison.

**Output:** `docs/OHMI_QWEN_EVALUATION_RESULTS.md` with scores, sample size, failures, real usage, effective free-only proof and a go/no-go recommendation. This file must not claim results before evaluation occurs.

## 7. Milestone Q3 — Safe diagrams and downloadable materials prototype

After core qualification, evaluate these as offline artifacts first; they are new capability scope, not an assumed native SVG-generation API.

- [ ] Ask for a bounded **diagram JSON** describing known components, labeled terminals and edges. Validate IDs, component allowlist, endpoint references, limits and evidence/proposed-design labels. Model text must not be injected as raw SVG into OHMI.
- [ ] Generate SVG locally from validated data with trusted templates and escaped labels. Allow only static shapes/text and bounded coordinates; forbid scripts, event handlers, foreignObject, external href/images/styles, DTD/entities and arbitrary model attributes. Test malicious labels and edge IDs. No automatic electrical-layout invention or implied netlist extraction from an unreadable screenshot.
- [ ] Compare topology with fixture ground truth and verify visual readability. Label output as an educational schematic/proposed design, never a certified circuit or a verified reproduction of unseen wiring. Human review remains necessary for technical correctness.
- [ ] Generate downloadable `.svg`, `.md`/`.txt` notes and `.ino` code from the same validated content. Use explicit user action and safe filenames/MIME types; local Blob URLs are revoked after use. Never auto-run code, embed credentials or add the Chrome downloads permission merely to download a local file. Use existing trusted review/Account page conventions if a future UI is approved.
- [ ] Keep the existing strict V2 circuit schema unchanged. Diagram/export contracts and any future artifact persistence are a separate reviewed operation/extension, not arbitrary extra keys in `CircuitCheckResult`. No PDF-generation, ZIP or graphics package is needed initially; PDF input understanding remains in Q2.

**Exit:** Offline artifacts pass topology, escaping, malicious-input, accessibility and download tests. No new public UI, storage schema or production feature is authorized by this prototype milestone alone.

## 8. Milestone Q4 — Optional production proposal, not automatic rollout

Only after owner accepts results and student/data eligibility is resolved:

1. Present exact provider/model, region/endpoint, required secrets, prompt/schema version, free-only availability behavior and rollback steps. Preserve Gemini as a manually configured option; do not deploy dual calls, per-question routing or automatic Max/Gemini fallback.
2. Plan a minimal migration for accurate provider metadata in `ohmi_complete_ai`, retaining existing Gemini rows, owner checks, function grants, transaction/replay semantics and usage accounting. Validate trusted provider/model mapping server-side; never accept a client-supplied provider label as authoritative. Review any new export operation/schema separately. Do not rewrite existing history.
3. Recheck hosted migration/function parity and reconcile the stale V13 bundle through the existing release process. Run actual handler/Gemini/Qwen mock tests, full unit/typecheck/build and browser/Phase 5 suites. Verify missing Qwen config does not affect Gemini; errors or free-quota exhaustion do not switch providers.
4. Seek separate approval for the migration, secret provisioning, deployment and a bounded synthetic smoke test. Retain the kill switch until all gates pass. A production outage after free quota is exhausted is preferable to an unauthorized paid call; show a truthful unavailable state.
5. Roll back using manual server selection and the reviewed compatible bundle, preserving all data/security gates. Never restore an older insecure function merely because it was the last deployed version. Landing page, OAuth, mascot and unrelated phase work remain untouched.

**Remaining unknowns:** replacement credential status; actual workspace access, quota/expiry and effective billing protections; applicable student-audience permissions and transfers; generation quality/latency/token usage; full hosted schema parity. Public docs and source inspection cannot resolve these account/runtime facts. This task used no supplied key, made no generation request, read no student records, and performed no implementation, deployment, migration or credential mutation.
