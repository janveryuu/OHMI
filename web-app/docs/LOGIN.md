# OHMI welcome and authentication

The owner approved the frontend and non-destructive integration on 25 October 2026. Production deployment requires the owner's review of the completed experience. Work is isolated on `codex/ohmi-premium-login`, based on production source `426ab8a` and merged with incoming Playground source `a6f6699` before final verification.

## Surface contract

Operate mode: sign in and continue to the intended workspace. The supplied collage governs composition only: scenic split on desktop, a compact scenic header and single panel on mobile. Existing Geist typography, mint accents, semantic light/charcoal tokens, controls and exact original pixel mascot remain authoritative. Design variance 6, motion 6, density 3. This is a code-led extension of the established design, not a replacement identity.

The approved countryside is reused byte-for-byte from `website/src/assets/countryside-1672.webp` on the landing branch. The standalone mascot remains `public/mascot.png`, unchanged. Google’s unmodified G asset comes from `https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg`; button guidance: `https://developers.google.com/identity/branding-guidelines`. The owner's collage is the visual reference; the saved Mobbin/Refero catalogs supplied supporting navigation and system references, not copied layouts or characters.

The page inherits new-user light mode and the existing saved-preference script. A manual theme control includes system-theme resolution. Entrance and press springs use installed Motion; the mascot greeting ends within five seconds. Reduced motion removes spatial movement. Landscape phones use a compact split so the primary action remains visible. Artwork remains static. No registration fields, other providers, invented legal links or generated replacement artwork were added. `AppFrame` defers the existing workspace shell on login; the countryside image is eager and explicitly high priority. The original shell and shared auth/theme providers remain in use.

## Authentication and navigation

- Existing landing links already target `/app`, `/app/ask`, `/app/checker` and `/app/guide`. They need no visual or source changes.
- `src/proxy.ts` verifies users through the existing Supabase Auth service before rendering workspace routes, refreshes cookies and preserves refresh cookies on redirects. APIs retain their independent authentication, origin checks and RLS.
- Signed-out page requests go to `/app/login/`. A validated `next` path preserves intended navigation. Authenticated login requests return to that path or `/app/`.
- The existing Google PKCE implementation and **exact registered** `/app/auth/callback/` remain in use. A ten-minute, non-sensitive `ohmi-web-return` cookie carries only an allowlisted route. The callback validates it again, clears it, and never trusts a client session or external return URL.
- Cancelled consent and failed code exchange return to login with fixed recovery copy, without displaying provider details. Offline start leaves the user on the page. Returning through browser history resets pending sign-in feedback.
- Successful local sign-out clears private in-memory state, aborts in-flight reads and replaces the page with login. Expiration and cross-tab sign-out also hide the workspace and route to login.
- Login, page redirects and callbacks use private/no-store responses. The worker retains its public-only cache and `/app/` scope, including on login. No auth response or private data is added to its cache.

No schema, provider, credential, billing, landing, extension or hosted configuration changes are required. Existing production environment variables and callback allowlists remain in force. The separate Playground worktree is untouched. Its incoming production source is preserved through a normal merge; the page guard and safe return helper cover `/app/playground/`. This task applies no migrations or hosted writes.

## Local verification

Use the ignored `.env.local` below **only for controlled local tests**. It does not contain real credentials and must never be deployed:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-publishable-key
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3115
OHMI_LOCAL_TEST=true
OHMI_WEB_AI_ENABLED=false
```

Build and start Next at port 3115, then run the suites sequentially. Each browser script starts and closes its local Auth/Data API double at port 54329. The application contains no test authentication bypass; its real Supabase SDK verifies against the configured service.

```powershell
npm run typecheck
npm test
npm run build
npm run start -- --port 3115
# Separate terminal, same web-app directory:
npm run test:login
npm run test:browser
node tests/library-browser.mjs
node tests/playground-browser.mjs
node tests/playground-interactions.mjs
```

`test:login` covers the real SDK’s Google authorization parameters, PKCE challenge/verifier exchange, cookie session, safe returns, cancellation, invalid exchange, session restoration/refresh, logout, account isolation, keyboard/touch, light/dark persistence and six screen sizes. Browser and library suites use synthetic authenticated sessions and retain their existing UI, API-denial, PWA and library checks. They make no hosted writes or real AI calls.

Live Google consent with an actual Google account and production proxy delivery require the owner's review/release step. Local mocks do not establish those results. Physical devices, Safari, native installation and screen readers are outside the automated browser evidence.

Screenshots and the final verification record are under `design/login/`. A rollback can revert the login commit; production remains on the existing release until approved.
