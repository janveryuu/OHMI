---
name: OHMI Web App
description: Calm mint electronics study workspace with a restrained charcoal dark theme and the original pixel companion.
colors:
  background: "#f5f8f7"
  foreground: "#20332f"
  card: "#fdfefd"
  primary: "#08776b"
  primary-foreground: "#fafffd"
  secondary: "#edf3f0"
  secondary-foreground: "#304d45"
  muted-foreground: "#566b61"
  accent: "#dff5ec"
  accent-foreground: "#09695c"
  destructive: "#b23636"
  destructive-foreground: "#fafffd"
  border: "#e1e9e4"
  input: "#ccd9d2"
  background-dark: "#0b0c0f"
  foreground-dark: "#f1f3f5"
  card-dark: "#15171b"
  popover-dark: "#202329"
  primary-dark: "#9be4ce"
  primary-foreground-dark: "#10231d"
  secondary-dark: "#202329"
  secondary-foreground-dark: "#d8dce2"
  muted-foreground-dark: "#a2a9b4"
  accent-dark: "#24272d"
  accent-foreground-dark: "#b6f0de"
  mint-dark: "#202329"
  destructive-dark: "#ffb4ab"
  destructive-foreground-dark: "#3a1412"
  border-dark: "#2a2e35"
  input-dark: "#5f6670"
typography:
  headline:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "12px"
rounded:
  button: "11px"
  control: "12px"
  panel: "16px"
  dialog: "20px"
  feature: "24px"
  pill: "999px"
spacing:
  compact: "8px"
  row: "12px"
  group: "16px"
  panel: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.button}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.button}"
    height: "44px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "24px"
  badge:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.pill}"
    padding: "4px 9px"
---

# Design System: OHMI Web App

## Overview

**Creative North Star: "Calm mint study workspace"**

Operate mode. A personal electronics workspace with iOS-adjacent adaptive navigation, inset groups, restrained translucent chrome and spring feedback. The explicit user brief fixes the mint/pixel identity; this app extends it without replacing the landing page or redesigning the mascot. No approved visual comp exists: this document records the implemented code.

Design variance 5, motion intensity 6, visual density 4. Usable study tasks take precedence over marketing composition. The original pixel PNG provides the character; the surrounding interface stays quiet.

**Key Characteristics:**
- Teal actions and pale mint selection in light mode; restrained mint highlights on neutral charcoal in dark mode.
- Self-hosted Geist, compact labels and comfortable body leading.
- Rounded task surfaces, adaptive navigation and finite companion greetings.

Source evidence: `src/app/globals.css`, `src/app/template.tsx`, `src/components/app-shell.tsx`, `src/components/dashboard.tsx`, `src/components/app-provider.tsx` and `src/components/ui/`; login evidence is `src/components/login.tsx` and `src/app/login/login.css`, with its surface contract in `docs/LOGIN.md`. Product constraints live in `PRODUCT.md`.

Provenance retained from the incumbent document:
- https://meetohmi.vercel.app/: visually inspected original mint robot, crisp pixel edges and approachable typography. Only identity principles inherited.
- https://mobbin.com/discover/apps/ios: public catalog inspected; detailed paid app flows unavailable. Adaptive navigation is the implementation's choice, not a copied screen.
- https://ui.shadcn.com/docs/components/dialog: accessible Radix-backed dialog used through shadcn/ui.
- https://nextjs.org/docs/app/guides/progressive-web-apps: manifest and secure service-worker foundation.
- UI/UX Pro Max's first education result targeted children and marketing, so it was rejected. A narrower productivity query informed flat product UI and friendly typography; the pinned teal/iOS brief overrides its orange suggestion.

## Colors

### Primary

Teal identifies actions, links and focus. Pale mint with deep teal text identifies selection, companion support and contextual notices. The `primary`, `primary-foreground`, `accent` and `accent-foreground` frontmatter pairs describe the light theme; corresponding `-dark` keys record the actual dark-theme values.

### Neutral

The existing light palette keeps its cool off-white canvas, near-white cards and green charcoal text. Dark mode uses a near-black canvas, charcoal cards, graphite elevated surfaces, off-white text, cool gray secondary text and subtle gray borders. Semantic red remains feedback, not an alternate brand accent.

**The Semantic Pair Rule.** Change foreground and background tokens together when switching themes; preserve their roles rather than reusing a light-theme literal.

The login uses these same semantic canvas, card, text, border, focus and error roles in both themes. The static countryside keeps its original colors; its lower-edge scrim and white caption support image legibility, rather than defining a new interface palette.

## Typography

Self-hosted Geist Variable with sans-serif fallback serves every role. Global page headlines use the frontmatter headline token, reducing to 28px on phones. Dashboard greeting specializes to 30px desktop and 27px phone. Section titles use 20px; item headings use 16px. Body text is 14px with 1.5 leading; supporting labels commonly use 12px. Sentence case keeps tasks approachable.

The implementation also carries smaller chrome labels; these are existing density exceptions, not a recommendation for future body copy.

Login specializes this hierarchy without changing the shared ramp: welcome headline (650 weight, `clamp(28px, 2.65vw, 38px)`, 1.15 leading, -0.035em tracking), portrait headline (30px), short portrait headline (27px) and compact landscape headline (26px). Supporting copy is 16px with 1.6 leading, reducing to 15px portrait and 14px landscape. The Google action is 15px/550; back navigation is 13px; feedback and footer are 12px. Desktop scenic caption uses `clamp(28px, 2.8vw, 40px)` at 600 weight. These are login roles, not replacements for workspace typography.

## Layout

Desktop uses a sticky 248px sidebar with an optional 88px compact state. From 768px through 1199px the rail is 88px. Below 768px the sidebar gives way to five bottom destinations: four task links and More, which opens a sheet. Preserve safe-area padding.

Main content is capped at 1360px, with 40px horizontal desktop padding, 28px tablet padding and 20px phone padding. Repeated gaps use the frontmatter spacing scale. Panels reduce from 24px padding to 20px on phones. Multi-column task surfaces collapse on phones; checker and settings also simplify at tablet sizes.

Layer scale: base content 0; sidebar/header 20; mobile navigation 30; companion 40; PWA status 45; dialogs 50; toast 80; skip link 100. This records the actual source, including status and accessibility layers.

Login is a separate entry composition. At widths of 900px and above, a centered frame (maximum 1440px) pairs countryside and sign-in panel in a 1.08:1 grid, with a 380px maximum action/content column. The page has 24px safe-area-aware outer spacing; desktop heights of 720px or less reduce that spacing to 16px and shrink the mascot from 180px to 120px.

Below 900px, the countryside becomes a scenic header (30svh, constrained to 240–340px) above a panel inset 16px and overlapping by 24px. Scenic branding/caption are hidden; the mascot reduces to 124px. At heights of 740px or less, the scene reduces to 24svh with a 160px minimum and the mascot to 92px. At widths 640–899px and heights up to 540px, a compact 0.8:1.15 landscape split restores the scene alongside the panel, uses 12px outer spacing and a 64px mascot, and hides the footer. The primary action remains the first-viewport priority. Six light/dark desktop, portrait and landscape captures were reviewed in `.impeccable/review/login/`.

## Elevation & Depth

Cards combine tonal separation with soft shadows; the dark theme uses neutral black shadows. Sticky chrome uses a restrained translucent fill and blur; the topbar becomes opaque under reduced transparency. Dialogs and the floating companion receive stronger ambient elevation. Shared shadow tokens preserve those roles in both themes.

**The Quiet Chrome Rule.** Reserve stronger elevation for overlays; regular study content uses the shared panel treatment.

## Shapes

Use the observed role-based radius scale: compact controls, softer panels, larger feature panels and pill badges. Input and navigation corners share the control radius; buttons have their own nearly matching radius. Companion and dialog shells have larger corners. Circular avatars and mascot orbits are established exceptions.

Login adds surface-specific roles: a 28px desktop outer frame, 24px top corners on the inset portrait panel, a 24px compact landscape frame and a 14px Google control. The stacked mobile outer frame and landscape panel are square where they meet their container. These roles preserve the shared workspace radius scale.

## Components

### Buttons

Primary uses paired primary tokens; secondary uses paired secondary tokens. Outline and ghost variants provide lower emphasis. Controls have a 44px minimum height, subtle color feedback, a 0.98 press scale and visible focus. Disabled controls lose emphasis and block pointer action. Lucide is the existing icon family; navigation uses a restrained stroke.

### Login action and artwork

A single outlined Google action spans the content column with a 54px minimum height, paired card/foreground tokens, input border and selected-state shadow. Hover uses secondary fill and the focus token for its border; pending/session restoration disables repeat activation and announces feedback through a polite live region. Back and theme controls retain the established 44px touch minimum.

Reuse the exact unchanged `public/mascot.png` with crisp pixel rendering. The owner approved countryside detail restoration on 25 October 2026: login now uses `public/welcome-countryside-4k.webp`, a 3840 × 2160 export from an AI-enhanced 1672 × 941 source. Preserve the established scene, composition and character identities. Original countryside remains `public/welcome-countryside.webp` for rollback; the landing artwork is unchanged. Provenance and resolution limits are in `design/login/countryside-enhancement.md`. The countryside stays static; mascot motion moves the unchanged PNG as described below.

### Chips

Pill badges use accent fill and paired text. Segmented groups use a secondary track and a card-colored selected segment with low elevation. Selection is a state, not a separate palette.

### Cards / Containers

Panels use the shared card surface, panel radius and tinted shadow. Grouped rows use separators and spacing. Large welcome panels use mint support with the exact original mascot PNG rendered with crisp pixel edges. Mascot displays use Next Image delivery from the canonical `/mascot.png`; the dashboard wraps Image with Motion and supplies responsive sizes plus priority loading. Uploaded local blob images remain ordinary image elements.

### Inputs / Fields

Visible labels sit above stroked card-colored inputs. Placeholder and helper text use the muted foreground. Errors use destructive text. Global focus uses a 3px ring with a 4px offset; shadcn buttons also supply their component focus treatment. Phone inputs use 16px text to avoid focus zoom.

### Navigation

Active destinations use mint inset highlights and stronger paired text. Hover uses secondary fill. Links retain accessible names when the rail hides visible labels. Mobile More opens a Radix-backed sheet with remaining routes.

### Motion and companion

Route entry uses a spring (stiffness 340, damping 32) with a short vertical settle. Shared navigation and segmented state motion preserve spatial continuity. The greeting mascot moves briefly, then rests. System reduced motion and the explicit setting disable spatial movement through component checks and MotionConfig. CSS also suppresses animation and transitions. Keep the exact approved PNG; do not generate a replacement mascot.

Login entry uses a spring (stiffness 230, damping 28) with short staggered arrivals; the action acknowledges press with a 0.98 scale spring (420/28). The mascot performs one 3.8-second vertical greeting after a 0.35-second delay, then rests. System or saved reduced motion removes spatial entrance, greeting and press movement; shared CSS suppresses animation/transitions.

## Do's and Don'ts

### Do:
- **Do** reuse semantic color pairs in both themes.
- **Do** preserve adaptive navigation, safe areas, visible labels and keyboard focus.
- **Do** use the exact original pixel mascot with crisp rendering and responsive Next Image delivery.
- **Do** make movement acknowledge navigation, state or a finite greeting and respect reduced motion.

### Don't:
- **Don't** replace the mint/pixel identity or imply that an iOS reference is an approved comp.
- **Don't** turn chrome microcopy or small badges into the body-text scale.
- **Don't** claim electrical verification from an image or disguise demo activity as live student data.
