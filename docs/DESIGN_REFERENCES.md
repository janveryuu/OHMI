# OHMI design references

These are approved sources of inspiration for OHMI's Chrome extension. The [mascot specification](OHMI_MASCOT.md) and approved pixel-art PNGs are the visual source of truth. Use teal branding, readable controls, and compact layouts that leave Tinkercad's circuit workspace usable.

## Start with compact product interfaces

| Resource | Purpose and relevance to OHMI |
| --- | --- |
| [Mobbin](https://mobbin.com) | Study real app screens and interaction flows for the floating assistant, chat, and step-by-step guidance. Favor compact patterns over full-page layouts. |
| [Page Flows](https://pageflows.com) | Study how users move through onboarding and task flows. Useful for opening OHMI, asking a question, and resuming a tutorial. |
| [SaaSFrame](https://www.saasframe.io) | Compare product UI hierarchy and panel composition. Adapt only patterns that fit a small browser overlay. |
| [shadcn/ui](https://ui.shadcn.com) | Reference accessible control patterns and states for buttons, dialogs, and forms. Its components are not installed in this project. |
| [Figma Community](https://www.figma.com/community) | Explore interface patterns and design assets. Check access and licensing before reusing any asset; OHMI's approved mascot stays unchanged. |

## Use selectively for polish and motion

| Resource | Purpose and relevance to OHMI |
| --- | --- |
| [Magic UI](https://magicui.design) | Consider small feedback and transition ideas only when they clarify an interaction and remain lightweight. |
| [Aceternity UI](https://ui.aceternity.com) | Consider individual React UI treatments after checking accessibility, performance, and dependency cost. Avoid page-scale effects in the extension. |
| [Dribbble](https://dribbble.com) | Explore color, typography, and small-control concepts; validate attractive concepts against real use and readability. |
| [Behance](https://www.behance.net) | Explore visual identity and presentation ideas while keeping OHMI's approved pixel-art identity intact. |
| [Awwwards](https://www.awwwards.com) | Look for restrained craft in typography and motion. Full-screen, cinematic patterns are a poor fit for the floating assistant. |
| [Land-book](https://land-book.com) | Reference page composition only if OHMI later needs a website; it is low priority for Phase 1. |

## How to apply them

- First inspect the installed [design-reference-library skill](C:/Users/LEGION/.codex/skills/design-reference-library/SKILL.md). Its existing 18-site collection offers more references; choose only a few relevant examples for the current task.
- Preserve OHMI's approved pixel-art proportions, colors, accessories, and branding. Use the front PNG for the floating mascot and the six-view sheet for future animation planning.
- Favor a clear hierarchy, keyboard access, readable contrast, responsive placement, and reduced-motion support. Keep animation smooth and light; never obscure essential Tinkercad controls.
- Adapt principles to OHMI's own content and brand. Do not copy third-party layouts, artwork, code, or assets directly. Check licenses and compatibility before any later reuse.
- When implementation begins, inspect rendered examples and test the actual extension at its intended sizes. Saved links do not establish access to paid content or install component libraries.
