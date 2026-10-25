# OHMI frontend production setup

## Landing source authority, 25 October 2026

Publish the complete approved `website/src` from `codex/ohmi-website`. Integrate landing changes into that branch before release; a manually promoted review deployment can otherwise be overwritten by the next Git deployment. The approved workshop Explore art, PWA/GitHub installation options and breakdance animation must coexist. The static build now checks the artwork and installation controls. See [restoration evidence and release rule](design/explore-refresh/README.md). Preserve all existing PWA proxy rules and security headers.

The owner approved production deployment on 24 October 2026. Preserve the cinematic landing page and Apple/iOS-inspired PWA designs. Backend integration remains outside this release.

## Architecture

| Surface | Vercel project | Repository root | Production branch | Public URL |
| --- | --- | --- | --- | --- |
| Cinematic landing | meetohmi | website | codex/ohmi-website | https://meetohmi.vercel.app/ |
| Next.js PWA | ohmi-workspace | web-app | codex/ohmi-web-app-pwa | https://meetohmi.vercel.app/app/ |

The landing project externally rewrites `/app` and `/app/:path*` to the same prefixed paths on `https://ohmi-workspace.vercel.app`. The browser stays on `meetohmi.vercel.app`. Keep both slash-preserving page rules (`/app/`, `/app/:path*/`) and unslashed entry/asset rules (`/app`, `/app/:path*`); Vercel matches trailing slashes explicitly. Launch OHMI and Meet OHMI use `/app`; feature cards use `/app/ask`, `/app/checker` and `/app/guide`. Navigation anchors, styles, mascot and cinematic animation code remain unchanged.

The independently deployed Next.js PWA uses `basePath: "/app"` and `trailingSlash: true`. Unsuffixed routes redirect to the same-origin slash form. Manifest identity/start/scope, icon and image paths, offline fallback, and worker registration use `/app/`. The worker cannot control the landing page. The standalone production alias remains available at `https://ohmi-workspace.vercel.app/app/`; its former root routes redirect for compatibility. Deploy app path support before switching the landing proxy.

Both projects use the existing Hobby team. No paid add-ons, backend credentials or application environment variables are required. Static landing build: `node build.mjs`, output `dist`, empty install command. PWA build: `npm run build`, install `npm ci`, framework Next.js. Both use Node 24.x. Git deployment allowlists restrict each project to its approved branch.

## Updating

1. Fetch the remote and work on the correct production branch in an isolated checkout.
2. Edit `website/src` for the landing page, or `web-app/src` for the PWA. Preserve approved designs unless the owner requests a change.
3. Run that project's build and tests. For the landing page, also run `website/tests/cinematic-browser.mjs`; for the PWA run its `test:browser` script against a running production build.
4. Commit only the intended project changes. Push to its production branch; Vercel builds and updates that project's domain automatically.
5. Check Vercel reports READY, then verify the public URL, direct routes, assets and app links in a clean browser.

Never commit `.env*`, `.vercel`, dependencies, caches or build output. The landing page build generates ignored `dist` from versioned `src`. Do not merge unrelated extension/backend work into the landing production branch.

## Rollback

Before the unified-domain change, both production commits were tagged and pushed:

| Project | Remote rollback tag | Commit | Deployment |
| --- | --- | --- | --- |
| Landing | ohmi-landing-before-unified-domain-2026-10-24 | 7bec84a69907f882aca2b6753bdb2e0c67fe1050 | dpl_D8vP6ak8pyjf8EXruNu5uSG3hZ17 |
| PWA | ohmi-app-before-unified-domain-2026-10-24 | 1baadf432a50bc51f48d6686feb96a85d3ab7f5f | dpl_BT5tY68H7N4cuNFZ3t4PFccrzTzx |

For full rollback, use Vercel Rollback/Promote on the landing first, then the PWA. The restored landing uses temporary redirects to the standalone host. Reconcile source with normal Git reverts; never force-push. Do not restore the old root-only PWA while the landing still proxies `/app/`. The earlier `ohmi-landing-before-cinematic-2026-10-24` tag and deployment `dpl_225ZxyGLrerMrBiF5CiK8bM5kUgZ` remain preserved.

## Data and testing limits

The deployed PWA remains a clearly labeled frontend demonstration. Chat uses presets, uploads are local previews, and screenshot findings are illustrative. No account, database, live AI or cloud persistence is connected. Offline caching contains only the public fallback, mascot and icons. Physical-device installation and real hardware accuracy require separate qualification.

Existing installations and local preferences on the old PWA origin cannot migrate across origins. Reinstall from the official `/app/` URL. The standalone project serves a retirement worker at `/sw.js` to unregister its former root worker and clear only the old public-shell cache, without reloading user sessions.

## Unified-domain production verification, 24 October 2026

Actual HTTPS production checks pass: all seven prefixed routes return 200; Launch/Meet and feature links plus reload work at 1440, 768 and 390 pixels without leaving the official origin. Queries, same-origin manifest/icons, worker no-store headers, canonical redirects, old-origin redirects and root worker retirement pass. Chromium reports no installation eligibility errors; the landing remains uncontrolled by the app worker. Retirement preserves the new app cache and unrelated caches without navigating the page.

The cinematic suite passes five widths, motion-region pixel checks, unchanged sampled face, pause/resume/offscreen, keyboard, reduced motion, no-JavaScript and no-WebGL. Delivered CSS, interaction and scene code match approved source after line-ending normalization. No failed responses or page errors. Evidence: `design/production/links.json` and `motion.json`. Browser emulation does not qualify native OS installation or physical devices.
