# Phase 3 setup

## Existing project and schema

Use existing **OHMI - YOUR CIRCUIT BODY**, ref `vhmdgfydvoljzqztuxmu`. Do not recreate it. Authenticated access uses the **Supabase CLI**, not MCP, and was verified before live changes.

Migration `20261012141823_ohmi_private_student_data.sql` is deployed. It creates three RLS-protected tables and private `ohmi-assignments` storage. It preserves unrelated data and rejects an incompatible existing bucket. Create another migration for later schema changes; never rewrite an applied migration.

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
4. After delivery works, enable `WXT_EMAIL_DELIVERY_READY=true`, rebuild/reload a test installation, and verify every extension email flow before distributing that build.

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
