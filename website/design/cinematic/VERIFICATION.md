# Cinematic landing verification - 24 October 2026

Status: **ready for owner visual review; not deployed**. Isolated branch `codex/ohmi-cinematic-review`. Production branch `codex/ohmi-website` and existing extension/PWA/backend sources were not changed.

## Reference fidelity

The OHMI master prompt governed the build; the original Meadowbell prompt supplied typography, UI proportions and motion order. Inspected the owner's 6.27-second recording as 12 timed frames. Recording shows a page re-entry; the implementation runs its entrance only once per entry. Exact easing coefficients are not recoverable from a screen recording: the code uses the specified 160 ms headline stagger and exponential spring-inspired ease-out, rather than claiming a frame-exact reconstruction.

Supplied countryside and original pixel-art mascot PNGs are retained byte-identical. The rendered page uses quality92 WebP delivery copies of the countryside and lossless nearest-neighbor mascot thumbnails. No redraw, dog plate, chapter art, generated replacement mascot or video generation is used. Asset provenance and hashes: `ASSETS.json`.

Desktop composition: compact floating nav, white Grandstander900 kicker/MEET/OHMI, Inter support copy, pill actions, three image cards near/below fold. Mobile copy sits above a landscape window containing both characters. Cards swipe and remain keyboard reachable. Original public section anchors and four FAQ answers are preserved.

## Verified

- `npm run build --prefix website`: copies canonical src to generated dist after local asset, SEO and original mascot hash validation.
- `npm test --prefix website`: source/artwork boundary assertions pass. Test was first run red before the new source existed.
- `node website/tests/cinematic-browser.mjs`: passes in Chromium at1440x900,1024x768,768x1024,390x844,320x740. No horizontal overflow; hero actions above fold; boy/OHMI scene landmarks visible on phones/tablet.
- Browser tests verify actual shader pixel changes in grass, hair, clouds and antenna regions over1.2seconds, with zero changed pixels in the sampled OHMI face region. This proves local motion, not physical animation quality.
- Pause/resume stops/restarts render frame count; offscreen scene pauses. Card lift8px and image scale1.05, scripted question switching, keyboard skip/menu/Escape, all anchors, retained FAQ keyboard disclosure, reduced motion and OS-dark consistency pass.
- Simulated unavailable WebGL retains poster and readable page. JavaScript-disabled page retains scene/headline. No page errors, failed network responses or third-party runtime requests in suite.
- Source review confirms document-hidden pause, pagehide/pageshow handling, save-data still fallback and context-loss fallback. These branches are not all independently exercised by the browser suite.
- Independent Impeccable finish review requested two material corrections: mobile/tablet sky seam and subtitle contrast across clouds. 100px alpha fade and opaque dark glyph stroke resolved both. Reviewer's bounded verdict: **ship for owner review**, not deployment approval.
- Mechanical design detector ran once. It flagged the old design record's tokens/fonts and subtitle contrast. The final visual system is recorded in DESIGN.md and its sidecar; muted text already measured5.77:1 on paper. Subtitle fill/stroke contrast is above10:1. Browser review used current Web Interface Guidelines.

## Performance

Mobile Lighthouse local lab after delivery optimization: Performance94, Accessibility100, Best Practices100, SEO100. LCP2.9seconds, CLS0, TBT90ms. Initial full-size delivery scored47 with LCP24.7seconds; optimized hero is269KB desktop /133KB mobile and tiny mascot icon5.4KB. These are lab results, not field Core Web Vitals. LCP remains above the2.5second target.

WebGL renders a capped30fps at no more than1672pixels wide. Shader initialization waits until after the main entrance. Native JavaScript and browser APIs only; no runtime dependencies added. Lighthouse was run as a temporary development tool; no package or lockfile change.

## Animation limits and review artifacts

The ambient scene is a localized source-image deformation, **not a generated motion video or a full layered character rig**. Grass/flower regions bend in phased wind; hair and a small cloth area ripple; sky drifts slowly; antenna tips sway. OHMI's face, body and pose are anchored. There is no blink, body breathing, individual flower-stem rig or newly painted occluded background. Maximum movement is deliberately small to preserve the illustration. The24-second trigonometric field is periodic without a reset cut.

Screenshots and short screen recording are local, ignored review artifacts under `website/.impeccable/review/cinematic/`. Static screenshots cannot establish perceived smoothness. Owner review of the recording remains the acceptance gate for environmental motion and final composition.

Not checked: physical iPhone/iPad/Android hardware, Safari/Firefox, assistive technology, real low-end GPU/battery behavior, live AI, hosted deployment or production smoke tests. The sunny illustration/theme intentionally stays light under either OS scheme, per this brief. Original PRODUCT.md uses a legacy metadata schema; optional `impeccable init` remains outside this redesign's scope.

## Release boundary

No deployment command or production-branch push. Vercel configuration enables Git deployment only for `codex/ohmi-website`; the review branch is disabled. Source, assets, tests and docs are committed/pushed only to the review branch per project instructions. Production rollback is the unchanged production branch; no force push.
