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

Production verification is pending; do not treat a configured hostname or created project as a successful deployment.
