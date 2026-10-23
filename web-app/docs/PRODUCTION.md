# OHMI public frontends

Production hosting was authorized by the owner on 24 October 2026. Both approved designs are preserved.

| Surface | URL | Vercel project | Root | Production branch |
| --- | --- | --- | --- | --- |
| Cinematic landing | https://meetohmi.vercel.app/ | meetohmi | website | codex/ohmi-website |
| App + PWA | https://ohmi-workspace.vercel.app/ | ohmi-workspace | web-app | codex/ohmi-web-app-pwa |

## Routing and isolation

`https://meetohmi.vercel.app/app` returns a 307 redirect to the PWA. Nested paths redirect to their equivalent: `/app/ask`, `/app/checker`, `/app/guide`. Launch OHMI, Meet OHMI and the three feature cards use these real entry points. Other landing navigation remains local scrolling.

This is a separate production origin, not a reverse proxy under `/app`. It preserves the app's root-relative routes, Next image optimizer, manifest and service worker while keeping its cache separate from the landing page. Both origins use HTTPS. The service-worker response uses `no-cache, no-store, must-revalidate`; private demo content is never cached. Both projects deny framing, disable MIME sniffing and use a strict cross-origin referrer policy.

The existing Vercel team stays on Hobby. No paid services or application environment variables were added. Projects exclude files outside their own root. No Supabase/authentication, live AI, remote uploads or cloud persistence is connected. Frontend demonstration labels remain visible.

## Git and updates

Each project is connected to `janveryuu/OHMI` and tracks only its production branch. Its `vercel.json` disables other branches. Pushing an approved commit to that branch triggers an automated Vercel production build; confirm READY before reporting release success.

For the PWA, edit `web-app`, run `npm ci`, `npm run build`, `npm test`, `npm run typecheck`, then run `npm run test:browser` against a running build. For actual HTTPS verification, set `OHMI_TEST_URL=https://ohmi-workspace.vercel.app` before the browser script. The test uses demo content only.

For the landing page, use the retained `ohmi-website-motion` worktree on `codex/ohmi-website`. Edit `website/src`, run its build/source/browser tests. Set `OHMI_WEBSITE_URL=https://meetohmi.vercel.app` for production motion checks, and run `website/tests/production-links.mjs` to exercise every Launch/Meet/feature link at desktop, tablet and mobile sizes. Do not merge unrelated extension changes into the landing branch.

PWA updates wait until the user chooses Apply update; the app warns that in-memory content clears. Advance the public-shell cache version when changing cached public assets. Never add private responses, credentials or user files to its allowlist.

## Rollback

The previous landing production is preserved by remote tag `ohmi-landing-before-cinematic-2026-10-24`, commit `c16c183bbaefe92dff27183262f46be389871f67`. Its Vercel deployment is `dpl_225ZxyGLrerMrBiF5CiK8bM5kUgZ`. Use Vercel Rollback for immediate domain recovery, then a normal Git revert to reconcile source. Do not force-push.

The original PWA frontend is retained at `4a244c9cebdd5e42add6ec7717ce199f20702fe9`; production configuration was added in `3238de92cec6a71e7a93c136dcd18f79400b4d40`.

## Public verification

- Live PWA: all seven routes at six viewports, light/dark and adaptive-shell accessibility scans, local chat/file/crop/guide/history flows, preferences, mobile navigation, install-prompt handoff, service worker/offline policy and emulated touch/reduced motion pass. No page errors, unexpected external requests or axe violations.
- Live landing: five viewports; WebGL motion in grass/hair/clouds/antennae; stable mascot face samples; pause/resume, offscreen pause, keyboard navigation, reduced motion, no-WebGL and no-JavaScript fallbacks pass. No runtime errors or failed asset responses.
- Launch and Meet, plus Ask/Checker/Guide cards, open the correct app view and survive refresh at 1440px, 768px and 390px. `/app` paths return expected 307 destinations.
- Nine delivered WebP/font assets match source hashes. Live CSS, interaction script and scene script match approved source after Git line-ending normalization. Styling and cinematic code were not redesigned.
- PWA build, TypeScript and three local boundary tests pass. No local server is needed to open either production URL.

Physical phones/tablets, Safari, screen readers, native OS installation and real Document Picture-in-Picture windows are not qualified. The PWA remains a demonstration, with English preset content and local session-only files/progress. Existing mobile Lighthouse LCP limits remain documented in VERIFICATION.md; these browser checks are not field performance claims.
