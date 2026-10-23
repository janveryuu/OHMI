# OHMI motion refinement — 16 October 2026

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
