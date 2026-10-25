# OHMI project instructions

- Read [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) before planning or implementing OHMI work. It records the product vision, roadmap, design, and engineering constraints.
- Work on the phase the user has approved. Review each phase with the user before starting the next.
- Keep the Chrome extension independent of Tinkercad. Use documented browser capabilities and explicit user action for screenshots. Never imply Autodesk affiliation or claim a circuit was electrically verified from an image alone.
- Protect student data and AI credentials. Apply authorization and Supabase Row Level Security when those systems are introduced.
- Read [docs/OHMI_MASCOT.md](docs/OHMI_MASCOT.md) before mascot or UI work. Its approved pixel-art PNGs are the visual source of truth: use the front image for the floating mascot and the six-view sheet for future animation reference. Preserve the design; do not replace or redesign it without user approval.
- For new or substantively redesigned interfaces, read [docs/DESIGN_REFERENCES.md](docs/DESIGN_REFERENCES.md) and apply `C:/Users/LEGION/.codex/skills/design-reference-library/SKILL.md`. Follow the current brief and existing design system. For narrow functional fixes, preserve the existing visual design.
- Prefer the smallest maintainable solution for the current milestone. Test actual behavior and report meaningful technical trade-offs.
- After completing and verifying each user-approved phase, commit and push all project source, assets, tests, configuration, and documentation updates to `https://github.com/janveryuu/OHMI.git`. The owner has authorized these phase-completion pushes; preserve remote history and confirm the remote commit. Keep credentials, local environment files, dependencies, and generated build/cache output excluded. Phase-completion pushes do not authorize starting the next phase.

## Default coding workflow — Ponytail + Caveman (no slash commands needed)

Apply these lightweight defaults to OHMI tasks automatically, without requiring `/ponytail`, `$ponytail:ponytail`, `/caveman`, or `$caveman` in each prompt.

- **Ponytail — minimal, complete engineering.** Before editing, understand the task and inspect affected code, callers, and existing tests. Prefer code already in OHMI, then platform/standard features, then installed dependencies; add only what is necessary. Preserve existing contracts and UI. Finish all impacted call sites, error handling, security boundaries, and accessibility. Add focused tests for meaningful new or changed logic, especially auth, payments, privacy, parsing, and data mutations. Avoid speculative abstractions and unrelated refactors.
- **Caveman — efficient communication, not reduced accuracy.** Keep routine progress and final reports answer-first, brief, specific, and free of repetitive filler. Preserve exact code, paths, commands, configuration, errors, numerical values, units, and all negations. Use normal, sufficiently detailed language for explanations, security decisions, user-facing copy, plans, reports, or irreversible actions.
- If the corresponding trusted skill/plugin is installed and the agent supports automatic loading, follow its instructions for relevant tasks. Otherwise, use the defaults above; an unavailable skill is not a blocker. Do not pretend a skill was invoked when it was not.
- These defaults **do not authorize** installing tools, enabling hooks/proxies, changing the model or its routing, spawning subagents, performing full-repository audits, accessing external vaults, or expanding scope. Run deeper reviews and specialized commands only when task risk or the user requests them.
- OHMI project instructions, the user's current request, privacy/security requirements, and milestone approvals take precedence over terseness or reducing code size. Never sacrifice correctness to save tokens.
