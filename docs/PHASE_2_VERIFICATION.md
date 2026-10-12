# Phase 2 verification — 2026-10-12

## Delivered

Version **0.2.0** implements Home, Ask OHMI, Assignments, Guide Me, Check My Circuit, and Settings. Local samples exercise conversations, attachment previews, assignment analysis, circuit notes, guide progress, loading/empty/notice states, and English/Filipino/Taglish explanations. Language, appearance, and motion preferences persist in extension-local storage. Page-session sample state survives navigation, but does not survive reload or unmount.

The approved front PNG remains unchanged. Idle, hover, happy, thinking, antenna-light, panel, and navigation effects use CSS. Motion settings and OS reduced motion disable the effects. Extra facial expressions require owner-approved transparent frames; no replacement mascot or new expression artwork was created.

No dependencies, AI/backend integrations, accounts, actual uploads, file reading, screenshot capture, or circuit inspection were added. Manifest permissions remain `storage` only, with no background worker. Phase 3 was not started.

## Final automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: WXT types and TypeScript |
| `npm test` | Passed: 10 tests across 3 files |
| `npm run build` | Passed: Chrome MV3, version 0.2.0 |
| `npm run test:browser` | Passed: extension foundation and all six Phase 2 sections |
| Approved mascot source and built copy | Both match approved SHA-256 below |
| Manifest inspection | Version 0.2.0, storage only, no worker |
| Impeccable detection | No findings in the scoped UI files (`[]`) |
| Independent code review | Ready after the placement fix; no remaining findings |

The browser run used installed Chromium via `OHMI_CHROMIUM_PATH`, a temporary profile, and a locally fulfilled **simulated** HTTPS editor URL. It did not access the owner's signed-in Chrome profile. Production output contains approximately 257.61kB JavaScript, 24.21kB CSS, and the existing 1.44MB PNG; approximately 1.72MB total. These are build sizes, not CPU performance measurements.

Approved front-image SHA-256:

```text
815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382
```

### Behavior covered

- Original route detection/unit tests, SPA exit/return, one-instance mounting, image loading, raised editor layers, and pointer/keyboard/style isolation.
- Mouse drag, simulated touch drag/cancel, touch-to-keyboard activation, arrow movement, open/minimize/Escape/focus return, position/open persistence, responsive bounds, and mascot/panel non-overlap.
- All six sections; empty, loading, unavailable-upload notice, built-in attachment/assignment/circuit flows; no real file inputs.
- Sending and navigating while a sample reply is pending; conversation and guide state retained across section changes.
- Five guide steps, previous/next bounds, completion count, success, and restart.
- More/Escape focus behavior, three localized sample replies, dark appearance, saved preferences, motion previews, animation toggle, and OS reduced motion including antenna effects.
- 1280×800 desktop and 320×400 small viewport; horizontal overflow, reachable navigation/minimize/composer, and centered small-screen dragging.

### Defect found and fixed

Independent review reproduced a 132px panel after dragging OHMI to the center of a 320×400 viewport. Fixed header/navigation/footer clipped the controls. The added browser regression failed before the fix and passed afterward. Shared placement now moves the open mascot toward the nearest edge when needed, preserving at least 260px of panel height where physically possible. Opening, resize, drag release/cancel, keyboard movement, and stored-open restoration use this rule; closed dragging remains unchanged.

## Visual and accessibility review

Reviewed the rendered desktop, all six sections, dark Settings, and small Home/chat screenshots. Main content scrolls while navigation and minimize remain available. Native controls, explicit labels, visible focus, semantic progress, polite loading/conversation announcements, and IME-aware Enter behavior were reviewed against the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Compact empty-state principles were referenced from shadcn/ui; no third-party layout was copied or installed.

WCAG contrast calculations checked eight normal-text token pairs in each appearance: body/surface, muted/surface, muted/mint, muted/tint, teal/mint, primary text/button, warning text/background, and pink text/background. All exceed 4.5:1. The lowest checked pair is **4.99:1** in light mode and **5.84:1** in dark mode. This is a targeted token check, not a complete accessibility certification.

### Screenshots

| State | Capture |
| --- | --- |
| Desktop context | [phase-2-desktop.png](screenshots/phase-2-desktop.png) |
| Home | [phase-2-home.png](screenshots/phase-2-home.png) |
| Ask OHMI | [phase-2-chat.png](screenshots/phase-2-chat.png) |
| Assignments | [phase-2-assignments.png](screenshots/phase-2-assignments.png) |
| Guide Me | [phase-2-guide.png](screenshots/phase-2-guide.png) |
| Check My Circuit | [phase-2-check.png](screenshots/phase-2-check.png) |
| Dark Settings | [phase-2-settings-dark.png](screenshots/phase-2-settings-dark.png) |
| Small viewport | [phase-2-small.png](screenshots/phase-2-small.png) |
| Small chat composer | [phase-2-small-chat.png](screenshots/phase-2-small-chat.png) |

Long results/settings/guide content intentionally requires vertical scrolling. Legacy `phase-1-*` screenshots are refreshed by the foundation regression and now show the latest UI; the original Phase 1 verification document remains historical.

## Remaining checks and limitations

**Owner feedback after handoff:** The owner reports the manual test/checklist working except animation previews. A live screenshot shows the system reduced-motion notice with previews disabled. This is expected behavior while Chrome reports reduced motion. Windows Animation effects and any DevTools override must be adjusted to test animation; successful live motion has not yet been confirmed. This is owner-reported verification, separate from the automated fixture results above.

- The owner reported Phase 1 working in Tinkercad. This run has not verified Phase 2 in signed-in Tinkercad, real component editing, actual Chrome zoom, physical touch hardware, or a screen reader. Use the [README manual checklist](../README.md).
- Reduced viewport sizes were tested; they do not replace actual 80%, 125%, and 200% Chrome zoom checks. Extremely short viewports remain constrained by physical space.
- No guarantee of avoiding every Tinkercad tool: drag/minimize OHMI as needed. No undocumented Tinkercad DOM selectors or APIs were added.
- Sample replies are fixed, regardless of the question; no actual assignment or circuit is analyzed. Interface labels stay English. Sample state is not a saved student record.
- No linter is configured. No CPU benchmark or accessibility certification was performed.

## Try the updated extension

The production build is ready in `.output/chrome-mv3`. In `chrome://extensions`, reload the existing OHMI extension and confirm **0.2.0**. Refresh the Tinkercad Circuits editor and click the mascot. Try each Home action, More, and Settings. Rebuild only after additional source changes. Stop here for owner review before Phase 3.
