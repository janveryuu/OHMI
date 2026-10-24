# OHMI Playground verification

## Production release — 25 October 2026

The owner explicitly authorized immediate GitHub and Vercel publication. Production branch `codex/ohmi-web-app-pwa` is remote-confirmed at `a6f6699acd9a5089672b1571293e3effd8b85914`. Vercel production deployment `dpl_2njRsHikbdx5MwFdngTnXURAq3r6` is READY at `https://ohmi-workspace-k62pe2ah6-janveryu1-s-projects.vercel.app`; the official `https://meetohmi.vercel.app/app/playground/` serves the new feature.

Live verification passed all nine PWA route responses, unsafe-to-correct LED mission behavior and 9.09mA result, undo/redo, desktop/mobile in both themes, zero scoped axe violations/overflow/page errors, anonymous project denial, foreign-origin write denial and private no-store headers. See `production-playground-verification.json` and `screenshots/playground/production-*`. No live student account or new AI generation was used in this release smoke.

Rollback tag `ohmi-app-before-playground-2026-10-25` preserves source `426ab8ab3d36e1eeb6b1dbe67f88b23d99c31883`. Retain private Playground rows/table during any code rollback. The previously disclosed local mobile cold-load performance gap remains; this release smoke does not establish field Core Web Vitals.


Verified implementation: 25 October 2026, isolated branch `codex/ohmi-playground`, based on production source `426ab8ab3d36e1eeb6b1dbe67f88b23d99c31883`.

## Delivered M0-M6 scope

- Added `/app/playground/` and one navigation destination. Existing PWA pages, landing, extension behavior and approved artwork remain intact.
- Native drag/drop, tap-to-place, component dragging, keyboard placement/movement, numeric positioning, selection/deletion and 60-change undo/redo. Wires join named component terminals. Connections can also be made and selected through labeled native controls.
- Explicit pan mode isolates canvas gestures from page scrolling. Zoom, real Fit and component-centering controls support small screens. Editing terminals remain 44px; fit overview hides terminals and directs users to zoom in or use alternate controls.
- Deterministic one-source, one-red-LED DC series evaluation, with series resistors and optional ideal switches. Unsafe, unsupported, incomplete, open, off and expected-light states stay distinct. LED polarity, missing current limiting, supply limits, connectivity, bypasses, open paths, switch states, current and resistor power are checked.
- Three missions: build a basic LED loop; fix excessive current; check switch-controlled off/on states. Each has an objective, three progressive hints, deterministic completion and a circuit explanation. Electrical/topology edits reset switch observations.
- Private account save, copy, list pagination, reopen, edit and confirmed delete. Revision checks reject stale writes. Account changes discard private in-memory state and abort pending requests. Unsaved navigation warns before discarding work.
- Contextual Ask OHMI sends bounded, structured component settings, terminal netlist, mission and server-recomputed validation through the existing authenticated AI path. The explanation is labeled AI guidance and cannot alter electrical results. The existing provider/free-only gate remains authoritative.

## Passed verification

| Gate | Result |
| --- | --- |
| Web unit tests | 39 passed, 0 failed |
| Existing extension/backend tests | 282 passed across 22 files |
| Web and extension typechecks | Passed |
| Optimized production build | Passed; existing unpdf import.meta warning retained |
| Playground browser behavior | Missions, progressive hints, inspector edits, keyboard movement, delete/undo, switch states, zoom/pan passed |
| Placement and wiring | Native tray drag/drop, pointer movement, keyboard placement, terminal wiring, native-control wiring and clear/undo passed |
| Responsive/theme/a11y | 1440, 1024, 768, 390, 320 and 844 landscape widths in light/dark; no overflow, page errors or scoped axe violations |
| Touch | Emulated tap placement/terminal selection, 44px editing targets and scoped pan/page-scroll behavior passed |
| Existing PWA regression | Dashboard, Ask OHMI, Assignments, Checker, Guide, Progress, Settings, navigation, appearance, account controls, PWA/offline policy passed |
| Library regression | 20 detail routes, illustration decoding, four sizes in both themes, search/categories/URL restoration, keyboard navigation and image-failure fallback passed |
| Authenticated persistence | Real Supabase browser save, reload, reopen, edit/revision and deletion passed using two disposable accounts |
| Isolation and input boundaries | Cross-owner API read/update/delete, anonymous access, invalid origin, invalid project and stale revision denied |
| Direct RLS | Owner CRUD passed; foreign select/insert/update/delete and ownership reassignment denied; anonymous table access denied |

Database evidence: additive migration `20261024152911_playground_projects.sql` is applied to the existing OHMI Supabase project. It creates only `ohmi_playground_projects`, owner/time index, explicit authenticated CRUD grants, and operation-specific owner RLS. Existing student tables/data/policies were not modified. The RLS transaction rolled back its fixtures. Two real disposable browser-test accounts were signed out and removed; no test accounts or private contents are retained in evidence. `supabase/tests/playground_rls.sql` preserves the repeatable rollback-only check.

The authenticated browser script requires two disposable accounts marked `ohmi_playground_test: true`, with `ohmi-playground-…@example.test` emails, in ignored `.superpowers/playground-fixtures.json`. Never supply real student accounts. It deliberately clears only those verified fixture accounts' Playground rows. Test credentials are excluded and were removed after this run.

## Review and resolved issues

Independent design/source review returned **ship**, scoped to incumbent fidelity, supplied desktop/mobile captures and sampled source. The reviewer did not rerun the reported suites. Genuine Fit, mobile component centering, visible Save copy and nearby feedback resolved its material findings. A first screenshot set was rejected because focus/scroll and full-page fixed chrome obscured context; corrected top-of-document and real mobile viewport captures replaced it.

The mechanical design detector reported local microtype/radius advisories against the older global design metadata. The local surface notes document these workbench constraints without changing the existing global design system. No blocking detector finding was reported. PRODUCT schema/design-sidecar drift remains deferred.

## Mobile performance result

Final stable, optimized local mobile Lighthouse run: **78 performance / 100 accessibility / 100 best practices**. LCP **4.1 s**, total blocking time **320 ms**, CLS **0.002**, with no console errors. The 2.5 s LCP target is **not met**. Treat mobile cold-load performance as an explicit launch qualification gap, not a passing metric. Functional interaction, account isolation and responsive behavior gates passed independently.

Focused changes defer the Playground rich-text renderer until an AI reply exists, stop unrelated route prefetch only while Playground is open, and suppress only its duplicate generic signed-out notice. The Playground already supplies its own save/sign-in status; account error/configuration notices remain. Other PWA pages keep their existing presentation and prefetch behavior. The valid pre-optimization run measured 68 performance, 4.9 s LCP and 540 ms blocking; lab timings vary. The first attempted audit overlapped a rebuild and had missing chunks, so it was discarded rather than counted as application evidence. No further broad app-shell performance rewrite was undertaken.

## Limits and readiness

This is an educational model, not comprehensive simulation or physical verification. Supported assumptions: one 1.5-12 V ideal DC source, one fixed-2 V red LED, 1-20 mA expected-light range with a 20 mA ceiling, positive series resistance up to 1 MΩ per resistor, 0.25 W resistor ratings and ideal switches/wires. No breadboard electrical connectivity, branches/parallel networks, multiple LEDs/sources, transient effects, battery chemistry, LED brightness modeling, Arduino, buzzer or potentiometer behavior. Unsupported configurations never light an LED or receive a fabricated success result.

Signed-out experiments remain in memory. Account projects and mission progress persist only when explicitly saved. Refresh does not automatically restore the last canvas; open a saved project. Offline private saving is unavailable. No new live AI quality benchmark was performed; the unchanged provider path is covered by existing tests, while new context grounding is unit-tested. Physical phones, Safari, native screen readers, OS installation and production deployment of this feature remain unqualified.

## Release and rollback

Functional implementation and hosted additive storage are ready for the owner's release review, with the mobile LCP gap disclosed. Production deployment remains gated by the explicit instruction: “Request my approval before production deployment.” The feature branch can be pushed without advancing the configured production branch. The official landing and current production PWA remain unchanged until that approval.

After approval, integrate the verified feature into `codex/ohmi-web-app-pwa`, confirm the Vercel build is READY, then verify `/app/playground/` and existing official routes on `https://meetohmi.vercel.app/app/`. Preserve remote history; do not force-push. Rollback the app to source `426ab8a` or its preserved deployment if needed. Retain the additive Playground table and saved rows during rollback; do not drop student projects.

Evidence: `playground-browser.json`, `playground-account-verification.json`, `playground-lighthouse.json`, `playground-performance-before.json`, `PLAYGROUND_DESIGN.md`, and `screenshots/playground/`.
