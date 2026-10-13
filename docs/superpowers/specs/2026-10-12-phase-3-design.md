# Phase 3: private accounts and assignments

The owner approved automatic implementation and testing of Phase 3. Preserve the approved Phase 2 interface and PNG. Stop before Phase 4. Commit/push completed verified work under the standing owner instruction.

**Accepted scope update:** the owner deferred email confirmation and password reset until custom SMTP. Keep implementation/templates prepared, block delivery-dependent actions with `WXT_EMAIL_DELIVERY_READY=false`, and preserve required verification. Phase 3 handoff requires verified Google authentication and backend features; email delivery remains an explicit pending item. The owner subsequently confirmed Google login, displayed email, and name saving in actual Chrome/Tinkercad.

## Architecture and privacy

Use one pinned `@supabase/supabase-js` client in the Manifest V3 background worker. It owns authentication, PKCE verifier/session persistence, cloud CRUD, and authorization checks. Restrict Chrome local and session storage to trusted extension contexts. Move existing content-script position/preference storage through validated runtime messages, preserving the current `ohmi` and `ohmiPreferences` keys.

The Tinkercad content UI receives safe account summaries and owner-authorized assignment/progress data, never passwords, auth tokens, PKCE verifiers, or upload authorization. Login and upload controls open a bundled extension-owned Account page. Sensitive commands accept only that exact extension page as sender; content commands accept only the extension's own content script on an allowed Circuits editor URL. Never use a caller-supplied user ID as authorization, or accept caller-controlled buckets/URLs/object paths. A non-secret `accountId` snapshot guards against stale views; it must match the independently verified current user. Ownership comes only from the session and database. No externally-connectable messages.

Only the Supabase URL and publishable key are used as API credentials. The owner inadvertently supplied privileged keys; do not store, embed, commit, or use them. Request their rotation. The publishable key identifies project `vhmdgfydvoljzqztuxmu`; its public Auth settings are reachable, signup is enabled, email confirmation is required, and Google is enabled. Verify authenticated project identity and existing schema before live migrations. Existing CLI access currently does not include OHMI.

## Authentication

Account page: sign up, sign in, sign out, confirmation/resend, forgot/reset password, Google, display name, and session restoration with actionable loading/errors. Allow password managers, paste, native labels, and keyboard navigation. Auth credentials pass only between this trusted page and the worker.

Google uses Supabase `signInWithOAuth` with PKCE and `skipBrowserRedirect`, then Chrome `identity.launchWebAuthFlow`, strict callback-origin/path validation, and `exchangeCodeForSession`. Prevent overlapping auth flows from overwriting a verifier. The owner supplied extension ID `ikemolangalcofljjajakagdnfdpnakh`; validate runtime identity against it. Provisional callback is the exact root `https://ikemolangalcofljjajakagdnfdpnakh.chromiumapp.org/`, pending comparison with the project's allow list. Keep the existing unpacked build path; a distributable stable manifest public key must be supplied/extracted from the registered extension, not invented from its ID.

Use emailed OTPs for confirmation and recovery in the trusted Account page. This avoids email links redirecting to localhost or an unhandled Chromium callback outside an active identity flow. Configure confirmation/recovery email templates to include `{{ .Token }}` and explicitly set the registered callback on email API calls. Verify the target URL allow list/templates and actual mail flow before claiming live completion. OTP entry supports paste and autocomplete; Google provides an alternative. Verify recovery before accepting a new password. Failed/cancelled Google flows clear their pending verifier and show a recoverable error. Invalid/expired sessions clear account views and request sign-in.

Live inspection confirmed the exact root callback is already allow-listed. The project uses eight-digit email OTPs; accept 6–10 digits rather than changing its existing length. Free default email delivery rejects custom templates and limits recipients to project-team addresses. The owner must configure custom SMTP for student email flows; templates remain prepared for deployment. Apply only Site URL/password strength now, preserving Google/provider settings and the existing callback list.

## Minimal schema

- `ohmi_profiles`: owner ID, display name, language, timestamps. Language synchronizes across sign-ins/devices; appearance, animation, mascot position/open remain device-local.
- `ohmi_assignments`: ID, owner ID, original filename, immutable private object path, MIME type, byte size, pending/ready status, timestamp.
- `ohmi_assignment_steps`: ID, assignment ID, owner ID, user-written step text, completion, timestamp. Composite assignment/owner FK prevents linking another student's assignment.

Every exposed table has RLS and explicit grants. Policies constrain ownership with `(select auth.uid())`, including INSERT/UPDATE checks. Immutable assignment fields have no UPDATE grants. Owner/foreign-key indexes support policies. No privileged triggers or security-definer functions are necessary. No conversation table yet: local sample chat remains demonstrative, not a student record.

Private `ohmi-assignments` bucket: PDF/PNG/JPEG only, 10 MiB limit. Object policies require the same authenticated owner and matching assignment metadata; updates/upserts are not supported. Paths are owner/assignment IDs plus a controlled extension, not user filename paths. Existing buckets/data must be inspected and preserved.

## Upload and deletion

Account page validates filename, declared MIME, size, and PDF/PNG/JPEG signature. Worker inserts pending metadata before allowing upload. Only the trusted Account page receives its current user's temporary upload authorization. It uploads with XMLHttpRequest to the exact Supabase Storage endpoint and shows actual byte progress. Tokens remain in trusted page memory. Worker verifies stored size/MIME before marking ready.

Failed uploads retain recoverable pending metadata when cleanup fails. Closing a tab mid-upload leaves a pending item that can be safely deleted/retried. Deletion removes the object first, then metadata; failed object deletion retains the record. Reopening uses a short-lived signed URL opened by the worker after rechecking ownership. Signed URLs are not injected into Tinkercad DOM.

The floating Assignments section lists the signed-in student's files, offers Upload (trusted page), Refresh, Open, Delete with confirmation, and a saved-step view. Students add/check/delete their own steps; no AI generation. The existing sample assignment/guide remain explicitly sample-only and separate from real records. Home/Ask/circuit samples and animations stay intact. Footer copy distinguishes private storage from sample AI features. Account state refreshes after trusted-page actions and on returning focus; disconnected UI keeps local demo available and offers retry.

## Verification

Unit tests cover sender/input authorization, public config validation, callback validation, file signatures/limits, and failure ordering. Local Supabase tests use two real test users to exercise table and Storage isolation, including cross-owner reads/writes/deletes and signed URLs. Generate TypeScript types from the applied local/live schema. Run existing browser regressions plus account/file/progress/loading/error flows; confirm content scripts cannot read trusted storage or invoke sensitive commands. Review rendered account and floating states at desktop/small sizes. Inspect built artifacts for privileged credentials and keep .env/config secrets ignored.

Live completion under the accepted scope requires target schema/redirect inspection, applied reviewed migrations, real Google flow, uploads/retrieval/deletion, and two-user privacy checks. Email delivery is pending SMTP. Local/mocked passes are labeled separately. Privileged-key rotation remains an owner action.
