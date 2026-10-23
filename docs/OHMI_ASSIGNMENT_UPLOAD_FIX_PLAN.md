# Assignment Upload UX Fix Implementation Plan

**Status:** Planning only; awaiting owner approval. AGY implements after approval. Review each milestone before starting the next. This document authorizes no implementation, deployment, migration, or live upload.

**Goal:** Students select and save private PDF, PNG, or JPG assignments through OHMI without leaving their current Tinkercad tab.

**Architecture:** Open an OHMI Chrome side panel from the companion's assignment controls. Reuse the existing account/upload React implementation inside a packaged extension page. Keep authentication and upload authorization restricted to trusted extension documents; retain the worker-owned Supabase client and existing RLS.

**Stack:** Existing WXT, React, TypeScript, Manifest V3, Supabase, native XMLHttpRequest; Chrome Side Panel API. No new dependency.

**Spec:** Owner's upload-fix request; `docs/PROJECT_CONTEXT.md`, `docs/OHMI_MASCOT.md`, and existing account/privacy constraints. AGY should use the project's execution workflow, limited to approved milestones.

## Evidence and limits

Inspected source at HEAD `8ce5859` on 23 October 2026. Source is authoritative over older project summaries. Pre-existing untracked `assets/ohmi-hero-banner.png` is unrelated and must remain untouched.

The requested screen recording is not accessible among this chat's attachments or repository files. No frame-by-frame analysis or installed-extension reproduction was possible. The reported navigation is independently explained by source. Before implementation acceptance, review the recording if supplied and reproduce in the installed build. Do not invent observed timings or visual defects.

No fresh Graphify graph exists in this checkout. Inspected specific source files instead. No app tests, build, live OAuth, hosted data reads/writes, or uploads were run for this planning task. Hosted configuration and actual Chrome behavior remain implementation verification gates.

### Root cause and current flow

1. `src/AssistantPanel.tsx` renders `PrivateAssignments` in the Assignments section without `onUpload`.
2. `src/PrivateAssignments.tsx` falls back to `request('account.open', { view: 'upload' })`. Its signed-out CTA also calls `account.open`.
3. `src/backend/service.ts` handles `account.open` with unconditional `browser.tabs.create`, targeting `/account.html#upload`.
4. `entrypoints/account/main.tsx` renders `src/AccountPage.tsx`, which owns the real file picker, validation, XHR progress, cancellation, finalization, and saved list.
5. `entrypoints/ohmi.content.tsx` mounts the companion in a Shadow DOM on Tinkercad. Shadow DOM protects styling, not sensitive DOM data from the host. The content script's isolated JavaScript world does not turn its shared DOM into a trusted extension document.
6. `src/backend/validation.ts` deliberately restricts authentication, `files.prepare`, and `files.finish` to `/account.html`. Removing this restriction would undermine the existing design.

The tab is an intentional security/navigation shortcut, not evidence of Google or Supabase failing. Fix the destination surface; do not put the account page's authorization or XHR into the companion content script.

### Existing upload/security implementation to preserve

- Worker initialization restricts local and session storage to `TRUSTED_CONTEXTS`.
- Worker-owned PKCE Google sign-in uses `identity.launchWebAuthFlow`, exact extension callback validation, and code exchange. No auth session is returned in `account.state`.
- Data actions verify the current user and compare the caller's `accountId` snapshot. The snapshot is a stale-view guard, not ownership authority.
- `files.prepare` validates filename, MIME, extension, size, and first-byte signature, creates pending metadata, and returns `UploadAuthorization` **including the user's access token**, upload URL, MIME, and publishable key. This is a session bearer token, not a narrowly scoped signed-upload token.
- The trusted page uploads directly with XHR, a 120-second timeout, and `x-upsert: false`. Bytes do not pass through runtime messages or the MV3 worker.
- `files.finish` checks owned storage metadata for matching path, size, and MIME before marking ready. This is not full document parsing, malware scanning, or electrical verification.
- Existing migration `supabase/migrations/20261012141823_ohmi_private_student_data.sql` defines private `ohmi-assignments`, ownership policies, and a 10 MiB cap. Paths are `${user.id}/${assignment.id}/assignment.${extension}`. Confirm effective hosted policies later; local SQL is not proof of deployment.
- Allowed files: PDF, PNG, JPEG (`.jpg` and `.jpeg`), 1 through 10,485,760 bytes inclusive. Filename limit is 180 characters, excluding paths and control characters.
- Successful finish/delete broadcasts `account.changed`; `src/useAccount.ts` refreshes trusted pages and companion lists.

## Decision and trade-offs

**Recommend the trusted Chrome side panel as the safest practical no-tab alternative.** The Upload assignment button stays in OHMI. It opens an OHMI-branded upload surface beside Tinkercad. The file picker, authentication UI, bearer token, and transfer live in an extension document outside Tinkercad's DOM.

This does not place the picker literally inside the floating mascot panel. Chrome owns the side panel and reserves some page width; OHMI cannot promise its side or exact width. The student remains in the same circuit tab. Keep the floating mascot, companion navigation, chat state, tutorials, checker, original assets, and colors intact.

Rejected for this fix:

- Copying the existing uploader into Shadow DOM: selected files and private authorization would cross the wrong boundary.
- Exposing a token-returning upload action to content scripts, even with a matching origin.
- Embedding a web-accessible account iframe: adds host-controlled framing/clickjacking and lifecycle risks. Do not expose account/upload pages as web-accessible resources.
- Toolbar popup: can dismiss during file selection, authentication, or uploads; also conflicts with the current screenshot action.
- Separate extension window: retains security but takes focus and adds a window. Do not silently substitute it if the side panel fails.

Chrome 116 is already the manifest minimum and supports `sidePanel.open`. Preserve that minimum. Do not depend on newer `sidePanel.close`, `onOpened`, or `onClosed` APIs. Chrome's native close control is sufficient.

## Global constraints

- Planning approval must precede implementation. No database/schema, bucket, RLS, OAuth callback, extension ID, provider, billing, or AI feature change is needed.
- Preserve private storage, existing file limits, Google authentication, email-delivery gates, CSP, and host permissions. Add only `sidePanel` permission.
- No tokens, upload authorization, file bytes, storage paths, or signed URLs in host DOM, page events, `window.postMessage`, localStorage, or diagnostic logs.
- Preserve current account tab as an explicitly requested account-management feature. Upload and assignment sign-in must not invoke it.
- Saving a file does not trigger AI analysis. Keep saved assignments separate from the local sample-analysis card.
- Apply the design-reference-library's narrow-fix rule: reuse existing OHMI styles and approved mascot; no redesign or new design dependency.

## Review focus

1. A cold worker must still open the side panel from the real button gesture.
2. Repeated clicks must not reload a mounted uploader or duplicate an upload.
3. Account changes must prevent stale upload completions or errors appearing for another student.
4. Ambiguous completion must not delete a successfully saved assignment.
5. Closing the panel or leaving the editor must never imply a background upload will finish.

## Milestone 1 — Prove trusted, gesture-driven no-tab navigation

**Files:** Modify `wxt.config.ts`, `entrypoints/background.ts`, `src/backend/validation.ts`, `src/backend/validation.test.ts`, `src/AssistantPanel.tsx`, `src/PrivateAssignments.tsx`. Create `entrypoints/assignments/index.html`, `entrypoints/assignments/main.tsx`, and `src/assignment-panel.ts` with focused unit tests. The new page initially reuses `AccountPage` unchanged.

**Interfaces:** Add action `assignments.open`, accepting no caller-controlled tab ID, path, URL, or account ID; return `null` on success through the existing response envelope. Add optional `onSignIn?: () => void` alongside existing `PrivateAssignments.onUpload`. Wire both companion callbacks to the new action. Keep the existing account-page callback that scrolls to its uploader.

- [ ] Add failing tests proving companion Upload assignment and assignment Sign in invoke `assignments.open`, never `account.open`.
- [ ] Register packaged `assignments.html` for the side panel. Configure tab-specific options for validated circuit editor URLs using existing `isCircuitEditorUrl`; disable on other URLs. Establish options before clicks, including existing tabs on startup and editor navigation. Do not reset unchanged options or reload an open page.
- [ ] The opener must derive the destination from Chrome's validated top-frame `sender.tab.id`, never the message payload. Reject foreign extensions, non-editor URLs, child frames, missing tab IDs, and page/external messages.
- [ ] Handle `assignments.open` in the background message listener before `await ready` or authentication/network work. Validate synchronously and invoke `sidePanel.open({ tabId })` immediately in the gesture message turn. Keep the existing async path for all other actions. Do not add polling, delayed retries, or an external-message bridge.
- [ ] Keep toolbar `browser.action.onClicked` wired to capture. Do not set `openPanelOnActionClick: true` or add a default popup.
- [ ] Narrowly recognize `/assignments.html` as a trusted top-level extension page. Require the exact extension ID, protocol, pathname, and `frameId === 0`; also harden `/account.html` to top-frame senders. Update synthetic account sender fixtures accordingly. Keep `auth.*`, `files.prepare`, and `files.finish` unavailable to editor senders. Share only the existing auth/upload privileges the reused page needs; retain account-only `profile.name` unless that control is intentionally present.
- [ ] Keep HTML and sensitive scripts out of web-accessible resources. Build and inspect the generated manifest and packaged entrypoints.

**Acceptance:** In headed Chrome, click the actual companion button from a warm and restarted worker. Side panel opens, circuit URL and active tab remain unchanged, and no browser tab/window is created. Repeated clicks reuse the surface. Wrong sender tests fail closed. Browser failure shows a clear companion error and an explicit retry button, with no tab fallback. If gesture delivery fails, stop and resolve this milestone before building further UI; do not weaken trust restrictions.

**Review gate:** Owner reviews the side-panel trade-off and working navigation before Milestone 2.

## Milestone 2 — Reuse the uploader in a compact OHMI surface

**Files:** Modify `src/AccountPage.tsx`, `src/account.css`, `entrypoints/assignments/main.tsx`, `src/PrivateAssignments.tsx`; extend `tests/assignments-chat.mjs`. Preserve `entrypoints/account/main.tsx` behavior.

**Interface:** `AccountPage({ surface = 'account' }: { surface?: 'account' | 'assignments' })`. The new entrypoint passes `surface="assignments"`. Share the current upload/auth state and logic; do not create a second Supabase client or duplicate the upload implementation. In assignments mode, render compact branding, auth state, upload section, and existing saved-list/steps controls. Keep profile editing in the full account surface.

- [ ] Add failing UI cases for unresolved account, signed out, configured failure, authenticated empty list, selected file, uploading, verifying, success, and error.
- [ ] On open, show neutral loading until account resolution. Reuse the existing Google sign-in control and trusted auth actions. Preserve upload intent through authentication. Google may open its explicit identity authentication window; it must not create the private workspace tab. OAuth cancellation leaves Tinkercad and the upload surface usable.
- [ ] Show a labeled native picker with `application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg`, selected filename, 10 MiB limit, privacy copy, Save private assignment, and Cancel upload. Keep file selection inside the trusted page. Do not transfer a dropped companion file to this page; retain the sample area's explicit demo behavior.
- [ ] Reuse validation and XHR progress. Cap transfer progress at 99 until finish succeeds; show Verifying upload, then saved success. Use indeterminate status if upload progress is not computable. Never automatically open the native file picker after asynchronous auth; focus its control for an explicit student click.
- [ ] After verified save, clear the selection, refresh the saved list, and let existing `account.changed` update the companion list. Keep refresh, explicit Open file, Delete, and Saved steps behavior. Companion Analyze/Tutorial features remain available there. Opening a saved file may still open its existing signed preview tab only after a separate explicit Open file click.
- [ ] Use existing CSS tokens, typography, approved front PNG, focus styles, `role="status"`, `role="alert"`, labeled progress, and reduced-motion handling. Keep the compact surface usable at 320 CSS pixels without horizontal scrolling. Do not unmount or minimize the companion automatically.

**Acceptance:** Each allowed format saves and appears in both lists. Tinkercad stays active throughout pick, transfer, finish, and refresh. An existing account session needs no new login. Signed-out Google success returns to the same upload intent. Tab-based account management still works. No sample upload becomes a real upload, and no save initiates AI analysis.

**Review gate:** Owner approves the rendered flow before lifecycle hardening.

## Milestone 3 — Preserve account isolation and safe failure recovery

**Files:** Modify shared upload logic in `src/AccountPage.tsx` only where tests demonstrate a gap; extend `src/backend/service.test.ts`, `src/backend/validation.test.ts`, `tests/account-privacy.mjs`, and the upload UI tests. Do not redesign the backend protocol.

- [ ] Add deterministic tests for cancellation before prepare, during transfer, and during finalization; timeout, offline, storage 403, finish rejection, and refresh failure after save.
- [ ] Preserve sequence/account guards, the 120-second timeout, no-upsert behavior, and disabled duplicate submission. Guard every post-await state update, including prepare, finish, catch, and finally. On unmount or account change, abort transfer, invalidate callbacks, and clear files, progress, messages, and account-bound selections. Do not retain the bearer authorization beyond the operation.
- [ ] Distinguish transfer/finalization failure from list-refresh failure. Once save is confirmed, a refresh failure says the file was saved and offers Refresh; it must not call `files.delete` or invite a duplicate upload. For an ambiguous finish response, inspect owned state before destructive cleanup; preserve ready or unknown items and offer refresh/recovery.
- [ ] Best-effort cleanup may delete only a confirmed failed pending item under its original account. Never retry cleanup under a newly signed-in account. If cleanup cannot finish, leave an honest incomplete item with the existing explicit Delete/retry action. Do not promise cancellation rolls back an already completed save.
- [ ] Show concise guidance that closing OHMI's upload panel can interrupt the upload. Reopening refreshes owned records and reports pending/incomplete items honestly. Do not introduce a background queue, offscreen document, service-worker file transfer, or resumable-upload dependency.
- [ ] Verify `TRUSTED_CONTEXTS` remains enforced. Test editor attempts to call auth/prepare/finish, spoof the trusted URL, select another student's ID, or obtain token-bearing responses. Test framed `/assignments.html`, wrong extension IDs, and non-allowlisted extension pages. Distinguish tests with mocked auth from real trust-boundary tests.

**Acceptance:** Student A's file or pending callback never appears for B or after sign-out. Same-account refresh does not discard the selection or restart a transfer. Failed uploads never become ready. Verified saves survive a refresh error. Worker restart does not falsely report success or expose authorization. Closing/reopening and changing away from the editor produce recoverable, honest state.

**Review gate:** Owner reviews privacy and failure evidence before final qualification.

## Milestone 4 — Qualify and hand off

**Files:** Add `tests/assignment-panel.mjs`, register it in `tests/browser.mjs`, and update relevant verification/setup documentation. Extend existing tests rather than creating a second harness.

- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, then `npm run test:browser`. Record exact results, environment, and any baseline failures; do not claim historical suite counts as fresh results.
- [ ] Use synthetic files and mocked storage for deterministic progress/error tests. Separately verify actual Side Panel API behavior in headed Chrome: a normal extension page opened in a test tab does not prove side-panel behavior. Include cold worker, repeated click, tab switching, editor SPA navigation, narrow browser window, and Chrome's native panel close/reopen.
- [ ] Test 0 bytes, exactly 10,485,760 bytes, 10,485,761 bytes, valid PDF/PNG/JPG/JPEG, mismatched extensions/MIME/signatures, path/control filenames, and valid Unicode filenames. Exactly-limit fixtures need not be valid AI-readable documents; upload validation and model readability are separate concerns.
- [ ] Run existing mascot dragging/minimizing, host pointer/keyboard, chat expand/restore, assignment analysis/tutorial, account management, saved steps, and screenshot/checker regressions. A side-panel resize must leave mascot and panel reachable.
- [ ] Manually verify keyboard traversal, visible focus, announcements, reduced motion, and 320-pixel layout. Capture before/after screenshots and a short recording of the actual no-tab upload flow without private student data or token-bearing developer tools.
- [ ] Before any live upload test, obtain explicit authorization for synthetic hosted writes. Then use two authorized test accounts to verify ownership isolation, private object access, configured MIME/size limits, sign-out/account switch, save/delete, and cleanup. No migration or policy edit is part of this plan. If live testing is not authorized, record the hosted security and real OAuth gates as unverified.
- [ ] Produce a concise verification report separating source/unit proof, mocked integration proof, actual Chrome UI proof, and hosted proof. Owner reviews before release. Follow repository commit/push rules only for completed, verified, approved implementation milestones; this planning task makes no commit, push, deployment, or next-phase change.

**Release acceptance:** Upload and assignment sign-in create no workspace tab. Real Chrome shows trusted upload UI beside the current circuit; all allowed types, progress, success, errors, saved files, cancellation, and account isolation work. Existing features and security boundaries pass regression checks. Unverified gates are explicit rather than marked passed.

## Official platform references and practical limits

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel): supports extension UI beside the webpage; programmatic opening requires a user interaction. Chrome 116 supports `open`; newer close/events must not become accidental requirements.
- [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) and [messaging security](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#security-considerations): JavaScript isolation does not make shared DOM a private account surface. Validate message senders and constrain privileged operations.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): retain authenticated ownership enforcement and private bucket access.
- [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads): standard uploads support this limit, though Supabase recommends resumable uploads above 6 MB for reliability. Retain the existing transport and 10 MiB limit for this focused fix; test near-limit failures and offer retry. Resumable transfers remain separately scoped work if evidence warrants them.

References checked during planning. The Supabase changelog Markdown endpoint could not be read by the web tool; no changelog compatibility claim is made. AGY must recheck relevant API behavior against the installed dependency versions and tested Chrome build.

## Approval requested

Approve the trusted side-panel approach and Milestone 1 first. AGY must stop at each milestone review gate. This plan does not authorize unrelated UX improvements, new AI work, database changes, or deployment.
