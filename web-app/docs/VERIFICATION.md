# Frontend verification

Verified 23 October 2026 against the local production Next.js build. No production deployment, hosted backend operation, real login or AI request was performed.

## Results

- Production build and independent TypeScript check pass. All seven routes, manifest and error/not-found boundaries build.
- Three local boundary tests pass: file validation, centered crop bounds and derived lesson progress.
- Existing extension regression suite passes: 290 tests across 23 files; root TypeScript check passes. Root configurations only exclude the separate web app.
- Browser matrix covers 1440×1000, 1024×768, 768×1024, 390×844, 320×640 and 844×390. Every route fits without horizontal overflow.
- Axe WCAG A/AA checks cover every route in light and dark modes. Final scan reports zero violations; this does not replace manual assistive-technology testing.
- Chat preset replies, safe code rendering, conversation switching, expansion, cancellation and client-route session continuity pass.
- Local file add/preview and cancel-removal pass. File type/extension, zero-byte and size boundaries have unit coverage.
- Centered image crop, reset, demo loading and explicitly illustrative findings pass.
- All five guide completion checks drive progress and achievements. Data is derived from actual session interactions.
- Appearance and accessibility preferences persist; demo profile and content clear on refresh. Mobile More navigation and companion fallback pass.
- Emulated phone tap and horizontal guide swipe pass. System reduced motion leaves no changing spatial animation; opacity feedback remains permitted.
- Deferred install-prompt availability survives navigation to Settings. Manifest and six-item public service-worker cache allowlist pass. Offline navigation opens the public fallback.

Full browser results: [browser-verification.json](browser-verification.json). Screenshots: [screenshots/](screenshots/).

## Performance

Lighthouse 13.5.0 against localhost production build, simulated mobile: **90 performance, 100 accessibility, 100 best practices**. LCP **3.6 s**, CLS **0.001**, TBT **90 ms**. See [lighthouse-summary.json](lighthouse-summary.json). The full local report is retained under ignored `test-results/lighthouse-final.json`.

The original mascot stays byte-identical. Next Image supplies responsive display sizes and a high-priority dashboard image. Initial route content stays visible during hydration. These changes improved the initial mobile lab LCP from 10.9 s to 3.6 s. The 2.5 s LCP target remains unmet in this lab run. These numbers are not deployed field metrics; INP has not been established from real user traffic.

## Independent design review

Impeccable review initially requested five fixes: companion client routing, primary CTA contrast, accessible tablet navigation names, visible mobile component materials and removal of two eyebrow labels. The reviewer scored all five resolved, with `disposition: ship` for that fix list. That scoped verdict is not a claim of exhaustive product certification.

Mechanical detector ran once. Its only finding was Geist's popularity. The font was retained because it fits the explicit calm iOS-oriented brief and is self-hosted. Product UI guidance takes priority over marketing-page taste rules on these Operate surfaces.

## Regressions found and fixed

- Wrapping App Router children in keyed AnimatePresence briefly retained an outgoing route, permitting a newly selected file to be lost. The browser flow reproduced the loss. App Router now owns lifetime; template.tsx supplies a visible spring entrance.
- Unlayered anchor color rules overrode Tailwind button foregrounds. Explicit semantic variants restore contrast.
- A muted text token was slightly below 4.5:1 on secondary surfaces; it was darkened and the light/dark audit rerun.
- Tablet-only hiding of brand text exposed an unnamed home link. Explicit home/profile names and tablet/mobile shell axe checks close this gap.
- Worker registration originally depended on opening Settings/More. Registration now occurs on initial app load.
- Install events are retained for later-mounted Settings controls. Update activation still requires a user action.

## Limits

- No live Supabase/authentication, AI analysis, file uploads or student records. Preset review findings do not depend on uploaded pixels. No electrical verification is claimed.
- Language preference is a frontend control; this version's interface and preset responses remain English.
- File selection, centered cropping and preview work locally; freeform crop handles and PDF extraction are outside this stage.
- Chromium automation and emulated touch cover browser behavior. Physical Android/iPhone/iPad devices, Safari, screen readers, real OS installation, real Document Picture-in-Picture windows and real virtual keyboards have not been qualified. Document PiP denial/unavailability has an in-app fallback.
- Offline behavior deliberately provides only a public fallback, not personal content or a full offline tutoring session.
- No production Vercel project or domain was created. A future deployment needs an isolated host and explicit owner approval.
- Existing unrelated extension edits in the working tree were preserved and excluded from this task's commit.
