---
name: OHMI electronics workspace — M1–M3 local preview
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
  build-disclosure:
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.surface}"
    padding: "12px 16px"
---

# Design System: OHMI electronics workspace — M1–M3 local preview

## Overview

**Creative North Star: "Calm mint study workspace"**

This local preview inherits the existing OHMI Operate interface. A compact React control area surrounds the native designElectronics canvas; it does not introduce a new visual identity. This file records M1–M3 local implementation, including the explicit Ask OHMI build disclosure and workspace handoff. The application-wide authority remains `web-app/DESIGN.md`, with product constraints in `web-app/PRODUCT.md` and phase boundaries in `../PLAN.md`.

**Key Characteristics:**
- Light mode by default; mint actions on pale study surfaces and neutral charcoal in dark mode.
- Familiar labeled controls, restrained borders and the unchanged canonical OHMI mascot in the shared shell.
- Native technical canvas retained; no new illustrations, mascot variants or decorative motion.

## Colors

The React shell uses existing semantic CSS variables. Primary color marks Run, Save snapshot and actionable links; secondary surfaces carry the persistence/simulation notice. Status copy uses muted foreground; failures use destructive foreground. Dark mode switches the existing application tokens rather than applying an image filter. The private-project and build disclosures add no new palette; build actions reuse the outline variant, with result navigation expressed as underlined primary-color links.

The native chrome receives a separate `Theme` mapping from `src/ohmi_web.cpp`: near-black background, charcoal panels, graphite secondary surfaces and subdued mint accents. These native values are close to, but not identical to, the React tokens. The schematic remains a white technical sheet with its upstream grid and symbol colors.

**The Technical Canvas Rule.** Theme the surrounding controls without recoloring physical part markings or making schematic symbols unreadable.

## Typography

Self-hosted Geist serves the React shell. Supporting copy uses the body token with a maximum notice/footer measure of 75ch. Labels use the shared Button component. The upstream editor retains its bundled Lato interface and Source Code Pro code font; CSS outside the iframe does not replace them.

Page and legacy-copy heading sizes remain local implementation exceptions, not additions to OHMI's shared type ramp.

## Layout

Header and control groups wrap without horizontal page overflow. A native `details` disclosure for Private projects sits between the persistence notice and circuit toolbar. Thin block borders separate this optional section; its summary has a 44px minimum target. Project rows wrap their name/revision, Open and Delete controls; long names can break rather than overflow. The toolbar separates view, simulation/history and file actions. The full-width editor follows the loading/status line. At 640px and below, footer controls stack; the editor remains at least 560px tall. Above that breakpoint, its height is at least 600px or 75dvh. Shared OHMI navigation adapts independently around this surface.

Ask OHMI places its separate Build disclosure below the existing composer, preserving that composer's layout and unrelated draft. The disclosure uses a thin border, base surface radius and left-aligned body copy. Its summary and result link retain 44px minimum targets; action buttons wrap with the control gap rather than shrinking. A full-width labeled textarea has a 100px minimum height. The workspace adds a requested-draft action and a second native disclosure for captured observations. The timeline scrolls within a bounded region, uses tabular numbers and retains a caption and table headers.

Initial shell captures are in `../evidence/m1-*.png`. M2 ordinary desktop/light, desktop/dark and mobile first viewports are `m2-desktop-light.png`, `m2-desktop-dark.png` and `m2-mobile-light.png`; separately scrolled editor captures are `m2-mobile-editor.png` and `m2-desktop-dark-editor.png`. The replacement-safe capture records the separate-copy notice. These show the local preview, not final M4 interaction polish.

M3 evidence is `m3-ask-light.png`, `m3-ask-mobile-dark.png`, `m3-build-mobile-viewport.png` and `m3-workspace-dark.png`. The mobile viewport capture shows the build controls within the inherited fixed navigation; it does not certify the native canvas's touch or assistive-technology coverage.

## Elevation & Depth

Tonal surfaces and thin borders provide most separation. Buttons inherit the shared component's modest outline shadow and focus treatment. The editor frame adds no decorative halo, glass layer or gradient.

## Shapes

Use the shared Button corners and base surface radius for the notice and editor frame. Native canvas controls retain upstream geometry. Do not standardize the upstream shapes by changing the actual component drawings.

## Components

**The Captured Work Rule.** Saving records an explicit captured snapshot, not continuous autosave; later edits need another save. Keep `.dez` download available, and require it when private storage is unavailable. File replacement, reload and workspace exit require confirmation; canceling navigation retains the runtime and circuit.

Host controls are labeled DOM buttons with shared keyboard focus and disabled states while loading or busy. Status uses `role="status"`, errors use `role="alert"`, and the iframe has a descriptive title. View buttons issue native commands without claiming synchronized selected-state semantics. Reload provides recovery after engine failure.

Private projects reuses those buttons for Save snapshot, Save separate copy, Refresh, Open, Delete and loading older records. Legacy records have a distinct Create copy action and a visible promise that original saves/progress remain unchanged; the new simulator can differ. Availability, empty lists, save revision, replacement notices and failures are rendered inline rather than implying background autosave.

**The Account and Document Rule.** Account changes clear private project state and the engine runtime. A captured native replacement generation plus UID binds the current private record/revision; replacing a native document creates a separate project even if its UID matches. Ordinary edits can update the same record. This session identity prevents accidental overwrite; it is not an authentication credential. Server authorization remains separate.

The SQL migration is a draft, and hosted storage rollout is separately gated. Where storage is unavailable, the API returns 503, saving stays unavailable and the notice directs students to download `.dez`. Local fixture captures of successful saves do not establish hosted availability. The final M2 review's ship disposition resolves its one native-replacement identity finding only.

**The Explicit Draft Rule.** Building is a distinct action, never an automatic interpretation of chat text. Keep generation, stopping the wait, checking the same request and opening a new editable draft visibly separate. Do not imply that stopping the wait cancels server work or that a completed model answer has already opened or saved a circuit.

The Build disclosure states its qualified component scope and unavailable state in ordinary copy. An unresolved request disables another build; read-only status recovery remains a separate labeled action. The result preserves validated planner caveats as a visible list. Direct workspace handoffs include those caveats before opening. Account changes clear the private build UI; the ordinary chat composer is not consumed by building. New draft opening uses the existing work-protection confirmation, scratch compilation and separate-save identity. Exact `.ino` download joins `.dez` in the file-action group.

Captured observations use an optional details/table surface, not a success badge or fabricated live indicator. Its copy distinguishes historical simulator samples from post-edit behavior and hardware verification. The table's bounded scrolling region is keyboard-focusable; values use tabular numerals and thin row separators.

The native canvas is not a DOM-accessible equivalent of every editor operation. Full keyboard, touch and assistive-technology coverage remains an M4 gate; shell checks are not whole-editor accessibility certification. M3 was verified locally with mocked provider responses and actual WASM, not live inference. Its review's ship disposition covers the one planner-warning preservation fix. Hosted enablement, production readiness and M4 polish remain separately gated.

## Do's and Don'ts

- **Do** reuse the existing semantic tokens, shared Button and exact approved mascot.
- **Do** preserve the native technical rendering and disclose simulation limits.
- **Do** distinguish local-preview verification from production readiness.
- **Don't** infer full canvas accessibility from the surrounding DOM controls.
- **Don't** treat local heading exceptions, upstream canvas geometry or incidental test toasts as new application-wide design rules.
- **Do** preserve planner caveats and distinguish model narrative, captured simulation evidence and actual saved work.
- **Don't** add replacement mascot art, unapproved visual-analysis controls or unverified hosted-save/live-inference claims to this preview.
