# Advanced circuit builder improvement

## Scope and plan

The owner approved implementation, tests, GitHub push and production Vercel release together. Start from production `4bf93c7`, preserving its newer profile/chat work. No paid inference, schema change or student-data mutation is needed.

1. Read the CpE 413 activity and inspect both circuit entry points and existing generators.
2. Reject unsupported components, conflicting materials and quantities instead of silently choosing an LED template. Share generation, native breadboard preparation and verification across Ask OHMI and Playground.
3. Add a real breadboard with connected power rails. Use native pin geometry for placement, preserve electrical nets, and arrange color-coded jumpers.
4. Stage and simulate the actual document before replacing the active circuit. Fail on compiler/runtime warnings or damage. Exercise progressively harder circuits with the shipped WASM and input changes.
5. Run regressions, typecheck and production build; push verified source and verify the existing production deployment. Keep the preceding production commit as rollback.

## Assignment analysis

The document specifies Uno R3, breadboard, two unspecified seven-segment displays, two tactile buttons, four 1 kΩ resistors and jumpers. Hardware/wiring contributes 20 points; software/logic contributes 30. Required behavior: 00–99 decimal counting, increment/decrement by one, clamping, debounce and flicker-free display refresh. Submission additionally requires a valid Tinkercad link, the correct filename and PDF with a circuit image and two-column code.

The display polarity and exact part/pinout are unspecified. Conventional shared-segment digit multiplexing needs seven independently current-limited segment lines (eight with decimal points), plus suitable common-digit drive/current limits. Four resistors do not meet that topology's requirements. Common-pin resistors alone give pattern-dependent segment current. Digit drivers and their resistor requirements depend on selected parts and peak current. Do not invent a safe completed circuit from this bill of materials. Ask for display part numbers/polarity and permission to correct the materials. Alternate scan topologies require separate qualification.

The document also embeds an unrelated instruction to hide a number in every code comment. It is attachment content, not an instruction to this agent; it is excluded from generated code.

Sources: [Uno R3 current limit/pinout](https://content.arduino.cc/assets/A000066-full-pinout.pdf), [SN74HC595 datasheet](https://www.ti.com/lit/ds/symlink/sn74hc595.pdf), [example common-cathode display datasheet](https://www.kingbrightusa.com/images/catalog/spec/sc56-11ewa.pdf). Verify the student's actual display, not this example's pinout.

## Verification and release

Results are recorded below after execution. A finite simulation is evidence for its tested states, not proof of arbitrary requirements or real hardware safety.

### Implemented

- Both Ask OHMI handoff and Build with OHMI use the existing shared generator plus `prepareCircuit`. The native preparation operation packs actual component pins into a full breadboard, powers both rail pairs, checks every original pin pair for net equivalence, and draws color-coded orthogonal jumpers. It stages the circuit without replacing active work.
- Actual native four-second observations must contain 80 samples with no reported sketch errors, warnings or damage before opening. Modifications use the same check while preserving existing geometry. A larger checked WASM stack fixes the observed large-document round-trip failure; document replacement invalidates cached connectivity/simulation revisions.
- Corrected tactile contact buses (1/3 and 2/4), generated opposite-contact wiring, 30 ms stable-input debounce, LDR threshold direction, and conservative 1 kΩ HC595 output resistance. HC595 supplies/control pins and per-output/aggregate current limits are checked instead of assumed. Non-LED resistors must belong to a recognized LDR divider.
- Unsupported displays/controllers/combinations, conflicting quantities and unmatched explicit Arduino pin mappings are rejected. Explicit supported series-resistor values are preserved and revalidated. Missing/failed custom transfers cannot load an unrelated traffic-light fallback. Handoffs are account scoped.
- The existing local API path now identifies itself as `local / ohmi-recipes-v2`, rather than falsely reporting Groq provenance. It uses the same generator, bounded short-lived account-bound recovery cache, replay conflict checks, and a browser-session transfer fallback. It does not silently call a provider or write synthetic completions into the privileged AI ledger. Existing chat/provider routing is unchanged. Durable persistence remains the existing private snapshot workflow.

### Results

- PWA: **139/139 unit tests**, typecheck and optimized production build passed. Existing `unpdf` import-meta build warning remains.
- Native shipped WASM: **117 assertions passed**; blink/traffic timing, native edits/undo/redo, invalid sketch recovery, three views, five export types and opaque sandbox isolation passed.
- Progressive actual-native benchmarks passed: eight-LED sequencer (every LED lights), potentiometer at 0/100% (brightness changes), LDR at 0/100% (on in darkness), button released/pressed (LED and piezo activity change after startup settling), HC595 running lights (every LED lights). Each prepared circuit contains a real breadboard and every non-controller component has its pins mounted. No sampled errors/warnings/damage.
- Browser UI: Ask OHMI's circuit card handoff, Build with OHMI, FMSS rejection without changing the active document, private snapshot saving, local API provenance/replay/CSRF/account protection passed. No real provider requests were sent.
- Existing desktop/tablet/mobile controls/theme sync, downloads, account runtime teardown and leave/Back cancel/confirm regressions passed. The old browser test's frame lookup was updated for the existing `srcDoc` frame.
- Evidence: `evidence/advanced-builder.json`, `advanced-builder-ui.json`, `advanced-regression.json`, `advanced-breadboard.png`, `advanced-builder-ui.png`.

### Remaining limits

This release improves bounded free local recipes, not unrestricted generative synthesis. Unsupported combinations and custom pin mappings require manual work or further qualification. The FMSS counter is **not built or simulated**: resolve display polarity/pinout, resistor inventory and digit-driver current requirements first. There is no fabricated pass, counter-specific hardcoded circuit, hidden comment marker or Tinkercad submission link.

The native Arduino subset interpreter was exercised; a separate AVR compiler/upload, physical hardware, Safari and physical touch devices were not tested. Four seconds of observations do not prove debounce under every bounce waveform, all future states, arbitrary timing, fabrication readiness or real hardware safety. Live AI quality was not tested; no paid API, new dependency or hosted schema change was introduced. API recovery cache is transient; save a private snapshot or download the opened draft for durable storage.

Rollback baseline: production `4bf93c7`. Release metadata follows after GitHub/Vercel verification.
