# Website verification — 16 October 2026

Owner-approved scope: a new OHMI website, Concept C (“Bold type and horizon”). No extension or backend changes were made.

## Verified

- `node tests/website.mjs`: passed after the correction batch. Viewports: 1505×1045, 1366×768, 768×1024, 390×844 and 320×700. No horizontal overflow; primary hero action visible; approved mascot visible and loaded.
- Keyboard-operable tabs, arrow/Home/End switching, native FAQ Enter behavior, skip link and main focus, valid section anchors, preview URL persistence across refresh, default no-JavaScript content, reduced motion and primary-button text contrast passed.
- Browser requests remain same-origin; no third-party runtime request, AI request, browser error or HTTP error was observed.
- Original and published mascot SHA-256 match: `815AD3DFF06433ED9081EF1A73FAC2F97D7943D760E95A9AC11660D11AD39382`.
- `npm test`: all 77 existing unit tests across 11 files passed. `npm run typecheck`, website JavaScript syntax and authored-source Git whitespace checks passed. The three verbatim upstream OFL license files retain one trailing space each; these vendor-only warnings do not affect the site or license terms.
- Fresh Vercel Web Interface Guidelines were reviewed against the HTML/CSS/JS: semantic actions, heading order, image dimensions/alt, focus, reduced motion, URL state, responsive layout and text contrast applied. No new dependency was installed.
- Impeccable detector ran once. Tiny metadata was raised to at least 12px; the FAQ border-padding warning was adjudicated a false positive because summaries already have 22px vertical padding.
- Independent finish reviewer inspected the approved concept, all four captures, source and paired crops. Its verdict pass marked all seven interface fixes resolved: display/wordmark, hero geometry, ground/mint, horizon/ornament, schematic connections, phone legibility and footer touch targets. No visible regression was found within that fix scope.

## Diagnostic limitations

The numeric hero comparison improved from 67.55% to **80.3% (“match”)**. This is a similarity diagnostic, not a universal design-quality score or proof of pixel identity. The original mascot intentionally replaces the generated character. Fonts are obtainable licensed approximations.

The automatic Impeccable **hero gate remains open**. Spec and plate gates closed; the hero gate rejects wordmark/helper crop readings and the educational inline SVG despite the craft floor's allowance for countable geometric diagrams. The independent reviewer found no remaining user-visible defect among the seven fixes but retained disposition **fix** for the workflow-state item. No automatic pass or blanket reviewer approval is claimed. Diagnostics are preserved locally under ignored `.impeccable/`; this record persists their result and adjudication.

The original mascot carries external origin provenance because embedding metadata would change its approved bytes. The generated shipping horizon carries its exact prompt in PNG metadata and in `design/horizon-final.json`.

## Not checked

Physical touch devices, screen-reader sessions, Safari/Firefox and long-duration usage were not tested. No live AI/provider, hosted account, private-assignment or actual Tinkercad flow was exercised; the extension was outside this website scope. The website does not electrically verify a circuit.

## Deployment

Owner-private Sites deployment succeeded at `https://ohmi-circuit-buddy.purple-reed-2208.chatgpt.site`. Source archive was built from verified pushed Site source commit `1473ff9377ce3f02c51fa51cd95463b80841182f`. Windows packaging required `TAR_OPTIONS=--force-local` with Git Bash so the drive-letter path was treated as a local archive; no bundled tool or UI source was changed for this repair.
