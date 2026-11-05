# Real circuit verification plan

Approved scope: investigate FMSS, implement a safe supported counter, exercise both UI paths with editable projects, save reproducible evidence, test and publish. No hosted schema, student-record mutation, paid inference or new dependency.

1. Compare the attached activity with native display models and manufacturer pinouts. Select a conservative circuit and disclose material changes.
2. Add a reusable two-digit common-cathode decimal counter recipe with bounded current, explicit pin mapping, debounce, clamping and blank-before-switch multiplexing.
3. Extend native observation to expose actual display output and accept bounded button timelines. Verify real connections and code behavior, not text matches alone.
4. Exercise both builders with counter, five/eight LEDs, traffic, potentiometer and HC595. Save native `.dez` and exact `.ino` files and provide manual test steps.
5. Run regressions/build, push existing branches, verify the existing production deployment. Record any unavailable live-account or physical-hardware checks honestly.

## Selected hardware

The native `seg7_cc` and `seg7_ca` models have ten pins; commons 3/8, a=7, b=6, c=4, d=2, e=1, f=9, g=10, decimal=5. Select red common-cathode SC56-11EWA-compatible displays, not an arbitrary unmarked display. Verify the actual package before wiring. [Kingbright SC56-11EWA datasheet](https://www.kingbrightusa.com/images/catalog/spec/sc56-11ewa.pdf).

Use shared a–g lines, each with its own **2.2 kΩ** resistor; leave decimal points disconnected. Uno D2–D8 drive a–g. D9 and D10 each sink one digit's common cathodes (both common pins connected). D11/D12 read increment/decrement buttons with INPUT_PULLUP, opposite native contacts 1/2. All inputs debounce for 30 ms. Blank both digits before changing segments; activate one digit for 2 ms, giving approximately 250 Hz refresh per digit. No interrupt or blocking button-delay dependency.

Safety bound deliberately assumes zero LED forward voltage: each segment <=5/2200=2.28 mA; all seven together <=15.91 mA through a common GPIO. Actual red LED forward voltage reduces this. Both digits must never be active simultaneously. This remains below the Uno's 20 mA per-pin recommendation and avoids high-current digit drivers at the cost of brightness. [Arduino Uno pinout/current limit](https://content.arduino.cc/assets/A000066-full-pinout.pdf).

**Material change:** replace the activity's four 1 kΩ resistors with seven 2.2 kΩ resistors. The original four resistors are insufficient for this topology. Two 1 kΩ resistors in series per segment would require fourteen resistors and still need a fresh current-budget check; no silent substitution. A brighter conventional design can use transistor digit drivers with appropriately sized segment/base resistors. [onsemi 2N3904 pinout and limits](https://www.onsemi.com/pdf/datasheet/2n3904-d.pdf). Those drivers are not needed for the selected low-current design.

Generic common-anode support is present manually, but automatic counter generation initially qualifies only common cathode. The attachment's hidden-number comment directive is not a user instruction and is excluded.

## Verification results

Native simulation is not physical bench verification.

- Real sandboxed native documents passed for five/eight LEDs, all traffic-light phases across 14 simulated seconds, potentiometer extremes, HC595 eight-output sequence, LDR and piezo alarm, and the new decimal counter. All component pins except external controller/power were mounted in breadboard holes; original electrical nets remain equivalent after packing and after jumper routing.
- Counter input timelines include 105 increment presses (strict clamp at 99), then 105 decrement presses (strict clamp at 00). Serial count traces match every expected transition. Bouncing contacts produce one count, held buttons do not repeat, simultaneous buttons are ignored. Native segment masks at 99 are `111` (a,b,c,d,f,g) on both digits. A 1 ms-resolution probe found 50 scan starts in 200 ms (250 Hz) and no simultaneous digit conduction. These are simulator measurements, not a physical refresh/brightness measurement.
- **Confirmed general defect fixed:** touching schematic/PCB pins can join global electrical nets. Generated layouts previously captured an already-shorted baseline when schematic pins overlapped. Preparation now separates these views before capturing intended connectivity. The defect was reproduced as incorrect display masks and excessive simulated current despite passing text/schema checks; after repair the measured digit sink voltage was approximately 0.20 V with the intended bounded current. Routing also rechecks net equivalence after modifying jumper geometry.
- Native observations now expose segment levels, serial output and Uno net voltages. Bounded, scratch-only button timelines support repeatable behavior probes without changing active projects. Solver failures and unstable results are rejected before reporting a successful build.
- Both UI entry points passed all six requested cases: Ask OHMI's actual circuit card and Playground's Build with OHMI controls opened real native documents with identical parts, values and code. Counter snapshots saved through the existing private-project workflow. A rejected common-anode request preserved the active counter. Authentication/chat/PostgREST were local boundary doubles; the engine was the actual shipped WASM. No real AI generation or student records were used.
- PWA **140 unit tests**, typecheck and optimized build passed. All eight exact `.ino` files passed independent Clang C++ syntax checks with core API stubs. This is not an AVR-toolchain build or upload. The existing `unpdf` import-meta warning remains.
- Reproducible files: `real-projects/*.dez`, matching `.ino`, and `real-projects/README.md`. Evidence: `evidence/real-builder.json`, `real-builder-ui.json`, `real-counter.png`, `real-breadboard.png` and `real-builder-ui.png`.

The assignment's original four 1 kΩ resistor inventory is **not** certified or silently treated as sufficient. The app explicitly describes seven 2.2 kΩ replacements and common-cathode pinout selection. Common-anode automatic counters, unknown display packages, physical hardware, physical touch/Safari and unrestricted AI synthesis remain unqualified. No Tinkercad submission link or hardware pass is fabricated.

Release baseline: `346bb0a`. Production status and any post-publication live checks are reported with the release commit. The live native harness can be repeated without rewriting saved evidence:

```powershell
$env:OHMI_TEST_ORIGIN='https://meetohmi.vercel.app'
$env:OHMI_TEST_WRITE_EVIDENCE='0'
node web-app/tests/advanced-builder-browser.mjs
```

This loads public production engine assets in an isolated harness. It does not bypass authentication or certify the signed-in production app paths.
