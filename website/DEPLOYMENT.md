# OHMI frontend production setup

The owner approved production deployment on 24 October 2026. Preserve the cinematic landing page and Apple/iOS-inspired PWA designs. Backend integration remains outside this release.

## Architecture

| Surface | Vercel project | Repository root | Production branch | Public URL |
| --- | --- | --- | --- | --- |
| Cinematic landing | meetohmi | website | codex/ohmi-website | https://meetohmi.vercel.app/ |
| Next.js PWA | ohmi-workspace | web-app | codex/ohmi-web-app-pwa | https://ohmi-workspace.vercel.app/ |

The landing page redirects `/app` and `/app/:path*` to the corresponding PWA path using temporary HTTP redirects. Launch OHMI and Meet OHMI use `/app`; feature cards use `/app/ask`, `/app/checker` and `/app/guide`. Navigation anchors and all cinematic animation code stay unchanged.

The PWA keeps an origin-root Next.js build, manifest, image optimizer and service worker. A separate host avoids rewriting every absolute asset/service-worker path and keeps its cache scope away from the landing page. `/app` is an entry point that redirects, not a reverse-proxied application.

Both projects use the existing Hobby team. No paid add-ons, backend credentials or application environment variables are required. Static landing build: `node build.mjs`, output `dist`, empty install command. PWA build: `npm run build`, install `npm ci`, framework Next.js. Both use Node 24.x. Git deployment allowlists restrict each project to its approved branch.

## Updating

1. Fetch the remote and work on the correct production branch in an isolated checkout.
2. Edit `website/src` for the landing page, or `web-app/src` for the PWA. Preserve approved designs unless the owner requests a change.
3. Run that project's build and tests. For the landing page, also run `website/tests/cinematic-browser.mjs`; for the PWA run its `test:browser` script against a running production build.
4. Commit only the intended project changes. Push to its production branch; Vercel builds and updates that project's domain automatically.
5. Check Vercel reports READY, then verify the public URL, direct routes, assets and app links in a clean browser.

Never commit `.env*`, `.vercel`, dependencies, caches or build output. The landing page build generates ignored `dist` from versioned `src`. Do not merge unrelated extension/backend work into the landing production branch.

## Rollback

Before this release, the previous live landing page was preserved in remote tag `ohmi-landing-before-cinematic-2026-10-24`, commit `c16c183bbaefe92dff27183262f46be389871f67`. Its Vercel production deployment is `dpl_225ZxyGLrerMrBiF5CiK8bM5kUgZ` (`meetohmi-78te0ampt-janveryu1-s-projects.vercel.app`).

Use Vercel's Rollback on the previous production deployment for an immediate recovery. Preserve Git history: revert the release commit rather than force-pushing the branch. The initial PWA frontend is retained at commit `4a244c9cebdd5e42add6ec7717ce199f20702fe9` on its own branch.

## Data and testing limits

The deployed PWA remains a clearly labeled frontend demonstration. Chat uses presets, uploads are local previews, and screenshot findings are illustrative. No account, database, live AI or cloud persistence is connected. Offline caching contains only the public fallback, mascot and icons. Physical-device installation and real hardware accuracy require separate qualification.
