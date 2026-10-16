# Vercel deployment

- Account team: `janveryu1-s-projects`, confirmed Hobby plan.
- Project: `meetohmi`, separate from every existing project.
- Approved production hostname: `https://meetohmi.vercel.app`.
- Repository: `https://github.com/janveryuu/OHMI.git`.
- Dedicated production branch: `codex/ohmi-website`.
- Framework: Other (static HTML/CSS/JavaScript).
- Root directory: `website`; install command empty; build command `node build.mjs`; output directory `dist`.
- Application environment variables: none. Vercel-managed local authentication files are ignored and must never be committed or included in uploads.

`npm run build --prefix website` verifies the hand-authored static output, local assets, approved mascot hash, SEO metadata and unavailable download control. No compiler or dependency installation is needed. `.vercelignore` allows only the static output and build configuration into CLI source uploads. Git deployments use the website root, and `vercel.json` enables automatic deployment only for the dedicated website branch.

The existing `ohmi.vercel.app` site belongs to someone else. It was inspected read-only and must never be modified or claimed for this project. The owner explicitly selected `meetohmi` instead.

This deployment changes no Chrome-extension, Supabase or Phase 4 source. Website-only additions are a disabled Coming Soon download control, bounded cursor-following eye highlights over the unchanged original PNG, canonical/social metadata, robots and sitemap. Eye motion is disabled for reduced-motion and touch-only contexts. No paid service or add-on is enabled.

Local Vercel CLI 64.3.1 production builds fail on this Windows host with `spawn cmd.exe ENOENT`; the plain Node static build and browser checks pass. Use Vercel's Linux production builder for the authoritative deployed build. This is an environment limitation, not a claimed successful local Vercel build.

Production verified on 16 October 2026: https://meetohmi.vercel.app/ serves the website over HTTPS. Vercel's Linux production build is READY for commit `593d04c5f24113809214e7ddf8a7ca8d03769d6a`; the Git push automatically triggered deployment. The upload filter explicitly retains the website ancestor directory for repository-root Git builds.

Live Chromium checks passed at five viewport sizes (320–1505 px): layout, assets, navigation, keyboard tabs/FAQ/skip link, deep links, reduced motion, cursor-following eyes, unavailable download and static fallback. The in-app browser independently confirmed the live page, fonts, mascot and working Arduino tab. No browser or HTTP errors or external runtime requests were recorded by the browser suite. No application environment variables or further domain configuration are required. Physical-device and screen-reader checks were not performed.
