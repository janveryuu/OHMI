# Phase 3 setup

## Existing project and schema

Use existing **OHMI - YOUR CIRCUIT BODY**, ref `vhmdgfydvoljzqztuxmu`. Do not recreate it. Authenticated access uses the **Supabase CLI**, not MCP, and was verified before live changes.

Migration `20261012141823_ohmi_private_student_data.sql` is deployed. It creates three RLS-protected tables and private `ohmi-assignments` storage. Six later applied Phase 4 migration files have been recovered unchanged to reconcile hosted history. Their objects/data remain dormant; they are not an active AI implementation. See [stabilization](PHASES_1-3_STABILIZATION.md). Create another reviewed forward migration for later schema changes; never rewrite an applied migration or reset the linked project.

## Extension configuration

Copy `.env.example` to ignored `.env`. Use the project's HTTPS URL and **publishable** key from Supabase Project Settings → API keys. The public key identifies the project; RLS and authenticated credentials enforce ownership.

- Registered ID: `ikemolangalcofljjajakagdnfdpnakh`
- Exact callback: `https://ikemolangalcofljjajakagdnfdpnakh.chromiumapp.org/`
- Minimum Chrome: 116
- Version: 0.3.0

The current unpacked build retains this ID at its original absolute path. Other checkouts/machines may get another ID. For distribution, set `WXT_EXTENSION_PUBLIC_KEY` to the original registered extension's **public manifest key**. Never include a private signing key. An ID cannot be converted back into a public key.

Configuration rejects secret/legacy JWT keys. Never add Google client secrets, service-role keys, SMTP secrets, or AI credentials to WXT variables. Rotate privileged keys previously exposed in chat; keep replacements out of source/chat.

## Google authentication

Google was already enabled. Existing provider settings and callback allow list were preserved. Site URL now uses the registered callback; minimum password length is 10; email confirmation remains required.

OHMI uses PKCE, trusted Chrome storage, `skipBrowserRedirect`, `identity.launchWebAuthFlow`, strict callback validation, and background code exchange. Content scripts receive no session credentials. Auth flows are serialized; cancellation clears the verifier. Sessions refresh on demand rather than through a worker polling timer.

Reload OHMI, refresh Circuits, then Settings → Sign in to OHMI → Continue with Google. The owner confirmed real Google login, correct email, and display-name saving. Google consent-screen restrictions remain controlled by existing OAuth configuration; check intended student access before expanding the beta.

## Email confirmation/reset: pending custom SMTP

The owner explicitly deferred delivery. Supabase's default provider rejected custom templates and limits recipients to project-team addresses. **Never disable verification or auto-confirm students to work around this.**

Prepared files:

- `supabase/templates/confirmation.html`
- `supabase/templates/recovery.html`
- `supabase/hosted-auth.toml` — desired scoped configuration; templates are not yet applied.

Once SMTP is available:

1. Configure [OHMI Authentication → Email/SMTP](https://supabase.com/dashboard/project/vhmdgfydvoljzqztuxmu/auth/smtp). Keep credentials in Supabase only.
2. Use the prepared confirmation/recovery templates containing `{{ .Token }}`. Preserve verification, Google, and the allowed callback.
3. Verify delivery to a non-team test address, eight-digit OTP confirmation, resend, invalid/expired codes, recovery, new-password success, and old-password rejection.
4. After delivery works, enable `WXT_EMAIL_DELIVERY_READY=true`, rebuild/reload a test installation, and verify every extension email flow before distributing that build. Until then, UI entry points and worker requests remain gated; Google and existing confirmed-password accounts can sign in.

`supabase/config.toml` is **local development** configuration. Never push its full defaults to hosted Auth. The scoped hosted file describes an intentional later deployment after SMTP works.

## Local checks

With Docker Desktop and Node 22.12+:

```powershell
npm ci
npx --yes supabase@2.120.0 start
node tests/backend.mjs
npx --yes supabase@2.120.0 db advisors --local --type security --level warn --fail-on error
```

Local checks use localhost admin credentials in memory to provision confirmed disposable fixtures. They do not test or change production email verification. They run the same privacy checks used live and remove fixtures. Database resets are permitted only for disposable **local** development, never the linked live project.

## Guarded live checks

This test writes disposable fixtures. It refuses a linked project or environment URL other than existing OHMI. The owner authorized these checks.

```powershell
npx --yes supabase@2.120.0 link --project-ref vhmdgfydvoljzqztuxmu --yes
npm run build
node tests/backend-live.mjs
```

Set `OHMI_CHROMIUM_PATH` if needed. Exactly two randomly named `ohmi-phase3-…@example.test` accounts receive a test marker. The script runs public Auth/API/Storage and extension flows, then deletes only those accounts. Authorized CLI SQL provisions test fixtures; no production service-role key is used.

On failure, disposable test credentials remain in ignored `.superpowers/sdd/2026-10-12-phase-3`. Run `node tests/cleanup-live.mjs` before retrying. It validates target/fixture identities, deletes objects before metadata, and deletes only recorded marked accounts. The test directory must exist; create it with `New-Item -ItemType Directory -Force .superpowers/sdd/2026-10-12-phase-3` after a clean checkout.

```powershell
npx --yes supabase@2.120.0 db advisors --linked --type security --level warn --fail-on error
```

References: [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [private Storage](https://supabase.com/docs/guides/storage/security/access-control), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity).

## Portable extension identity — owner action

The owner confirmed no existing registered public manifest key is available. Preserve the current installation loaded from **`C:\Users\LEGION\Documents\OHMI - Your Circuit Buddy\.output\chrome-mv3`**. In `chrome://extensions`, confirm ID **`ikemolangalcofljjajakagdnfdpnakh`** before reloading; do not remove/reinstall from another folder. Existing Google functionality must continue using this identity and `https://ikemolangalcofljjajakagdnfdpnakh.chromiumapp.org/`.

If an existing Chrome Web Store item with this exact ID exists:

1. Open its Developer Dashboard → Package → View public key. Copy only the base64 between the PUBLIC KEY markers, without newlines. Never use a private signing key.
2. Put that public value in ignored `.env` as `WXT_EXTENSION_PUBLIC_KEY`. Preserve `WXT_EXTENSION_ID` and `WXT_EXTENSION_CALLBACK`.
3. Build and test a separate temporary-profile installation from a different folder. Confirm it yields the **same registered ID**, then complete Google consent/cancel/retry. A mismatched ID is not a valid replacement. Do not alter credentials to conceal a mismatch.

If this was only a path-derived unpacked installation, there may be no corresponding key. An extension ID cannot be reversed into its public key. Creating a new Web Store item/key establishes a **different** identity and needs a separately approved migration. No Web Store registration/payment is required or authorized by this stabilization. Existing local extension storage/session is not automatically transferred to a different ID.

For that later approved identity migration, the exact OAuth checks are:

1. In Supabase Authentication → URL Configuration, retain the current callback and add `https://<approved-new-extension-id>.chromiumapp.org/` to Redirect URLs. Move the Site URL only as part of that reviewed migration.
2. In Google Cloud Console → Google Auth Platform → Clients (or APIs & Services → Credentials), open the **existing Web application OAuth client configured in Supabase's Google provider**. Its Authorized redirect URI must remain **`https://vhmdgfydvoljzqztuxmu.supabase.co/auth/v1/callback`**. Do not replace this with a chromiumapp URL: the extension callback belongs in Supabase's redirect allowlist. Do not create/change the Google client ID or secret silently.
3. In Google Auth Platform → Audience, inspect External/Internal and Testing/Production status. While Testing, add intended classmates as test users if needed. Organization restrictions may still apply. Validate a second intended Google user before broad distribution.
4. Set the approved new public manifest key, matching ID and extension callback together. Rebuild/reload only the test installation, confirm its ID across two folders, then verify Google consent/cancel/retry, logout/login and restored private assignments. Preserve the old installation/callback until migration acceptance.

Chrome's [manifest key instructions](https://developer.chrome.com/docs/extensions/reference/manifest/key) describe obtaining a public key. Uploading a new item does not recover this old path-derived ID.

## Security actions — owner only

**Rotation status: UNVERIFIED**, confirmed by owner on 15 October 2026. Read-only CLI metadata (without `--reveal`) lists a default secret key and legacy `service_role` key. Metadata cannot prove that previously exposed values were revoked. Neither is used in OHMI's frontend; only the publishable key is allowed there.

1. Open Supabase Project Settings → API Keys. Review secret keys and the legacy anon/service_role tab privately against the exposure record. Verify revocation for every exposed `sb_secret_...` key and legacy `service_role` JWT. Never paste values into chat, source, handoff notes or screenshots.
2. If an exposed secret key is still active, schedule an owner-approved task: create a replacement, update only server consumers, verify them, then revoke the exposed key. Do not rotate the frontend publishable key unnecessarily.
3. A legacy `service_role` key depends on legacy JWT signing configuration. Review Project Settings → JWT Keys / legacy JWT secret and dependent services before any rotation. Revoking legacy signing material can affect API keys and active sessions; obtain approval for that impact. Do not assume rotating an unrelated API key revokes an exposed service-role JWT. Follow [Supabase API-key guidance](https://supabase.com/docs/guides/api/api-keys).
4. Keep replacement credentials only in authorized server secret stores. Record the affected key type and completion date, not its value. Recheck backend access, existing-account login and private storage after any separately approved rotation.

The current linked security advisor returns only `auth_leaked_password_protection`. [Supabase password-security documentation](https://supabase.com/docs/guides/auth/password-security) states that leaked-password protection requires Pro or above. It remains disabled: no plan/billing change was authorized. If it later becomes included without additional cost, verify entitlement and obtain authorization before enabling it in Authentication → Email/password security. Minimum password length remains 10, verification remains required, Google remains enabled, and SMTP stays deferred. Do not activate a paid plan or paid SMTP as a workaround.
