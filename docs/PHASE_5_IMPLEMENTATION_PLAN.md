# OHMI Phase 5 — AI Circuit Checker & Interactive Tinkercad Assistance Implementation Plan

> **Status: PROPOSED — PLANNING ONLY.** Prepared for owner review on 16 October 2026 (Asia/Manila). AGY (Antigravity) is the implementation worker. No Phase 5 implementation, provider evaluation, migration, or deployment is authorized by this document. After approval, execute the approved milestone task by task; use `superpowers:executing-plans` where available. Checkboxes track future work, not work completed during planning.

**Goal:** Help students inspect deliberately supplied circuit evidence, review Arduino source, compare an actual build with stated assignment requirements, and work through corrections without overstating what OHMI can verify.

**Architecture:** Keep the existing WXT/React extension, worker-owned authentication, Supabase Edge Function, quota ledger, and private history. Add toolbar-initiated local screenshot capture, an extension-owned review page, and a bounded structured circuit-check operation. Combine images with explicitly supplied code, assignment requirements, and simulation observations; never extract private Tinkercad state or control its editor.

**Tech stack:** Existing TypeScript, React, WXT/MV3, browser Canvas/image APIs, Supabase Auth/Postgres/Edge Functions, and the existing Gemini route subject to eligibility and quality gates. No new runtime dependency, paid service, OCR service, vector database, hosted simulator, or agent framework is required.

**Specification and authority:** This request approves planning and research only. Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/PHASE_4_IMPLEMENTATION_PLAN.md`, `docs/OHMI_MASCOT.md`, and `docs/DESIGN_REFERENCES.md`. This document supplies the proposed Phase 5 design and execution plan together. Its current-source audit supersedes stale status prose for planning purposes; it does not silently rewrite previous phase acceptance.

## 1. Global constraints

- Preserve all existing account, OAuth, private-upload, assignment, manual-step, chat, tutorial, language, mascot, placement, theme, accessibility, and website behavior. Repair defects with focused regression tests; do not restore an older rollback over current work.
- Work only on the owner-approved milestone. Review Phase 4 closure before starting dependent Phase 5 implementation. Review Phase 5 completion before any Phase 6 work.
- Preserve the original registered build path, extension ID `ikemolangalcofljjajakagdnfdpnakh`, and OAuth callback. Do not invent a manifest key or change identity settings.
- Use the exact approved pixel-art PNGs. Preserve the current compact teal design; this phase is a functional extension, not a redesign.
- OHMI is independent of Autodesk. Use documented browser capabilities and explicit user action. Never claim electrical verification, successful compilation, successful simulation, or assignment completion from an image/model answer alone.
- Keep provider/service credentials server-side. Keep Supabase sessions in trusted extension contexts. `accountId` is a stale-view guard, never authorization.
- No provider calls on capture, preview, crop, discard, navigation, guide advancement, invalid requests, unauthorized requests, or quota denial. One admitted analysis means at most one generation attempt.
- No automatic retries, model fallback, background screenshots, automatic code entry, rewiring, simulation control, grading, or hidden telemetry.
- Keep migration history and student data. Use reviewed additive forward migrations; never reset the linked database or erase accounting to regain quota.
- A free-tier quota is neither a privacy guarantee nor proof of a zero-cost account configuration. Do not enable billing or switch provider without a separately reviewed owner decision.
- AGY must obey `.agents/rules/ohmi-local-second-brain.md`: use its read-only local snapshot when present, otherwise source-only work. Do not access or sync the external second brain or force-add its snapshot to Git.

## 2. Current project audit and Phase 4 dependencies

### 2.1 Evidence and confidence

Audited checkout: `codex/stabilize-phases-1-3`, HEAD `593d04c5f24113809214e7ddf8a7ca8d03769d6a`. Phase 4 source arrived in `7f8d5ed`; later commits add the independent website and deployment configuration. Initial working tree was clean. There is no repository-root `graphify-out/graph.json`; source inspection was used without rebuilding a graph.

| Area | Evidence reviewed | Planning conclusion |
| --- | --- | --- |
| Phases 1–2 | `entrypoints/ohmi.content.tsx`, `src/OhmiApp.tsx`, placement/preferences modules, CSS, Phase 1/2 verification docs and browser runner | Shadow DOM overlay, editor URL gating, draggable mascot, six sections, responsive placement, reduced motion and local preferences exist. |
| Phase 3 | `src/backend/{client,validation,service,contracts,database.types}.ts`, account/private assignment/manual-step components, original migration and stabilization reports | Worker owns Auth/private CRUD; trusted Account page owns credential entry/upload. Existing private bucket supports 10 MiB uploads. |
| Phase 4 | `src/ai/*`, `supabase/functions/ohmi-ai/*`, four newer migrations, milestone evaluation scripts, `docs/PHASE_4_VERIFICATION_REPORT.md` | Authenticated Gemini text/image/PDF/tutorial code, accounting and persistence primitives exist. The completion report is historical evidence, not sufficient proof of complete current behavior. |
| Website | `website/`, latest Git history | Independent static website. No Phase 5 website redesign or deployment changes needed. |
| Fresh local checks | `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser` | Passed: 77 tests across 11 files, typecheck, production build, simulated-browser foundation/privacy checks. Build retains version 0.3.0 and current identity warning. |
| Not freshly verified | Hosted schema/routine parity, deployed function revision, billing/free-tier settings, provider availability, actual AI answers, real Tinkercad, regular-profile Google consent, credential revocation | Unknown in this planning session. Do not present them as freshly passed. No hosted writes or provider requests were made. |

`README.md`, the status banner in `docs/PROJECT_CONTEXT.md`, older handoff/stabilization reports, and several memory notes still describe Phase 3/rolled-back AI. Conversely, the Phase 4 report says all gates passed. Both must be reconciled against current source and reproducible evidence in M0. Preserve their historical records; add dated current status rather than deleting history.

### 2.2 Architecture to reuse

```text
Tinkercad top-frame isolated content script
  -> typed runtime message -> background sender validation
  -> worker-owned verified account / Supabase client
  -> authenticated ohmi-ai Edge Function
  -> owned-source checks + atomic request reservation
  -> one Gemini generation -> validate -> atomic result/history/accounting
  -> typed response -> safe React rendering

Trusted account.html: credentials and private file upload
Supabase: profiles, assignments, manual steps, analyses, conversations,
          messages, tutorial progress, AI requests, provider backoffs
```

The handler currently calls Gemini directly. The tested `src/ai/gemini.ts::callGemini` is not the production handler's transport. Likewise, `src/ai` and Edge helper copies differ. Local helper tests therefore do not prove production transport or every server validator behaves correctly. Add tests around the actual Edge handler rather than introducing a third implementation.

### 2.3 Unfinished or insufficiently proved Phase 4 work

These are source-supported dependencies, not allegations about every hosted execution. AGY must reproduce the relevant failure offline first and then repair the responsible path.

| ID / priority | Finding in current source | Required closure / affected Phase 5 work |
| --- | --- | --- |
| P4-1 / blocking | `AssistantPanel.tsx` sends signed-in text and saved-image/PDF requests, but labels them as demos. Guide remains sample/manual steps. It never calls conversation/history/progress actions or requests generated tutorials. | Finish usable Phase 4 chat/history/tutorial/resume controls and truthful loading/capability copy; preserve explicitly labeled samples. API-only harnesses cannot prove these UI flows. |
| P4-2 / blocking | Worker has conversation list/open/delete, but no conversation-create action. UI sends no `conversationId`; plain chat has no durable conversation target. | Add owned creation/selection, pass the real ID, restore messages and structured results after refresh, and prove account-switch isolation. |
| P4-3 / blocking | Edge awaits `ohmi_complete_ai` without checking its error/result. Replay returns “This request was previously completed,” not the original result. Completion output omits some accepted tutorial fields, and SQL reconstructs reduced payloads for non-tutorial analyses. Input-fingerprint uniqueness can also reuse an earlier artifact after a deliberate new generation. | Check completion failures, persist the exact validated structured result per admitted request, return durable IDs, and restore the identical result on replay without generation. Separate request identity from semantic input hash. Never say saved when persistence failed. |
| P4-4 / blocking | Tutorial handling creates a generic one-step tutorial when parsing fails; validators also supply generic missing fields. Handler does not enforce finish reason/refusal before accepting candidate text. | Reject malformed/truncated/refused results and preserve usage. Remove fabricated success. Test real handler branches, not only pure helper behavior. |
| P4-5 / blocking for comparison | `verifyPageCitation` is imported but never called in Edge. PDF/image assignment analysis is largely free-form prose, not a validated requirement inventory. | Extract bounded requirements with explicit source references and validate PDF text references against the owned source. Legacy prose is not trusted comparison ground truth. Allow explicitly entered requirements when extraction is unavailable. |
| P4-6 / blocking security/usage | Handler reads whole request/response before checking character counts; context/body shape is incompletely validated. Some storage/media work precedes admission. No actual free-tier/eligibility/AI-enabled gate is enforced. | Bounded byte reads, strict boundary validation, no provider work without admission, server kill switch, and documented provider/audience gates. Keep source ownership before privileged reads. |
| P4-7 / blocking for idempotency | Hash omits `conversationId`; raw media is hashed via a Latin-1 string re-encoded as UTF-8. Latest reserve routine coexists with an older overload; replay is checked after provider cooldown. | Hash original bytes directly and include all immutable target/input/version fields. Inspect RPC signatures and remove ambiguity only through reviewed forward migration. Replay/status recovery must work during cooldown. |
| P4-8 / blocking for accounting | Handler records only prompt/candidate counts, defaults unknown usage to zero, and ignores some RPC failures. Provider timer stops at response headers, not end of body/validation. | Keep deadlines through bounded body reads/finalization; retain total/reasoning usage when reported and conservative reservations when unknown. Record terminal states and failure metadata truthfully. |
| P4-9 / qualification gap | Unit tests target client copies. M4 uses simple colored synthetic shapes and broad keyword assertions; M7 replay checks row counts, not exact response restoration. | Add real-handler tests and human-reviewed Tinkercad fixtures. Existing tests are useful smoke checks, not a measured circuit-accuracy guarantee. |
| P4-10 / documentation mismatch | Report says eight PDF pages; current source allows six. Package/manifest still say 0.3.0. Report says fully free/verified without this review checking actual account/deployment settings. | Document actual limits: AI PDF 2 MiB / 6 pages / 24,000 extracted characters; image 4 MiB / 4 MP / 4,096 px per side. Keep 10 MiB storage allowance distinct. Review release version separately. |

Inherited release gates: privileged-key rotation/revocation remains unverified in available evidence; matching portable extension public key remains unavailable; SMTP workflows remain intentionally disabled; real Google consent and actual editor controls/zoom still need acceptance evidence. Inspect their latest status in M0. Do not rotate secrets, enable SMTP, change billing, or reconfigure OAuth as incidental Phase 5 work.

**Readiness decision:** Phase 4 is implemented in substantial part, but cannot be treated as closed for Phase 5 dependencies. Approve and complete M0 first. Missing audience eligibility blocks real AI evaluation and release, even if offline engineering can proceed later under explicit approval.

## 3. Research-backed decisions

Sources were checked on 16 October 2026. Recheck terms, model lifecycle and account-specific capacity at implementation time. Recommendations below are architectural choices, not claims that a browser prototype or live model has already passed.

| Option | Feasibility and trade-off | Decision |
| --- | --- | --- |
| Student uploads PNG/JPEG | No new capture permission; explicit file selection; works if browser capture fails. | Required fallback, using the same local preview pipeline. |
| `tabs.captureVisibleTab` with `activeTab` | One visible viewport; toolbar invocation grants scoped access. API targets the active tab in a window, not a tab ID. Existing Tinkercad host permission alone does not establish this method's required capture permission. | Preferred one-shot capture. Add `activeTab` and an explicit toolbar action; never `<all_urls>`. |
| Injected “Capture” button alone | Ordinary injected clicks are not documented `activeTab` granting gestures. A previously granted permission also does not constitute perpetual consent. | Button explains/presents the toolbar capture instruction. It never invokes capture through an arbitrary runtime message. |
| `getDisplayMedia` | Standard chooser and fresh user activation; adds stream/cancellation/source-selection cleanup and wider wrong-window exposure. | Defer. File upload already provides a simpler fallback. |
| Private Tinkercad netlist/code/simulation access | Scoped official research found no supported public live Circuits API for this purpose. Absence of evidence is not proof none exists. | Do not scrape canvas/private DOM state, intercept internal traffic, read Autodesk cookies, or reverse-engineer APIs. |
| Text code and simulation evidence | Autodesk guides describe coding/simulation and `.ino` export. Current logged-in labels still require manual confirmation. | Paste source or import `.ino`/`.txt`; student runs simulation and optionally pastes its errors/Serial output. |
| Vision plus explicit evidence | Practical for visible components and possible mistakes; weak at hidden endpoints, fine breadboard coordinates and electrical topology. | One multimodal request with evidence references, uncertainty and actionable verification questions. No automatic netlist reconstruction. |
| Custom CV/OCR/simulator, multi-model critique | More dependencies, cost and evaluation burden; no reliable shortcut to topology proof. | Outside Phase 5. Use existing deterministic calculations and bounded static code hints. |

Chrome documents `activeTab` granting invocations and `captureVisibleTab` requirements/rate limits. The capture API permits at most two calls per second; this plan uses one call per deliberate toolbar action and disables overlapping capture. [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab), [W3C Screen Capture](https://www.w3.org/TR/screen-capture/).

### 3.1 Provider, privacy and audience gate

Current Gemini Developer API terms require adult API users and prohibit API clients directed toward or likely accessed by under-18s. Unpaid inputs/outputs can be used for product improvement and human review, with restrictions on personal/sensitive/confidential submissions. An adult key owner, parental consent, a checkbox, or paid Developer API access alone does not remove the audience restriction. [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms).

**Proposed pilot:** confirmed eligible adult college students, synthetic or de-identified course material, explicit disclosure of Google processing, and billing disabled. Owner/institution must confirm the actual audience and applicable terms before real calls. Do not collect birth dates just to implement this gate. If the intended audience includes minors or eligible private processing cannot fit the budget, stop the external-AI release gate and return that conflict to the owner. Keep local functionality available; do not silently adopt Vertex, another provider, or paid infrastructure.

Retain the configured `gemini-3.5-flash-lite` only if current official model availability, the project's actual access, and the Phase 5 quality gate support it. A historical model name or metadata response is not a successful generation test. Choose one explicit replacement only if the owner approves a qualification change; no automatic fallback. Prices and free quotas vary by model/account and must be checked in the actual provider project. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

Gemini accepts image input and structured output, but JSON conformance does not establish factual correctness. Use application-side schema and evidence checks. Higher-resolution input can help small detail while increasing usage; resize/crop deliberately and ask for a close-up when needed. [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [Structured output](https://ai.google.dev/gemini-api/docs/structured-output).

## 4. Required student experience

### 4.1 Check a circuit

1. Open Check My Circuit. Offer **Upload screenshot**, explain **Capture with the OHMI toolbar icon**, and allow code-only review.
2. First toolbar use shows an extension-owned explanation of local capture and provider processing. The user returns to the editor and explicitly clicks the toolbar capture action again. Subsequent actions have the clear title “Capture visible Tinkercad circuit for review.” No capture on install, page load, tab change, or opening the panel.
3. Capture only when the clicked action's tab is a supported, active, focused Tinkercad editor. Hide only OHMI's overlay briefly; restore it on success/failure. Capture before opening the review tab.
4. Show the image in an extension-owned review page. Student crops to the circuit, excludes names/class lists, and chooses **Use this crop**. Provide a keyboard-accessible full-image alternative with explicit confirmation. Changing/replacing the image clears send confirmation.
5. Optionally attach a second close-up, paste/import code, select a board, enter component values, select an owned assignment requirement set, and paste simulation diagnostics. Label each source independently.
6. Show exactly what will be sent, the selected provider, storage behavior, and limitations. **Send for analysis** is a separate explicit action. Raw screenshots and full input code/diagnostics remain temporary; accepted guidance, bounded evidence excerpts and generated code suggestions are saved privately and can contain portions of supplied text. Disclose this before Send.
7. Show visible observations, possible issues, unknowns, assignment comparisons, and one correction step at a time. Each step includes action, reason and what the student should check.
8. Student changes the circuit manually and runs simulation manually. “I made this change” records student progress only. “Check updated circuit” requires a new screenshot/upload and explicit Send.

### 4.2 Follow-up and assistance

- Next/Back, mark/undo a step, reviewing evidence and reopening saved results use zero generation calls.
- A follow-up answer uses the prior accepted result plus the student's text/explicit diagnostics. Label it as based on the earlier snapshot; it cannot declare current wiring fixed.
- Require new visual evidence for a visual recheck. Do not reuse an old screenshot silently or automatically send it again.
- Keep English, Filipino and natural Taglish explanations. Preserve code, pin labels, units and source references verbatim across languages.
- Any suggested corrected sketch is display/copy text only. Never inject code into Tinkercad. Explain changes and preserve original pasted source.
- Show “Run Tinkercad simulation and share the exact error/Serial output” when runtime evidence is needed. User-reported success remains user-reported.

Use current OHMI controls, spacing, focus patterns and mascot. Read/apply the design-reference-library skill before new UI work; inspect a small relevant reference subset during implementation, record concrete choices, and verify the rendered result. No external component library is needed for this plan.

## 5. Technical design and contracts

### 5.1 Capture authority and race handling

Add `activeTab` and `manifest.action` with no default popup. Current source has no toolbar handler to preserve; recheck before editing. Register `browser.action.onClicked` synchronously in `entrypoints/background.ts`. Await backend initialization before account-bound actions, but do not depend on content-script messages to grant capture permission.

Implement `src/capture.ts` as the worker-side coordinator. Derive tab/window from the actual action event; ignore any caller-supplied tab ID. Reject unsupported URL, inactive/unfocused source, loading/discarded tab, missing top-frame companion, concurrent capture and incognito operation. Incognito support is deferred explicitly.

- Snapshot tab ID, window ID, supported editor pathname and content-document generation. Ask the top-frame content script to hide only the `ohmi-companion` host and acknowledge after painting; use a request nonce and a short 2-second acknowledgment deadline.
- Content script validates internal sender identity and message shape. A per-document generation token changes on supported-editor SPA transitions. A replacement document cannot reuse a pending handshake.
- Check active tab, focused window, URL/generation immediately before and after `captureVisibleTab(windowId, {format: 'png'})`. Track intervening activation/navigation events during this short operation. Reject any mismatch or missing acknowledgment.
- Restore OHMI in `finally`. The content side also has a 3-second local restore watchdog so worker interruption cannot leave OHMI hidden. This watchdog controls only OHMI UI, never capture/retry.
- `captureVisibleTab` has no atomic tab-ID parameter. These checks reduce races; they cannot prove the pixels never came from another tab during a very fast switch-and-back. Always keep capture local pending visual review. Never auto-upload.
- Store at most one pending image handoff in trusted `storage.session`, bounded below its capacity, with random capture ID, owner scope (or signed-out scope), source generation and a 5-minute TTL. Normalize oversized raw capture locally in the worker using available platform bitmap/OffscreenCanvas APIs before the handoff. If unsupported, discard and offer upload; do not add an offscreen document as an automatic workaround.
- Open `/check.html#capture=<opaque-id>` only after capture. Do not put pixels, code, source URL or credentials in the URL. Only the intended extension review tab may claim the record. Consumption removes the session copy immediately; page memory owns the preview afterward.
- Bind handoff to review tab ID as soon as it exists; handle its startup race without releasing bytes to another caller. Expire/delete on claim, discard, replacement, sign-out/account change and browser end. Check TTL on access/new capture; do not rely on sleeping workers or scheduled cleanup.
- Never send captured pixels or pasted code back to Tinkercad content scripts. Only neutral completion/error notices may enter the overlay.

Service workers may terminate and lose globals; no keepalive/polling hack is permitted. Session handoff and durable result IDs address recovery without keeping the worker alive. [Chrome service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [Chrome messaging security](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#security-considerations).

### 5.2 Trusted review and local preprocessing

Create `entrypoints/check/index.html`, `entrypoints/check/main.tsx`, and `src/CircuitReviewPage.tsx`; reuse account styles/components where suitable. Add `/check.html` as a narrowly trusted sender in `validateRequest`; retain `/account.html`-only restrictions for auth and signed upload authorization. Do not broaden the existing `trustedOnly` category to every extension URL.

Proposed actions:

| Action | Allowed sender | Purpose |
| --- | --- | --- |
| `circuit.open` | Existing validated editor or Account page | Open trusted review page; never capture or send images. |
| `capture.claim` | Intended top-frame `/check.html` tab only | Consume its opaque, unexpired pending capture. No provider work. |
| `ai.circuit` | Top-frame `/check.html` only | Submit an approved version-2 circuit request using worker-owned Auth. |
| `ai.request.get` | Validated editor, Account or Check page, with current account | Retrieve original owned request state/result, without generation or quota reservation. |

Review-page preprocessing uses `createImageBitmap`/Canvas: decode, honor orientation, crop using decoded pixel coordinates, optionally downscale, and re-encode PNG or JPEG. Re-encoding strips original file metadata. No SVG/HTML/GIF/PDF input in this path. PNG is preferred for labels; use JPEG only when the preview remains readable. Default longest side 2,048 px, never upscale; student may keep higher detail within server bounds. Blurred endpoints need a better crop, not invented labels.

Allow up to two images: overview and optional detail, **combined encoded bytes <= 4 MiB and combined pixels <= 4,000,000**, each side <= 4,096 px. Enforce these after normalization. Preview the final normalized images, not a higher-resolution source that will not be sent. Current Phase 4 single-image limits remain unchanged.

Crop provides pointer and keyboard controls/numeric boundaries, Reset, Cancel, and “Use full image” confirmation. Student excludes identifying regions by cropping or uploads an externally redacted image; do not build a drawing editor. Revoke object URLs/bitmaps and clear bytes/code on discard, page close, account change, source-project change, or successful send unless the student is actively reviewing them. No localStorage, IndexedDB, persistent screenshot cache, or automatic Supabase upload.

### 5.3 Version-2 circuit request

Keep version-1 chat/image/PDF/tutorial clients working. Extend `ohmi-ai` with a discriminated version-2 request; route via `ai.circuit` so content scripts cannot supply inline pixels. Use one production handler, with a small exported `handleAiRequest(req, dependencies)` test seam and a separate `Deno.serve` entry. Do not rewrite unrelated AI behavior.

Define these types in `src/backend/contracts.ts` and matching server validation in `supabase/functions/ohmi-ai/circuit.ts`. Keep any client validation a convenience; server checks are authoritative.

```typescript
type CircuitRequestV2 = {
  version: 2;
  operation: 'circuit_check';
  requestId: string;                 // UUID, immutable per logical attempt
  language: 'english' | 'filipino' | 'taglish';
  mode: 'check' | 'follow_up';
  message: string;                   // 1..2,000 characters
  images: Array<{
    id: 'overview' | 'detail';
    mimeType: 'image/png' | 'image/jpeg';
    data: string;                    // strict base64, not URL/data URL
  }>;
  code?: string;                     // <= 8,000 characters
  board: 'uno-r3' | 'unknown';
  calculation?: AiCalculationPayload; // reuse Phase 4 explicit typed operands
  simulation?: string;               // <= 2,000 characters, user-reported
  assignmentId?: string;             // UUID, owned ready source
  assignmentAnalysisId?: string;     // UUID, exact validated requirement version
  requirementText?: string;          // <= 4,000 characters, user-provided alternative
  previousCheckId?: string;          // UUID, owned accepted check
  conversationId?: string;           // UUID, owned conversation
};
```

Worker-only envelope additionally carries `accountId`, which is never forwarded as proof of ownership. Server derives owner from verified JWT. Optional IDs must be strings matching UUID syntax, never coerced objects/arrays. Unknown keys, duplicate image IDs, invalid enum values and oversized fields are rejected.

Rules: `mode: check` requires an image or nonempty pasted code; code-only review states that wiring is unobserved. A follow-up requires `previousCheckId`, carries no images, and cannot be presented as a new visual check. A new visual recheck uses `mode: check`, new approved image(s) and optional prior ID. Do not treat arbitrary client conversation history as authoritative context; load bounded owned history/result on the server.

For assignment comparison, require either `assignmentId` plus a matching `assignmentAnalysisId`, or `requirementText`, not both. An assignment ID without a validated requirement artifact is rejected with instructions to analyze/select requirements first. Server verifies same owner, assignment relation, source hash and supported schema; stale/legacy prose gets clarification, not fabricated requirements. No second generation is triggered automatically to extract them.

Bounds: retain 32 KiB UTF-8 body ceiling for version 1; allow **6 MiB UTF-8 encoded JSON** only for version 2. Two images share the 4 MiB decoded bound, leaving room for base64 expansion and text. Validate streamed request bytes before assembling/parsing; Content-Length is only an early rejection hint. Reject invalid base64 before allocation; enforce decoded limits, actual MIME/signature/dimensions and a bounded decode/structure check. Do not fetch image URLs. Limit assembled textual provider context, including owned history/requirements, to 24,000 characters; reject excess source content with a useful selection request rather than silently truncating requirements/code.

### 5.4 Evidence-based result

Define `CircuitCheckResult` with `schemaVersion: 2`; persist exactly the validated object. Use the provider's supported JSON Schema subset plus a strict server validator.

| Field | Contract and meaning |
| --- | --- |
| `status` | `reviewed`, `needs_clarification`, or `unsupported`. “Reviewed” means evidence inspected, never circuit passed. |
| `summary` | 1..800 characters. No overall safe/correct/electrically verified verdict. |
| `findings` | 0..6 entries: stable `id`, `severity` (`info`, `warning`, `stop`), `certainty` (`observed`, `possible`), `observation`, `why`, `action` (each 1..500 characters), and 1..3 evidence references. |
| `unknowns` | 0..6 strings, each <= 300 characters, including hidden/unreadable/unsupplied facts. |
| `questions` | 0..3 focused questions, each <= 300 characters. At least one for `needs_clarification`. |
| `comparisons` | 0..8 entries keyed to supplied requirement IDs: `supported`, `possible_mismatch`, or `not_observable`, plus explanation <= 400 characters and valid evidence references. No grade/score or overall completion flag. |
| `steps` | 0..8 entries: sequential `step` (1-based), `instruction`, `why`, `check` (each 1..500 characters), and optional `findingId`. Reuse the guide/progress convention: stored current/completed indices are 0-based. |
| `codeSuggestion` | Optional source text <= 8,000 characters with explanation <= 800 characters. No executable actions/HTML. Original input stays distinct. |
| `limitations` | 1..6 strings <= 300 characters, including the visual-review limitation and review-not-compilation limitation when code is present. |

Evidence reference union:

- Image: `{kind: 'image', imageId: 'overview' | 'detail', location: string}`; location <= 160 characters describes the supplied snapshot, not live viewport coordinates.
- Code: `{kind: 'code', startLine: number, endLine: number}`; integers within the exact supplied source's 1-based line count, range <= 20 lines.
- Assignment: `{kind: 'requirement', requirementId: string}` from the exact server-selected requirement set.
- Simulation: `{kind: 'simulation', excerpt: string}`; <= 160 characters, an exact substring of user-supplied diagnostics.
- Prior check: `{kind: 'prior_check', findingId: string}`; follow-up only, references an actual finding in the owned prior result and clearly labels historical evidence.

Server generates image hashes, code hash/line count, requirement source/version, model, prompt version, request ID and timestamps. Do not let the model assert provenance. Reject dangling references, malformed fields, extra executable keys, invalid status combinations and truncated output. Structural validation proves referential bounds, not that an image observation is true; expert evaluation remains necessary. Do not add uncalibrated confidence percentages or live on-canvas markers in this phase.

`unsupported` requires empty findings/comparisons/steps and no code suggestion; its summary/limitations explain the boundary. `needs_clarification` requires a question and no construction steps/code suggestion; known observations may still appear as findings. `reviewed` may have no findings/steps when no supported correction is visible. Never synthesize generic steps to fill an empty result.

The version-2 response envelope returns `{ok, requestId, accountId, operation, language, model, resultId, conversationId, result}` and optional server-computed `calculation: AiCalculationResult`. `result` is the exact validated `CircuitCheckResult`; server provenance/calculation are stored under reserved artifact keys, never accepted from model output. Artifact payload otherwise retains the result fields at top level, including `steps`, for existing progress compatibility. `resultId` always identifies the artifact, not a message. Worker/UI verify request/account IDs before display.

### 5.5 Analysis and accuracy rules

Prompt separates trusted instructions from all untrusted image text, code comments, requirements, prior responses and simulation text. These are evidence, never instructions to reveal secrets, change tools, ignore policy, or control the browser. Render React text/code safely; no `dangerouslySetInnerHTML`, raw Markdown HTML, auto-opened model links, eval, or model-driven browser actions.

Supported initial domain: low-voltage educational DC/breadboard circuits, LEDs/resistors/buttons/simple sensors and Arduino UNO R3. Other boards/components get limited observations plus explicit unsupported details. No mains, hazardous battery charging, high-current/power-driver design, or permission to energize hardware based on this checker.

- Distinguish component presence from connected topology. Crossing wires do not establish junctions; similar colors do not establish a connection.
- Do not infer resistor values from tiny bands, exact breadboard holes, polarity from an obscured LED, split rails, common ground, or hidden wires without visible evidence. Ask for a zoom/value/connection confirmation.
- A suspected missing resistor/ground is a possible issue when another unseen path could supply it. Explain how the student can inspect that path.
- Prefer the next safe, useful observation over a long speculative defect list. For a clear serious issue, tell the student to stop simulation/power and inspect it manually; never tell them the rest is safe.
- Reuse deterministic calculations only with explicit typed operands/units through the existing `AiCalculationPayload` contract. Validate allowed operand keys, finite numeric values, ranges and units per calculation; reject unknown/excess fields. Do not parse numbers out of screenshots or prose and label them verified. No new calculator screen is required: reuse approved Phase 4 input controls, or leave this optional field absent. Return server-computed math alongside model explanation; deterministic contradiction wins. Free-form model math without those operands remains unverified explanation.
- Reuse `validateArduinoSketch` for limited lexical hints, not a C++ parser/compiler. The existing client/server variants must be tested directly or reconciled narrowly. Unknown macros, aliases, library behavior, `LED_BUILTIN`, analog-as-digital pins and other boards must not create false definitive errors.
- Ask the student to confirm board identity. Default `unknown`; do not silently impose UNO mappings. Official UNO documentation/pinout supports board facts and PWM mapping; absolute maximum ratings are not operating targets. [Arduino UNO R3](https://docs.arduino.cc/hardware/uno-rev3/), [official pinout](https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf).
- Compare code pins with visible wiring only when both are readable and from the same declared build. Otherwise mark the relationship unknown. Code line references refer only to pasted source, never OCR guesses.
- Successful syntax hints, reported simulation and visual review remain separate evidence classes. No automatic progress completion or “circuit fixed” badge.

### 5.6 Assignment grounding

M0 supplies `AssignmentRequirementSet` in a validated analysis payload: `schemaVersion: 2`, `requirements` (1..8), and source metadata. Each requirement has stable `id`, `kind` (`component`, `connection`, `code`, `behavior`, `deliverable`), `text` <= 400 characters and a source reference. PDF references include page and exact excerpt verified against that page's extracted text. Diagram-derived requirements use an explicitly visual reference and remain unconfirmed until the student checks them. Manual requirements are labeled user-provided and use stable `manual-1` etc. IDs; they are not teacher-verified.

Store/choose the exact requirement analysis version. Do not compare against generated tutorial embellishments, generic electronics advice or a different assignment. Preserve assignments with ambiguous/conflicting requirements; ask for clarification. For scanned diagrams/text not verifiable by extraction, do not counterfeit an exact text citation. Let the student provide a readable crop or confirm a concise manual requirement set before comparison.

Assignment comparison does not need the entire PDF on every check. Reuse the selected requirement set within the context bound. Re-extract only on a separate explicit assignment-analysis request after changed source or rejected legacy evidence. Keep Phase 4's file/authorization/PDF limits and private storage behavior.

### 5.7 Durable results, progress and deletion

Reuse `ohmi_analyses`, `ohmi_conversations`, `ohmi_messages`, `ohmi_tutorial_progress`, `ohmi_ai_requests` and backoffs. **No separate screenshot bucket or circuit-session database is needed.**

One forward migration slice, after M0 accounting repairs, should:

- Allow `artifact_kind = 'circuit_check'` and `schema_version = 2` alongside all legacy kinds/versions. Permit null assignment for checks; preserve assignment-required constraint for existing `analysis` artifacts. Preserve the payload's bounded `steps` array to stay compatible with progress checks.
- Reconcile reserve/complete/status routines for operation `circuit_check`, exact artifact persistence, result IDs, owner-scoped request recovery and replay. Preserve service-role-only admission/finalization and RLS owner reads. No authenticated direct insert/update of model artifacts.
- Persist the structured result and minimal provenance: normalized image hashes, code hash/line count, source/requirement IDs and hashes, board, prompt/schema/model versions, previous-check ID, and server timestamps. Never store base64 images or full input code/diagnostics fields in provenance/history. Bounded result evidence excerpts and generated code suggestions are retained and can reproduce portions of the supplied source; disclose that distinction before Send. Do not promise that accepted guidance contains none of the student's source text.
- Save only neutral user-message summaries (“Circuit review requested” or “Follow-up on circuit review requested”) and the accepted assistant result for version 2. Raw follow-up/message text can itself contain code/diagnostics, so do not persist it as chat content. Server follow-up context uses accepted structured results plus the current transient message. Never serialize the full request into `structured_result`, chat content, ledger, error messages or logs. Existing version-1 chat retention stays unchanged and separately disclosed.
- Separate semantic input hash from per-request artifact identity. Keep `ohmi_ai_requests.input_hash` as the semantic fingerprint defined in section 6. For newly finalized artifacts, set `ohmi_analyses.fingerprint` to a SHA-256 derived from owner ID, request UUID and artifact kind, rather than reusing `input_hash`; store semantic hash in provenance. Preserve legacy fingerprint values/index and change the completion routine's new-write/conflict behavior accordingly. Same UUID replays its one result; two new UUIDs with identical evidence each retain their own generated result and independent progress. No cross-request artifact reuse or generation cache is introduced.
- Keep `previousCheckId` and assignment-analysis references owner-checked; any new relational reference must preserve same-owner invariants. A hash is a pseudonymous identifier, not anonymization.
- Allow the owner to delete a circuit-check artifact via a validated `analyses.delete` action and RLS owner-delete policy, including its progress and linked conversation/messages according to actual existing cascade behavior. Explain that deletion of a linked artifact can delete its linked conversation under the existing FK. Test this explicitly; never delete source assignments to delete a check.
- Delete conversations independently without deleting unrelated assignment/manual-step data. A result's AI request ledger entry remains for accounting, but result retrieval returns unavailable after deletion; replay must not resurrect deleted content or generate again.

Use exact validated result on completed request replay, without admission/quota/generation. Same UUID with changed hash/target is 409. Duplicate pending returns in-progress. Failed stays terminal; explicit retry is a new UUID. A lost response first uses `ai.request.get`, never a fresh analysis. Completion and structured message/artifact inserts happen atomically; test finalization failure and duplicate concurrent completion. Raw image deletion from OHMI does not promise provider deletion/zero retention.

Local guide progress may be shown immediately; durable progress uses the existing per-analysis RPC after acceptance. Progress is student-reported, tied to exact result version, and never shared automatically with manual assignment steps. New check = new progress record. Follow-ups do not overwrite the earlier guide or silently reset its progress.

## 6. Security, deadlines and efficient usage

### 6.1 Request pipeline

1. Method/CORS handling; reject unsupported methods and invalid content type. CORS/origin allowlisting is defense in depth, not authorization.
2. Bounded byte read/strict envelope validation and verified JWT. Both finish before provider work. Reject missing/unowned conversation, prior check, assignment and requirement artifacts; use safe unavailable responses.
3. Validate image bytes/dimensions, code/diagnostics, source relation/version and assembled text budget. Do not fetch arbitrary URLs or private source objects chosen by raw client paths.
4. Compute canonical SHA-256 over original normalized image bytes and deterministic semantic fields. Include owner, mode, board, language, message, exact code/diagnostics, typed calculation operands when present, selected requirement hash/version, prior check, conversation, model, prompt and schema versions. Exclude request UUID from the input fingerprint. Never trim source/code in a way that makes differing meaningful inputs collide.
5. Resolve exact replay first, then enforce AI-enabled/audience gate, persistent cooldown, per-user/project quota and global in-flight lock. Admission and any cached completed-result lookup remain owner-scoped.
6. Run deterministic math/code hints; construct one bounded multimodal request; generate once with structured schema and no retries/tools/search grounding.
7. Bounded read through completion, validate refusal/finish reason/JSON/schema/references, retain usage even if validation fails, then atomically finalize and return the durable accepted result.

Use a server `OHMI_AI_ENABLED` kill switch, default false when absent; M0 documents the owner-confirmed conditions for enabling it. Keep server-side free-only capacity settings and refuse provider work if that deployment gate is not confirmed. A flag alone does not prove billing/eligibility; M0 records the actual checks.

Use the stricter of current approved limits and verified free provider capacity. Initial maxima remain **6 per user per rolling minute, 10 per user per rolling 24 hours, 40 per project per rolling 24 hours, one global in-flight generation, 60-second pending lease**. All operations share the ledger/quotas. Do not create a second independent Phase 5 allowance. Failed admitted attempts still count. Lower caps if model/account limits require it; raising them requires reviewed evidence and approval.

Set a **25-second server operation deadline**, with generation/body consumption ending by **22 seconds after request start**, leaving finalization time; retain the worker's **28-second client deadline**. Storage/auth work consumes the same operation budget. Reject insufficient remaining time before generation. Propagate abort through fetch and bounded readers; never clear the timer at headers. No detached background work to finish a timed-out request. Test header-fast/body-slow providers and DB timeout handling. Chrome's worker limits and Supabase's runtime limits remain outer constraints, not targets. [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits).

Cap provider response at **64 KiB actual UTF-8 bytes** and accepted structured result at **32 KiB**. Initial circuit output ceiling: **3,072 tokens**, temperature 0.1, one candidate. If this ceiling truncates fixtures, reduce schema verbosity before proposing more tokens. Account for reported total/thinking usage; missing usage retains conservative reservation, never zero. No `countTokens` request per check, automatic JSON-repair call, self-critique call, retry loop, or image-to-text prepass.

### 6.2 Error behavior

| Condition | Behavior and provider-call expectation |
| --- | --- |
| Capture permission denied/tab changed/unsupported page/preview canceled | Local notice and upload fallback; zero generation calls and no upload. |
| Account changes while preview/request open | Clear local evidence and discard stale response; server retains original-owner scope. Never display it to the next account. |
| Invalid JSON/body/base64/media/schema/target | 400/413/415 or safe 404; no provider call. Unknown board is a supported uncertainty state, not a fabricated UNO review. |
| Local quota/disabled AI/provider cooldown | Stable code, truthful wait/availability message; zero generation calls. Keep preview for deliberate later Send. |
| Provider 429/503 | Record one attempt, persist bounded cooldown; no automatic retry or fallback. Honor a valid longer Retry-After within a maximum 24-hour policy. |
| Provider refusal/non-STOP/truncation/invalid result | Reject success, preserve accounting, return a controlled category. No fabricated tutorial/check and no silent repair. |
| Client disconnect/worker restart | Query original owned request status/result after reconnect. Never regenerate automatically. Unknown outcome retains reservation until terminal lease handling. |
| Persistence failure | Do not return saved success. Finalize failure conservatively when possible; lease recovers abandoned pending. A deliberate new analysis costs quota; no hidden generation for recovery. |
| Result/source deleted | Show unavailable. Do not resurrect from another account, stale local cache or a new generation. |

Log only request ID, operation, versions, model, duration, attempt count, numeric usage/reservation, HTTP/finish category and allowlisted validation path/type/length/reason. No screenshot, source URL, title/name, prompt, code, diagnostics, excerpts, signed URL, bearer token, provider key, arbitrary JSON keys or full rejected output. Existing handler stores raw provider error prose; replace that with safe categories in M0. Private bucket policies and RLS remain required wherever stored sources are used; a service key bypasses Storage RLS, so owner checks must precede privileged reads. [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

### 6.3 Capacity and cost expectations

Local capture, crop, static hints, guide navigation and replay recovery are zero-generation operations. A new circuit check or text follow-up costs at most one generation. Repeated click while pending is suppressed; re-opening the same result never generates. Do not add a global cross-student cache or semantic cache. Retain only an account-scoped current result and the ledger's exact replay behavior.

Forty requests per project/day is a small pilot limit, not classroom concurrency. For example, ten students making four requests exhaust it. Under the one-in-flight rule, other students receive a busy message and manually submit later; do not add a job queue. Record actual prompt/image/output usage and latency using synthetic fixtures before choosing pilot size. Free availability is not guaranteed. Do not promise per-check money savings or permanent free capacity without current measurements.

## 7. Files and responsibility map

Paths below are proposed future changes, not files already implemented. Inspect current source before each edit. Reuse existing modules; only split the large Edge handler enough to test production logic.

| Files | Responsibility / reach |
| --- | --- |
| `wxt.config.ts`, `entrypoints/background.ts` | `activeTab`, toolbar action, event registration, worker initialization/capture routing. Preserve all existing manifest fields/identity. |
| `entrypoints/ohmi.content.tsx`, `src/OhmiApp.tsx`, `src/AssistantPanel.tsx` | Internal capture hide/restore handshake and neutral open-review instruction; Phase 4 UI gaps; unchanged mascot/host isolation. |
| Create `src/capture.ts`, `src/capture.test.ts` | Tab/window/document checks, one-shot capture, trusted TTL handoff and restoration tests. |
| Create `entrypoints/check/index.html`, `entrypoints/check/main.tsx`, `src/CircuitReviewPage.tsx` | Trusted preview/crop/file/code/requirements/send/results page. Reuse existing styling; add only necessary styles in `src/account.css` / `src/ohmi.css`. |
| Create `src/ai/circuit.ts`, `src/ai/circuit.test.ts` | Circuit types/client result guards, local preprocessing coordinate helpers and schema invariants as needed. No client provider key/transport. |
| `src/backend/{contracts,validation,service,database.types}.ts` and focused tests | Sender/action/version validation, conversation creation, worker dispatch, owned result/status/delete access, current schema types. `src/bridge.ts` changes only if typed response transport requires it. |
| `supabase/functions/ohmi-ai/index.ts`; create `handler.ts`, `circuit.ts` and `handler.test.ts`, `circuit.test.ts` there | Thin serving entry, actual production handler test seam, version-2 schema/prompt/evidence validation, deadlines and accounting; keep existing provider route. |
| Existing client/server Arduino/image/PDF/tutorial helpers and their tests | Focused P4 repairs, actual server coverage, safe static hints, verified requirement references. No broad abstraction/refactor. |
| New reviewed migration(s) under `supabase/migrations/` | M0 prerequisite RPC/persistence corrections, then M3 additive circuit kind/provenance/delete/replay support. Generate filenames with installed CLI; never edit applied history. |
| Create `tests/phase5.mjs`, `tests/phase5-live.mjs`, `tests/fixtures/circuits/` | Offline trusted-page/capture integration, separate opt-in bounded provider/database evaluation, sanitized fixtures and ground truth. Extend `tests/browser.mjs` only to invoke safe offline tests. |
| `package.json`, lockfile only if required by approved tooling | Offline/live verification commands; no new runtime dependency expected. Record how actual Edge tests are run; do not rely on `npm test` silently skipping them. |
| `README.md`, `docs/PROJECT_CONTEXT.md`, `docs/PHASE_4_VERIFICATION_REPORT.md`, create `docs/PHASE_5_VERIFICATION_REPORT.md`, `.env.example` | Dated truthful status, approved limits, permission/privacy/setup/release evidence and kill-switch example. Keep historical phase reports identifiable. |

Do not touch `website/`, Auth configuration, existing mascot assets, unrelated phase fixtures or paid infrastructure for this phase. If source differences invalidate this map, report the delta and update the plan before broadening scope.

## 8. Milestone execution plan for AGY

Milestones are sequential. Each contains a deliverable that can be reviewed independently. For every nontrivial behavior change: write the named failing regression, run it to observe the intended failure, implement the smallest responsible change, rerun focused checks, then checkpoint the scoped diff. Do not run every live evaluation script by default: existing scripts create hosted users/files, may install CLI versions, consume provider quota and remove fixture ledger rows.

### M0 — Reconcile and close the Phase 4 foundation

**Entry:** Owner approves M0; no Phase 5 feature implementation yet. **Owns:** P4-1 through P4-10 and inherited release gates. **Files:** existing Phase 4 UI/backend/AI helpers, thin Edge handler seam, prerequisite migration(s), existing tests, current-status docs.

- [ ] Record fresh Git/status/manifest identity/mascot hashes. Reproduce baseline commands below. Inspect only sanitized hosted metadata if authorized: migration versions, RPC overloads/grants/RLS, deployed function revision. Do not read student payloads or print secrets.
- [ ] Publish a Phase 4 gap checklist with source evidence and mark historical live claims separately. Resolve current PDF limits, model configuration, identity/key-rotation status, intended audience and free-tier/billing eligibility.
- [ ] Add regressions: `completion_rpc_error_is_not_saved_success`, `replay_restores_exact_structured_result_during_cooldown`, `same_uuid_different_conversation_conflicts`, `non_stop_and_invalid_tutorial_are_rejected`, `pdf_requirement_excerpt_must_match_claimed_page`, and `unknown_usage_is_not_zero` against production server code.
- [ ] Implement narrow fixes described in section 2.3, including byte-bounded input/output, operation-to-source MIME matching, per-request artifact identity and deadline-through-body handling. Keep version-1 operations working. Do not fabricate tutorial steps or loosen validators to make a test pass.
- [ ] Define/export `AssignmentRequirementSet`, verify references in the server route, and persist exact structured results including code/clarification/requirement fields. Support legacy display while preventing legacy unverified prose from being trusted by comparison.
- [ ] Add owned `conversations.create` (title <= 160 characters), wire chat/history restore and generated tutorial/progress UI, and test refresh/sign-out/switch/resume using mocked provider/owned fixtures. Preserve manual steps and labeled demos.
- [ ] Verify forward migrations on an isolated disposable database; compare representative legacy rows before/after. Inspect overloaded RPC dispatch and preserve ledger histories/caps. Hosted parity follows only through reviewed, authorized deployment.
- [ ] Produce dated Phase 4 closure evidence. Review with owner before starting M1. If eligibility/provider/security gates remain open, label Phase 4 closure partial and request only a clearly bounded offline next step.

**Acceptance:** All focused regressions pass, UI reaches/restores the real Phase 4 paths, version-1 smoke cases pass, persistence/replay is truthful, source citation checks execute in production, and the owner sees unresolved gates explicitly. A unit count or old “fully verified” sentence cannot close M0. Any real provider test requires its own bounded request allowance after eligibility.

### M1 — Deliver local capture and private preview, with AI disconnected

**Entry:** M0 accepted, or owner explicitly approves offline-only work despite named external gates. **Produces:** `captureFromAction(tab): Promise<void>` in `src/capture.ts`, trusted `capture.claim`, and working `/check.html` preview. No generation calls.

- [ ] Add capture coordinator tests: `toolbar_only_can_capture`, `unsupported_or_unfocused_tab_is_denied`, `tab_switch_and_back_invalidates_capture`, `spa_navigation_invalidates_capture`, `hide_timeout_restores_overlay`, `worker_restart_watchdog_restores_overlay`, `claim_requires_intended_check_tab_and_owner`, `expired_capture_is_unavailable`, and `raw_pixels_never_reach_content_script`.
- [ ] Add browser tests for local upload/crop coordinates at DPR 1/2 and zoom 80/100/125/150%, crop cancellation/reset/full-image confirmation, keyboard operation and final normalized-byte/pixel bounds.
- [ ] Add `activeTab`/action and the event-driven capture flow. Implement one pending trusted session handoff and upload fallback; do not add capture permission to any runtime message action.
- [ ] Build review UI with provenance/time, source scope, crop confirmation, optional code and local clear controls. Explicitly disable Send until later milestones. Signed-out capture is local-only and cleared when account scope changes.
- [ ] Manually test actual Chrome/Tinkercad: toolbar gesture, minimized/open OHMI, multiple tabs/windows, navigation during hide/capture, permission denial, discard, and editor work unaffected. Capture no other real person's data in evidence.

**Acceptance:** One deliberate action produces one local screenshot, final preview requires explicit use/send consent, cancel/upload/capture issue zero network analysis requests, and overlay always returns. Browser tests verify local storage/sender isolation. A raced result never auto-uploads; residual non-atomic capture risk is documented. No new broad permissions.

### M2 — Implement and prove the bounded circuit-check handler offline

**Entry:** M1 accepted. **Produces:** `validateCircuitRequest(value: unknown): CircuitRequestV2`, `validateCircuitResult(value: unknown, evidence: CircuitEvidence): CircuitCheckResult`, and production `handleAiRequest` version dispatch. `CircuitEvidence` contains server-selected image IDs, code line count, requirement IDs, diagnostic source and prior finding IDs; it never trusts model provenance.

- [ ] Write failing request tests: strict IDs/enums/body object, UTF-8 byte ceiling, streaming without Content-Length, malformed/oversized base64, image aggregate bounds, invalid MIME/dimensions/corrupt structures, no-evidence check, visual follow-up misuse, foreign/stale requirement and prior-check IDs.
- [ ] Write result tests: wrong/missing keys, unknown image/requirement/finding, code line overflow, nonmatching simulation excerpt, >6 findings/>8 steps, missing clarification question, output cap, provider safety block and MAX_TOKENS, and malicious text in each input source.
- [ ] Implement version-2 validation, prompt and one-request generation path. Reuse existing image/math/board validators; test the server variants. Keep code-only checks honest and refuse unsupported detail without breaking text help.
- [ ] Stub provider and database to prove exactly zero/one generation calls for every branch. Include slow response body, parse failure after usage, account/target denial, cooldown, duplicate pending/completed, finalization error and unknown outcome.
- [ ] Add worker `ai.circuit` with `/check.html` sender restriction, stale-account guard and bounded timeout. Retain existing `ai.chat` version-1 behavior and Account-only credential/upload actions.

**Acceptance:** Production-path offline tests pass; no raw image URL fetch or model-driven action exists. Input/output bounds work before unbounded reads/decodes. Rejected provider output consumes accounting but does not appear as accepted guidance. Version-1 operation regressions pass.

### M3 — Persist exact checks and compare owned requirements

**Entry:** M2 accepted and migration/security review approved. **Produces:** durable `circuit_check` artifacts, `ai.request.get`, owned delete, requirement selection/comparison and exact replay.

- [ ] Add disposable-database tests: `two_users_cannot_read_or_link_each_others_checks`, `old_artifacts_survive_forward_migration`, `concurrent_reservation_calls_admit_one_generation`, `same_request_cannot_double_finalize`, `two_uuids_with_identical_inputs_keep_distinct_results_and_progress`, `lost_response_restores_exact_result`, `deleted_result_stays_unavailable`, and `assignment_delete_cascade_preserves_unrelated_manual_steps`.
- [ ] Generate/review additive migration(s) for section 5.7. Reconcile only affected RPC signatures; use owner constraints and narrow grants. Do not modify historical migration files or lower quota accounting.
- [ ] Integrate artifact creation/finalization and status recovery in the same existing transaction path. Add/delete/list/open actions and types; maintain stable immutable source/result fingerprints.
- [ ] Resolve selected owned validated requirements server-side, including manual-text alternative. Pass bounded requirements rather than the whole PDF. Implement `supported`/`possible_mismatch`/`not_observable` comparison semantics and stale-source rejection.
- [ ] Verify result deletion, conversation deletion and assignment deletion independently. Test the actual FK cascades, UI confirmation copy and no regenerated/deleted result recovery.
- [ ] Replay all migrations and focused RLS/grant/RPC tests in isolation. Before hosted deployment, inspect pending migration list/dry-run using the installed CLI's actual help/options and review exact SQL. If the runtime is unavailable, record this gate as blocked; do not claim a replay pass.

**Acceptance:** User A cannot access/link User B's sources/checks/progress/status. Completed replay returns identical structure and no provider call, including during cooldown. New UUIDs keep independent results/progress even with identical inputs. Source changes invalidate comparison. Database/history contain no image bytes, full raw code/diagnostics fields or raw version-2 messages; disclosed bounded result excerpts/suggestions may remain. Logs contain none of these contents. Legacy data and existing uploads/manual steps retain behavior.

### M4 — Finish interactive guidance, code review and recovery UX

**Entry:** M3 accepted. **Produces:** complete student flow in Check page plus compact overlay entry/result history; account-safe step progress and text follow-ups.

- [ ] Add browser fixtures for clear/ambiguous results, code-only review, assignment comparison, follow-up on prior snapshot, provider/limit errors, interrupted requests and exact history restoration. Mock generation; do not silently call a provider.
- [ ] Wire Send to one immutable request snapshot/UUID. Disable duplicate submission; edit-after-send creates new consent/input, never mutates an in-flight attempt. On reconnect use `ai.request.get` before offering deliberate new analysis.
- [ ] Render findings/evidence/unknowns/requirements and step actions with safe React text/code. Include accessible live status, focus restoration, error notices, text alternatives and readable code overflow. Limit the overlay to compact navigation/results; keep detailed evidence in the trusted page.
- [ ] Add board selection and source paste/import <=8,000 characters; treat `.ino`/`.txt` as inert UTF-8 text. Verify code line references, original-versus-suggested separation and explicit copy control. No compilation/execution/new compiler service.
- [ ] Add Next/Back, mark/undo and server progress using exact result ID; show student-reported status. Zero generation for these controls. Follow-up is explicit, uses historical evidence and cannot replace/complete the guide silently.
- [ ] Test account switch/sign-out while cropping, awaiting AI, opening history and saving progress. Clear/discard local evidence and ignore stale responses. Test source-editor project switch invalidation without automatic screenshot or DOM scraping.
- [ ] Verify English/Filipino/Taglish technical equivalence; keyboard-only crop/send/results, 320 px layouts, desktop review page, 200% text zoom, reduced motion, screen-reader labels and real Tinkercad host controls.

**Acceptance:** Student can capture/upload, review/crop, send, inspect uncertainty, compare selected requirements, correct manually, advance guidance and explicitly recheck. Code-only use never claims wiring inspected. Historical results are visibly dated snapshots. Refresh/reconnect/account switch behave safely; existing demo/manual-guide behavior remains distinct and available.

### M5 — Qualify accuracy, release safeguards and phase handoff

**Entry:** M4 accepted; actual provider/audience/free-only gates confirmed. **Produces:** evidence-backed Phase 5 acceptance report, not a broad accuracy promise.

- [ ] Prepare `tests/fixtures/circuits/manifest.json` with at least 16 de-identified fixtures, expected observations/unknowns, supported requirement/pin facts, reviewer and source provenance. Use genuine Tinkercad renderings from team-owned circuits for visual fixtures; colored blocks alone are insufficient.
- [ ] Run the full offline security/capture/schema/database/browser regression matrix below. Review the rendered extension in actual Chrome/Tinkercad. Record exact commands, versions, browser source and results.
- [ ] Obtain a fixed live evaluation allowance; proposed maximum is **16 generation attempts total**, one per fixture/case, sequential, using only confirmed eligible synthetic material. Use at most eight attempts in one rolling 24-hour period unless current usage leaves a smaller allowance; do not bypass shared 10/user and 40/project limits. Text/PDF prerequisite calls consume this same approved allowance unless separately approved. No rerolls to improve scores.
- [ ] Run 2 diverse cases first. Stop on first availability/schema/security/critical factual failure; diagnose with sanitized metadata/offline fixtures before requesting any additional live run. Do not exhaust allowance following a known failure. If the remaining rubric cannot be completed within allowance/quotas, mark it incomplete.
- [ ] Have an electronics reviewer score real output against ground truth. Cover the fixture matrix below and all three languages; use existing accepted outputs for repeated UI testing to avoid new calls.
- [ ] Verify deployed/source/schema parity, no credentials/raw evidence in source/build/logs, no untracked dependencies/output included, kill switch and rollback behavior, real Google/session behavior, original extension identity and approved mascot hashes.
- [ ] Write `docs/PHASE_5_VERIFICATION_REPORT.md` with limits, dataset/scoring, request/usage counts, failed cases, manual checks, residual uncertainty and source/deployed SHAs. Update current README/context only after evidence supports it. Present completion to owner.
- [ ] After verified user-approved phase completion, follow `AGENTS.md`: commit/push all scoped source/assets/tests/config/docs to `https://github.com/janveryuu/OHMI.git` on the appropriate approved `codex/` branch; preserve remote history/main, exclude credentials/build/cache/dependencies, and confirm remote SHA. Do not push the planning-only document as a completed Phase 5. Do not begin Phase 6.

**Acceptance:** All mandatory gates below pass with evidence. Any unresolved critical gate means Phase 5 is partial, even if code builds. Never relabel an unsuccessful quality test as “verified” based on keyword matches or repeated sampling.

## 9. Test matrix and release criteria

### 9.1 Reproducible commands

Existing safe local baseline commands (run from repository root):

```powershell
npm test
npm run typecheck
npm run build
npm run test:browser
```

Proposed future focused commands after adding their files:

```powershell
npx --no-install vitest run src/capture.test.ts src/ai/circuit.test.ts src/backend/validation.test.ts src/backend/service.test.ts
node tests/phase5.mjs
```

Production Edge tests should use `deno test --no-check supabase/functions/ohmi-ai/handler.test.ts supabase/functions/ohmi-ai/circuit.test.ts` with a fake provider/database and no network permission. Pin/cache the project's required Deno dependencies in the approved development environment; if Deno/tooling is missing, report it and use the project's approved runtime rather than silently installing tools. M0 records the exact runnable command and verifies production imports execute in it. Do not substitute tests of unused browser helpers. Migration replay/RLS tests require an explicitly isolated database; no generic command in this plan should reset the linked project.

`tests/phase5-live.mjs` is opt-in only: require explicit environment gates for confirmed eligibility and a maximum request count, validate the intended project/ref, use synthetic fixtures and service credentials only in trusted tooling, and fail closed on missing gates. Never include it in `npm test` or the default browser suite. Discover installed CLI help/version before any hosted command; do not copy old evaluation scripts' `npx --yes` installs or ledger-deletion cleanup. Guard cleanup by exact fixture IDs and owner markers; retain sanitized attempt/accounting evidence rather than deleting real usage.

### 9.2 Ground-truth fixture coverage

| Cases (at least 16 total) | Required behavior |
| --- | --- |
| Correct-looking LED/resistor, equivalent valid alternate wiring, correct UNO blink (3) | No invented definitive fault; explain limits and useful checks without a “safe” verdict. |
| Visible missing current limiting, readable reversed LED, visible unconnected ground/rail gap (3) | Identify evidence-supported risk/action; use “possible” where unseen wiring could change interpretation. |
| Dense crossings/hidden endpoints, blurred labels, unreadable resistor value (3) | Abstain on exact endpoints/value; ask a targeted close-up/value question. |
| Actual code pin mismatch, missing OUTPUT/simple source defect, valid alias or `LED_BUILTIN` (3) | Cite actual source lines; identify genuine issue without treating every unfamiliar valid pattern as wrong. |
| Assignment mismatch, non-observable behavior requirement (2) | Match exact selected requirement IDs; distinguish observation from absent evidence. |
| Unsupported board/component and malicious embedded instruction (2) | Explicit limitation/ignore injected instruction; no leaked data, invented map, tool action or unsafe recommendation. |

Make at least one fixture intentionally mix stale code/image/project evidence and expect clarification; combine this with an ambiguous case. Cover English, Filipino and Taglish across the set. Provide an additional offline follow-up fixture proving the earlier snapshot cannot establish a repair, and provider stubs for safety/truncation/errors. A safety-critical failing real case blocks release regardless of total score.

**Proposed quality threshold:** 100% correct abstention on deliberately unreadable/hidden facts; zero claims of electrical verification/compilation/unobserved success; zero critical harmful recommendations; all clearly visible planted safety issues flagged; at least 90% of material factual claims supported by supplied evidence/official board facts; at least 14/16 cases meet the beginner clarity/actionability rubric. Report false positive and missed-issue counts plus denominator; do not advertise a general “90% circuit accuracy” from this small curated set. Schema validity must be 100% on accepted results; invalid output is a failure, not discarded from the score. Reviewer checks language equivalence manually.

### 9.3 Review focus: high-risk cases and owners

1. **Tab switches away and back during capture:** M1 event invalidation and local-only preview; M5 real multi-window check. No automatic upload under any timing.
2. **Slow provider body after fast headers / worker interruption:** M0/M2 deadline and accounting tests; M4 request-status recovery. No implicit regeneration.
3. **Valid unusual Arduino source / ambiguous breadboard topology:** M2 abstention/reference tests; M5 ground truth. Unknowns never become definitive errors.
4. **Mixed assignment/project/account versions:** M3 same-owner/version checks and M4 preview/request clearing. Source evidence never crosses scope.
5. **Save failure or deletion followed by replay:** M0/M3 exact durable restoration and deleted-result tests; no saved-success lie or resurrection.

### 9.4 Final acceptance checklist

- [ ] Owner reviewed Phase 4 gap closure and approved Phase 5 work; all unresolved inherited gates are named.
- [ ] Capture uses only toolbar-granted `activeTab`; upload fallback works. Preview and Send are separate, accessible, explicit actions.
- [ ] No automatic screenshots/uploads, broad capture permissions, private Tinkercad integrations or editor mutations.
- [ ] Real circuit/code/requirement evidence produces bounded, grounded guidance with honest uncertainty and explicit verification steps.
- [ ] Code review is distinct from compilation/simulation; new screenshot is required for visual recheck.
- [ ] Exact accepted result/history/progress/replay/delete behavior works with two-user isolation and preserved legacy/manual data.
- [ ] Auth/storage/provider credentials and raw screenshots/full code/diagnostics stay out of host-page JS, logs, durable cache and unapproved storage. Private history retains only disclosed accepted guidance/excerpts/suggestions, minimal provenance and neutral version-2 user summaries.
- [ ] Every branch obeys zero/one generation, shared quotas/cooldowns, conservative accounting, byte bounds and end-to-end deadlines.
- [ ] Eligibility/privacy/free-only provider gates and real quality fixtures pass; no paid services enabled.
- [ ] Existing local checks, production server tests, isolated migration/security tests and actual Chrome/Tinkercad acceptance pass with recorded scope.
- [ ] Owner receives truthful release evidence and verified remote commit at phase completion. Phase 6 remains unstarted.

## 10. Risks, rollback and explicit exclusions

| Risk | Mitigation / release implication |
| --- | --- |
| Vision misreads hidden topology, colors, polarity or tiny labels | Evidence references, targeted clarification, no electrical verdict and expert fixtures. If quality cannot meet the gate, release only a narrower owner-approved capability and label Phase 5 partial. |
| Student audience or private material incompatible with provider terms | Block external AI release until eligible audience/contract/data handling is confirmed. No automatic paid/provider workaround. |
| Tiny capture race or sensitive page content | Strict tab/window/generation checks, local crop/preview and separate consent; no automatic upload. State residual non-atomic API behavior. |
| Free capacity unavailable or too small for classmates | Shared limits, one request, no retries, measured pilot size, explicit busy/cooldown UI. Never solve by rotating keys or increasing paid capacity. |
| Phase 4 report/source/deployment drift | M0 evidence gate and dated source/deployed/schema parity. Preserve history; no blind rollback or destructive reconciliation. |
| Raw screenshot or code retained accidentally | Trusted ephemeral handoff, bounded TTL, local cleanup, payload-free logs/provenance and two-user/DB assertions. Provider processing/retention disclosed separately. |
| New schema breaks old artifacts or rollback | Additive kind/version handling, actual replay of all migrations, version-1 compatibility and preserved legacy rendering. |
| Editor layout changes | Guidance refers to concepts/user-supplied evidence; verify current manual labels. No fragile internal selectors for circuit/code state. |

Rollback order: disable new AI submissions with server kill switch; disable/hide Phase 5 entry paths; restore last accepted extension/Edge release if needed while preserving original extension path/identity. Keep additive database changes, existing rows and accounting. Clear only temporary local capture material. Do not run destructive reverse SQL or remove private assignment files. Test that Auth, uploads, manual steps, mascot and preferences still work with AI disabled. Re-enable only after the failed gate is resolved and reviewed.

Deferred deliberately: continuous monitoring/video/audio, screen sharing, automatic wiring/code edits/simulation, real electrical/netlist verification, custom CV/OCR, broad component/board catalogs, local compiler sandbox, live on-canvas bounding boxes, teacher grading, paid processing, automatic translation calls, vector search, multi-agent runtime, background queues and a new dashboard. They are not needed for the defined student workflow.

## 11. AGY handoff and next approval

Read this plan and current source before execution. Report any changed baseline or conflicting instruction. Use local memory only under the AGY bridge; the document is sufficient without external-vault access. Each milestone report must state: objective met/not met, exact files/API/schema changes, tests actually run, mocked versus real results, provider attempts/usage, preserved behavior, failures/unknowns and the next approval requested.

On a failing provider/security/quality gate, stop that path, retain sanitized evidence, and investigate offline. Do not resample, widen validators, invent results, delete quotas, change models or declare success to advance the roadmap.

**Recommended first approval: M0 only — Phase 4 reconciliation and closure.** After its report, approve M1 local capture/preview, then the remaining dependent milestones. This planning session has not started implementation and does not constitute phase completion, a deployment authorization, or a completion push.

## 12. Primary-source reference index

- [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) — granting gestures and scoped permission lifetime.
- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab) — capture requirements, active-window target and call rate.
- [Chrome messaging security](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#security-considerations) — distrust content-script inputs and constrain privileged operations.
- [Chrome worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — suspension, globals and lifetime limits.
- [Chrome user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) — screenshots/website content as user data and disclosure duties. Apply before any wider distribution.
- [W3C Screen Capture](https://www.w3.org/TR/screen-capture/) — user choice and transient activation for the deferred media-stream alternative.
- [Autodesk Tinkercad getting-started guide](https://images.tinkercad.com/jl5ii4oqrdmc/1eTWASZYKjnMX9u5ioLh8Y/bb2dfb24cfc4bd66adc485baaecedf97/Tinkercad_Getting_Started_Guide_ISTE.pdf), [Circuits printable guide](https://images.tinkercad.com/jl5ii4oqrdmc/4sMFqe3rDlbUymJt0I4yh/85a4487f7fe274e74c19870ae4679fc1/tinkercad-guides_circuits-Printable.pdf) — circuit/code/simulation workflows and native code export; current labels remain a manual test.
- [Gemini API terms](https://ai.google.dev/gemini-api/terms), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) — eligibility, data use and changing account/model capacity.
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [structured output](https://ai.google.dev/gemini-api/docs/structured-output) — supported input/output mechanisms, not an accuracy guarantee.
- [Arduino UNO R3](https://docs.arduino.cc/hardware/uno-rev3/), [official pinout](https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf) — board/pin facts for bounded code advice.
- [Supabase Edge limits](https://supabase.com/docs/guides/functions/limits), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [changelog](https://supabase.com/changelog) — runtime/security constraints. Recheck relevant breaking changes before execution; recent TLS changes do not justify a new dependency or architecture for this Chrome-based plan.

Research limits: no authenticated Tinkercad UI inspection, live provider call, model benchmark, hosted database audit or billing/credential inspection was performed for this plan. No supported public live Circuits API was located in the scoped official search; that is an explicitly bounded finding. Official web tools were used because the agent-reach CLI route was unavailable; no research tooling was installed.
