# OHMI Web App + PWA

## Platform

Web. Standalone installable PWA, with adaptive phone, tablet and desktop layouts.

## Product truth

OHMI helps students learn electronics through questions, assignments, screenshot review and beginner guides. The existing app integrates Supabase Google authentication, owner-scoped database records, private file storage and server-mediated AI tutoring. Account changes clear private in-memory state; appearance and accessibility preferences remain device-local. Private responses and authentication flows are excluded from the public-only PWA cache.

Documentation correction, 25 October 2026: the previous frontend-only/no-backend description was stale. This paragraph reconciles existing source and `docs/BACKEND_INTEGRATION.md`; it does not describe backend integration introduced by the login work.

The approved welcome/login work reuses the existing Google PKCE implementation and exact registered `/app/auth/callback/`, with safe return navigation and authenticated workspace guards. Controlled local Auth/API doubles verify integration states and PKCE behavior. They do not verify real Google consent or production delivery of this new experience; those remain unverified for this login release.

## Stack

User requested Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Motion and Lucide. This app has an independent package and build under web-app. Existing WXT extension and website remain independent.

## Constraints

Use the exact approved mascot PNG. Preserve teal identity. Do not imply Autodesk affiliation or electrical verification from a screenshot. Existing backend integration and prior production release are documented in `docs/BACKEND_INTEGRATION.md`. The owner requires review of the completed login before deployment; this feature branch must not deploy. Login work introduces no provider, schema or credential changes.

## Success

Preserve the existing study surfaces, authenticated data boundaries and public-only PWA cache. The login keeps its Google action visible across desktop, portrait phone and landscape phone layouts, with keyboard/touch access, light/dark modes, recovery states and reduced motion. Local verification and its limits are recorded in `docs/LOGIN.md`; six reviewed light/dark desktop, portrait and landscape captures are under `design/login/`. Owner review remains the gate for deployment.
