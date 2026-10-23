# OHMI frontend implementation plan

**Goal:** Deliver the user-approved standalone frontend/PWA under web-app, preserving extension, backend and production website.

**Architecture:** Independent Next.js App Router project. Shared shell and tokens; route-specific client views. In-memory demo context owns conversations, files and lesson progress. No production deployment, network services or sensitive offline persistence.

**Approved spec:** User's attached OHMI Web App + PWA brief. Product/design constraints recorded in web-app/PRODUCT.md and web-app/DESIGN.md.

## Tasks
- [x] Independent package, tokens, original mascot, shadcn controls, adaptive shell, theme/reduced-motion preferences.
- [x] Dashboard, chat/history/attachments/expand, assignment library/local previews, circuit crop/demo states, guide and derived progress, settings, capability-detected companion.
- [x] Public-only PWA cache, installation instructions, safe update prompt and offline fallback.
- [x] Unit boundary checks, production build, desktop/tablet/mobile browser checks, screenshots, accessibility and motion checks.
- [x] Document verified limits, update scoped second-brain notes, commit only this task's files and push a non-production branch. Confirm remote commit.

## Review focus
Invalid or oversized files, replacement/reset during delayed demo response, mobile focus/keyboard/overflow, safe service-worker cache boundaries, unsupported Picture-in-Picture/install browsers.
