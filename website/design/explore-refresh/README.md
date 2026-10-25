# Explore images and installation options

Owner approved all three generated illustrations on 25 October 2026 and requested replacement plus a themed GitHub button.

Scope: preserve the current live cinematic page, replace its three Explore images, and expose browser PWA versus manual Chrome extension setup. The supplied screenshot and approved illustrations are the visual target. This is a constrained refinement; no new visual system or character design.

The live landing deployed at `dpl_FD5QWrFgCr1rV3RWZfXuB6icaPE9` was newer than both website Git branches. Its CSS/JavaScript match this cinematic worktree after newline normalization. The live HTML's PWA links were retained before editing. Existing `/app` proxy rules are restored in source from `web-app/docs/PRODUCTION.md`; this does not replace or deploy the PWA.

Artwork: built-in Imagegen, exact prompts in `prompts.json`. Approved original PNGs remain in the primary checkout's `website/design/explore-image-proposals/`. Shipping WebPs are `ask-workshop.webp`, `check-workshop.webp`, `build-workshop.webp`, 1200 x 751, quality 88, about 228-244 KiB each. Original mascot and countryside are unchanged. New art remains lazy-loaded with reserved dimensions. The GitHub public README was inspected through its API; its navigation explicitly uses `#-quickstart`.

Verification: static build/source assertions; Chromium at 1440, 1024, 768, 390 and 320 CSS pixels; all three images decoded; no document overflow, console errors or failed local responses. Both actions are 56px high without clipped labels; GitHub focus and hover are visible; PWA click reaches `/app/`. The local PWA click was intercepted only to test destination, not claimed as a live PWA flow. Desktop/mobile screenshots compare against the supplied layout and live baseline. Reduced and normal motion checked. See `verification.json`.

The mechanical detector reports inherited page-wide typography/contrast/pattern flags. Actual new button colors were inspected in normal/hover states: forest ink on ivory/mint, with existing visible yellow focus. No site-wide redesign or detector-rule changes were made.

Not checked: physical phones, Safari, screen readers, actual extension installation or live AI. Preview/release evidence is recorded after hosting verification. Git production branch remains separate; review-branch pushes do not authorize another phase.
