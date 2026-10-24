---
name: OHMI Playground
description: Surface notes for OHMI's beginner circuit workbench within the existing PWA design system.
---

# Design System: OHMI Playground

## Overview

Operate mode. The Playground extends the existing calm mint study workspace with a circuit editor. It preserves the app shell, self-hosted Geist, approved Library Soft Voxel WebP illustrations, and exact pixel mascot. No approved visual comp exists; these notes describe the implemented surface rather than a proposed replacement identity.

The workbench uses actual component-terminal connections and a bounded deterministic evaluator. Circuit geometry carries function: terminal buttons expose connection points, wires join terminals, and the grid supports placement. Breadboard electrical connectivity is explicitly unsupported. AI guidance occupies a separate, collapsed helper and cannot alter the electrical result.

Sources: `src/app/playground.css`, `src/components/playground.tsx`, `src/components/playground-help.tsx`, and `docs/screenshots/playground/`. Global tokens remain authoritative in `DESIGN.md` and `src/app/globals.css`. This document does not repair the deferred PRODUCT.md or design-sidecar drift.

## Colors

Use the incumbent semantic pairs. `primary` identifies actions, wires, terminals, selection, and focus; `accent` with `accent-foreground` supports mission success and contextual feedback. Potential-damage feedback uses `destructive`, a stroked card surface, and explicit warning text.

The whole surface follows the existing light mint or neutral black theme. Secondary text uses `muted-foreground`; form controls and component surfaces use `card`, `foreground`, `input`, and `border`. The workspace grid derives from `input`. No Playground-specific palette or new global color token is introduced.

## Typography

Geist Variable continues across headings, controls, explanations, and measurements. The page inherits the app headline treatment, reducing to 28px on phones. Mission headings use 17px; inspector and tray headings use 15px; feedback and primary form copy use 13–14px. Mobile input and select text rises to 16px.

Local 10–12px terminal labels, component metadata, and canvas chrome are compact-editor exceptions. They are not a new body-text standard. Canvas zoom changes the rendered component scale; users can center a component, zoom in, or use the inspector's native controls for readable interaction.

## Layout

Desktop uses a three-column tray/workbench/inspector grid: 180px, flexible center, and 244px, separated by 16px gaps. At 1250px and below, the tray narrows to 148px and the inspector moves beneath the workbench. Below 768px, these regions stack; the four component choices occupy one compact tray row.

The logical workspace is 1000 × 640px with 24px snapping. The visible canvas is 520px high by default, 480px at the intermediate layout, 360px on phones, and 580px on wide screens. Fit derives its scale from available width. Phone editing starts at a readable zoom; View component centers the selected part at 80% rather than requiring precision panning.

Deterministic feedback precedes the workbench. Mission objectives, progressive hints, and completion explanations remain above that feedback. Secondary wiring controls, the connection list, and contextual AI help use disclosure panels to limit initial density. Existing mobile navigation and its safe-area treatment remain in the app shell.

## Elevation & Depth

Tray, canvas, inspector, and mission regions use card-colored surfaces with subtle borders. Movable component cards reuse the existing ambient `shadow`; selected mode segments reuse `shadow-selected`. Selection is primarily expressed through the paired teal border or fill, not decorative glow. The LED's expected-on state has both a surface change and an explicit label.

## Shapes

The recurring role-based corners continue the incumbent system: inputs and compact actions around 11px, tray/supporting controls around 12px, and main panels/components at 16px. Circular terminal buttons communicate connection points. Small segment and label exceptions remain local details rather than additions to the global radius scale.

## Components

- **Placement and movement:** native tray drag/drop, choose-then-tap placement, component dragging, keyboard placement and arrow-key movement, and numeric X/Y fields provide equivalent paths.
- **Terminals and wires:** editing terminals remain 44px in rendered size through inverse zoom scaling. Below 50% zoom, direct terminal buttons are hidden and the canvas explains that users should zoom in. Native From/To selects remain an alternate connection method. Selected wires receive a thicker dashed stroke and can be selected through the connection list.
- **Pan and zoom:** selection mode retains vertical page scrolling. Explicit Pan mode scopes `touch-action: none` to the workbench; draggable component handles also isolate their own gesture. Zoom buttons, Fit, and View component provide discrete alternatives.
- **Inspector:** component imagery, properties, switch state, position fields, and deletion stay grouped. Undo/redo restores editing changes. Connection and AI disclosures remain separate from the primary component task.
- **Saving:** Save project updates the current private record. Save copy remains visible after a record exists, supporting separate experiments without overwriting earlier projects. Pending, conflict/error, signed-out, empty-list, and saved/unsaved states have explicit text.
- **Feedback and motion:** visible labels and live status communicate supported, incomplete, unsafe, and unsupported results. Tray and terminal color transitions last 160ms; feedback enters over 180ms. These effects run only when reduced motion is not requested.

## Do's and Don'ts

- **Do** preserve the global semantic color pairs, approved artwork, and unchanged mascot.
- **Do** keep electrical feedback visible near the workbench and separate from AI guidance.
- **Do** retain component centering, native-control wiring, keyboard alternatives, and clear overview/editing states.
- **Don't** imply comprehensive simulation, breadboard connectivity, or physical verification.
- **Don't** promote scaled canvas microtype or one-off editor measurements into global PWA defaults.
- **Don't** redesign existing pages or change project-wide tokens to accommodate this surface.

Independent review disposition: **ship**, limited to incumbent fidelity, corrected desktop/mobile captures, and sampled source. The review resolved genuine Fit behavior, mobile component centering, an accessible Save copy path, and feedback placement. It did not independently rerun the implementation's reported test suites.

Playground alone omits the generic signed-out banner because its save status repeats that instruction. Error/configuration notices remain. Unrelated route prefetch is disabled while editing, and rich-text rendering loads only when an AI explanation exists. These changes do not alter other page designs.
