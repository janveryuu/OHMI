# Explore restoration and deployment-source repair

25 October 2026. The owner reported the approved workshop images had reverted and requested restoration plus a complete GitHub push.

## Cause

The earlier artwork/installation update was committed to `codex/ohmi-cinematic-review` (`f16b73f`, evidence `d71dad3`) and manually published as deployment `dpl_Czw6C37LmLUSWBotqY5MJr7DNAdL`. It was not integrated into the production source branch `codex/ohmi-website`.

Later production commit `67f64aba7d1f12fc8ea1d0026c45f86dceef7d60` added the approved breakdance animation. Its automatic deployment `dpl_HezKvfGDLfguLAzv56x8nQ4EPBk6`, created at 16:22:25 Asia/Manila, rebuilt the production branch's older screenshots and removed the earlier installation row. The public HTML confirmed `ask-preview.webp`, `check-preview.webp` and `build-preview.webp` were being served. This was a source/deployment mismatch, not evidence of browser caching.

## Repair

Apply the narrow approved Explore changes directly to the current production branch, preserving the breakdance code/video and all hosting headers/PWA rewrites. Restore the three optimized workshop WebPs, installation buttons, manual setup explanation and valid GitHub Quickstart destination. Include original high-resolution PNGs in `originals/` and exact generation prompts in `prompts.json`; only optimized WebPs ship in `src/assets`.

Both the production build and source tests now require all three artwork references and both installation paths. Missing assets fail the build. A source regression also requires the newer breakdance element. A deliberately failing pre-fix test reproduced `Approved Explore artwork must be retained: ask-workshop.webp`; the completed source and build pass.

## Verification

Chromium at 1440, 1024, 768, 390 and 320 CSS pixels: three 1200 x 751 images decode, no document overflow, both 56px actions fit, and keyboard focus is visible. Normal-motion breakdance playback remains muted, looping and active; reduced motion pauses it and shows the still image. Explore axe scan: no violations. No page errors or failed local responses. See `restoration-verification.json` and desktop/mobile captures. Source comparison confirms `app.js`, the dance video and `vercel.json` are unchanged.

Do not claim physical-device/Safari/screen-reader, signed-in PWA, extension-installation or live-AI verification. Public route checks establish availability and expected login redirects only.

## Release rule

The canonical landing source is `website/src` on **`codex/ohmi-website`**. All landing releases must include reviewed changes on that branch before publishing. A manual promotion from another branch is not a replacement for integration. Keep this branch's complete approved website features together. Retain the build assertions if changing unrelated artwork or motion; deliberately revise them only when the owner approves a new Explore design.

Push every intended landing source, asset, test, configuration and documentation change. Keep credentials, `.vercel`, dependencies, generated `dist`, caches and unrelated work in other checkouts excluded. Never force-push or replace the entire website with an older review branch. The separate PWA production branch, Supabase and student data are outside this fix.
