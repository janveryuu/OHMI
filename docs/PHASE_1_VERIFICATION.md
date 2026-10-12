# Phase 1 verification — 2026-10-12

Phase 1 implementation is built and verified in the isolated test environment. Acceptance in an actual signed-in Tinkercad Circuits editor remains pending.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, no TypeScript errors. |
| `npm test` | Passed: 6 tests across 2 files, covering editor URL filtering, stored-state validation, viewport clamping, and panel placement without mascot overlap. |
| `npm run build` | Passed: Chrome Manifest V3 extension at `.output/chrome-mv3`; about 238 kB JavaScript, 11 kB CSS, and the 1.44 MB approved PNG. |
| `npm run test:browser` | Passed with a local Chromium executable and the production extension, on a simulated HTTPS editor URL. |
| Browser interactions | Image loading; host pointer/keyboard access; Shadow DOM style isolation; open/minimize/Escape/focus return; keyboard movement; mouse and simulated touch dragging/cancellation; keyboard activation immediately after touch dragging; drag click suppression; reload position/open-state persistence; SPA exit/return with one mascot. |
| Responsive and motion | Tested at 1280×800 and 320×400; panel stays in bounds without covering the mascot or overflowing horizontally; scrolling keeps minimize available; reduced motion disables animation. |
| Browser errors | No page errors observed in the isolated interaction test. |
| Visual review | Desktop and small-viewport screenshots inspected, then refined and confirmed. All four future actions are visible on desktop and scrollable on small viewports. |
| Text contrast | Checked secondary text pairs at 5.43:1–6.21:1, above 4.5:1. Labels and keyboard focus reviewed. |
| Impeccable detector | No findings for `src/OhmiApp.tsx` and `src/ohmi.css`. |
| Independent code review | No Critical or Important findings. One touch-to-keyboard click-suppression defect was reproduced, fixed, and covered by the browser test. |
| Mascot integrity | Built PNG SHA-256 matches canonical source: `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382`. Source PNGs unchanged. |
| Dependencies | Installation reported 0 known vulnerabilities. Lockfile saved. |
| Lint | No linter configured; no lint pass claimed. |

## Visual evidence

These are **simulated editor fixtures**, not screenshots of a live Tinkercad editing session.

- [Desktop screenshot](screenshots/phase-1-desktop.png)
- [Small viewport screenshot](screenshots/phase-1-small.png)

## Remaining manual checks

An unauthenticated visit to `https://www.tinkercad.com/things/g6IFAg6ayAL-lcd-16x2weathericons-v2/editel` redirected to `/login?next=...` with title **Login - Tinkercad**. No login bypass or editor automation was attempted.

Complete the [README checklist](../README.md#manual-check-in-your-signed-in-tinkercad-session) using your own signed-in editor. Real toolbar placement, component/wire/code interactions, Chrome zoom, and assistive-technology testing are not yet verified. Mouse and CDP-generated touch input were tested; physical touchscreen hardware was not.

The `/things/<design>/editel` route is inferred from publicly shared Circuits editor links. It is not an Autodesk API contract. A new route or embedded editor would require reviewing detection before widening permissions.

Blinking requires approved expression frames and is deferred. Idle animation is one gentle 3.5-second float per mount; hover and panel transitions remain available. Phase 2 remains unstarted.

## Visibility fix after the live-editor report

The owner reported that OHMI remained absent in the actual Circuits editor after reloading the extension and page. Investigation found a reproducible stacking defect: WXT applies `:host { all: initial !important; }`, which cancels the normal inline position and z-index previously assigned to the shadow host. The rendered fixed UI lacked its own overlay z-index and could be covered by a positioned editor workspace.

The browser fixture now includes an opaque positioned workspace at z-index 100. A hit-test at the mascot's center failed before the fix, demonstrating that the workspace covered it. Setting the overlay z-index on `.ohmi-root` and removing the ineffective host styling makes the same test pass. Existing pointer passthrough, panel, drag, keyboard, persistence, and navigation checks also pass. TypeScript, all 6 unit tests, and the Chrome production build were rerun successfully.

The build at `.output/chrome-mv3` contains this fix. Reload the installed extension, then refresh the Circuits tab. The user's signed-in Chrome tab cannot be inspected directly through the available browser connection, so live confirmation remains pending.
