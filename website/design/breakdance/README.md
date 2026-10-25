# Landing breakdance animation

25 October 2026. Owner approved this focused replacement, GitHub publication and Vercel production deployment.

## Scope and asset

Only the mascot inside `#explore .meet-art` changes. The source heading is “A little buddy. A brighter build.” The section, circle, copy, buttons, spacing, breakpoints, other image sources and environmental scene remain unchanged. No PWA/backend/extension source or hosting configuration changes. No runtime dependencies were added.

Source: owner's `C:/Users/LEGION/Downloads/OHMI BREAKDANCING.mp4`, 1920x1080, six seconds, 144 frames at24fps, with audio. SHA-256 `6b487d0b2b8504e7bd35c1d2688abb5c31fc4effb74ca6fa33063e7d4624d83c`.

Export: `website/src/assets/ohmi-breakdance.webm`, VP9 with an alpha plane, 480x480, six seconds, 24fps, **1,704,537 bytes** (48% smaller than the 3,274,132-byte input), no audio stream. SHA-256 `88a17d398791c4f6f907e186db5cf8c0ed6b5c1ea7a2b0c0bbc8b85a02fb12ab`.

`convert.py` uses existing local FFmpeg, OpenCV, numpy and Pillow as authoring tools. Run from the repository root with `python website/design/breakdance/convert.py "C:/Users/LEGION/Downloads/OHMI BREAKDANCING.mp4"`. It removes border-connected chroma and large enclosed green pockets inside the source spin trails, preserves the smaller green LEDs, and unmixes edge colors against the measured backdrop. The green floor shadow is removed. Original mint spin/dust accents are retained; these are part of the supplied animation. No character generation, retiming, mirrored playback, or pose replacement occurs. Four final frames blend to the first pose in premultiplied alpha to soften the source seam.

One fixed 900x900 motion envelope contains the dance and airborne backflip, resized uniformly into the existing circle. It retains safety space for movement, so a resting pose has a small optical margin relative to the static image. No per-frame recentering, distortion or clipping is applied. Original circle/container size and alignment are unchanged; the entire video box remains clear of text at all five verified widths.

The original `assets/ohmi-480.webp` remains the visible fallback until actual playing and a decoded alpha sample succeeds. Reduced motion prevents initial media loading and restores the original image immediately when changed live. Playback errors, opaque-alpha decoders and blocked autoplay preserve the static image. JavaScript-disabled pages retain the static image because the video has no initial src. Video starts only when the circle is visible and pauses offscreen or in a hidden document. It has no controls, stays muted/defaultMuted, loops, plays inline, and cannot open Picture-in-Picture or remote playback. No green MP4 fallback is shipped.

## Verified

- `node website/build.mjs` passed; static output copied from source, all declared assets exist, canonical mascot SHA-256 unchanged.
- `node website/tests/cinematic.mjs` passed; original canonical artwork and landing links retained.
- `node website/tests/breakdance-browser.mjs` passed against local source at127.0.0.1:4179. Chromium at1440/1024/768/390/320px: original seven-box geometry within0.2px, identical copy and all original image src values, no horizontal overflow or video/text overlap, actual transparent video decode, six-second duration, muted/defaultMuted, autoplay, inline/no controls, real loop wraparound, live and initial reduced motion, missing asset and simulated opaque-alpha fallbacks. No page errors. `geometry.json` is the pre-change baseline. Ignored screenshots/results are under `website/.impeccable/review/breakdance/`.
- FFprobe: one VP9 video stream, alpha_mode1,480x480,24fps,6seconds; zero audio streams.
- Decoded all144 alpha frames with libvpx: transparent corners and no opaque foreground touching any frame edge. First/last alpha mean difference0.194/255. Visually inspected final dance/spin/backflip and seam frames over cream, dark and white backgrounds; trapped green pocket removed, mint/cream/yellow features and green LEDs retained. Inspected actual desktop/mobile page screenshots.
- `git diff --check` passed. Unrelated source and existing worktrees preserved.

This static landing has no TypeScript compilation step. Physical devices, Safari/Firefox, screen readers, Lighthouse and live private/PWA actions were not tested. Browsers without correct VP9 alpha show the original static image. The source is lossy; the seam is softened, not mathematically identical after VP9 encoding. Production readiness is confirmed separately through GitHub's Vercel deployment status.
