---
name: OHMI website
description: A friendly electronics companion in a dark mint pixel world.
colors:
  bg: "#020e0b"
  surface: "#0c211b"
  ink: "#f5faf5"
  muted: "#b5c8c1"
  mint: "#a6f6df"
  line: "#2c4b40"
typography:
  display:
    fontFamily: "Special Gothic, Manrope, sans-serif"
    fontSize: "clamp(72px, 8.85vw, 133px)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Special Gothic, Manrope, sans-serif"
    fontSize: "clamp(38px, 4.15vw, 64px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "22px"
    fontWeight: 750
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  brand:
    fontFamily: "Silkscreen, Manrope, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
rounded:
  inset: "8px"
  illustration: "12px"
  panel: "16px"
  pill: "100px"
spacing:
  close: "12px"
  related: "18px"
  component: "24px"
  roomy: "30px"
  section-mobile: "68px"
  section-tablet: "84px"
  section-desktop: "112px"
components:
  button-primary:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "17px 30px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "17px 30px"
  button-small:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "15px 25px"
  preview-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 18px"
  preview-tab-selected:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "12px 18px"
  learning-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "32px"
---

# Design System: OHMI website

## Overview

**Creative North Star: "Bold type and horizon"**

Large, tightly set sans headings make electronics feel approachable. The approved pixel-art companion brings warmth to a green-black field, with mint actions and a luminous pixel horizon. Quiet lower sections give explanations and setup instructions room to read.

This system describes the standalone marketing website, not the extension interface. It follows owner-approved Concept C in `design/concept-c-spark.png` and the direction contract in `design/SURFACE.md`; built ground truth is `dist/index.html`, `dist/styles.css`, and `dist/app.js`. Native controls and self-hosted fonts keep the surface direct and lightweight.

**Key Characteristics:**

- Green-black canvas, ivory hierarchy, mint actions and explanations.
- Oversized compact headings beside the unchanged pixel mascot.
- Pill controls, quiet hairlines, generous vertical space.
- Scripted educational examples with visible limitations.
- Brief entrance motion with a complete reduced-motion fallback.

## Colors

The palette uses one light mint accent over deep green neutrals; approved artwork supplies its own richer colors.

### Primary

- **Mint:** primary actions, selected preview tabs, focus outlines, circuit strokes, answer identity, and restrained accents.

### Neutral

- **Green Black:** uninterrupted page field and dark text within mint controls.
- **Deep Forest Surface:** the educational preview panel, separated from the canvas without elevation.
- **Ivory Ink:** headings, readable answer text, outlined actions, and navigation.
- **Soft Sage:** supporting paragraphs, secondary explanations, and disclosure text.
- **Forest Hairline:** panel borders, section dividers, and FAQ separators.

**The Mint Means Action Rule.** Use mint for actionable or explanatory emphasis; keep long supporting paragraphs in Soft Sage.

## Typography

**Display Font:** Special Gothic with Manrope and sans-serif fallbacks.

**Body Font:** Manrope with a sans-serif fallback.

**Brand Font:** Silkscreen Bold with Manrope and sans-serif fallbacks, confined to the OHMI wordmark. Code examples use `ui-monospace, SFMono-Regular, Consolas, monospace`.

All three brand/content families are self-hosted under `dist/assets/`, with SIL OFL license files. Manrope exposes weights 200–800; Special Gothic exposes weights 400–700 and width 75%–125%; Silkscreen is the 700 file. The current stylesheet does not set a display width-axis override.

### Hierarchy

- **Display:** the frontmatter describes the default desktop hero. Two explicit lines use tight tracking and line-height. At widths through 1250px it becomes 8.8vw; through 760px it uses `clamp(42px, 8.25vw, 62px)` with line-height 1.09; through 420px it becomes 9.6vw.
- **Headline:** the default section heading follows the frontmatter. Setup and FAQ headings have contextual size overrides; they retain the same family and compact rhythm.
- **Title:** Manrope provides the warmer, smaller article and question titles; setup titles use 20px on desktop.
- **Body:** the default is the frontmatter body role. Introductory paragraphs use 18–20px; the hero introduction scales from 20–31px on large screens and becomes 18px, then 16px, on narrow screens.
- **Label:** navigation uses the frontmatter label role. Buttons use weight 750 and 18px by default; preview tabs use weight 650 and 14px by default. Do not derive a general small-text scale from the current helper copy.
- **Brand:** the desktop wordmark uses the frontmatter brand role. It becomes 30px through 760px and 26px through 420px; the footer uses 30px, then 28px.
- **Technical text:** the code block uses 13px/1.75 and horizontal scrolling; it becomes 12px on mobile. Diagram labels increase to 24px through 760px and 28px through 420px in SVG coordinates to remain readable as the figure shrinks.

**The Pixel Accent Rule.** Keep pixel lettering to the wordmark and pixel texture to the approved artwork and sparse decoration; explanatory prose stays in Manrope.

## Layout

The shared centered container is at most 1377px wide. Its desktop width is the viewport minus 128px; through 1250px it subtracts 80px, through 760px 48px, and through 420px 40px. Repeated section spacing uses the three section tokens in the frontmatter.

The desktop header is a 112px flex row. The hero has an isolated stacking context: copy above, full mascot lower-right, decorative horizon behind. Copy occupies 76% with a 970px maximum; the mascot uses 42% with a 580px maximum. Wide screens at 1600px and up cap the headline at 133px and extend hero height. Keep text and mascot visibly separate, following the approved composition.

The preview uses a `.95fr / 1.05fr` split with a 66px gap; through 1000px it stacks. Companion capabilities and setup steps use three columns. FAQ starts as a `.8fr / 1.2fr` split and stacks through 1000px.

Through 760px, the header becomes 90px high and hides the two secondary navigation links while retaining the setup action. The hero becomes a vertical flow; the full mascot follows the copy, centered at 76% width and at most 360px. Companion articles become image/text rows; setup and FAQ become single columns. Through 420px, companion article contents stack and the mascot grows to 84% width. The footer retains two groups, with links arranged vertically on mobile.

The build is spacious rather than card-dense. Keep content sections in the shared container; only the learning example needs a full enclosing panel. FAQ answers cap at 65ch. Preserve touch-sized controls: preview tabs start at 48px high, become 46px on mobile; mobile footer links remain at least 44px high.

## Elevation & Depth

Depth comes from tonal separation, borders, the horizon glow, and the mascot artwork. Panels and capability illustrations do not have card shadows. The mascot alone has a soft object shadow (`drop-shadow(0 18px 25px #0006)`); sparse pixel stars have a small glow. These decorative effects do not define a general elevation scale.

**The Quiet Surface Rule.** Separate functional containers with surface tone and a single hairline; leave cinematic glow to the decorative horizon and stars.

## Shapes

Controls are pills. Content uses restrained soft corners: the learning panel uses the panel token, becoming 14px on mobile; capability illustration fields and speech bubbles use the illustration token; code uses the inset token. One-pixel borders and simple straight dividers organize content. Circular numbered setup markers give sequence without enclosing every step in a card.

The original mascot retains its square source proportions, transparency, complete antennae and feet, and crisp `image-rendering: pixelated` scaling. Never stretch or regenerate it to fit a layout.

## Components

### Buttons

Friendly pill links carry the primary page actions. Default height is at least 64px; the small header variant starts at 58px. Mint fill with dark text is primary; the outlined variant uses ivory text and a sage border. Hover lightens mint to `#c4ffdf` and moves the control up 2px; outline hover uses a translucent mint field. Active returns to its resting position. Arrow SVGs use a 22px square by default and inherit the text color.

All links, buttons, summaries, and focusable panels share a visible 3px mint focus outline with a 6px offset. Preserve the focused skip link, which reveals itself above the page and targets main content.

### Preview tabs

Pill buttons switch among three labeled, scripted examples. Transparent unselected tabs have a muted green border; the selected tab has mint fill and dark text. ARIA tab/tabpanel associations and roving tabindex are implemented. Left/right arrows wrap; Home and End jump; activation updates `?preview=` using `replaceState`. Reload and `popstate` restore a valid topic; an unknown topic falls back to the first tab.

### Learning panel

The repeated example container has Deep Forest Surface, a Forest Hairline border, and 32px default padding, with responsive overrides of 26px, 36px, 24px, then 20px. A question, a clearly identified OHMI answer, a technical example, and a hairline-separated footer form its hierarchy. Hidden panels use the `hidden` attribute. The component example remains visible without JavaScript; switching needs JavaScript. There is no free-form chat input.

### Capability illustrations and setup steps

The three capability articles use flat illustration fields, followed by an ordinary title and supporting copy. Decorative artwork is hidden from assistive technology. Setup uses an ordered list with mint circular number markers; numbers are hidden from assistive technology because the list already supplies sequence.

### FAQ

Native `details`/`summary` rows supply keyboard behavior and disclosure state. Rows have hairline separators, generous vertical padding, and a CSS plus/minus marker. Hover makes the summary mint; opening rotates the vertical marker to horizontal. Answers use readable paragraph spacing and visible inline links.

### Navigation

Text links and the small primary action form a simple header row; there is no drawer. The wordmark links home with an accessible label. Footer source and back-to-top links keep generous target heights. Section links use native anchors and smooth scrolling unless reduced motion is requested.

### Mascot and horizon

The sole character authority is `../docs/OHMI_MASCOT.md` and `../assets/mascot/ohmi-pixel-front.png`. `dist/assets/ohmi.png` is byte-identical to that approved front PNG: both SHA-256 hashes are `815AD3DFF06433ED9081EF1A73FAC2F97D7943D760E95A9AC11660D11AD39382`. The six-view sheet is reference material, not an alternate hero asset. Preserve original PNG bytes, transparency, proportions, and identity; future expressions or replacement art require owner approval.

The generated horizon is separate decorative art. Its final exact prompt is in `design/horizon-final.json` and PNG metadata; source and licensing provenance is in `dist/assets/ASSETS.md`. It is not a circuit simulation. Give the mascot meaningful alt text; the horizon and stars remain decorative.

Entrance motion uses a 14px upward arrival with opacity 0.6 to 1 over 0.7s for copy and 0.85s for the mascot, using `cubic-bezier(.16,1,.3,1)`. Hover transitions use 0.2s, with 0.25s transforms. Reduced motion disables all animations and transitions and changes scrolling to automatic. Forced colors adds control/panel borders and hides the horizon and stars.

Motion refinement: copy children arrive with a short bounded stagger. The mascot has one independent 3px idle breath; stars and horizon breathe softly, settling within five seconds. Original source-pixel pupil sprites ease toward a mouse pointer within exact eye masks; no head or body rotation follows the pointer. Neutral, touch and reduced-motion gaze show the original PNG. Offscreen/hidden motion sleeps, and the animation frame loop stops after settling. See `design/MOTION_VERIFICATION.md` for source bounds, asset provenance and verification.

## Do's and Don'ts

### Do:

- **Do** preserve the exact approved mascot PNG and its complete silhouette.
- **Do** reuse the existing mint action, focus, and selected-state vocabulary.
- **Do** keep functional surfaces quiet, with tonal separation and hairlines.
- **Do** retain semantic headings, native disclosures, keyboard tabs, the skip link, and reduced-motion behavior.
- **Do** label examples as scripted and illustrative, and direct setup to the existing source instructions.
- **Do** keep this standalone website separate from extension behavior and student data.

### Don't:

- **Don't** regenerate, redraw, crop, or stretch the approved mascot without owner approval.
- **Don't** make decorative raster artwork responsible for essential text or interaction.
- **Don't** imply Autodesk affiliation, Chrome Web Store availability, electrical verification, or a live AI connection from this page.
- **Don't** promote detector exceptions or small helper-copy defects into reusable design rules.

Not canonized: the unresolved automated wordmark/helper flags and countable below-fold SVG conflict are review limitations, not house-style permissions. The existing educational schematic is documented as built, not declared a craft-floor exemption. Current helper sizes are not a recommended minimum text scale. Preview state is retained only in the URL; this website has no account or durable student-work persistence.
