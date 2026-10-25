---
name: OHMI sunny countryside
description: A warm circuit-learning companion in the owner's countryside illustration.
colors:
  ink: "#173f36"
  muted: "#44675c"
  paper: "#f1f7ef"
  mint: "#dcead9"
  accent: "#245c48"
  white: "#f9fcf7"
  focus: "#f8d254"
  scene-ground: "#54783e"
  preview-surface: "#e2ecdd"
  glass: "rgb(207 228 209 / .42)"
typography:
  display:
    fontFamily: "Grandstander, sans-serif"
    fontSize: "clamp(100px,10vw,144px)"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Grandstander, sans-serif"
    fontSize: "clamp(32px,3.3vw,48px)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "-.025em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 500
rounded:
  surface: "16px"
  pill: "999px"
spacing:
  card-gap: "20px"
  mobile-gutter: "22px"
  preview-padding: "32px"
components:
  button-primary:
    backgroundColor: "{colors.white}"
    textColor: "#315f46"
    rounded: "{rounded.pill}"
    padding: "14px 25px"
    height: "56px"
  navigation:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 30px"
    height: "50px"
  feature-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  learning-preview:
    backgroundColor: "{colors.preview-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "{spacing.preview-padding}"
---

# Design System: OHMI sunny countryside

## Overview

**Creative North Star: A circuit buddy in the countryside.** The owner's supplied sunny illustration establishes the world: open blue sky, green hills, a seated student and OHMI. White playful display type and frosted controls follow the owner-selected MotionSites composition. Quiet pale-green reading sections continue its warmth below the scene.

This records the review build in `src/index.html`, `src/styles.css`, `src/app.js` and `src/scene.js`, governed by `design/cinematic/PLAN.md`. It supersedes the previous dark-mint website direction; the historical visual brief in `PRODUCT.md` does not describe this build. Product truth remains unchanged. This is a review branch, not a deployment record.

**Key Characteristics:**

- Exact supplied countryside art, responsive delivery copies and the original approved pixel mascot.
- Grandstander display type with Inter explanations and controls.
- White and frosted pills, soft card shadows and generous reading space.
- Localized environmental motion with a complete still-image presentation.

## Colors

### Primary

Deep forest **Accent** marks selected preview questions and environmental-motion controls. The illustration supplies the saturated sky and hillside colors; do not approximate it with replacement scenery.

### Neutral

**Ink** carries headings and controls, **Muted** carries supporting prose, and **Paper** is the page and card surface. **Mint** and **Preview Surface** distinguish secondary controls and the local learning sample. **White** carries hero text and primary actions. **Glass** lets the sky show through navigation. **Focus** supplies the visible yellow keyboard outline and text selection.

**The Sunny Scene Rule.** Keep this light palette in both operating-system color schemes; the implementation explicitly sets `color-scheme: light`.

## Typography

Both fonts are self-hosted with license files. Grandstander (900) gives the headline, section headings and wordmark a friendly rounded character; Inter supports legible explanations and navigation.

The hero is two separate white lines, **MEET / OHMI**, with a smaller uppercase kicker. On phones the display becomes (82px), falling to (76px) below (370px); tablets from (560–820px) use (100px). Supporting hero text scales from (16–21px), uses a dark blue shadow and a (1px) stroke with stroke painted behind the fill to remain readable against clouds. Feature titles use Grandstander (24px); long answers stay in Inter with a (65ch) maximum measure.

## Layout

The wide opening centers the hero in open sky while keeping the student and OHMI at lower left. The image frame preserves its source ratio (1672:941). The scene flows into three equal feature cards, followed by mascot introduction, three learning roles, scripted preview, about text, retained FAQ and source footer. Standard content uses a maximum (1180px) width and (48px) side gutters; wide screens from (1700px) expand feature content to (1280px).

Laptop adjustments apply from (821–1100px). At (820px) and below, navigation becomes a menu, text sits above a landscape window, and a (100px) image-mask fade removes the sky seam. Cards become a keyboard-focusable horizontal snap track with (22px) gutters and (77%) card widths. Tablets from (560–820px) use (47%) cards and a wider landscape crop. Reading columns stack on phones; sample-question pills become full-width rounded rows. Safe-area padding protects mobile controls and footer.

## Elevation & Depth

Illustration, sky shading and the lower landscape fade create scene depth. Navigation uses frosted glass (18px blur) with a subtle inset highlight. Secondary hero actions use (14px) blur. Reduced transparency replaces these with solid pale-green surfaces.

Cards use the shared ambient shadow `0 12px 32px rgb(24 64 44 / .17)`, deepening on hover. Primary actions have a smaller ambient shadow. Lower reading sections rely on tonal surfaces and thin green dividers rather than enclosing every section in a card.

## Shapes

Use full pills for navigation and actions, gently rounded rectangles for cards and preview surfaces, circular arrow badges and a round pale-green mascot frame. Preserve the mascot's complete silhouette, proportions and transparent source; apply pixelated rendering to its UI copies. The countryside remains a single image texture, without duplicate character layers.

## Components

**Navigation and actions.** The compact three-part desktop header holds the brand, centered glass navigation and launch action. Links reveal a fine underline; primary pills rise (2px), their arrows shift diagonally, and active pills compress to (.98). Keyboard focus uses a (3px) yellow outline offset (5px). The mobile menu closes on link activation, outside click or Escape, returning focus on Escape.

**Feature cards.** The owner-approved pixel-art workshop illustrations introduce Ask OHMI, Check My Circuit and Guided Builds. Use `ask-workshop.webp`, `check-workshop.webp` and `build-workshop.webp`, each 1200 x 751. These are conceptual illustrations, not screenshots or verified electrical diagrams. Preserve the 1.64 image windows, card motion and corresponding PWA links.

**Installation choices.** Beneath Explore, retain both `Open the PWA` and `View on GitHub` pill actions, the manual desktop Chrome explanation and `#get-started`. GitHub uses the pale mint surface with forest ink and visible yellow keyboard focus. The layout reflows beneath 1100px and stacks buttons as needed beneath 820px. This row coexists with the approved breakdance animation below.

**Learning preview.** A pale-green container holds three native question buttons and a polite live answer region. Forest fill and white text indicate selection. Responses are scripted local text; the visible limitation belongs beside the preview. No input field or upload interaction exists here.

**FAQ and source access.** Four retained answers use native details/summary disclosures with pale surfaces, muted prose and sparse green dividers. Preserve the existing `#faq`, `#get-started` and `#top` destinations, the source setup link and the focusable main target for the skip link. This preserves existing content and navigation, without introducing product capability.

**Entrance and scene.** Native Web Animations API entrances rise into place with `cubic-bezier(.16,1,.3,1)`. Headline lines stagger (160ms); subsequent copy, pills and feature cards follow. Content remains visible when JavaScript fails. The WebGL source-image wind field has a (24-second) period and a (30fps) draw cap, with independently phased grass, hair, cloth, sky and antenna motion. Character face and body landmarks stay anchored. This is shader displacement, not generated video.

The scene has an explicit pause/play control, pauses when hidden or offscreen, and falls back to the poster for reduced motion, data saving, unavailable WebGL or context loss. Reduced motion also removes entrances, card transforms, transitions and smooth scrolling.

## Do's and Don'ts

- **Do** preserve the supplied countryside PNG and canonical mascot PNG originals; use documented WebP copies for delivery.
- **Do** keep essential copy and interaction in HTML, above decorative artwork.
- **Do** retain the phone sky fade, subtitle contrast treatment, keyboard access and still-scene fallback when adapting this page.
- **Do** retain accurate preview labels and source setup destinations.
- **Don't** redraw the mascot, replace the illustration or introduce generated footage without owner approval.
- **Don't** imply live AI, electrical verification from an image, Autodesk endorsement or a deployed release through screenshots or action wording.
