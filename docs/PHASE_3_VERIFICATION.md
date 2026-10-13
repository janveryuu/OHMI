# Phase 3 verification — version 0.3.0

## Accepted scope

Google authentication, private assignments, profiles/language, and saved student-written steps. The owner explicitly deferred email confirmation/password reset until custom SMTP; verification remains required and those delivery-dependent actions are gated. Phase 4 is excluded.

## Actual results

| Check | Result | Evidence/limit |
| --- | --- | --- |
| `npm test` | **24/24 passed**, five files | Sender/input restrictions, file/config/callback validation, eight-digit OTP acceptance, stale-account guard, auth concurrency/cancellation/exchange failure, cleanup-lock recovery, failed deletion ordering, incomplete-upload rejection, existing placement/routes/preferences. Worker failure tests use mocks. |
| `npm run typecheck` | **Passed** | WXT preparation and TypeScript, including live-generated database types. |
| `npm run build` | **Passed**, 0.3.0 | Production MV3 bundle, approximately 2.23 MB including the original 1.44 MB PNG. |
| `npm run test:browser` | **Passed** | Phase 1/2 interactions, six sample sections, keyboard/touch event isolation, responsive layout, reduced motion, local persistence, SPA navigation, Account labels/navigation, no host password input, no page errors. Uses a simulated editor. |
| `node tests/backend.mjs` | **Passed** | Actual local Supabase, two disposable users, profile/preferences and assignment/step CRUD, private upload/download/signed-link bytes, ownership constraints, anonymous/cross-owner denial. Fixtures removed. |
| `node tests/backend-live.mjs` | **Passed** | Same privacy tests against existing OHMI, plus actual extension worker/UI login/logout, XHR upload, opened signed file, saved name/steps/language, account switching, stale-account rejection, trusted storage/message denial, browser restart with forced expiry and successful refresh, deletion. |
| Interrupted upload | **Passed** | Storage upload HTTP failure injected in browser; real live pending metadata created and cleaned through owner APIs; UI shows error and allows retry. Not a claim of physical network failure testing. |
| Google login | **Owner confirmed in real Chrome/Tinkercad** | Private workspace, correct Google email, successful display-name saving. OAuth consent is not automated by fixture login tests. |
| Migration history | **Matched** | Local/remote `20261012141823`; existing project preserved. |
| Local security advisor | **No issues found** | Fresh CLI run after migration replay. |
| Live security advisor | **One Auth warning** | `auth_leaked_password_protection` disabled. No table/RLS/storage warnings. This feature requires Supabase Pro or above; no paid upgrade was made. See [password security](https://supabase.com/docs/guides/auth/password-security). |

Live fixtures use exactly two random reserved test addresses and an explicit marker. Success deletes their files/metadata through owner APIs and only their two Auth records through guarded CLI SQL. No production service-role key is used. Confirmed fixture provisioning does **not** verify production email registration or bypass student verification.

## Security and identity

- Three tables have RLS, explicit grants, immutable ownership fields, owner indexes, and a composite assignment/owner step FK.
- Bucket is private, limits files to PDF/PNG/JPEG and 10 MiB, and requires matching owner metadata. File replacement/upsert is unsupported.
- Background validates actual Chrome sender ID/page/frame and payload. Content scripts cannot request auth or upload authorization, or read Chrome auth storage.
- Data actions carry a non-secret account snapshot. Worker independently verifies the current user, rejects stale snapshots, and derives ownership from Auth.
- Passwords, refresh/access tokens, and PKCE verifiers stay in trusted contexts. Signed file URLs are opened by the worker, not injected into Tinkercad DOM.
- Deletion removes the object before metadata. Failed object deletion keeps the record. Incomplete uploads remain recoverable if cleanup fails or a tab closes mid-transfer.
- Permissions are only `storage`, `identity`, Tinkercad, and the exact Supabase host. Minimum Chrome 116. No externally-connectable messages, capture, or AI integration.
- Exact front PNG SHA-256 in source and build: `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382`.
- The tested unpacked extension ID matches the existing callback. Other machines require the original registered public manifest key.
- Privileged-key/build scans and ignored-file checks found no embedded privileged credentials. Local `.env`, `.superpowers`, CLI cache, dependencies, and generated output are excluded from Git.

## Fresh final review and fixes

A separate fresh reviewer inspected the whole change against Phase 2 commit `1f893dc`, the specification, plan, and security focus.

**Important finding fixed:** stale Account A input could otherwise save to B after a second page changed accounts. The worker now rejects mismatched account snapshots; trusted Account pages receive notifications; inputs/actions wait for account refresh; upload continuations abort on account change. Regression observed failing, then passed. Live two-page test confirms stale A input is rejected and B's view replaces it.

**Additional verified fixes:** cancellation cleanup could leave the auth lock set if Chrome storage failed (RED → GREEN unit regression). Saved-step checkbox now updates immediately and rolls back on save failure; the original failing live checkbox test passes, and completion persists across reload/restart. Language controls wait for account loading before changes; two-account language restoration passes.

**Deferred minor:** legacy sample upload copy still says real uploads are unavailable. It refers to the sample analysis/circuit area; functional private uploads appear separately above it. README clarifies the distinction. Clarify this sample copy in a later UI change.

## Decisions and costs

1. Kept a feature branch in the original checkout to preserve unpacked extension identity; cost is less filesystem isolation than a separate worktree.
2. Prepared email OTP templates instead of unhandled external email callbacks. Cost: SMTP/template verification and pasted codes are required before enabling delivery flows.
3. Accepted the owner's Google-first handoff with SMTP pending. No verification bypass; cost: email signup/confirmation/reset are not yet available to students.
4. Used account ID only as a stale-view guard, never as ownership authorization. Cost: stale tabs must refresh before saving; RLS remains authoritative.
5. Committed the coherent verified Phase 3 change together rather than incomplete intermediate slices; Phase 2 remains the recoverable baseline.

## Manual work still needed

- Reload the final 0.3.0 build and refresh Circuits. Repeat Google login/restart, one real PDF/PNG/JPG upload/open/delete, and saved steps in your regular Chrome profile. Backend/temporary-Chromium versions already passed.
- Try a second intended Google account and cancel/retry the real Google window. Consent-screen account restrictions and real popup behavior remain provider/browser checks.
- Confirm privileged keys previously pasted have been rotated in Supabase. Rotation was requested; confirmation has not been received.
- Configure custom SMTP and verify confirmation/recovery before enabling email delivery. No paid leaked-password protection was enabled.
- Screen-reader behavior, physical touch, real Chrome zoom, and current signed-in Tinkercad toolbar placement still need human checks. Existing Phase 1/2 behavior passed automated regression; owner reported it working previously.

## Screenshots

All test-editor images are explicitly simulated; fixture emails are disposable, not student identities.

- [Account desktop](screenshots/phase-3-account.png)
- [Account 320 px](screenshots/phase-3-account-small.png)
- [Private live-backed workspace](screenshots/phase-3-private-account.png)
- [Saved live-backed steps](screenshots/phase-3-saved-steps.png)
- [Interrupted-upload error](screenshots/phase-3-upload-error.png)

For reproducible setup and guarded test commands, see [Phase 3 setup](PHASE_3_SETUP.md).

## Git handoff

Implementation commit `f189335c3527d35362ef214242f476c1491375f0` was fast-forwarded to `main` and pushed to `https://github.com/janveryuu/OHMI.git`. `git ls-remote` confirmed that exact implementation commit. The merged tree's 24 unit tests passed. Final live inspection confirmed **zero** disposable Phase 3 test users remaining, **three** RLS-protected tables, and a **private** bucket. A documentation follow-up records this completed handoff; Phase 4 remains unstarted.
