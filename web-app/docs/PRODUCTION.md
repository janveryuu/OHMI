# OHMI official domain

The owner authorized frontend routing and production deployment on 24 October 2026. Both approved designs remain unchanged.

| Surface | Official URL | Vercel project | Root | Production branch |
| --- | --- | --- | --- | --- |
| Cinematic landing | https://meetohmi.vercel.app/ | meetohmi | website | codex/ohmi-website |
| Web App + PWA | https://meetohmi.vercel.app/app/ | ohmi-workspace | web-app | codex/ohmi-web-app-pwa |

## Routing

The landing project's `website/vercel.json` externally rewrites `/app` and `/app/:path*` to the same prefixed paths on `https://ohmi-workspace.vercel.app`. Both slash-preserving page rules and unslashed entry/asset rules are required because Vercel matches trailing slashes explicitly. This is an internal proxy: browser URLs, assets, Next image optimization, fonts, RSC requests and installation remain on the official origin. Each project builds independently. No paid microfrontend service or backend proxy is required.

Next.js builds with `basePath: "/app"` and `trailingSlash: true`. `/app` and unslashed child routes redirect to their same-origin slash form. Slash forms are intentional: the app root, manifest start URL and worker scope all fit `/app/`. Next Link/router handle the prefix; raw image, icon, manifest and offline paths include it explicitly. Navigation selection and mobile label selectors account for the new paths without changing styling.

Launch OHMI and Meet OHMI link to `/app`; feature cards use `/app/ask`, `/app/checker` and `/app/guide`. All seven app routes are directly accessible and refreshable under `/app/`. The standalone project remains available at https://ohmi-workspace.vercel.app/app/. Its former root and seven entry URLs redirect to their new prefixed equivalents, so old landing redirects remain usable during rollout.

## PWA and data

Manifest identity, start URL and scope are `/app/`; shortcuts and icon URLs share that prefix. `/app/sw.js` registers only for `/app/`, explicitly ignores other paths and query-bearing requests, and caches exactly six public offline/mascot/icon assets in `ohmi-app-public-shell-v2`. It never caches private responses, chat, files, API or RSC content. Landing pages remain outside worker control. Updates still require the existing Apply update action.

Only on the standalone project, `/sw.js` serves the same script in retirement mode, selected by its own script URL. Vercel serves public files before configured rewrites, so retirement is handled inside the worker rather than a rewrite. It unregisters the old root worker and deletes only its former `ohmi-public-shell-*` caches, without forcing a session reload. Existing installations on the old origin cannot transfer identity or local preferences across origins. Reinstall from the official `/app/` URL to use the official origin. Browser/OS installation UI remains platform-dependent.

No Supabase, AI providers, Chrome extension, credentials, remote uploads or backend behavior changed. Both projects retain their existing Hobby plan, zero app environment variables, isolated roots and security headers.

## Updates

GitHub repository: `janveryuu/OHMI`. Push app changes to `codex/ohmi-web-app-pwa`, landing changes to `codex/ohmi-website`. Vercel Git integration and branch allowlists remain enabled. Confirm READY and inspect production URLs after each release. Routine app changes require only the app deployment; the proxy follows its stable production alias.

From `web-app`, run build, typecheck, unit tests and browser tests. Local production URL: `http://127.0.0.1:3100/app/`. For live verification:

```powershell
$env:OHMI_TEST_URL='https://meetohmi.vercel.app/app'
npm run test:browser
```

In the landing worktree run build/source checks, `tests/cinematic-browser.mjs` with `OHMI_WEBSITE_URL=https://meetohmi.vercel.app`, and `tests/production-links.mjs`. These check the preserved animation and official-origin launch routes. Never commit environment files, `.vercel`, dependencies, build output or unrelated extension work.

## Rollback captured before changing routing

| Project | Remote tag | Commit | Previous production deployment |
| --- | --- | --- | --- |
| Landing | ohmi-landing-before-unified-domain-2026-10-24 | 7bec84a69907f882aca2b6753bdb2e0c67fe1050 | dpl_D8vP6ak8pyjf8EXruNu5uSG3hZ17 |
| PWA | ohmi-app-before-unified-domain-2026-10-24 | 1baadf432a50bc51f48d6686feb96a85d3ab7f5f | dpl_BT5tY68H7N4cuNFZ3t4PFccrzTzx |

For full rollback, restore the landing deployment first (it redirects to the standalone project), then restore the PWA deployment. Use Vercel Rollback/Promote, then normal Git reverts to reconcile source. Never force-push. Do not restore the old root-only PWA while the landing still proxies `/app/`. Original cinematic rollback tag remains preserved too.

## Verification limits

Production evidence is stored beside this document and in `website/design/production`. Browser tests use real HTTPS URLs with desktop/tablet/mobile viewports, not physical phones. Native OS installation, Safari, screen readers and real Document Picture-in-Picture remain unqualified. The frontend remains the approved, clearly labeled demonstration with local session-only files, chat and progress.
