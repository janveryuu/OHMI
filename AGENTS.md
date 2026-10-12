# OHMI project instructions

- Read [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) before planning or implementing OHMI work. It records the product vision, roadmap, design, and engineering constraints.
- Work on the phase the user has approved. Review each phase with the user before starting the next.
- Keep the Chrome extension independent of Tinkercad. Use documented browser capabilities and explicit user action for screenshots. Never imply Autodesk affiliation or claim a circuit was electrically verified from an image alone.
- Protect student data and AI credentials. Apply authorization and Supabase Row Level Security when those systems are introduced.
- Read [docs/OHMI_MASCOT.md](docs/OHMI_MASCOT.md) before mascot or UI work. Its approved pixel-art PNGs are the visual source of truth: use the front image for the floating mascot and the six-view sheet for future animation reference. Preserve the design; do not replace or redesign it without user approval.
- For new or substantively redesigned interfaces, read [docs/DESIGN_REFERENCES.md](docs/DESIGN_REFERENCES.md) and apply `C:/Users/LEGION/.codex/skills/design-reference-library/SKILL.md`. Follow the current brief and existing design system. For narrow functional fixes, preserve the existing visual design.
- Prefer the smallest maintainable solution for the current milestone. Test actual behavior and report meaningful technical trade-offs.
- After completing and verifying each user-approved phase, commit and push all project source, assets, tests, configuration, and documentation updates to `https://github.com/janveryuu/OHMI.git`. The owner has authorized these phase-completion pushes; preserve remote history and confirm the remote commit. Keep credentials, local environment files, dependencies, and generated build/cache output excluded. Phase-completion pushes do not authorize starting the next phase.
