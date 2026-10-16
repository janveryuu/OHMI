# OHMI motion refinement — 16 October 2026

## Continuous-motion follow-up

The owner supplied `OHMI SCREENRECORD.mp4` and requested more visible gaze and
continuous ambience. The recording shows gaze responding subtly, followed by
static ambience. Prior live JS/CSS matched local source after line-ending
normalization; the original pupil asset also matched. The issue was not a missing
deployment: CSS used one iteration, gaze travel was only 12×10 source pixels,
and the fixed mask omitted the baked-in antialiased eye fringe.

Current refinement: critically damped, velocity-preserving spring response;
18×14 source-pixel travel with elliptical bounds; stronger near-face response;
`any-pointer`/`any-hover` detection for hybrid devices. Two source pixels of
derived fringe coverage remove stationary ghost edges. Left source bounds are
(437,445)–(523,575); right (728,445)–(816,575). Original PNG bytes remain unchanged.

Ambient motion now repeats: independent 4px mascot idle over six seconds,
out-of-phase stars over seven to nine seconds, and horizon opacity over eight
seconds. Button press/release and section transitions are softer. The owner's
explicit continuous-motion request supersedes the earlier finite-animation
decision below. Hidden/offscreen and reduced-motion handling remains in place.

Local production build and both website suites pass. The motion suite uses
installed Google Chrome, asserts infinite ambient timing, and checks pointer
movement separately from idle motion. Latest local initial CLS: 0; longest
application animation-frame callback: 2ms; no pending frames after gaze settles.
Resting desktop/mobile screenshots remain pixel-identical to prior production.

`tests/website-motion-record.mjs` records the same pointer sequence in an isolated,
headed Google Chrome profile for both versions. It captures only the page,
not the owner's desktop/profile. The small cursor marker exists only in the
recording harness. The previous static website snapshot stays ignored locally;
recording script requires it under `.output/motion-v2/before-site/dist`.
The short side-by-side MP4 and filmstrip were visually inspected. The two
independent captures have different startup timing, not frame-perfect sync.
Videos/screenshots are ignored local proof, never Vercel uploads or Git assets.
The owner's personal Chrome session after deployment remains unverified.

Production commit `e54ab7d0ac484095ef3f9c11a15464b356fc9583` reached Vercel READY.
Both website suites passed against https://meetohmi.vercel.app/. Deployed JS,
CSS (after line-ending normalization) and all six eye-layer byte hashes match
the checked source. Production initial CLS: 0; longest measured application
animation-frame callback: 15ms; no pending gaze frames after settling. The
head/body measurement now awaits animation pause readiness and allows 0.1px
of compositor rounding; the first exact-equality assertion differed by 0.003px.
This is a test-measurement correction, not a product change. The final ~13-second
comparison records the actual deployed after-version in an isolated headed
Google Chrome profile; no personal browser session or desktop was accessed.

The sections below document the earlier implementation, not current timing.

Scope: motion only on the existing standalone landing page. No HTML, copy,
layout, colors, typography, original mascot PNG, extension, backend or Phase 5
source changed. Work is isolated in the `ohmi-website-motion` managed worktree.

## Reference and implementation

Studied the supplied 5.43-second Nimbus recording at half-second intervals.
Its eye highlights follow the pointer in both axes while the face stays still.
OHMI's earlier implementation moved synthetic white glints over painted patches.
The replacement moves source-derived pupil sprites, including their original
highlights, inside masks traced from the exact original eye outlines. Cream
underlays sample the adjacent original face pixels. No new eye design was drawn.
`derive-eyes.py` regenerates the six small layers with Pillow, which is an
authoring tool only. Their combined size is approximately 25 KB. The production
site remains dependency-free HTML/CSS/JavaScript.

Maximum travel is 12 horizontal and 10 vertical source pixels, normalized to an
ellipse. One requestAnimationFrame callback reads the mascot rectangle before
writing two pupil transforms. Time-based easing settles and stops requesting
frames. Scroll and resize recalculate viewport coordinates; leaving the page,
blur, hidden tabs, reduced motion, touch input and offscreen state restore the
original art. All six layers decode before gaze is enabled; missing layers
leave the original PNG visible.

Supporting motion: a short hero entrance sequence, independent 3px idle breath,
soft star/horizon opacity changes, small one-time section arrivals, quick topic
changes and a 3px button-arrow response. Ambient sequences settle within five
seconds rather than run indefinitely. Hidden tabs pause CSS motion; the hero
also pauses offscreen. Reduced motion retains the existing static experience.
Blinking was omitted to preserve the approved eye shapes.

## Verification before deployment

- Production static build and `git diff --check` passed.
- Existing website browser suite passed at 320, 390, 768, 1366 and 1505px.
- New `tests/website-motion.mjs` passed four gaze directions, intermediate easing,
  interruption, fixed head/body, resting return, scrolling, offscreen sleep,
  touch/reduced-motion behavior, missing-layer fallback and a deterministic
  hidden-document event harness.
- Alignment passed at five viewport sizes with 100%, 125%, 150% and 200% CSS
  layout zoom stress, plus CDP visual viewport zoom at 100%, 150% and 200%.
  CSS zoom does not emulate browser toolbar zoom breakpoint changes; visual
  viewport zoom may intentionally require panning. No overflow at the five
  normal responsive widths. Physical browser zoom controls were not exercised.
- Desktop and mobile full-page resting screenshots match the existing public
  production site pixel-for-pixel under reduced motion.
- Initial cumulative layout shift: 0. Synthetic resizing/zooming later in the
  test intentionally changes layout and is excluded from that initial metric.
- Longest measured application animation-frame callback in the final local run:
  1.4ms. No pending application frames after settling. This is a local measurement,
  not a guarantee for every device.
- No browser JavaScript or unexpected HTTP errors in the normal browser suites.
- Real in-app browser inspected the page and exercised gaze with pointer input.
- Mechanical design scan reported existing palette/type-ramp advisories in the
  unchanged design; no palette, type or spacing changes were made to silence them.
- Read-only independent review found no functional regression. Its hidden-tab
  coverage gap was addressed with global CSS pausing and a focused event test.

Physical devices, native browser zoom controls, Safari and screen readers were
not tested. Existing Impeccable product/sidecar drift was not repaired during
this motion-only task.

## Production verification

Vercel production deployment of `674bb7dab732c644d7122ccb2016fa1da3e4cf36`
reached READY on the existing Hobby project `meetohmi`. Both browser suites
then passed against https://meetohmi.vercel.app/. Production initial layout
shift measured 0.000622, longest measured application animation-frame callback
5.1ms, and pending frames after settling zero. The in-app browser independently
loaded the deployed eye masks and confirmed both pupils responding to pointer
input. Existing dedicated branch `codex/ohmi-website` and automatic deployments
remain in use. No environment, billing or backend configuration changed.
