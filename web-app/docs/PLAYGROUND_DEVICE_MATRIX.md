# Playground Device & Browser Qualification Matrix

**Audit Date:** 25 October 2026  
**Standards:** WCAG 2.1 AA, AXE Core v4.14.0, Touch & Keyboard Accessibility  
**Qualification Rule:** Only tested hardware/browsers may claim PASS. Untested platforms are marked BLOCKED/NOT RUN with explicit disposition.

| Platform / Device | Environment / Engine | Viewport / Orientation | Input Method | Scenarios Tested | Status | Evidence Location |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop PC | Chromium (Playwright 1.64.1) / Windows 11 | 1440x900, 1024x768 (Light & Dark) | Mouse, Keyboard | Empty workbench, part drag/drop, keyboard move/delete, mission pick/complete, inspector edit, switch toggling, undo/redo, 0 axe violations | **PASS** | `docs/cross-browser-results.json`, `docs/screenshots/playground/` |
| Tablet | Chromium / Emulated iPad | 768x1024 (Light & Dark) | Touch / Pointer | Full workbench layout, drawer controls, mission hints, 0 axe violations | **PASS** | `docs/cross-browser-results.json` |
| Mobile Phone | Chromium / Emulated iPhone 12/13/14 (390x844) | 390x844 Portrait & 844x390 Landscape | Touch tap, swipe, gestures | Tray scrolling, tap placement, terminal wiring, modal sheet controls, feedback layout, 0 axe violations | **PASS** | `docs/test-mobile-390.png`, `docs/cross-browser-results.json` |
| Small Mobile | Chromium / Emulated 320px | 320x600 Portrait | Touch tap | Compact controls, single-column feedback, no horizontal overflow, 0 axe violations | **PASS** | `docs/cross-browser-results.json` |
| Desktop Firefox | Mozilla Firefox | Desktop viewports | Mouse, Keyboard | Firefox engine binary not installed in local environment | **BLOCKED / NOT RUN** | Host local environment |
| Desktop / iOS WebKit | Playwright WebKit | Desktop & iOS emulation | Mouse, Touch | WebKit engine binary not installed in local environment | **BLOCKED / NOT RUN** | Host local environment |
| Physical iPhone / iPad | Mobile Safari (iOS 17+) | 390x844, 820x1180 | Real capacitive multi-touch | Native iOS viewport gestures, safe-area insets, virtual keyboard interaction | **BLOCKED / NOT RUN** | Requires physical Apple hardware device |
| Physical Android Device | Chrome on Android (v120+) | Various mobile resolutions | Real capacitive touch | Real-world touch latency, PWA installation banner | **BLOCKED / NOT RUN** | Requires physical Android hardware device |
| Screen Reader (Windows) | NVDA / Windows Chrome | Desktop 1440x900 | Keyboard screen reader navigation | Native NVDA speech synthesis, ARIA live region announcements | **BLOCKED / NOT RUN** | Requires live assistive technology operator session |
| Screen Reader (iOS) | VoiceOver / Mobile Safari | iPhone portrait | Rotor, gesture-based touch accessibility | VoiceOver custom rotor navigation and accessibility announcements | **BLOCKED / NOT RUN** | Requires live iOS VoiceOver device session |

### Notes & Limitations
1. Automated axe checks passed across all 12 tested responsive configurations (widths 320, 390, 768, 1024, 1440, and landscape 844 across light and dark themes).
2. Keyboard navigation (`Tab`, `Arrow` keys for component positioning, `Delete` for removal, `Escape` for cancellation) was functionally verified in Chromium.
3. Untested physical devices and screen readers are documented above as unpassed boundaries without inflating automated scores into claims of universal compatibility.
