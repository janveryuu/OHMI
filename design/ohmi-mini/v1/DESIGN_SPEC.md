# OHMI Mini · asset edition 1

Created 6 November 2026. Standalone design delivery; not installed in OHMI. The original pixel-art mascot remains authoritative for the existing application. This package is a proposed Mini identity for owner review, not a replacement already approved for rollout.

## Reference and direction

The owner confirmed proceeding from the original mascot and written brief because no separate Mini concept was attached. Reviewed the supplied mascot and `assets/mascot/ohmi-pixel-front.png`. Preserved the rounded teal head, cream screen, oval eyes, catchlights and friendly curved smile. Reduced two antennae to the requested single angled antenna with a muted gold tip. Removed body, text, blush, hardware and circuitry to keep a quiet four-color mark. No gradients, shadows, raster tracing or enlarged reference artwork.

The supplied brief takes precedence over older mascot-preservation rules for this standalone derivative. No app branding, source, manifest or existing mascot asset was changed. The design-reference-library was consulted; its interface catalog was not used to substitute third-party branding for OHMI's supplied character.

## Palette

All values are sRGB; flat fills at 100% opacity.

| Role | Light | Dark |
| --- | --- | --- |
| Head / antenna stem | `#347F78` | `#80BDB0` |
| Face / eye catchlights | `#F5F4E7` | `#F5F4E7` |
| Eyes / smile | `#203E3A` | `#203E3A` |
| Antenna tip | `#C8A45D` | `#C8A45D` |
| App background | `#E4F0E9` | `#152E2B` |

Use the light logo on white, cream or pale mint. Use the dark logo on deep teal or similarly dark surfaces. The face and expression do not invert. Transparent logos have no background; app and PWA tiles always have a full-bleed background.

## Master geometry

The editable SVG uses a 256 × 256 artboard. Coordinates below are vector units; multiply by 4 for the 1024px icon.

| Element | Construction |
| --- | --- |
| Head | x 40, y 73, width 176, height 144, corner radius 44 |
| Face | x 54, y 87, width 148, height 116, corner radius 31 |
| Frame | 14-unit inset on all four sides; filled contours, not an applied border |
| Eyes | centers (94,137), (162,137); horizontal radius 9, vertical radius 14 |
| Catchlights | centers (96.5,131), (164.5,131); radius 2.5 |
| Smile | cubic from (114,161) through (120,172), (136,172) to (142,161); 6-unit rounded stroke |
| Stem | (158,81) to (166,55), 10-unit rounded stroke, concealed behind head and gold tip at the joins |
| Gold tip | center (168,48), radius 9 |

Visible artwork fits x 40–216 and y 39–217: 68.75% artboard width and 69.53% height. Horizontal center is 128; vertical bounds center is 128. Head-to-face ratio is 176:148. The slightly angled right antenna recalls the mascot's original paired antennae while giving Mini a compact asymmetric silhouette.

## Optical sizes and spacing

- Primary logo: use at 48px or larger. Preserve the square artboard and aspect ratio.
- At 16px and 32px use the provided optical favicon assets: geometry enlarged 1.18× around (128,128); eye horizontal radius 10; smile stroke 9; catchlights removed. All character cues and colors remain consistent. Do not resize the 1024px file to replace these exports.
- At 48px use the standard master. PNGs are rendered directly at their final dimensions in Chromium, not resized from a reference bitmap.
- Outside the square logo artboard allow at least 14 master units (5.47% of displayed artboard width) of additional clearance from text or unrelated artwork. Full-bleed app icons already include their own safe spacing and do not need this extra exterior padding.
- Normal app tile has 15.625% left/right clear space to the head. Maskable tiles use 0.88× scaling about the artboard center, giving 19.75% side margins. Every non-background pixel has been checked within the central 40%-radius circle, including antialiasing.
- Keep the app tile square and full bleed. Platform clipping applies the exterior icon shape. The rounded tiles and circular crops in previews are demonstrations only.

## Files and usage

| Folder | Contents |
| --- | --- |
| `logo/` | Transparent light/dark SVG masters and 1024px RGBA PNGs |
| `app/` | Light/dark 1024px RGB masters,512px RGBA Google Play files (fully opaque pixels),180px RGB Apple touch icons |
| `favicon/` | Transparent 16/32/48px PNGs plus light/dark multi-size ICOs containing those exact optical frames |
| `pwa/` | Light/dark 192px and 512px ordinary and maskable opaque PNGs |
| `source/` | Editable app/maskable/micro SVGs, palette, export code, inventory, validation hashes, example icon manifest fragment |
| `preview/` | Presentation and every-export visual review sheets; not production icons |

Use `ohmi-mini-light.svg` as the primary mark. For browser tabs, supply theme-specific PNG or ICO assets using media queries when integration is approved. Use PWA `any` and `maskable` files as separate entries, not a single dual-purpose entry. The example fragment is a handoff only and is not installed.

Do not rotate the head, stretch the face, recolor individual features, add circuitry, reintroduce a body, bake shadows or rounded outer corners into store artwork, or enlarge a favicon for print. For larger artwork render from SVG. No font, stock asset or external artwork dependency is required for the mark itself.

## Platform handoff

- Apple: supplied 1024×1024 PNG is flattened RGB, opaque with square corners. Current Apple guidance also describes layered icons and Icon Composer. This is a flat artwork package, not a native `.icon` project, Xcode asset catalog, tinted/clear variant set or tested App Store submission. Do the target-platform integration in Xcode when authorized. [Apple app icon guidance](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- Google Play: use the separate 512×512 32-bit RGBA PNG; all alpha values are 255. No baked outer corner mask or shadow. Kept well below the 1024KB limit. The 1024px master is included for future reuse, not as a substitute for Play's 512px listing asset. [Google Play icon specification](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)
- PWA: all important art stays inside the centered safe-zone circle with radius 40% of image width. Native Android adaptive-icon XML/layers are separate future integration work; PWA maskable icons are supplied here. [Maskable safe zone](https://web.dev/articles/maskable-icon)

## Reproduction and validation

From the repository root with existing Playwright and Python Pillow available:

```powershell
node design/ohmi-mini/v 1/source/export.mjs
python design/ohmi-mini/v 1/source/package.py
```

The first command builds every SVG and directly renders 22 PNGs. The second enforces color modes, creates 2 ICOs, verifies exact ICO frame equality, checks 4 maskable safe zones and builds contact sheets. PNG hashes and measured safe-zone radii are in `source/validation.json`. Preview sheets were visually inspected at native small sizes and enlarged pixels; the 16/32px artwork was enlarged optically after the initial review. All requested sizes decode and have their expected dimensions and transparency. Native launcher, Safari and app-store upload tests were not performed; assets are not integrated.

Execution strategy: authored vector geometry and Chromium rasterization, following the invoked imagegen skill's vector exception. Neither built-in image generation nor image-generation CLI was used; there is no hidden bitmap or AI-generated trace inside the SVG. The owner's written brief is the design specification; no image-generation prompt was executed.
