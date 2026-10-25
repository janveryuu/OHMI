# Dashboard mascot animation

25 October 2026. Owner approved GitHub push and production deployment after local verification.

## Asset and scope

Owner source: `C:/Users/LEGION/Downloads/OHMI DONE.mp4`, 1920 × 1080, 96 frames at 24 fps, four seconds, with an AAC track and an opaque green backdrop. Source SHA-256: `9932e8104c8b5157362e9d9d102d97e8b9d39005f49e1a8ad654d2f1a4f188e5`.

Delivery: `public/animations/dashboard-ohmi.webm`, VP9 with an actual alpha plane, 480 × 480, 24 fps, exactly four seconds, **586,307 bytes**, no audio stream. SHA-256: `2899225f51d31568a7cde47d1f158a900e3de2317cd446de17a4e65bad7f6ac8`.

`convert.py` deterministically processes the owner's video with OpenCV, numpy, Pillow and FFmpeg; these are authoring tools, with no new application dependencies. Run `python design/dashboard-animation/convert.py "C:/Users/LEGION/Downloads/OHMI DONE.mp4"` from `web-app/`. It removes only connected backdrop green, including the baked green floor shadow, unmixes edge colors, and preserves opaque interior colors and green LEDs. A fixed crop contains every pose; the last four frames blend in premultiplied alpha to the starting pose to close the small source seam without changing duration. The source MP4 is not shipped.

Only `src/components/dashboard.tsx` and scoped `.dashboard-mascot` rules in `src/app/globals.css` change runtime behavior. The existing `.welcome-mascot` geometry, banner, copy, buttons, circles and positioning rules are unchanged. The crop's motion allowance requires video scaling to 125% within the unchanged container; the resting sprite retains the original visible width, with room for the waving hand. Aspect ratio remains square. No other mascot instance changes.

The original `public/mascot.png` is untouched (SHA-256 `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382`). It displays before playback and whenever OS/app reduced motion is enabled, playback fails, or a canvas sample detects opaque WebM decoding. The video is hidden until actual playing plus alpha verification, muted/defaultMuted, inline, looping, and has no controls. A blocked autoplay leaves the original image visible. No opaque MP4 fallback is shipped.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed, 33 generated pages. Existing `unpdf` import.meta warning remains.
- `npm test`: 39 passed, zero failures; existing Node module-type warnings remain.
- `node tests/dashboard-animation.mjs`: passed. Existing local synthetic auth fixture only; no hosted accounts or student data. Four widths: 1440, 768, 390, 320. Compares seven original hero boxes against `hero-geometry.json` within 0.1px, checks decoded transparent corner and opaque body, muted/defaultMuted, four-second duration, autoplay/loop/inline/no controls, actual wraparound, live OS reduced-motion change, initial reduced motion, saved app reduced motion, aborted asset request and simulated opaque-alpha decoder fallback. No browser page errors.
- FFprobe confirms exactly one VP9 video stream, alpha metadata, four seconds, and no audio stream. Decoded all 96 frames with libvpx: every corner alpha is zero; the body sample stays 255. First/last decoded mean RGBA difference is 0.0082/255, with no visible seam in the inspected sequence.
- Visually inspected decoded frames over cream, dark and white backgrounds, including the wave and loop endpoints. Inspected actual desktop/mobile banner screenshots: clean edges, retained details, circles visible through alpha, no green rectangle or green floor shadow.

To reproduce the browser check, start Next on `127.0.0.1:3136` with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-public-test-key`, `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3136`; then run the test. The test starts/stops the existing synthetic auth fixture on 54329 and writes screenshots/results under ignored `test-results/dashboard-animation/`. These are dummy local test settings, never production configuration.

Physical devices, Safari/Firefox, battery profiling and offline video caching were not tested. Browsers lacking correct VP9 alpha use the original static image; no HEVC alpha export was added. The supplied source itself changes pose/expression; those original animation details remain.

An initial screenshot path encoded spaces as `%20`, creating a sibling `OHMI%20-%20Your%20Circuit%20Buddy/web-app/test-results/dashboard-animation/` folder outside this source checkout. Corrected the harness to use `fileURLToPath`. Automatic approval review rejected the optional folder cleanup with “blocked by policy”; that small screenshot-only folder remains.
