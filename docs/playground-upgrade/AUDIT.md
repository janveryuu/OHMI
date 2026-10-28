# Playground replacement: M0 feasibility audit

Date: 29 October 2026. OHMI source: `76e14cad1678c4632a29dd0eee1ea2272503be3d`. Local review branch: `codex/playground-design-electronics`. No OHMI runtime source, student records, hosted infrastructure, provider settings or production deployment changed. No inference calls, commits or pushes were made during this audit.

## Result

Proceed with a pinned, self-hosted WebAssembly integration, subject to the M1 review gate in [PLAN.md](PLAN.md). Do not replace the current Playground yet. The upstream native release supports both requested Arduino examples. Its published browser editor renders on desktop/mobile, but the browser self-test aborts before completing. The required secure live-document browser bridge does not exist upstream.

This is a feasibility result, not a completed AI-to-Playground integration or electrical/hardware certification.

## Upstream source and licenses

- Repository: <https://github.com/rORrEtboLt/designElectronics>, cloned locally to `C:/Users/LEGION/.codex/research/designElectronics`.
- Audited source commit: `4d9cb373bd06afb2d99b1548e6c3a0c86992bd56` (21 October 2026).
- Latest native release: `v0.2.1`, source `aefd20516e8f2a05fd1c183639ca4953ef6d82f8`. It predates the audited HEAD; its passing results do not qualify newer source.
- Windows release archive: SHA-256 `c6af8da9aef3563921732da374376451f6245b4b8f2575cc44698fe899a34dd4`, verified against GitHub release metadata before execution.
- Code: MIT, copyright 2026 Nesara Hippla. Preserve the full notice and warranty disclaimer.
- Lato and Source Code Pro: SIL OFL 1.1. The shared upstream OFL file names Adobe/Source; Lato's embedded metadata additionally names tyPoland Lukasz Dziedzic and its reserved name. Include both notices in distribution.
- C++17, SDL3, SDL3_ttf, Emscripten; vendored font-rendering dependencies require their own notices. Pin actual resolved SDL, SDL_ttf and recursive dependency commits, not mutable release branches.
- `third_party/VERSIONS.txt`: minih264 `b0baea7a80ef9d12da97301dd1099b8791b5ba43`, minimp4 `2a3014a7753cfcba4442adeb469431967238fe6a`, public-domain/CC0 notices retained. Do not infer all dependency licenses from the top-level MIT label.

Upstream build recipe is `.github/workflows/pages.yml`: Emscripten **5.0.7**, CMake Release, vendored SDL3 `release-3.4.x`, SDL_ttf `release-3.2.x`, then `.js`, `.wasm`, `.data`. Observed branch heads: SDL `fc305ea8ebe117ec9bbc54f08cb2a2c75dba8ae8`, SDL_ttf `38b0f69acb2763f910aad2a5f3f8d72541c05361`. M1 must lock the complete dependency graph and prove a rebuild. CMake, C++ compiler, Ninja and Emscripten were not available on PATH during M0; no system toolchain was installed.

## Verified baseline

| Check | Actual result | Boundary |
| --- | --- | --- |
| Official Windows `--selftest` | Exit 0, 105 printed assertions pass | Native release only; includes examples, connectivity, simulation and exporters |
| Test A | Uno D13, red LED, 220 Ω; on/off/on/off at 0.25/0.75/1.25/1.75 s | Deterministic native interpreter, 500 ms HIGH + 500 ms LOW = 1 Hz |
| Test B | Uno D8/D9/D10, red/green/yellow LEDs, one 330 Ω resistor each | Red/green/yellow/red observed at 0.25/1.25/2.25/3.25 s |
| Sketches and persistence | `.ino` generated; `.dez` save/reopen retains part/wire counts and full sketch | Synthetic fixtures only, no Tinkercad or hardware test |
| Published WASM editor | Breadboard, schematic, PCB at 1440×900 and breadboard at 390×844 render without page errors | Locally served downloaded upstream artifacts, not inside OHMI |
| Published WASM `--selftest` | Aborts with `RuntimeError: Aborted(undefined)` after passing model assertions | **Not a pass**; root cause not established without a diagnostic rebuild |

Native release reports **177 catalog entries**. `list_parts` only returns the first 80 matches and explicitly requests narrower queries. Published WASM self-test reports **791 entries**. README's catalog count is not a reliable version manifest. Never ship the native release's smaller catalog or an 80-result search page as the complete newer catalog.

Downloaded browser payload: WASM 4,743,673 bytes, JS 200,499 bytes, font data 239,661 bytes, approximately 4.94 MiB before compression. Hashes are in `evidence/audit-summary.json`; source provenance of those hosted binaries was not attested. They are audit inputs, not shippable vendor artifacts. Lazy-load the final pinned engine only on the new workspace route.

Reproduction: `python docs/playground-upgrade/audit_upstream.py <official-release-exe> <output-directory>`. The script uses local MCP only and isolates its version history. Evidence includes both sketches, full `.dez` fixtures, raw self-test output, browser screenshots and explicit failure output. Upstream self-tests use their dedicated self-test preference directories; no OHMI/student projects were opened.

## Engine capabilities and limitations

The same C++ engine owns three linked views, component/pin definitions, breadboard buses, wiring, PCB routing/DRC, Arduino interpreter, and SVG/PNG/BOM/netlist/SPICE/Gerber exports. Preserve those modules and test capability retention, rather than reimplementing them in React.

The Arduino runtime is a C/C++ subset interpreter, **not** avr-gcc, a full MCU emulator or proof of a compiled sketch on hardware. Supported core GPIO, delays, timing and selected library behavior can be observed. Some library-object calls are accepted but ignored with warnings. Some catalog items have only pinouts and no simulation model. Surface those warnings with the observed results; no generic "circuit verified" badge. Browser hardware uploads and native GitHub/CLI integrations are not equivalent to the desktop app. Preserve supported browser exports and explicitly label platform-only features.

Native MCP `simulate` creates a fresh Simulator per invocation and returns a final snapshot after a requested interval; repeated invocations are not a continuous timeline. M1 needs a bounded sample/timeline entry using the same simulator for one run so blink/traffic assertions prove transitions rather than one lit frame. The audit's independent-time native samples use this documented restart behavior.

## Why this is more than an iframe

- UI is SDL immediate-mode drawing in a canvas. React/CSS cannot restyle its internal menus, catalog or inspector. An OHMI shell plus a small native Theme/presentation patch is practical; an HTML rewrite of the full editor is not approved.
- `src/net.h` disables desktop networking under `__EMSCRIPTEN__`. No localhost MCP server or agent CLI can be assumed in a PWA.
- Emscripten exports only `_main` and `_de_web_opened`; runtime helpers are `FS`, `ccall`, `callMain`. Loading a `.dez` is possible; safe live editing, full snapshots, observations and theme integration need a small exported bridge.
- `McpSession(Document*)` already works against the live document. Its before/after/replaced hooks provide undo, selection and redraw integration. Reuse this class behind an allowlist, with fixed virtual paths for imports/exports; do not expose stdio, shell commands, arbitrary filesystem paths or native networking.
- Browser autosave writes a virtual filesystem file. No persistent IDBFS mount is configured in the inspected loader/CMake. It is not an account-safe replacement for Supabase saves, and must not restore a previous student's draft on a shared device.
- The upstream loader accepts arbitrary `#src=` URLs and puts designs into share-link fragments. OHMI must use a controlled loader with no arbitrary network imports and no automatic private designs in URLs.

## Existing OHMI compatibility

Current `web-app/src/lib/playground/model.ts` is a separate version-1 model with four kinds, string IDs and two-terminal wires. Current API and SQL impose 64 KiB and reject `.dez` shape. Audit Test A/B files are 40,189/44,301 bytes, but upstream breadboard examples are about 150–180 KB. They cannot be universally saved through the existing API.

Keep the old route/component, API, records, RLS and progress metadata intact. Add separate private electronics-project storage after M2 review. Convert legacy projects into **new copies**, recording their source ID/revision and original metadata; never rewrite existing rows. Confirm numeric ranges and source model semantics before conversion.

Verified pin mapping, also saved in `evidence/legacy-part-map.json`:

| Legacy kind/pins | Upstream mapping | Caveat |
| --- | --- | --- |
| battery `p`, `n` | `battery` `plus`, `minus`; `value` to voltage | Preserve exact voltage; engine model characteristics can differ |
| resistor `a`, `b` | `resistor` `pin0`, `pin1`; value to resistance | Preserve rating/value; don't round to a catalog dropdown option |
| LED `a`, `k` | `led` `anode`, `cathode`; red | Legacy forward-drop assumption is not a hardware datasheet guarantee |
| switch `a`, `b` | SPDT `common`, `a`; left=closed, right=open | Extra `b` throw stays unused; don't connect old terminals across the two throws |

Mission, hints and completion state stay in legacy metadata. Validate topology and values, plus observable behavior where equivalent; do not promise identical numeric results from two different solvers. Failed conversion leaves the source untouched and offers legacy open/export.

## Actual deployed provider configuration

Read-only Supabase inspection: `ohmi-ai` **v29 ACTIVE**, `ohmi-web` **v19 ACTIVE**. Downloaded their deployed source into the external audit checkout. No secret values were read or written.

- Groq configured primary: `openai/gpt-oss-120b`. Existing chat candidates also include `openai/gpt-oss-20b` and Gemini `gemini-2.5-flash`. This is source/config verification, not proof of which fallback will answer a particular future request.
- Gemini media configured primary: **`gemini-3.5-flash-lite`**, with 3.6/3.8 Flash candidates. A source comment still says 3.8; the executable constant is authoritative.
- Both API-key names and free-tier-confirmation names are present; provider/model override secret names are absent. Confirmation values and actual provider billing plans were not inspected. Existence of a key/flag is **not** proof of zero billing.
- Groq lists 120B on its free plan (30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD at audit time). Gemini lists 3.5 Flash-Lite input/output as free-tier eligible. Account-specific eligibility, billing switches and current organization limits remain a live-call gate. Free Gemini content-use terms also require student-data minimization and an explicit visual-analysis action.

New circuit planning should call only the requested 120B model through a separate server-owned operation. Do not silently inherit plain-chat fallback behavior or change existing Ask routing. Gemini is optional visual analysis, not a planning fallback. No live inference was used for this audit, so cost is ₱0.

## Sources

- Upstream [README](https://github.com/rORrEtboLt/designElectronics/blob/4d9cb373bd06afb2d99b1548e6c3a0c86992bd56/README.md), [MIT license](https://github.com/rORrEtboLt/designElectronics/blob/4d9cb373bd06afb2d99b1548e6c3a0c86992bd56/LICENSE), [MCP contract](https://github.com/rORrEtboLt/designElectronics/blob/4d9cb373bd06afb2d99b1548e6c3a0c86992bd56/docs/MCP.md), [file format](https://github.com/rORrEtboLt/designElectronics/blob/4d9cb373bd06afb2d99b1548e6c3a0c86992bd56/docs/FILE_FORMAT.md), [web build](https://github.com/rORrEtboLt/designElectronics/blob/4d9cb373bd06afb2d99b1548e6c3a0c86992bd56/.github/workflows/pages.yml).
- [Groq models](https://console.groq.com/docs/models), [free-plan limits](https://console.groq.com/docs/rate-limits).
- [Gemini models](https://ai.google.dev/gemini-api/docs/models), [pricing/free eligibility](https://ai.google.dev/gemini-api/docs/pricing).

All external sources and deployed metadata were inspected on 29 October 2026. Local source hashes and results remain the detailed evidence.
