# Phase 2 interface and motion

The owner approved Phase 2 and reports Phase 1 successfully tested inside Tinkercad Circuits. Preserve its editor detection, dragging, placement, position/open-state persistence, Shadow DOM isolation, and corrected overlay layer.

## Product and scope

OHMI is a compact independent learning companion for engineering students using Tinkercad Circuits. This phase builds six frontend sections: Home, Ask OHMI, Assignments, Guide Me, Check My Circuit, and Settings. Navigation, local sample conversations/results, tutorial progress, and preferences work. AI, real uploads, PDF/image processing, screenshot capture, circuit analysis, accounts, and backend calls stay unavailable and clearly labeled.

## Visual decisions

Keep the approved PNG and existing teal identity. The panel stays at most 360 CSS pixels wide and uses existing viewport-safe placement. One scrollable content area sits between a compact header and four-item navigation: Home, Ask, Guide, and More. More provides Assignments, Check My Circuit, and Settings; Settings also has a header control. Home has four purposeful quick-access actions and a sample-guide continuation.

When a narrow viewport leaves less than 260px of panel height, opening, resizing, or finishing a move shifts the mascot to the nearest vertical edge. This preserves reachable navigation and a scrollable body without covering the mascot. Closed-panel dragging stays unrestricted within viewport bounds. Very short viewports use the physical space available; 320×400 is the smallest automated layout check.

Use system UI typography to avoid external font requests: 20px section titles, 14px body copy, 12px secondary text. Main tokens: deep teal `#075d57`, charcoal teal `#183434`, cream `#fffdf8`, mint `#e5f7ee`, muted teal `#526e66`, and restrained gold `#f3c46c`. A dark appearance uses deep teal surfaces with light text. Native buttons, selects, checkboxes, and progress elements keep keyboard behavior familiar. All important controls get visible focus and practical touch targets.

Settings save English/Filipino/Taglish explanation preference, motion preference, and light/dark appearance in extension-local storage. Language affects local sample replies; the interface remains English in this phase. Chat messages and mock upload/result states remain session-only. Sample tutorial progress is retained during navigation, without implying cloud storage or real assignment progress.

## Sample interactions and truthful states

- Chat accepts local text, displays a brief explicitly labeled sample-loading state, then a fixed localized sample reply. Attachment controls explain that real files are unavailable.
- Assignments starts empty, provides a built-in LED assignment sample, then a local analysis preview and tutorial entry. No file chooser or drop handler reads user files.
- Guide has five sample steps, previous/next controls, completion tracking, and a restart action.
- Circuit checking offers a built-in illustrative sample with uncertainty-aware diagnostic text. It never reads the actual Tinkercad circuit.
- Unavailable upload/capture controls show a clear explanation and sample alternative. Loading, empty, and error/notice states have useful next steps and live announcements.

## Motion

CSS moves the entire approved image: gentle idle float, hover lift, happy bounce after local completion, and thinking movement during sample loading. Panel open/close and navigation transitions stay short. Subtle light effects sit around the existing antenna tips; no facial pixels, accessories, colors, or proportions are replaced. Both the animation preference and operating-system reduced motion disable all movement and light effects. Additional blinking, talking, confused, or sleepy faces need separately approved transparent frames; the turnaround sheet is reference only.

## References applied

- [shadcn/ui Empty](https://ui.shadcn.com/docs/components/base/empty): visually inspected the compact icon, clear empty-state explanation, and primary/secondary action hierarchy. Adapt these principles to OHMI's upload previews, without copying code or styling.
- [shadcn/ui component documentation](https://ui.shadcn.com/docs/components): use semantic control, progress, and focus patterns as reference. No component library installation is needed.
- The installed [design-reference-library](C:/Users/LEGION/.codex/skills/design-reference-library/SKILL.md) collection remains the broader inspiration pool; compact product patterns take priority over landing-page effects.
- [Arduino Blink example](https://docs.arduino.cc/built-in-examples/basics/Blink/): source for the illustrative LED learning context. Local sample diagnostics are not electrical verification.

The UI/UX Pro Max generated landing-page/clay suggestions do not fit this overlay or its approved brand. Apply its compact-navigation, readability, focus, and contrast guidance instead.

## Acceptance

Exercise every section, local preview flow, language/theme/motion persistence, guide navigation, keyboard focus, and reduced motion. Retain all Phase 1 browser regressions, especially raised editor layers, touch-to-keyboard activation, SPA exit/return, and page interaction passthrough. Inspect actual rendered desktop, small, and dark states; fix defects in a bounded pass. Stop after Phase 2.
