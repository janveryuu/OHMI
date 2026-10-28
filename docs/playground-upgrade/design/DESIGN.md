---
name: OHMI electronics workspace — M1 local preview
description: A scoped record of the inherited OHMI shell and native editor chrome, not a replacement application design system.
colors:
  primary: "#08776b"
  primary-foreground: "#fafffd"
  background: "#f5f8f7"
  foreground: "#20332f"
  card: "#fdfefd"
  secondary: "#edf3f0"
  muted-foreground: "#566b61"
  border: "#e1e9e4"
  destructive: "#b23636"
  background-dark: "#0b0c0f"
  card-dark: "#15171b"
  secondary-dark: "#202329"
  foreground-dark: "#f1f3f5"
  primary-dark: "#9be4ce"
  primary-foreground-dark: "#10231d"
  muted-foreground-dark: "#a2a9b4"
  border-dark: "#2a2e35"
typography:
  body:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
rounded:
  button: "11px"
  surface: "12px"
spacing:
  control-gap: "8px"
  row-gap: "12px"
  group-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.button}"
    height: "44px"
  local-notice:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.surface}"
    padding: "14px 16px"
---

# Design System: OHMI electronics workspace — M1 local preview

## Overview

**Creative North Star: "Calm mint study workspace"**

This local preview inherits the existing OHMI Operate interface. A compact React control area surrounds the native designElectronics canvas; it does not introduce a new visual identity. This file records M1 only. The application-wide authority remains `web-app/DESIGN.md`, with product constraints in `web-app/PRODUCT.md` and phase boundaries in `../PLAN.md`.

**Key Characteristics:**
- Light mode by default; mint actions on pale study surfaces and neutral charcoal in dark mode.
- Familiar labeled controls, restrained borders and the unchanged canonical OHMI mascot in the shared shell.
- Native technical canvas retained; no new illustrations, mascot variants or decorative motion.

## Colors

The React shell uses existing semantic CSS variables. Primary color marks Run and actionable links; secondary surfaces carry the local-save warning. Status copy uses muted foreground; failures use destructive foreground. Dark mode switches the existing application tokens rather than applying an image filter.

The native chrome receives a separate `Theme` mapping from `src/ohmi_web.cpp`: near-black background, charcoal panels, graphite secondary surfaces and subdued mint accents. These native values are close to, but not identical to, the React tokens. The schematic remains a white technical sheet with its upstream grid and symbol colors.

**The Technical Canvas Rule.** Theme the surrounding controls without recoloring physical part markings or making schematic symbols unreadable.

## Typography

Self-hosted Geist serves the React shell. Supporting copy uses the body token with a maximum notice/footer measure of 75ch. Labels use the shared Button component. The upstream editor retains its bundled Lato interface and Source Code Pro code font; CSS outside the iframe does not replace them.

The current page heading is a one-off fluid 24–32px, weight 650. It is recorded as an implementation exception, not promoted into OHMI's shared type ramp.

## Layout

Header and control groups wrap without horizontal page overflow. The toolbar separates view, simulation/history and file actions. The full-width editor follows the loading/status line. At 640px and below, footer controls stack; the editor remains at least 560px tall. Above that breakpoint, its height is at least 600px or 75dvh. Shared OHMI navigation adapts independently around this surface.

Desktop, tablet and mobile captures are in `../evidence/m1-*.png`. They show the local preview, not final M4 interaction polish.

## Elevation & Depth

Tonal surfaces and thin borders provide most separation. Buttons inherit the shared component's modest outline shadow and focus treatment. The editor frame adds no decorative halo, glass layer or gradient.

## Shapes

Use the shared Button corners and base surface radius for the notice and editor frame. Native canvas controls retain upstream geometry. Do not standardize the upstream shapes by changing the actual component drawings.

## Components

**The Local Work Rule.** Keep local-only saving explicit: students must download `.dez` before leaving. File replacement, reload and workspace exit require confirmation; canceling navigation retains the runtime and circuit.

Host controls are labeled DOM buttons with shared keyboard focus and disabled states while loading or busy. Status uses `role="status"`, errors use `role="alert"`, and the iframe has a descriptive title. View buttons issue native commands without claiming synchronized selected-state semantics. Reload provides recovery after engine failure.

The native canvas is not a DOM-accessible equivalent of every editor operation. Full keyboard, touch and assistive-technology coverage remains an M4 gate; M1 shell checks are not whole-editor accessibility certification. Cloud persistence and AI building remain later phases.

## Do's and Don'ts

- **Do** reuse the existing semantic tokens, shared Button and exact approved mascot.
- **Do** preserve the native technical rendering and disclose simulation limits.
- **Do** distinguish local-preview verification from production readiness.
- **Don't** infer full canvas accessibility from the surrounding DOM controls.
- **Don't** treat the heading exception, upstream canvas geometry or incidental test toasts as new application-wide design rules.
- **Don't** add replacement mascot art, visual AI controls or cloud-save claims to M1.
