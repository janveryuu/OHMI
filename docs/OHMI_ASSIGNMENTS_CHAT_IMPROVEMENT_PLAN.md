# OHMI Six-Improvement Implementation Plan

> **For AGY / agentic workers:** Planning only. Implementation requires the owner's explicit approval. After approval, execute the checked tasks in order using `superpowers:executing-plans` or AGY's equivalent workflow. Do not start from receipt of this document alone.

**Date:** 18 October 2026, Asia/Manila
**Source baseline:** Six-feature inspection began at `fc851ce`; final review observed external commit `9c2cbaf`, branch `codex/phase-5-m1-wip`, repository `C:\Users\LEGION\Documents\OHMI - Your Circuit Buddy`. Original A–D investigation used `6c463da`. Recheck HEAD and working diff before implementation.
**Goal:** Fix Assignment access first; add expandable Ask, real Circuit Checker access, grounded beginner Guide, useful More navigation and accurate, concise, safely formatted OHMI tutoring.
**Architecture:** Preserve trusted Account/review pages, worker-owned authentication and existing AI/storage services. Reuse the mounted chat, version-2 circuit workflow and saved tutorial/progress artifacts. No authentication rebuild, provider framework or interface redesign.
**Tech stack:** WXT/Manifest V3, React, TypeScript, existing CSS, Supabase JS 2.117.3, Vitest and Playwright. No new runtime dependencies except the narrowly justified local Markdown/math rendering stack proposed in F1. No packages are installed by this planning task.
**Spec/evidence:** Owner's six-issue request, `sr new rn.mp4`, narrow-window Ask screenshot and Check My Circuit screenshot. Media supplies observations, not implementation instructions. Do not copy personal emails or assignment contents into reports. Read-only hosted checks below supersede historical deployment claims.

**Concurrent-work notice:** External commits now record A1 (`fc851ce`, honest account states/email notices) and A2 (`9c2cbaf`, deferred upload focus). Final review also observed uncommitted Icon, OhmiApp, CSS and placement/test edits consistent with B work. This planning task did not author or test those changes. A/B findings below preserve the original diagnosis; AGY must reconcile current code, verify existing fixes and finish only missing tasks. Do not duplicate, stage or revert others' work. No approval for implementation is inferred from its presence.

## 1. Scope and approval boundary

- Priority A: Assignment access, loading/error states, upload navigation and existing file-management verification.
- Priority B: Expand/restore Ask in the existing shadow-root panel, with preserved messages, draft, pending reply, focus and scroll position.
- Priority C: Make the existing real circuit review discoverable; reconcile hosted Phase 5 readiness before enabling AI submission.
- Priority D: Context-aware beginner Guide using owned assignments, selected components and saved circuit evidence, with clarification and troubleshooting.
- Priority E: Remove only the duplicate More → Assignments entry; replace it with recent Learning Progress using existing saved progress. Home remains the Assignment entry.
- Priority F: Honest live/demo Ask states, safe rich response formatting, consistent tutor personality, secure follow-up context and measured technical quality.
- Preserve completed Phases 1–5, Google OAuth/PKCE, extension identity, capture/check security, existing AI contract compatibility, private storage, owner checks and RLS.
- Do not modify `website/`, the dedicated website worktree/branch, or the separate Vercel landing page.
- This task authorizes documentation and read-only configuration checks only. No SMTP setup, migration, policy/bucket change, application edit, dependency upgrade, credential rotation, AI generation, deployment or student-data mutation. Future hosted changes and live-provider evaluations need the owner's separate approval.
- The existing untracked `assets/ohmi-hero-banner.png` is unrelated. Do not stage, replace or remove it.
- Commit/push only approved implementation work under the existing project rules after verification. This draft itself is not phase-completion authorization.

## 2. Findings: confirmed causes versus unverified possibilities

### Assignment access

| Evidence | Finding and implication |
|---|---|
| Recording initially shows “Loading account…” with a login form, then “Your private workspace,” the signed-in identity and upload controls. | Session hydration completes in the recording. A permanently broken Google session is **not demonstrated**. The page initially looks signed out because its empty account state renders the login branch while loading. |
| `src/AccountPage.tsx:29–34,98–105` | The email warning renders whenever `WXT_EMAIL_DELIVERY_READY` is false, including inside an authenticated workspace. This is a confirmed misleading UI condition, not an upload permission check. |
| `src/backend/service.ts:75–78` | Email readiness gates registration/confirmation/recovery/password actions. It does not gate Google sign-in, assignment listing or file upload. SMTP is not a prerequisite for this user's Google-authenticated workflow. |
| `src/PrivateAssignments.tsx`, `service.ts:137`, `validation.ts:34–49` | Upload opens `chrome-extension://<same-extension-id>/account.html#upload`. A separate trusted page is intentional: `files.prepare`/`files.finish` and credential actions are prohibited from the Tinkercad content-script sender. Preserve that boundary. |
| `AccountPage.tsx` renders `#upload` only after account resolution and has no hash-intent handler. | The URL expresses upload intent, but code does not explicitly scroll/focus the target after asynchronous rendering/sign-in. Native initial fragment navigation alone is not a reliable handoff. |
| Ready workspace frame contains “No file chosen” and a disabled Save button. | Save is correctly disabled until a file is chosen. The recording does not show a completed file selection, upload request, storage error or failed upload response. Do not diagnose a broken uploader from this clip. |
| `useAccount.ts:13–22`; `service.ts:29–41` | Refresh errors can produce an empty UI state. Also, `currentUser()` checks absence of a session before checking `getSession().error`; a session-read failure can therefore look signed out. These are source-level classification risks, not proven causes of the recorded delay. |

**Conclusion:** Fix the confirmed notice, loading presentation and deferred upload handoff first. Keep working Google authentication. Investigate an actual session/storage failure only if controlled reproduction supplies evidence.

### Expandable chat

- `src/placement.ts` caps compact panel size at 360×520 CSS px and can shrink its height further to fit around the mascot. There is no expanded mode.
- `src/ohmi.css:107,156–170` combines a scrolling panel body, a chat layout with a 260px minimum, a separately scrolling message log and a resizable composer. History adds up to another 140px. This explains the cramped, nested-scroll layout visible in the screenshot.
- `AssistantPanel.tsx` owns draft, messages, attachment state, conversation ID/history and pending reply. `OhmiApp.tsx` mounts one `AssistantPanel`, keyed by account ID. That account boundary must remain; a size-dependent key or second panel would lose state.
- The existing message effect at `AssistantPanel.tsx:141–143` forces the log to the bottom whenever messages/pending/section change. Expanded chat also needs explicit reading-anchor preservation and conditional auto-scroll.
- `docs/PROJECT_CONTEXT.md` still describes Phase 5 M1, but current source, commit history and `PHASE_5_VERIFICATION_REPORT.md` record M0–M5 completion. Treat the context summary as stale; do not roll back later milestones. Historical verification claims were not rerun in this planning task.

### Circuit Checker and Guide

The checker has two separate problems: a misleading legacy sample card and a confirmed hosted function that lacks local Phase 5 support. Assignment requirements also need an explicit analysis reference. Guide defaults to static samples and does not expose its existing component/clarification data. Detailed evidence and tasks are in C0 and D0 below; no new AI backend is needed.

## 3. Current architecture to keep

```text
Tinkercad editor → isolated shadow-root OhmiApp / AssistantPanel
                         │ validated runtime messages
                         ▼
             background.ts → backend/service.ts
                         │
          one persisted Supabase client in the worker
                         │
             Auth + owner-scoped DB/private Storage

Upload action → extension-owned account.html#upload
              → same worker/session → files.prepare
              → trusted-page XHR → files.finish verification
              → account.changed → existing views refresh
```

- `backend/client.ts` stores Auth under `ohmi-auth` in extension storage. Initialization restricts local/session storage to `TRUSTED_CONTEXTS`.
- Google OAuth uses `chrome.identity.launchWebAuthFlow`, registered callback/extension-ID validation and worker-side PKCE exchange. Do not create an Account-page Supabase client or another login store.
- `files.prepare` returns upload authorization only to the trusted Account sender. Do not move that response, access tokens or direct authenticated uploads into the host page/content script.
- Keep 10 MiB PDF/PNG/JPEG checks, signature validation, UUID paths, pending→ready verification, abort/sequence handling and account-change guards.
- Keep private bucket `ohmi-assignments`, owner-scoped metadata/policies, 60-second signed file-open URLs and storage-first deletion ordering. No policy change is indicated.
- Real analysis stays `check.html` → validated `ai.circuit` → authenticated worker → `ohmi-ai` V2 → owner-scoped artifacts/progress. Toolbar capture stays local until explicit preview/send. Guide reuses V1 tutorial and saved V2 corrective steps as distinct artifact kinds.

## 4. Review focus

1. Cold worker or slow session hydration must not imply the Google user signed out. Assignment Task A1 covers this.
2. Upload intent must survive loading/sign-in, but must not steal focus on later refreshes. Task A2 covers this.
3. Account switching or request failure during upload must not leak credentials or finish an upload under another account. Task A3 covers this.
4. Changing chat size while reading or awaiting a reply must not reset state, duplicate requests or force a scroll jump. Tasks B1–B2 cover this.
5. Short visual viewports, keyboard/zoom changes and reduced motion must retain usable controls without changing other sections. Task B3 covers this.
6. A valid UI cannot compensate for an incompatible deployed handler or disabled/unqualified provider. C0/C2 and section 9 cover readiness.
7. Specific beginner instructions require actual requirements, confirmed components and readable evidence. D1–D3 cover context, missing facts and durable progress.

## 5. File map

| File | Intended responsibility/change |
|---|---|
| `src/AccountPage.tsx` | Correct initial/loading/error/authenticated branches; scoped email notice; deferred upload intent and focus. Keep uploader here. |
| `src/PrivateAssignments.tsx` | Briefly explain the trusted-workspace handoff and keep existing upload/open/delete actions. |
| `src/backend/service.ts` | Narrow `currentUser()` error-order correction only; preserve OAuth and upload implementation. |
| `src/useAccount.ts` | Inspect/reuse existing refresh sequencing and listeners. No redesign or session cache is required; change only if a reproducing test demands it. |
| `src/OhmiApp.tsx` | Own ephemeral `chatExpanded`, choose panel geometry and handle restore/minimize/Escape. |
| `src/AssistantPanel.tsx` | Expand/restore control, exit notification, stable chat DOM and scroll-anchor behavior. |
| `src/placement.ts`, `src/placement.test.ts` | Add/test expanded geometry without changing existing compact helper behavior. |
| `src/ohmi.css`, `src/Icon.tsx` | Scoped chat flex/overflow rules, existing-style maximize/restore icons and restrained size transition. |
| `src/account.css` | Only target focus/scroll-margin or narrow-layout corrections if necessary. Preserve current visual identity. |
| `tests/assignments-chat.mjs` (new), `tests/browser.mjs` | Add synthetic extension-page/overlay cases to the existing browser runner. |
| `tests/phase3.mjs`, `tests/account-privacy.mjs`, `src/backend/service.test.ts` | Update notice expectations and cover auth/error/owner boundaries. |

Additional C/D/E/F files and narrow contract changes are specified in sections 8–12. No schema migration is indicated. Preserve build identity, manifest permissions, capture security and all landing-page files. F1 may require narrowly scoped packaged font assets to be accessible to the extension's shadow UI; do not expand host permissions or expose unrelated files.

## 6. Assignment implementation — complete first

### A1. Render honest account states

**Interfaces retained:** `useAccount()` and `AccountState`; `request('account.state')`; existing Google action and email-workflow guards.

- [ ] Add failing browser cases with delayed synthetic `account.state`: an existing Google-authenticated account eventually resolves without another login action. During initial unresolved loading show only neutral “Loading your OHMI workspace…” and a status indicator, not the login form or SMTP notice.
- [ ] Distinguish these states in `AccountPage`: initial loading; unconfigured backend; request unavailable/error with Retry; confirmed signed out; authenticated workspace. Use existing `loading`, `error`, `configured` and `user` values rather than adding a second Auth system.
- [ ] If an already known user is refreshing, keep the existing workspace/file-input DOM mounted with `aria-busy` and disabled conflicting actions. Do not erase selected files or steal focus merely because `loading` changes. Existing account-ID changes must still abort/clear private input.
- [ ] Render the email limitation only in the resolved signed-out login area. Suggested copy: “Continue with Google. Email registration and password recovery are not available yet.” No SMTP warning in the authenticated workspace. Hide the unavailable Reset password control there while email delivery is disabled; retain sign out/profile management.
- [ ] Update `tests/phase3.mjs` to expect the scoped signed-out notice. Update `tests/account-privacy.mjs` to expect no signed-in email notice or unavailable Reset password button when email delivery is off; keep its same-account preservation and A/B/sign-out clearing assertions. Existing confirmed-account password sign-in must remain available.
- [ ] In `currentUser()`, propagate `getSession().error` before interpreting an absent session as signed out. Preserve the existing verified-user check and genuine unauthorized-session clearing. Add a unit test: session read error rejects; true absent session returns signed-out state. Do not change token refresh strategy or add polling.
- [ ] Keep error UI distinct from “you are signed out.” Preserve the current security-clearing behavior on identity uncertainty; do not add a stale private-data cache to retain drafts through auth failures.
- [ ] Run the focused unit/browser tests; confirm existing email workflow restrictions still pass. Commit this independently reviewable fix after approval.

### A2. Honor Upload Assignment intent after hydration

**Interface retained:** `request('account.open', { view: 'upload' })` and allowlisted `#upload`.

- [ ] Add tests for an already authenticated user and a genuinely signed-out user following `account.html#upload`. Both must reach the same trusted uploader once authentication resolves.
- [ ] Track a pending upload intent in `AccountPage` from the initial allowlisted hash and subsequent `hashchange` events. After `user` exists, loading ends and the upload input is mounted, scroll the upload section into view and focus its input with `preventScroll` after that scroll.
- [ ] Consume the intent once per navigation. Preserve it while waiting for Google sign-in; do not refocus after list refresh, profile edits, window-focus refreshes or upload completion. Do not accept arbitrary URL destinations.
- [ ] Keep native file selection an explicit user action. Do not programmatically open a picker from a background message. The flow is: Upload Assignment → private workspace at uploader → Choose File → Save private assignment.
- [ ] Add short overlay helper text explaining that upload opens a private OHMI workspace. Inside that workspace, reuse one scroll/focus handler for its secondary Upload assignment button instead of opening another tab.
- [ ] Keep `account.open` behavior and sender allowlist intact; no tab-reuse subsystem or new permission is needed. Verify late-mounted hash targeting at desktop and narrow window sizes; commit the handoff fix.

### A3. Verify existing upload, view and management end to end

- [ ] In the synthetic browser harness, intercept extension messages and mock upload HTTP locally. Do not call a real AI provider or write hosted student data. Assert ready metadata, progress, list refresh, file-open action and confirmed deletion.
- [ ] Cover: picker cancellation; no file chosen; valid PDF/PNG/JPEG; >10 MiB; mismatched signature; prepare failure; failed/timeout/aborted XHR; finish verification failure; failed cleanup. Save must remain disabled until a valid selection and current account are available.
- [ ] Verify same-account focus/refresh retains selected input; an actual account change aborts and clears it. Existing upload sequence/accountId checks remain authoritative. Keep pending/failed-item recovery visible and actionable.
- [ ] Assert completion reaches the overlay via the existing `account.changed` refresh path; do not add host-page token transport or polling. A storage error must show a retry/error, not an empty-success assignment list.
- [ ] Retain sender tests: editor cannot call `auth.*`, `files.prepare` or `files.finish`; forged/foreign sender and stale account IDs are rejected. Keep owned signed URLs and private bucket/RLS unchanged.
- [ ] After implementation approval, perform a supervised Google-account smoke test: upload a disposable owner-approved fixture, return to overlay, open it, view saved steps, delete that fixture, sign out/in and restart the worker. Verify a second test account cannot access the first account's records. If hosted failure requires configuration or DB work, stop with sanitized evidence and request separate approval.

**Assignment gate:** No misleading login/SMTP state for the authenticated user; one clear uploader handoff; verified upload/open/delete/refresh and isolation; no SMTP or schema change. Resolve this gate before implementing chat expansion.

## 7. Expandable Ask implementation

### B1. One panel, two presentation sizes

**New local interfaces:** `chatExpanded: boolean` in `OhmiApp`; `chatExpanded` and `onChatExpandedChange(value: boolean): void` props on `AssistantPanel`; `expandedChatRect(viewport: Viewport): { x: number; y: number; width: number; height: number }` in `placement.ts`.

- [ ] Add failing tests for expanding/restoring, including DOM identity and absence of any send/history/network action solely because size changed.
- [ ] Add a 44×44 header button in Ask using `Icon`, labeled/titled “Expand chat” or “Restore chat size.” Retain the existing separate “Minimize OHMI” button, which collapses the whole assistant to its mascot.
- [ ] Compute expanded width `min(960, availableWidth - 24)` and height `min(800, availableHeight - 24)`, centered in the available viewport. Clamp dimensions at zero for pathological sizes. At normal small widths this naturally becomes a near-full-window panel with 12px margins.
- [ ] For expanded mode use the visual viewport's width/height and offsets when available, with a layout-viewport fallback. Listen to its resize/scroll events for keyboard, browser chrome and zoom changes. Convert offsets consistently to the root's coordinate space; keep compact placement helpers and saved mascot position unchanged.
- [ ] Keep one `AssistantPanel` and the same message log/textarea nodes mounted. Do not key by size, move chat into a portal/new tab, conditionally swap components, lift conversation data out of the account-keyed boundary, or use browser fullscreen.
- [ ] `navigate(next)` restores compact size when leaving Ask. Whole-panel minimize also restores compact size for reopening, without discarding the current chat/draft. Genuine account-ID changes reset expansion and preserve existing private-state reset behavior. The size boolean is ephemeral, not persisted.
- [ ] Raise only the expanded panel above the mascot so the mascot cannot obscure messages/controls. Keep the dialog nonmodal (`aria-modal="false"`), existing host event isolation and no global page scroll lock/inert changes.
- [ ] Test expand/restore at 1366×768 and 1280×800: substantially larger than compact; restore to the existing computed compact rectangle. Account changes still remount by account ID. Commit after focused tests pass.

### B2. Reading, composer and scroll continuity

- [ ] Replace the chat layout's 260px minimum with `min-height:0` in the constrained flex chain. In normal-height Ask, header/toolbar/composer/navigation remain available; the message log receives remaining height and is the primary reading scroller. Scope CSS to Ask so Assignment, Guide and Check layouts do not change.
- [ ] Bound the optional history list with its own small maximum height and shrink allowance; it must not squeeze the message log into the thin strip shown in the screenshot. Wrap toolbar controls at narrow widths. Long prose wraps; code blocks may scroll horizontally inside the bubble without widening the panel.
- [ ] Keep the existing controlled textarea and draft state. Preserve selection/caret and its node across toggles. Constrain manual textarea height to available space. At extremely short visual heights where all controls cannot fit, permit one outer content scroller so controls remain reachable rather than clipping or hiding them.
- [ ] Add a local scroll snapshot ref: pinned-to-bottom when distance to bottom ≤48px; otherwise first visible stable message ID plus its pixel offset in the log (with clamped `scrollTop` fallback). Mark message elements with their existing stable IDs; do not generate new IDs for resizing.
- [ ] Capture before a size change and restore after layout in `useLayoutEffect`. A bottom-pinned user stays at the bottom; a user reading older messages keeps the same visible message/offset despite rewrapping. Apply the same rule on log resize/keyboard changes using one local observer, cleaned up on unmount; avoid a permanent animation loop.
- [ ] Replace unconditional bottom scrolling: own send or deliberate conversation-open may go to latest; an incoming reply only auto-scrolls when already near the bottom. History open/close and size changes preserve the reading anchor. Do not move focus into the log or announce the entire history again on resizing.
- [ ] Verify toggles with history open, a multiline unsent draft, sample attachment, many long messages, code blocks and a pending mocked AI reply. Message IDs/count, conversation ID, draft and pending operation remain unchanged; reply arrives once in the same conversation. Sign-out/account switch still clears the old account's private state.

### B3. Motion, accessibility and responsive polish

- [ ] Animate size changes on the existing panel using a bounded FLIP transform: measure current rectangle, apply final geometry, animate the inverse translate/scale to identity over 240ms with `cubic-bezier(.16,1,.3,1)`. Do not animate every descendant, interpolate layout on each frame or add a motion package.
- [ ] Cancel/replace an in-flight size animation on rapid toggle, viewport change, minimize or section exit; leave the final geometry correct. Do not let animation fill/styles override the existing panel open/close transform. Resize/keyboard corrections should snap to valid bounds rather than chase the viewport.
- [ ] Under `prefers-reduced-motion` or OHMI Animations Off, apply final geometry immediately with full functionality. Keep original colors, typography, mascot asset, shadow/radius tokens and navigation.
- [ ] The size button exposes `aria-expanded` and `aria-controls="ohmi-panel"`; its label changes with state, and keyboard focus stays on that same button. Enter/Space activate it. No focus trap for this nonmodal panel.
- [ ] Escape order: close the More menu first (existing behavior); otherwise restore an expanded chat; otherwise minimize the compact assistant. Do not interfere with IME composition. Existing minimize/open focus restoration and host-keyboard isolation remain intact.
- [ ] Test 320×600, 390×844, 634×1030 (screenshot-like), 768×1024, 1024×768, 1366×768 and a large desktop; also short 320×400, landscape, 125/150/200% browser zoom and a simulated shrinking visual viewport. No horizontal page overflow, unreachable controls, mascot obstruction or lost text. Verify mouse, touch and keyboard paths plus reduced motion.
- [ ] Capture compact/expanded/restored screenshots and a short resize demonstration. Inspect transitions in real Chrome; state assertions alone do not establish visual quality. Commit after verification.

## 8. Circuit Checker findings and implementation — Milestone C

### C0. Confirmed causes and hosted readiness

| Evidence checked 18 October 2026 | Finding / required action after approval |
|---|---|
| `AssistantPanel.tsx:638–684`, shared `UploadPreview`, `unavailable()` and footer | Check already contains **Open Circuit Review**, followed by the old disabled sample uploader. Screenshot shows that lower sample card. Global copy still says AI features are samples. This creates two contradictory experiences. Make the real action primary and the sample explicitly secondary. An absent primary action in the owner's installed build would also indicate build drift; screenshot alone cannot establish which build is installed. |
| `CircuitReviewPage.tsx`, `entrypoints/check/`, `backend/service.ts`, `backend/validation.ts`, `capture.ts` | Trusted `check.html` already supports upload/preview, optional detail image, board, code, simulation text, requirements, real V2 request, follow-up, saved checks and progress. Reuse it; do not build another checker inside the overlay. `ai.circuit` remains restricted to the trusted review sender. |
| Hosted project `vhmdgfydvoljzqztuxmu`; `ohmi-ai` ACTIVE, version **13**, JWT verification enabled | Retrieved deployed source accepts only `chat`, `image`, `pdf`, `tutorial`. It has no `circuit_check`, no V2 dispatcher/`circuit.ts` module and no `OHMI_AI_ENABLED` gate. Local `index.ts` delegates to `handler.ts`, which has those Phase 5 features. **Confirmed hosted/source mismatch: the local V2 interface cannot obtain Phase 5 processing from this deployed handler.** ACTIVE does not mean compatible. |
| Hosted migration history versus all local migration filenames | All **13 versions** match, including `20261016170000_ohmi_phase5_circuit_check_artifacts`. Do not reapply them or create a duplicate migration. This is version-history parity, not a full function-body/schema equivalence proof. |
| Hosted catalog, without student-table reads | All nine `ohmi_*` tables have RLS enabled. Reserve/complete/fail/backoff and tutorial progress routines exist. Private `ohmi-assignments` bucket is nonpublic, capped at 10,485,760 bytes, PDF/PNG/JPEG. Inspect policy/routine definitions and grants if any end-to-end test fails; do not relax RLS. |
| Hosted secret **names** only | `GEMINI_API_KEY` and historical free-tier flags exist; `OHMI_AI_ENABLED` is absent. Presence does not verify key validity, billing, quota or eligibility. The current local handler intentionally returns 503 unless `OHMI_AI_ENABLED` equals `true`. Deploying local code alone will therefore remain disabled, safely. Old Groq secret names are not a reason to add another provider or delete/rotate secrets. |
| Authentication | Current source retains Google PKCE and authoritative worker/server identity checks; the prior recording reaches a signed-in workspace. Hosted Google provider/redirect settings and the owner's present token were not reauthenticated here. Verify them through the existing flow after approval; no evidence supports rebuilding OAuth or adding SMTP. |
| `CircuitReviewPage.tsx:443–448`; `handler.ts:796–835` | Selecting an assignment sends `assignmentId` only. Server uses it for ownership/linkage; actual requirement loading depends on `assignmentAnalysisId` or manual `requirementText`. The selected file's requirements currently do **not** automatically reach V2. Wire an explicitly selected owned requirement analysis; never treat an ID/filename as assignment content. |
| `handler.ts` and Phase 4/5 reports | Existing server uses one model, `gemini-3.5-flash-lite`. Historical reports are not evidence of current deployment, successful live analysis or circuit accuracy. No live generation was performed for this plan. |

### C1. One clear entry, existing secure workflow

- [ ] First reproduce with the loaded extension ID, installed directory and current source revision recorded without private values. Reload the correct unpacked build and refresh Tinkercad before judging a missing control. Do not change manifest identity or OAuth callback to fix stale UI.
- [ ] At the top of More → Check My Circuit, use the existing `circuit.open` action for **Upload circuit screenshot** / **Open Circuit Review**. Explain that the private review opens in an OHMI tab. Keep the original layout tokens, colors and mascot; this is a functional content/control correction.
- [ ] Keep sample notes available under a clearly labeled secondary “Try a sample” control. Remove the dead “Analyze file — unavailable” control from the *real circuit path*. Do not globally enable the shared Assignment sample component or falsely claim a sample was analyzed.
- [ ] Replace unconditional “AI features remain samples” and `unavailable()` copy where it mislabels live features. Distinguish sample, sign-in required, provider disabled/unavailable, quota/cooldown, network error and active review. Do not derive availability solely from presence of a Supabase URL or key.
- [ ] Explain toolbar capture using the existing extension action/`activeTab` workflow. An injected button may open instructions/review; it must not silently capture or gain new broad permissions. Keep hide/restore handshake, tab/window checks, TTL, review-tab-bound claim and cancel cleanup. Capture/upload/crop alone must make **zero AI requests**.
- [ ] Reuse local preview, replace/remove, crop and optional detail image in `CircuitReviewPage`. Send only after the student reviews the final image and explicitly chooses analysis. Keep image limits, signature checks, bounded requests, sender validation and account checks on both sides. No raw capture, signed URL or token in host DOM, URL, logs or content-script storage.
- [ ] For a selected assignment, list its owned requirement-analysis artifacts using existing analysis services. Pass the selected `assignmentAnalysisId` with `assignmentId`. If none exists, offer the existing assignment-analysis action or explicitly entered requirements; do not launch analysis automatically. Show “requirements not supplied” when proceeding with visual review only. Reject mismatched owners/assignment IDs server-side.
- [ ] Keep immutable request UUID/snapshot, duplicate-send lock, request-status reconciliation, conversation linkage and saved review reopening. Show specific recoverable errors without creating retry storms or starting another billed request on every reconnect.

### C2. Hosted reconciliation — a later, separately approved action

- [ ] Before deployment, compare the local function's entire import bundle and required RPC signatures/policies with hosted definitions read-only. Preserve JWT verification and server-side `getUser`/ownership checks. Do not disable verification to bypass a 401; trace token/gateway compatibility with the current Supabase guidance.
- [ ] Run local actual-handler tests for both V1 operations and V2, including kill switch, auth, quota/admission, replay, evidence and malformed inputs. Confirm legacy Ask/assignment/tutorial behavior remains compatible.
- [ ] Present the owner a concrete release manifest: commit, function files, migration parity, model ID, provider eligibility evidence, usage limits, rollback strategy and whether AI remains disabled. No new migration is expected; any genuine schema drift becomes a separately reviewed change.
- [ ] Only after hosted approval, deploy the existing Phase 5 function bundle. Keep the switch disabled until provider/audience/cost gates in section 9 pass. Setting `OHMI_AI_ENABLED=true` is an explicit enablement decision, not an incidental deployment step. Never turn on billing to make a smoke test succeed.
- [ ] Perform a separately approved, bounded live smoke test using a disposable account and synthetic/nonpersonal circuit. Verify V1 Ask/tutorial plus V2 result, artifact/history/progress, expired auth and quota failure. Record sanitized status/model/revision and token usage only. A mocked response or HTTP 200 without a validated V2 artifact is insufficient.

**C acceptance:** The real route is visible at narrow sizes, upload and approved toolbar capture reach the same trusted review, preview/cancel do not transmit, and one deliberate send produces one validated saved result when service gates permit. Missing readiness produces a truthful actionable state. The host page remains unable to invoke `ai.circuit`, claim another tab's capture or access upload authorization. Never assert electrical correctness, successful compilation or live simulation from an image.

## 9. Single-provider qualification and decision gate

**Latest candidate scope:** The owner selected `qwen3.8-flash` and `qwen3.8-max` for Singapore evaluation. Follow the separate [Qwen evaluation plan](OHMI_QWEN_EVALUATION_PLAN.md), including exposed-credential replacement, student/privacy eligibility and free-only billing gates. Its controlled comparison replaces the generic alternative-provider evaluation for this decision; do not run duplicate benchmarks. The older provider table below remains dated background, not authorization to switch models. Gemini and production behavior remain unchanged pending owner approval.

### Verified public options, not account-level qualification

Checked official documentation on **18 October 2026**. Prices are USD per one million tokens, standard inference, without caching or batch discounts. Image tokenization, thinking, region and output length affect actual cost. Public model documentation does not prove access in this account or accuracy on OHMI circuits.

| Candidate | Verified image capability and indicative API price | Privacy / eligibility and decision |
|---|---|---|
| Existing Google `gemini-3.5-flash-lite` | Official pricing lists image input, $0.30 input / $2.50 output, and free quota. Existing OHMI integration and strict result validators already use it. [Pricing](https://ai.google.dev/gemini-api/docs/pricing), [image understanding](https://ai.google.dev/gemini-api/docs/image-understanding). | Unpaid content may be used for product improvement/human review; personal, sensitive or confidential content is restricted. Developer API terms exclude clients directed toward or likely accessed by under-18s. Paid access does not remove that audience restriction. Retain only if intended audience, submitted data, actual account access and quality qualify; otherwise keep service disabled pending an approved alternative. [API terms](https://ai.google.dev/gemini-api/terms). |
| Alibaba Model Studio `qwen3-vl-plus` | Visual model, not generic text-only Qwen. Singapore/International row at ≤32K input: $0.20 input / $1.60 output; time-limited free quota is not a permanent free service. [Pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing). | Official FAQ says customer data is not used for training. Default prompts/responses retained up to 30 days, with stated exceptions; ZDR is an enterprise option, not an assumed default. Account region, cross-border processing, age terms and school/data permissions still need review. [FAQ](https://www.alibabacloud.com/help/en/model-studio/faq-about-alibaba-cloud-model-studio), [retention](https://www.alibabacloud.com/help/en/model-studio/data-retention-policy). Candidate only. |
| DeepSeek `deepseek-flash` | Current public docs map alias to **DeepSeek-V4.1-Flash-1017** and support image input. Peak cache-miss $0.30 input / $1.20 output; off-peak $0.15 / $0.60. Pro row lacks vision. Older claims that all DeepSeek APIs are text-only are outdated. [Vision](https://api-docs.deepseek.com/guides/vision/), [pricing](https://api-docs.deepseek.com/quick_start/pricing/). | Public policy includes model-improvement uses; exact applicable API data terms, retention, opt-out, region and student/audience eligibility require confirmation. Do not infer no-training from open weights or a low price. [Open Platform terms](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html), [privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html). Candidate only. |
| Z.ai `glm-4.6v` / `glm-4.6v-flash` | Official vision pricing: 4.6V $0.30 input / $0.90 output; 4.6V-Flash listed free. Confirm the exact model's account access/limits; free text-only GLM models are not substitutes for vision. [Vision guide](https://docs.z.ai/guides/vlm/glm-4.6v), [pricing](https://docs.z.ai/guides/overview/pricing). | API DPA differs from consumer chat policy: processing on customer instructions, generally Singapore, and states API content is not stored. Confirm that DPA applies to the chosen endpoint/free tier, image handling, permitted audience and this account. Do not promise universal zero retention from the consumer policy. [API DPA](https://docs.z.ai/legal-agreement/privacy-policy#data-processing-addendum-for-api-services). Candidate only. |

**Recommendation:** Keep one Gemini integration if it passes the existing Phase 5 audience/privacy/quality gates. If it fails, review **one** suitable vision alternative with the owner, then replace only the server transport and corresponding configuration/accounting metadata. Do not add routing, automatic fallback, multiple provider keys, self-hosting or a model picker. No alternative is approved or accuracy-qualified by this document. An under-18 audience requires resolving the existing Gemini gate before release; a consent checkbox is not a substitute for provider eligibility.

For illustration only, 2,000 billed input tokens and 1,000 output tokens cost about $0.00310 Gemini, $0.00200 Qwen, $0.00180 DeepSeek at peak and $0.00150 GLM-4.6V. These are arithmetic examples, **not** observed circuit-request prices; image tokens and thinking must be included in real measurements. Recheck prices before approval. Free Hobby website hosting does not supply free AI inference.

### Qualification required before real student use

- [ ] Record intended student age range, applicable API terms/DPA, data categories, region/retention, permitted processing and the account's actual free/billing/limit state. Store no secrets. Do not collect birthdates or add identity systems as an incidental fix; owner must decide eligible product audience/service arrangement.
- [ ] Confirm model metadata/access and then, only with separate approval, run a small capped generation evaluation. Stop on quota/backoff; no automatic provider failover or paid upgrade. Secret-name presence and public pricing alone do not pass this gate.
- [ ] Reuse `tests/phase5-eval.test.ts` fixtures/rubric and supplement with independently labeled synthetic images: LED polarity/missing resistor, power/ground errors, ambiguous breadboard rails, tiny unreadable pins, conflicting assignment, code/pin mismatch, simulation warning and insufficient evidence. Include English, Filipino and Taglish. Separate schema correctness from technical correctness.
- [ ] A knowledgeable reviewer checks all stated connections against the fixture's ground truth. Gate: all outputs validate, zero invented exact coordinates/values or claims of electrical verification, all deliberately unreadable/ambiguous cases request clarification or state uncertainty, and ≥90% of labeled observable findings are correct across the agreed fixture set. Report false positives and missed critical issues explicitly; any unsafe instruction blocks release regardless of average score. Repeated runs are needed to assess variance; a tiny benchmark is not general accuracy proof.
- [ ] Measure latency, actual billed image/text/thinking tokens, cost per result, tri-language comprehensibility and error behavior under OHMI's existing timeout/body/quota limits. If no provider meets eligibility, quality and cost constraints, leave AI disabled and retain honest samples/private assignments while escalating the decision.

## 10. Beginner Guide — Milestone D and delivery order

### D0. Confirmed gaps

- `AssistantPanel.tsx:626` defaults to five static `GUIDE_STEPS` from `preview.ts`. These are demonstrations, not the student's assignment or observed circuit.
- `openTutorialGuide()` already loads saved tutorials or calls `ai.chat` with `operation: 'tutorial'` and an owned assignment ID. The server retrieves original image/PDF content. Reuse this foundation.
- Existing `TutorialResult` includes objective, component list, `clarificationQuestions`, notes and steps. The overlay mainly keeps title/steps; clarification becomes a generic notice rather than an answerable interaction. Component names/quantities and source references are not surfaced in the current step presentation.
- There is no structured student component selection or circuit-review reference in the V1 tutorial request. Merely changing its prompt cannot supply missing visual evidence. The V2 checker also needs the assignment requirement handoff described in C1.
- `followCheckSteps()` already reuses saved circuit result steps and progress. Circuit corrective steps and tutorial steps both have `instruction`, `why`, `check`; there is **no confirmed field-name mismatch**. Circuit steps are limited to eight and address findings, while assembly tutorials allow 24. Do not relabel repair steps as a complete assembly tutorial or loosen V2 limits to generate one.
- Saved-artifact selection currently accepts `artifact_kind === 'tutorial'` **or any payload with steps**. That can select a circuit check as if it were an assignment tutorial. Filter by explicit artifact kind and validate payload; keep the two routes clearly identified.
- Tutorial provider output is capped at 2,048 tokens, with 24-second server timeout and 64 KiB response limit. Detailed 24-step instructions may truncate; this is a capacity risk, not a reproduced provider failure. Existing `MAX_TOKENS` handling rejects truncation; preserve it.

### D1. Bind Guide to the student's chosen work

- [ ] Keep existing sample guide available and explicitly labeled. Add a compact **Choose assignment / Continue saved guide / Use saved circuit review** entry using existing controls, not another dashboard. Manual `AssignmentSteps` checklists remain independent of AI tutorial progress.
- [ ] Store active guide identity/kind, assignment ID, optional circuit analysis ID, language, confirmed component choices and clarification draft in the existing account-keyed panel state. Show the current context and allow deliberate change; discard stale responses after account/context switch using existing request sequencing patterns. Do not persist raw images or signed URLs in preferences.
- [ ] Display the existing generated component checklist: name, quantity, confirmed value/rating and simple identification notes. Ask students to confirm what they have and enter corrections with existing form controls. Distinguish required components from the student's available/selected ones; do not silently substitute values or boards.
- [ ] Use existing V1 `message`/bounded `context` for selected-component text, current question and clarification answers. Respect the 2,000-character message limit with validation; do not silently truncate critical values. Add just one optional tutorial request reference, `circuitAnalysisId`, if linking a prior check is needed. Validate UUID, operation, owner and assignment linkage in runtime validation, worker forwarding and server retrieval. Do not accept client-supplied analysis payload as trusted context.
- [ ] Server loads the referenced owned `circuit_check` artifact and builds a bounded summary of observations, finding IDs and uncertainties. A saved result is prior model feedback, not fresh image evidence; label it accordingly. Actual image reinspection/new screenshots must use the existing trusted review page and explicit send. Keep tokens/privileged reads server-side and reuse current admission/accounting order.
- [ ] Reuse existing tutorial artifact persistence and `progress.get/save`. Select only valid `tutorial` artifacts matching the chosen context/language; handle old artifacts without new metadata gracefully. Generation/refinement creates a new artifact instead of overwriting completed steps or copying completion indexes onto different instructions. Resume progress by stable analysis ID; clamp invalid stored step indexes. No schema migration by default: use existing JSON payload metadata if required.

### D2. Grounded beginner content, not a longer generic answer

- [ ] Update the existing tutorial prompt in the actual `ohmi-ai/handler.ts`; do not create another generation service. Keep schema, component list, ordered `instruction`/`why`/`check`, notes and `needs_clarification` outcome. Make each step one manageable action with a visible checkpoint.
- [ ] Sequence: identify/gather parts; locate component by its confirmed Tinkercad search name; place and orient; wire one connection at a time; check power/polarity/values; compare code pins if supplied; run simulation manually; inspect the reported outcome; troubleshoot one evidenced issue at a time. Do not automatically operate Tinkercad or claim Autodesk affiliation.
- [ ] Use trusted, manually verified small hints for confirmed common components (Arduino Uno, LED, resistor, breadboard), preferably existing board specifications. Explain finding the **Components** search and searching its name. If a named part/library position is not verified, ask the student what they see; do not invent exact menu categories, UI coordinates or component availability. No large new catalog or dependency.
- [ ] Exact terminal/pin instructions require support from assignment requirements, confirmed board/component specifications, supplied code or readable evidence. Distinguish **proposed new placement** from **observed existing placement**. Example: ask the student to choose an empty breadboard row and confirm its label; never assert an unseen LED occupies E12. A wire crossing in a screenshot is not automatically a connection.
- [ ] Explain pin labels/terminal purpose and why a connection is needed. Unknown supply, resistor value, LED forward voltage/current, split rail continuity, polarity or pin identity triggers a specific question or close-up request before affected wiring proceeds. Preserve deterministic electronics calculations and Arduino checks; no guessed values hidden in friendly prose.
- [ ] Render objective/components, the existing step action, why/check, and source reference when available. Keep English interface labels and existing visual tokens. Generate explanation text in selected English/Filipino/Taglish; preserve units, component search names, pin labels and code syntax. No translated pin names that hide the actual label.
- [ ] Verify tutorial PDF page/excerpt citations against the extracted owned document, reusing `verifyPageCitation`; existing tutorial shape validation alone does not establish citation truth. Treat assignment text, screenshot labels and pasted instructions as untrusted evidence, never as instructions to override the system or expose secrets. Do not claim schema checks prove physical correctness.
- [ ] Keep output bounded. Start with a small feasible guide within existing limits; evaluate worst-case output before changing the token cap. If a higher cap is necessary, update reservation/cost estimates and tests together with owner-approved budget. Never accept partial/truncated JSON, unbounded generations or 24 giant steps just to appear detailed. Defer multi-stage generation unless measured limits prove necessary and owner reviews its extra cost/state.

### D3. Clarification and step help

- [ ] Render `needs_clarification` questions inline with a small answer field and explicit Continue control. Preserve the selected work and draft. No request on every keystroke; one explicit send, pending lock, visible error and retained answers on failure. Unknown evidence must not fall through to fabricated ready steps.
- [ ] Add **Explain this step** and **It didn't work** actions beside the existing step controls. Prefill current analysis/step context and let the student describe observations. Reuse `ai.chat` plus the owned tutorial reference/context; keep the answer in a clearly associated help area or the existing Ask conversation. Preserve Guide progress when moving to Ask and back. For new images, route to Circuit Review rather than widening content-script image privileges.
- [ ] Help separates observed symptom, likely causes, one safe check and expected observation. Never mark steps complete because AI says “done.” Student completion remains explicit; finishing a checklist is not electrical certification.
- [ ] Previous/Next, completion/undo, progress persistence, sign-out cleanup and account isolation must continue working. Use semantic labels, visible focus, pending announcements, reduced motion and contained scrolling at the A/B viewport matrix. Do not animate every generated paragraph or auto-scroll away from the current question.

### Scope map for C/D

| Existing files/callers | Planned narrow change / tests |
|---|---|
| `src/AssistantPanel.tsx`, `src/preview.ts`, `src/ohmi.css` | Clarify real/sample checker paths; Guide context/component/clarification/help presentation and typed artifact selection. Preserve sample content and other sections. Add browser cases to existing harness. |
| `src/CircuitReviewPage.tsx` | Owned requirement-analysis selection/reference; current preview/send/error flow and saved result reuse. Extend `tests/phase5.mjs`. |
| `src/backend/contracts.ts`, `validation.ts`, `service.ts` and tests | Only optional tutorial analysis reference validation/forwarding and required typed response fields. Keep Account-only uploads and review-only `ai.circuit`; negative sender/owner tests mandatory. |
| `supabase/functions/ohmi-ai/handler.ts`, `tutorial.ts`, `circuit.ts`, `pdf.ts`; mirrored `src/ai` validators/tests | Beginner prompt, bounded owned context, citation checks, unchanged V2 evidence discipline. Update both contract copies only where needed; test actual handler, not only transport helpers. Include malformed/old fixtures. |
| `tests/phase5-eval.test.ts`, tutorial/handler tests, browser fixture handlers | Add grounded beginner, clarification, tri-language, artifact-kind and requirement-reference cases. Synthetic fixtures must intercept requests and never reach a live provider. |
| `docs/PHASE_5_VERIFICATION_REPORT.md`, setup documentation / `.env.example` if needed | After approved implementation, add dated readiness/release evidence and kill-switch setup, preserving historical report text. No secrets, key rotation, permissions change or unrelated provider cleanup. |

### Milestones and dependencies

| Milestone | Depends on | Exit / review evidence |
|---|---|---|
| A: Assignment access | Existing architecture | Correct loading/signed-in states; Google user uploads, opens and deletes disposable files through trusted workspace; owner isolation retained. |
| B: Expandable Ask | A acceptance | Compact/expanded/restored chat preserves messages/draft/pending reply/reading position; real Chrome responsive/accessibility evidence. |
| C: Real checker entry + local readiness | A for auth/assignment context; existing Phase 5 source | Clear entry, trusted upload/capture/preview, correct requirements, mocked V1/V2 regressions; concrete hosted mismatch release manifest. |
| D: Beginner Guide | A owned assignments; C requirement/evidence contract | Owned context and components, answerable clarification, grounded actions/why/check, source references, help and durable separate progress. |
| E: Useful More navigation | Existing saved progress; D resume behavior | Home retains Assignments; More offers Learning Progress, Check My Circuit and Settings; recent activity resumes the correct guide without fake mastery metrics. |
| F1: Formatting + honest Ask mode | B mounted chat/scroll behavior; existing rendering pipeline | Supported Markdown/math/code work for fresh and reopened messages; unsafe content cannot execute or fetch; live and demo states are explicit. |
| F2: Tutor behavior and accuracy | C provider readiness decision; D grounding rules | Concise multilingual personality instructions, bounded response extraction and honest deterministic/sketch checks; versioned prompts. |
| F3: Secure conversational memory | Existing owner-scoped conversations and accounting | Latest bounded stored turns, stable history paging and request isolation; replay remains idempotent; no cross-account/thread context. |
| F4: Quality qualification | A–F3 local gates | Formatting/security regression suite plus separately approved blind educational evaluation of the existing model against measurable criteria. |
| Release gate | A–F local verification + owner approval for hosted changes and qualified provider | Reconciled handler/config and bounded approved live smoke/evaluation; then owner reviews extension release. If AI eligibility fails, non-AI improvements can be reviewed independently while real AI remains disabled. |

AGY should work in A → B → C → D → E → F1 → F2 → F3 → F4 order, with a checkpoint after each. Reconcile existing A1/A2 and in-progress B first. D and F share one prompt/rendering policy; do not create competing tutor implementations. Read-only provider qualification can be prepared during local work, but no live model request or hosted enablement is implicit. Do not start another product phase or touch the landing page.

### Additional verification criteria for C/D

- [ ] Checker: signed-out/cold signed-in paths; stale installed build; hidden sample card vs real entry; valid PNG/JPEG, disguised/oversized file; local preview/crop/cancel; toolbar capture denied/raced/expired/claimed by wrong tab; one send; expired auth, disabled service, 429/cooldown, timeout, invalid provider JSON/evidence; saved check, follow-up and progress reopen. Confirm no host pixels/credentials leak and no automatic retries.
- [ ] Assignment requirement selection: ready analysis, missing analysis, deleted assignment, conflicting manual requirements, foreign-owner IDs and mismatched assignmentAnalysisId. Confirm actual selected requirements appear in the mocked provider input and comparisons, not merely an assignment ID. Selection alone incurs no generation.
- [ ] Guide: complete assignment, unknown supply/pin/value, unreadable screenshot, no circuit evidence, conflicting selected parts, old tutorial payload, circuit-repair artifact mistaken for assembly, unsupported task, failed/truncated response and fabricated citation. Verify missing facts yield questions, not invented coordinates or wiring.
- [ ] Guide continuity: answer clarification, explain/troubleshoot step, switch language/context/account, navigate Ask/Guide/Check, resume progress and deliberate regeneration. Drafts survive expected navigation; account switches clear private state; changed guides do not inherit old completion indexes. Manual checklists remain unchanged.
- [ ] Real Chrome: compact and expanded sizes, keyboard/focus, screen zoom and reduced motion; inspect component lists, long translated text, code and error states. Use synthetic data for screenshots/recordings. Mocked quality tests and visual inspections are distinct from separately approved real-provider evaluation.

## 11. Useful More navigation — Milestone E

### Findings and decision

`AssistantPanel.tsx` includes Assignments in Home `shortcuts` and again as the first More item. More's current-section predicate also includes `assignments`. The duplication is confirmed.

**Choose Learning Progress.** Its underlying functionality already exists: owned `analyses.list/get`, `progress.get/save`, durable `ohmi_tutorial_progress`, saved tutorials and corrective circuit steps. There is no aggregate mastery, grade, streak or learning-score system. Reuse recent saved activity rather than inventing one. Help & Tips is unnecessary as a replacement; retain brief contextual tips within existing features.

### E1. Replace one entry and preserve navigation

- [ ] Add a `progress` value to `Section` in `src/preview.ts`, with title/subtitle in `AssistantPanel.tsx`. Replace only More → Assignments with **Learning Progress**, using an existing suitable icon. Keep More → Check My Circuit and Settings in their current order after it. Home → Assignments and its private upload/manage path remain.
- [ ] Preserve the three-item More region, first-item focus, close-on-selection, Escape handling, minimized/open behavior and bottom navigation style. Point `firstMoreRef` at Learning Progress. No new router, route package, modal or dashboard.
- [ ] More's active predicate becomes `progress/check/settings`. Since Assignments is now a Home destination, mark Home current for `home/assignments`; Guide remains current when displaying a guide. Avoid simultaneous `aria-current="page"` on Home and More. Back-to-assignments still returns to the existing Assignment section.
- [ ] Update targeted navigation fixtures, exhaustive `Section` records/switches and accessible names. Do not rename unrelated section IDs or clear chat/guide state when opening More.

### E2. Recent saved learning activity

- [ ] Signed out: explain that saved progress requires sign-in, with the existing Account action and Guide sample access. Loading/error/no-recent-activity states are distinct; do not show made-up completion percentages or erase old progress after a fetch error.
- [ ] Signed in: reuse `analyses.list`, filter explicit `tutorial` and `circuit_check` kinds, and show at most eight recent entries from the returned recent page. Label this **Recent activity**, not a complete all-time transcript. Manual assignment checklists stay reachable through Home → Assignments; do not mix them into AI step totals.
- [ ] Reuse `progress.get` per displayed entry with bounded concurrency (at most three requests). Show saved completed-step count and last activity date if available. Obtain/validate the selected payload through `analyses.get` when opening it. Show a denominator or “complete” only after a valid step count is known; absent progress means “Not started,” not evidence of mastery. Clarification-only analyses are not completed guides.
- [ ] **Continue** opens the existing Guide for a tutorial or clearly labeled circuit correction steps; reuse D's validated artifact-loading path and account guards. Keep existing progress persistence. A deleted, unsupported or inaccessible artifact gets a recoverable notice and refresh, never another account's data.
- [ ] Refresh when this section opens and after returning from a changed guide. Reuse existing state/request sequencing, ignore stale responses on account switch, and avoid polling or a new cache/store. No aggregate table, migration, analytics or new progress RPC is needed.

**E acceptance:** Home provides Assignments exactly once; More provides Learning Progress, Check My Circuit and Settings. Keyboard/focus/active state remain correct. Signed-out, empty, partial, completed, deleted and foreign-owner fixtures behave honestly. Continuing an entry preserves its analysis ID and saved step, with zero AI generation. Verify narrow/zoomed layouts and no new network polling.

## 12. OHMI tutor communication and intelligence — Milestones F1–F4

### F0. Trace the actual pipeline before blaming the model

| Source evidence | Diagnosis |
|---|---|
| `AssistantPanel.tsx::send()` | **Mixed live/demo path.** Signed-in, unattached questions call `ai.chat`. Signed-out questions **or a selected built-in sample attachment**, including for a signed-in user, return `demoReply()` after 650ms. Demo replies are fixed regardless of the question. No evidence establishes a successful current live answer in the owner's installed build. |
| Ask subtitle, pending text, compose label/button/help, log name, language help and footer | These all contain hard-coded demo/sample wording even on the live request branch. Therefore “Send demo” does not prove the backend is disconnected, and signing in does not prove a sample-attached question used AI. Correct provenance per operation/message. |
| `AssistantPanel.tsx::renderMessageText()` | Renderer splits triple-backtick code blocks, then returns the rest in plain spans. It does not interpret headings, lists, bold or math. Valid model output such as `**resistor**` and `$R=\frac{V}{I}$` therefore appears as source markup. **Confirmed rendering gap.** Do not solve it solely through prompting. |
| `service.ts` JSON request/response; handler `result.answer`; `ohmi_complete_ai` migration; `conversations.open` | The inspected path stores/returns the answer string without a Markdown renderer or special-character stripping. No double-encoding defect is proven. Add byte-preserving synthetic round-trip fixtures to locate serialization faults before changing decoding or stored rows. No real student message records were read for this diagnosis. |
| `handler.ts` V1 response extraction | It takes `candidate.content.parts[0].text`. Multiple text parts or a thought part can yield incomplete/wrong visible text. Add actual-handler fixtures and bounded extraction of all visible text parts, excluding explicitly marked thought parts; do not expose hidden reasoning. This is a source risk, not a reproduced live-provider incident. |
| Assignment tutorial fallback `answer: tutVal.result.answer || answerText` | A tutorial's fallback answer can be raw structured JSON. Specialized tutorial/circuit payloads need their existing structured views; a generic chat renderer must not display an entire JSON object as a student's explanation. Preserve stored payloads and validate artifact type. |
| V1 system instructions | Friendly tutoring, language and uncertainty rules already exist, but no concise answer policy, clear formatting contract, calibrated humor or adaptive-depth behavior. The model alone is not the demonstrated cause of long/raw responses. |
| Client `messages.slice(-4)` and server `context.slice(-4)` | Only four **messages**, not four complete pairs, reach the model. Server slices each to 1,000 characters. `conversationId` links persistence/ownership but does not itself load older turns for generation. A value established earlier can fall out of memory. |
| `conversations.open` | It orders ascending, limits to 50 and has no cursor. Long conversations reopen at their first 50 messages, omitting newer ones. UI also replaces stored IDs with new local counters and drops `structured_result`. Fix retrieval/typing, not history deletion. |
| `send()` conversation creation catch; message `isAi` flag | Failed conversation creation silently proceeds unlinked; students may expect saved history that does not exist. Demo and live turns can coexist in the same in-memory log and the last-four context. User turns lack explicit provenance. Separate sample context from real conversation context. |
| Existing calculation and Arduino helpers | Server supports deterministic calculations only when explicit calculation inputs reach it; ordinary Ask does not supply `calculation`. Sketch checks are static heuristics, not compilation or simulation. Their existence does not validate every free-text AI answer. |

Hosted function was checked again during this six-feature update: still **ACTIVE version 13**, Gemini `gemini-3.5-flash-lite`, without V2 circuit support or the local kill-switch gate. This confirms deployment drift, not live Ask generation success. Retain C's separately approved reconciliation/eligibility gates.

### F1a. Make Ask mode and message provenance truthful

- [ ] Compute demo/live-request intent from the existing authenticated account plus sample attachment choice; do not add a provider-health request on every render. Use “Sample reply” for deliberate demos, “Ask OHMI”/“Send” for authenticated questions, and specific disabled/unavailable errors from the server. Authentication indicates intent, not confirmed provider availability.
- [ ] Correct subtitle, empty state, composer, pending status, log accessibility label, language description and footer together. Keep visible design unchanged. An AI error must not silently turn into a fixed sample response. Label each returned sample explicitly.
- [ ] Keep the sample attachment visibly labeled and explain that choosing it uses the local example. Exclude its associated user/reply turns from live context and saved AI conversation input. Use a small message provenance field (`mode: 'live' | 'sample'`, separate from role) instead of relying on `isAi` for both user and assistant turns. Preserve provenance when history reopens; existing persisted AI conversations default to live history, not sample.
- [ ] If conversation creation fails, keep the draft and show a retryable history error before requesting live AI, rather than silently proceeding unlinked. Preserve existing linked-conversation atomic completion. Freeze request/account/conversation snapshots; a reply or demo timer arriving after New conversation, account switch or opening another history must not append there. Cancel sample timers on cleanup and keep pending state scoped to its request.

### F1b. One safe Markdown/math renderer

- [ ] Introduce one small shared `src/MessageContent.tsx` for assistant response content, replacing `renderMessageText`. Reuse it in Ask live/reopened replies and prose fields of structured Guide/check views where rich content is appropriate. Keep raw user input and source code literal/escaped. Do not feed entire structured payloads into Markdown.
- [ ] No suitable parser exists in current dependencies. Recommend the established local stack `react-markdown`, `remark-math`, `rehype-katex` and directly declared `katex` for its bundled CSS/fonts. This is a justified exception to the previous no-dependencies preference: implementing Markdown and TeX safely with more regex is larger and less reliable. Install/pin compatible maintained versions only after plan approval. No editor framework, syntax highlighter, remote renderer, CDN or new provider.
- [ ] Support a deliberately small dialect: paragraphs, restrained headings mapped below the panel heading, ordered/unordered lists, emphasis/bold, inline code, fenced code, inline math and display math. Tables/HTML/embedded media are not needed. Preserve Arduino indentation, `#include`, `*`, underscores, backslashes, braces, comparison signs, `Ω`, `µ`, degree signs, superscripts and units. Math styling may use bundled math fonts; OHMI's surrounding typography/colors/spacing remain unchanged.
- [ ] Prefer ordinary math text such as `R = (Vs − Vf) / I` in new concise replies. When TeX is useful, require canonical `$…$` or `$$…$$` delimiters. Cover existing `\(…\)` / `\[…\]` forms with a bounded math-only normalization outside code if needed; do not globally replace dollar signs, escaped backslashes or `\n`. Currency and Arduino string literals must stay literal.
- [ ] Use React element rendering, disable raw HTML (`skipHtml`), do not enable `rehype-raw`, and allow only the chosen element set. Block remote images/media entirely. Links must allow only validated HTTPS destinations, no credentials or `javascript:`, `data:`, `file:`, extension/internal URLs; use safe external-link attributes. Do not insert model HTML via `dangerouslySetInnerHTML`.
- [ ] Configure math with `trust: false`, bounded macro expansion/size and no shared user-defined macro state between messages. KaTeX's default error behavior can display raw TeX; explicitly intercept malformed/unsupported math/error nodes. Show a validated plain equation when available from structured calculation output, otherwise a short “Formula could not be displayed; ask OHMI to restate it” fallback while retaining surrounding explanation. Never dump JSON/TeX error source into the student view or auto-call AI to repair it.
- [ ] Unmatched/escaped formatting must degrade to readable prose without exceptions or wholesale symbol deletion. Normalize only demonstrated transport defects at their responsible boundary. Any cleanup is limited to identified prose formatting tokens, outside math/code; ambiguous literal technical text stays literal. Regression fixtures must distinguish syntax markers from legitimate `*`, `$`, `_` and backslashes. No global special-character stripping.
- [ ] Keep canonical raw text and `structured_result` in storage; render at read time so existing history benefits without a data rewrite. For old tutorial JSON-as-answer cases, use validated structured fields from `structured_result` to show a concise title/objective/steps link. Unknown legacy payloads receive a readable message and intact history, not guessed destructive conversion.
- [ ] Bundle CSS/fonts with the extension and verify inside its shadow root, not just a standalone page. Prefer safe MathML output if it meets Chrome visual/accessibility checks without font assets; otherwise expose only the packaged math font paths required on Tinkercad. Never loosen CSP, add remote code, enable `unsafe-eval`, broaden host permissions or expose unrelated files. Decide this small rendering detail from a local approved-build check.
- [ ] Scope paragraph/list/code/math styles to the message component. Wrap long prose, scroll only wide code/equations horizontally, retain readable keyboard selection and math accessibility. Memoize by stable content so typing/resizing does not reparse the full conversation. Recheck B's reading anchors after math/fonts load; no continuous animation loop or rendering every paragraph character-by-character.

Maintainer references reviewed 18 October 2026: [react-markdown security](https://github.com/remarkjs/react-markdown#security), [remark-math integration](https://github.com/remarkjs/remark-math), [KaTeX security](https://katex.org/docs/security), [KaTeX options/error behavior](https://katex.org/docs/options). Default parser safety does not make arbitrary plugins or URL transformations safe; keep the configured stack and regression tests explicit.

### F2. One consistent tutor policy, grounded technical behavior

- [x] Version the existing server tutor instructions (for example `ohmi-tutor-v2`) and keep a single shared core policy inside the existing function bundle. V1 Ask, assignment/tutorial and V2 checker each append their operation-specific instructions. Do not overwrite V2 JSON/evidence contracts with chat Markdown or copy competing personalities into each client.
- [x] Adopt this behavioral contract: **OHMI is a patient circuit buddy: clear, observant, practical and quietly witty. Answer the actual question first; explain why when useful; suggest one concrete next check. Correct mistakes kindly. Use light situational humor at most occasionally, never mock the student or joke through a safety warning.** No repeated greetings, persona introductions, excessive emojis, canned praise or filler.
- [x] Default ordinary concept answers to about 40–100 words, usually a short paragraph or 2–4 bullets. Simple factual follow-ups may be shorter. Explicit worked explanations may use about 150–300 words; tutorials use D's small complete steps rather than an arbitrary word cap. These are prompt targets, not frontend truncation. Never cut off a warning, equation, code block or required clarification to meet a length target.
- [x] Recognize intent from the current question plus bounded context: quick fact, calculation, explanation, code help, troubleshooting, tutorial or follow-up. Use the current language preference, and honor an explicit English/Filipino/Taglish request without erasing stored preferences. Keep units, part names, pin labels and code unchanged. A vague request prompts one focused clarification when necessary; “explain more” expands the relevant point instead of restarting the whole lesson.
- [x] Match structure to need: calculation gives known inputs, formula, substitution, result/unit and a relevant limit; code help identifies the issue then gives a minimal corrected excerpt; troubleshooting gives observed symptom, plausible cause, one check and expected result. A basic definition does not need all those headings. Never reveal chain-of-thought; provide a concise educational derivation or evidence explanation.
- [x] Retain existing deterministic calculation helpers and explicit validated operands. Distinguish them from model arithmetic; do not claim every free-text reply was calculator-verified. Avoid an unbounded natural-language math parser or an extra AI call per question. Missing/ambiguous operands require clarification. Evaluate known-input free-text calculations separately in F4.
- [x] Revise over-broad existing prompt claims: resistor selection depends on confirmed ratings and target current; a quarter-watt rating is not universal; pins 0/1 cautions must match the selected board's serial behavior. Reuse existing board specifications and checked official references. Do not invent component datasheets, Tinkercad controls, supported parts, resistor values, measured voltages or wire locations. Treat board registry/static sketch validation as bounded aids, never compilation/electrical verification.
- [x] Make source limits explicit when relevant: distinguish assignment requirement, visible observation, student report, prior AI inference and proposed new wiring. Ask for a board model, clearer close-up, value or simulation warning when the answer depends on it. Respect C/D's safety and uncertainty rules. No silent tool calls, DOM scraping or general web-browsing integration is needed for this milestone.
- [x] In actual provider handling, extract visible candidate text parts in order within the existing response-byte cap, exclude explicitly marked thought parts, preserve newline/code boundaries and reject empty/truncated/safety-blocked results. Structured operations still parse and validate one complete JSON result. Add fresh/replayed/multiple-part fixtures; do not concatenate metadata or tool/function parts as student text.
- [x] Review all live, persisted and replay result paths so `answer`, `structured_result` and validated fields agree. Return a readable tutorial synopsis rather than raw JSON as the public answer while preserving structured fields. Record prompt version using existing metadata where available; no database migration solely for branding/personality and no rewriting historical responses.

### F3. Better follow-ups using existing secure history

- [ ] Keep worker/server-owned identity and owner-scoped conversations. Add no vector database, cross-thread memory, profile inference or third-party memory service. A student's prior claim is conversation context, not a trusted electrical fact or system instruction.
- [ ] Fix `conversations.open` to fetch the latest bounded page first (descending position, reverse for display), expose stored message IDs/positions and a cursor for **Load older messages**. Use keyset paging on existing positions and owner checks. Preserve older data rather than increasing an unbounded limit. A >50-message conversation must open at its actual newest turn and still allow older history access.
- [ ] Preserve `structured_result` and message language from existing metadata/conversation where available; do not incorrectly mark every reopened language as the current one. Maintain stable persisted IDs and one-time local IDs, B's reading anchor, draft and pending state while loading older messages. Rendering an older page must not regenerate or re-save responses.
- [ ] For linked live chat, load recent canonical messages server-side after authenticating/validating ownership, instead of trusting an arbitrary client history as authoritative. Read a bounded candidate set (at most 12 messages), retain up to eight recent complete messages within the existing total context-text budget of 4,000 characters, and keep pair boundaries where possible. Omit older complete turns before slicing code/equations. Ask the student to restate unavailable details rather than pretend unlimited memory. No quota/budget increase is implicitly approved.
- [ ] Add one optional `historyThroughPosition` request field for linked live chat: nonnegative safe integer, bound to the owned conversation. Reject a future position beyond its current head; zero represents no prior messages. Freeze it at send time and carry it through request typing, validation, worker forwarding and canonical hash. Fetch only rows through that watermark and preserve the chronological order. Missing watermark retains the bounded legacy path for compatibility; new clients use server history. Exclude sample turns completely.
- [ ] Hash exactly the canonical context actually sent, including watermark/language/current input and relevant existing D context reference. Keep the snapshot fixed for a request UUID so a retry after newer turns arrives does not consume another reservation or unexpectedly fail replay. If history is deleted/changed, return the existing completed result when valid or a truthful conflict, never silently regenerate. Test against actual reservation/replay behavior before changing it; no migration or accounting shortcut by default.
- [ ] Return the current canonical history watermark after an atomic successful completion and include it when opening history, so the next request can freeze the right boundary. Do not add the optimistic user question twice to stored context. The new question is appended once as the current provider input; DB message insertion remains the existing atomic completion's responsibility.
- [ ] Keep context retrieval bounded and cheap before provider admission; no provider request occurs before quota reservation. Check token estimates/accounting with worst-case multilingual/code input under the existing limits. If improved context requires larger quotas or a schema change, stop at a concrete owner-reviewed proposal instead of silently increasing cost.
- [ ] Test stale response isolation using account, conversation and request-generation refs, not only an async closure's captured account object. A completed old request may persist to its own authorized conversation, but must not append into the currently displayed different conversation. Refresh history deliberately and retain specific error/retry state.

### F4. Measurable quality and formatting qualification

Start with the current Gemini model. Rendering, demo routing, weak context and prompt gaps are confirmed; model insufficiency is **not** established. Reuse section 9's provider eligibility/quality gate and comparison. Test the same approved model before considering one alternative. No paid service, multi-model routing or unsupported API is approved.

**Layer 1 — deterministic local regressions, no live AI:**

- [ ] Add `src/MessageContent.test.tsx` plus a focused browser helper such as `tests/ai-communication.mjs`, registered in `tests/browser.mjs`. Reuse Vitest and existing Playwright; do not install a new test framework. Browser checks cover real DOM math/layout because string snapshots alone do not prove rendering.
- [ ] Round-trip synthetic text through request JSON, mocked provider result, `ohmi_complete_ai` parameters, a faithful persistence fixture, history response and renderer. Compare canonical text exactly. Include actual newlines, literal `\n`, backslashes, bold/list syntax, fractions, `Ω`, `µF`, Filipino text and Arduino strings. Distinguish simulated persistence from a live database test.
- [ ] Formatting fixtures: headings/list nesting/bold/inline code; C++ fence with `#include`, `a*b`, `x < 5`, braces and `Serial.println("\n")`; inline/display fraction and subscripts; legacy math delimiters; literal currency; unmatched fences/markers; invalid TeX; JSON-as-tutorial history; long equations/code at 320px and expanded chat. Supported syntax displays without visible source markers; code/literal technical characters remain intact. Unsupported math yields the explicit fallback, not raw TeX or a console crash.
- [ ] Adversarial fixtures: script/event HTML, `javascript:` and obfuscated links, remote image tracking, `data:`/file/extension URLs, malicious TeX links/images, huge expressions/macros and deeply nested Markdown. Pass means no script execution, unintended network request, escaped shadow-root styles, inaccessible controls or UI freeze. Bound input to the existing response size; verify timeout-independent renderer safeguards.
- [ ] Mode/history fixtures: signed out, signed in, deliberate sample attachment, server disabled, quota error, failed conversation creation, >50 messages, older paging, sample-to-live switch, corrected component value, retry after another turn, account/thread switch during pending response and reopened multilingual structured history. Assert correct provenance, exact-once persistence, no context leakage and stable scroll/draft.
- [ ] Actual-handler tests cover prompt depth/language, visible multiple text parts vs thought parts, short reply, malformed/truncated structured output, uncertainty and persistence/replay. Mock all provider calls. A mocked “good answer” does not establish actual tutor quality.

**Layer 2 — separately approved real-model evaluation:**

Use 18 synthetic educational scenarios: six categories below, each in English, Filipino and Taglish. The multi-turn cases remain multi-turn, rather than isolated translations. Run two passes on the same model/settings: 36 scenario runs per prompt, or 72 when comparing old and proposed prompts. Scenario runs can contain several provider calls; enumerate those calls and cap total calls/tokens/cost for owner approval before starting. Stop at the approved cap. An electronics reviewer, plus a fluent language reviewer, scores sanitized outputs blind to prompt version. Reuse identical inputs and agreed response limits. No personal assignments or student history.

| Category / example | Required behavior / known answer |
|---|---|
| Basic concept: “What does a resistor do?” then “Shorter, please.” | Correct current/voltage relationship, concise direct answer, adapts depth without a new greeting or repeating the whole explanation. |
| Known calculation: LED with 5 V supply, 2 V forward drop, 10 mA target | Ideal 300 Ω; a proposed 330 Ω E12 value gives about 9.09 mA and resistor power about 0.0273 W. State supplied assumptions; rating/availability still require confirmation. Verify against existing calculation helpers. |
| Missing data: “What resistor should I use for this LED?” | Ask for required values/rating/context; no invented 5 V supply or default 220 Ω as a definite answer. |
| Arduino: Uno LED output with missing `pinMode`, then request a minimal blink sketch | Explain relevant `setup`, `loop` and pin mode; valid minimal syntax and consistent confirmed pin. Label static review honestly; no claim of compiling/running the sketch. Reviewer/official board reference is ground truth. |
| Circuit troubleshooting: ambiguous breadboard photo/description and conflicting report | Distinguish evidence from inference; ask for a close-up or exact symptom; one useful check with expected observation; no unseen row numbers or electrical certification. Reuse section 9's labeled circuit fixtures for actual image tests through the trusted path. |
| Follow-up memory: establish a 3.3 V supply/component value, discuss several turns, correct one value, reopen history and ask “what changes?” | Use the newest confirmed value from the retained context, acknowledge unavailable older details, preserve conversation boundaries and language, and do not import sample/other-account facts. |

Local expected-answer numbers are test specifications, not claims that the model has passed them. Reference technical behavior against the existing board registry and current [Arduino language reference](https://docs.arduino.cc/language-reference/), not general model confidence.

**Acceptance thresholds:** zero unsafe invented wiring/ratings or electrical-verification/compilation claims; 100% correct units/numbers on these known calculation cases; all missing-evidence cases admit uncertainty or clarify; ≥90% scenario answers technically correct under the reviewer rubric; ≥90% ordinary concept replies within 100 words unless explicitly expanded; ≥90% language/naturalness and useful-follow-up scores at least 4/5; 100% supported formatting and all security regressions pass. Tutorials are judged for actionable complete steps, not the concept word cap. Humor is optional; forced jokes are a failure, not a quota. Any unsafe output blocks release regardless of averages. Record latency, actual usage and cost as in section 9.

If the existing model fails, first distinguish a context/rendering/prompt defect from a reproducible model limitation. Then present one eligible vision-capable alternative from section 9 with the same benchmark and capped cost, for owner approval. Do not switch based on a single bad answer or vendor leaderboard.

### Additional file map for E/F

| File / boundary | Minimal planned responsibility |
|---|---|
| `src/preview.ts`, `src/AssistantPanel.tsx`, `src/Icon.tsx` if needed | One Progress section, truthful mode labels, message provenance, typed persisted IDs/structured results, context watermark and request isolation. Preserve the single chat mount and sample functions. |
| `src/MessageContent.tsx` (new), `src/MessageContent.test.tsx`, `src/ohmi.css` | Shared safe Markdown/math view, malformed-content fallback and scoped responsive styles. No generic UI framework. |
| `package.json` / lockfile; content-script styles and `wxt.config.ts` only if required | Pin the approved rendering stack and package its CSS/fonts. Verify exact asset paths/CSP; no new browser permissions, remote scripts or broad web-accessible resources. |
| `src/backend/contracts.ts`, `validation.ts`, `service.ts`, existing tests | Latest-page/cursor history contract, optional watermark, preserved structured result/language fields and owner validation. Reuse existing analyses/progress actions for E; no new aggregate backend. |
| `supabase/functions/ohmi-ai/handler.ts`, a small `tutor-policy.ts` only if needed for V1/V2 reuse, actual handler tests | Shared versioned behavior, bounded canonical context, visible-part extraction and readable specialized answer summaries. Preserve accounting/replay/strict circuit contracts. |
| `tests/ai-communication.mjs` (new), `tests/browser.mjs`, existing Phase 4/5 fixtures | Mode/navigation/progress/history/formatting/security cases and real Chrome verification; no live provider calls from ordinary test runs. |
| Existing verification/setup docs | Dated A–F results, model/prompt revision, fixture scores and remaining live eligibility gates after implementation. Do not replace historical reports with unverified success claims. |

## 13. Verification and handoff gates for AGY

Use the existing Vitest/Playwright setup. Add `testAssignmentWorkspace(context)` and `testExpandableChat(context)` exports in `tests/assignments-chat.mjs`, invoked from `tests/browser.mjs` after existing helpers. Mock `account.state`, conversation and AI message actions in isolated test contexts so synthetic signed-in fixtures cannot reach a live provider/backend. Preserve the existing actual sender validation unit tests.

After approved changes, run:

```powershell
npx vitest run src/backend/service.test.ts src/backend/validation.test.ts src/placement.test.ts
npm test
npm run typecheck
npm run build
npm run test:browser
node tests/phase5.mjs
git diff --check
```

Acceptance is passing commands with no browser errors plus A–F behavior checks. Include actual Edge handler, tutorial, formatting/security, history and Phase 5 evaluation fixtures in `npm test`; mocked fixtures do not qualify real model accuracy. Do not substitute historical test counts for a fresh run. Review the diff and manifest: no new host/API permissions, no private values/tokens, unchanged original mascot hash, no unapproved schema/provider or landing-page edits. Only narrowly approved rendering assets/dependencies and C/D/F handler/contract changes are in scope. Never reset the hosted database or delete real assignments to make tests pass.

For the Assignment smoke test, record only sanitized state/error categories and disposable fixture outcomes; never capture tokens, signed URLs, real student files or private message text in committed logs. A reported session mismatch requires comparing the same extension ID/build path and authoritative worker identity before changing OAuth settings.

**Completion order:** See section 10. Assignment access remains first. Local C/D/F verification must pass before requesting approval for hosted changes. Preserve original function source/version metadata for rollback; rollback must retain current authentication, accounting and fail-closed gates. Do not restore an old insecure handler merely because it was previously deployed. Revert only scoped implementation commits; preserve unrelated history and all data. Preserve raw message history; formatting is a read-time view, not a destructive data cleanup.

## 14. Planning verification and limitations

Inspected current source, the recording/screenshots, targeted tests, storage policy definitions and Phase 4/5 reports/history. No Graphify graph exists in this checkout; source was used directly. Hosted checks read migration history, function metadata/source, secret names and database/storage configuration only. No student rows or secret values were retrieved. This planning task performed no app implementation, app test/build, live OAuth/upload, AI generation, database mutation or deployment. Concurrent application edits observed at final review are preserved and unverified, as noted above. Installed-build identity, the owner's active worker/session, real owner-isolation behavior and live model quality remain unverified. RLS-enabled flags and migration names alone are not proof of policy correctness or end-to-end service health.

Primary references reviewed 18 October 2026: [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), and [Chrome extension storage/access levels](https://developer.chrome.com/docs/extensions/reference/api/storage). These support retaining the current PKCE/custom-storage and private-storage boundaries, not rebuilding authentication. The [Supabase changelog](https://supabase.com/changelog) was checked; its recent TLS deprecation notice is not evidence for this UI issue. AGY should recheck applicable documentation before implementation without upgrading dependencies by default.

**Status: Six-feature plan ready for owner review. AGY must reconcile existing work and wait for explicit approval before starting any further work under this updated plan. No hosted deployment, AI enablement or live evaluation is authorized.**
