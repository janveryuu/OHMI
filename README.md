# OHMI — Your Circuit Buddy

Phase 2, version **0.2.0**: the approved pixel-art OHMI companion and six interactive frontend sections for Tinkercad Circuits. All conversations and results are clearly labeled local samples.

## Load in Chrome

1. Use Node.js **22.12 or newer**. This workspace was verified with Node.js 24.16.0.
2. Open a terminal in this project folder and run:

   ```powershell
   npm ci
   npm run build
   ```

3. In Chrome, open `chrome://extensions` and enable **Developer mode**.
4. Click **Load unpacked** and select `.output/chrome-mv3` inside this project.
5. Sign in to [Tinkercad](https://www.tinkercad.com), then open one of your designs in the **Circuits editor**. Refresh an editor tab that was already open when the extension was loaded.
6. OHMI starts near the lower left. Drag it to a free area, or focus it with Tab and use arrow keys to move it. Hold Shift for 1-pixel steps. Enter or Space opens and minimizes the panel; its close button and Escape also minimize it.

After changing source files, rebuild, click the extension's **Reload** button in `chrome://extensions`, and refresh the Tinkercad tab. `npm run dev` is also available for WXT development.

**Updating an already loaded extension:** the current build is ready in `.output/chrome-mv3`. Click OHMI's **Reload** button, confirm version **0.2.0**, then refresh your Circuits editor tab. Click the floating mascot to open Home.

## What Phase 2 adds

- **Home:** four quick-access actions and sample-guide continuation.
- **Ask OHMI:** message bubbles, keyboard-friendly composer, built-in sample attachment, loading feedback, and fixed localized replies. Enter sends; Shift+Enter adds a line.
- **Assignments:** empty upload interface, built-in assignment card, sample analysis, and an entry into the guide. Real upload controls explain why they are unavailable.
- **Guide Me:** five sample steps, previous/next controls, completion tracking, undo, and restart.
- **Check My Circuit:** screenshot-upload interface, illustrative circuit, and predefined diagnostic notes. No actual circuit is inspected or electrically verified.
- **Settings:** English, Filipino, or Taglish sample explanations; light or deep teal appearance; animation toggle; reaction previews.

Use the bottom navigation for Home, Ask, and Guide. **More** opens Assignments, Check My Circuit, and Settings. The header gear also opens Settings. Escape closes More first, then minimizes the assistant.

Preferences, mascot position, and panel open state are stored on this device. Conversations, sample results, and guide progress survive section navigation but reset when the page reloads or OHMI unmounts. Interface labels remain English; the language preference changes sample replies.

## Preserved extension foundation

- Shows an 88 CSS pixel mascot on HTTPS `www.tinkercad.com/things/<design>/editel` routes, including query strings and a trailing slash. Client-side navigation mounts or removes OHMI.
- Uses the exact approved front PNG, copied into the built extension from `assets/mascot/ohmi-pixel-front.png`. The turnaround sheet stays a reference asset.
- Uses Shadow DOM for styles and isolates interaction events within OHMI. The rest of the page remains available to pointer and keyboard input.
- Supports mouse and touch pointer dragging, viewport clamping, keyboard movement, and local extension storage for position and open state.
- Places the panel above, below, or beside the mascot. Content scrolls independently of the fixed header and bottom navigation. On narrow screens, opening or releasing a drag may move the mascot toward an edge to preserve usable panel space.
- Provides idle floating, hover feedback, happy bouncing, thinking movement, subtle antenna light effects, and opening/closing/navigation transitions. The animation toggle and operating-system reduced-motion setting disable movement and light effects.

The extension requests only `storage`, with its content script and public assets restricted to `https://www.tinkercad.com/*`. It has no background worker and sends no student data to a backend. Phase 2 adds no dependencies or permissions.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

To repeat the isolated browser test, install Playwright's Chromium browser once, then run:

```powershell
npx playwright install chromium
npm run test:browser
```

The test loads the built extension into a temporary Chromium profile and serves a labeled simulated editor page. It checks the extension foundation plus all six sections, sample flows, guide progress, navigation focus, language/theme/motion persistence, and centered dragging at 320×400. It writes screenshots to `docs/screenshots`. If Chromium is already installed elsewhere, set `OHMI_CHROMIUM_PATH` to its executable path before running the test. No linter is configured yet.

## Manual check in your signed-in Tinkercad session

1. On the homepage, dashboard, circuit gallery, and 3D editor, confirm OHMI is absent.
2. Open an actual Circuits design; confirm OHMI appears once. Drag it away from any controls you use, and verify that a drag does not open the panel.
3. Place components, wire them, use the code editor, and run/stop simulation. Check that OHMI does not intercept these actions outside its own controls.
4. Open/minimize using the mascot, Enter/Space, the close control, and Escape. Check that focus returns to the mascot after minimizing.
5. Reload with the panel open and closed, and check that position and state persist.
6. Resize the browser and test Chrome zoom at 80%, 125%, and 200%. Confirm the mascot remains reachable and the panel fits, scrolling vertically if needed.
7. Navigate to another Tinkercad page and back using both site links and browser history. Check that there is one mascot only in the Circuits editor.
8. Enable the operating system's reduced-motion preference and confirm OHMI's motion is disabled.
9. Open each Home action and the More menu. Send a sample chat question, attach the built-in sample, load the assignment and circuit examples, and complete/restart the guide. Check that section navigation preserves your sample state.
10. In Settings, try all three explanation languages, both appearances, and each reaction. Turn animations off; reload and confirm preferences persist. Actual file upload, capture, and AI remain unavailable.

## Scope and remaining verification

Live editing and placement relative to Tinkercad's current controls need the manual check above. A public editor link redirected to Tinkercad login during verification. Route detection uses the public `/editel` convention; an Autodesk route change may require an update. Default placement is a starting point, not a guarantee of avoiding every circuit or toolbar.

Blinking, talking, confused, and sleepy expressions need separately approved transparent animation frames. Current motion moves the entire approved image without fabricating facial artwork. AI, real uploads, PDF/image analysis, screenshot capture, authentication, and backend integration remain outside this phase.

Phase 2 automated checks and visual review are complete. Signed-in Tinkercad, physical touch hardware, actual Chrome zoom, and screen-reader behavior still require the manual check above. Extremely short viewports cannot accommodate the same panel space as a desktop editor. Phase 3 has not started.

## Project references

- [Project context](docs/PROJECT_CONTEXT.md)
- [Approved mascot specification](docs/OHMI_MASCOT.md)
- [Design references](docs/DESIGN_REFERENCES.md)
- [Phase 1 plan](docs/PHASE_1_PLAN.md)
- [Phase 1 verification record](docs/PHASE_1_VERIFICATION.md)
- [Phase 2 design and scope](docs/PHASE_2_DESIGN.md)
- [Phase 2 implementation plan](docs/superpowers/plans/2026-10-12-phase-2.md)
- [Phase 2 verification and screenshots](docs/PHASE_2_VERIFICATION.md)
