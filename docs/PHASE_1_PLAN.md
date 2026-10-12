# Phase 1 implementation plan

**Goal:** Build a Chrome Manifest V3 extension that shows the approved OHMI pixel-art mascot only in the Tinkercad Circuits editor and opens a compact, accessible preview panel.

**Architecture:** One WXT content script runs on `www.tinkercad.com`, checks the public `/things/<design>/editel` route, and reacts to client-side URL changes. React renders inside WXT's Shadow DOM UI; Chrome local extension storage keeps mascot position and panel state. No background worker, backend, AI, or page scraping.

**Stack:** WXT, React, TypeScript, Tailwind CSS, Chrome Manifest V3. Use the approved front PNG directly; the turnaround sheet remains a visual reference.

## Work

- [x] Set up the smallest WXT project, scoped content script, canonical mascot asset copied to the build, and isolated styles.
- [x] Add editor-route detection, viewport-safe dragging, persisted position and panel state, keyboard behavior, and restrained motion.
- [x] Build the branded welcome panel with clearly labeled future features and responsive layout.
- [x] Add focused tests for route and positioning rules. Build, type-check, test, inspect the rendered UI, and document Chrome loading and manual Tinkercad checks.

See [verification results](PHASE_1_VERIFICATION.md) and [Chrome loading instructions](../README.md). Live signed-in Tinkercad acceptance remains pending.

## Verification limits

Public URLs show the circuit editor route, but a real editing session may require the owner's login. If so, verify the extension on an isolated simulated editor URL and give manual steps for the logged-in editor. Do not call the real editor verified without seeing it.

## Sources checked

- [WXT content scripts and Shadow DOM UI](https://wxt.dev/guide/essentials/content-scripts)
- [WXT asset loading in content scripts](https://wxt.dev/guide/essentials/assets)
- [WXT installation](https://wxt.dev/guide/installation.html)
- [Tinkercad Circuits guide](https://images.tinkercad.com/jl5ii4oqrdmc/4sMFqe3rDlbUymJt0I4yh/85a4487f7fe274e74c19870ae4679fc1/tinkercad-guides_circuits-Printable.pdf)
