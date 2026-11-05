# Reproducible Playground projects

These `.dez` files are produced by the shipped native engine after breadboard placement and verification. Each `.ino` is the exact sketch stored in its corresponding project. No real student project is overwritten or saved remotely by this test set.

## Reproduce generation

Run the PWA locally with the existing test configuration and execute:

```powershell
cd web-app
node tests/advanced-builder-browser.mjs
node tests/advanced-builder-ui.mjs
```

Use this synthetic local configuration in the server terminal (never substitute production service credentials):

```powershell
cd web-app
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54329'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='synthetic-test-key'
$env:NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3140'
$env:OHMI_WEB_AI_ENABLED='true'
$env:OHMI_CIRCUIT_BUILD_ENABLED='true'
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3140
```

The first command uses the actual sandboxed WASM and saves these projects. The second exercises both UI entry points with synthetic authentication/chat boundaries; it does not call a paid AI provider. See `../REAL_WORLD_VERIFICATION.md` for hardware choices and evidence limits.

## Manual browser verification

1. Open OHMI Playground and download any current unsaved circuit first. Import a project below using **Open .dez**. Confirm its source, physical breadboard pins and named jumper endpoints before running.
2. Select Breadboard, Schematic and PCB in turn. Connections must remain consistent; schematic/PCB views are editable but are not fabrication-ready layouts.
3. Run, stop, edit a resistor, undo and redo. Download `.dez` and `.ino`, reopen the downloaded project, then confirm its code and part values match. Save a separate private snapshot only if you want a durable account copy.
4. Repeat each prompt below in **Ask OHMI**, click **Build in Playground**, and inspect the resulting document. Repeat in **Build with OHMI**. Both paths must produce the same component types, values, code and connections. Stop if either path reports failure; do not infer success from a spinner or ready engine.

| Project / prompt | Expected behavior |
|---|---|
| `standard_led-5.dez`: Build Arduino with five LEDs | Five separate series resistors; every LED participates in the forward/reverse sequence. |
| `standard_led-8.dez`: Build Arduino with eight LEDs | Eight separate resistors and eight unique output pins; every LED participates. |
| `traffic_light-project.dez`: Build Arduino traffic light | Red, yellow and green phases repeat; observe a full cycle, not only the initial four seconds. |
| `potentiometer_led-project.dez`: Build potentiometer-controlled LED brightness | Change wiper from 0% to 100%; LED brightness increases. Pot endpoints go to 5V/GND, wiper to A0, LED on PWM D9. |
| `shift_register-project.dez`: Build 74HC595 eight LED running lights | All eight outputs sequence; inspect VCC, GND, reset HIGH, enable LOW and eight 1 kΩ resistors. |
| `decimal_counter-project.dez`: Build two-digit 7-segment decimal counter 00 to 99 | Starts 00. Each increment/decrement press changes one step. Holding does not repeat. Clamp at 00 and 99; simultaneous presses do nothing. Both digits remain readable while counting. |

The LDR and piezo-alarm regression projects are included as additional checks. Change LDR light percentage and press/release the alarm button; outputs must respond.

For an independent C++ syntax check, use an installed Clang compiler with the core-API declarations in `web-app/tests/arduino-api-stub.h`:

```text
clang++ -x c++ -std=c++11 -fsyntax-only -nostdinc -include web-app/tests/arduino-api-stub.h docs/playground-upgrade/real-projects/decimal_counter-project.ino
```

All eight generated sketches passed this check. API stubs do not replace compiling against an actual Arduino AVR core or uploading to a board.

## Counter inspection checklist

- Two red **common-cathode** displays, standard SC56-11EWA-compatible pinout. Pins a–g are 7,6,4,2,1,9,10. Commons are 3/8. Pin 5 decimal point remains unwired.
- D2–D8 feed the shared a–g lines through **seven separate 2.2 kΩ resistors**. Four 1 kΩ resistors from the assignment do not satisfy this design.
- D9 sinks both commons of the tens digit; D10 sinks both commons of the units digit. Both commons are disabled before updating segments.
- Button opposite contacts 1/2 connect D11/D12 to GND; internal pull-ups replace external button pull-ups. Pins 1/3 are permanently joined, as are 2/4.
- Code uses a decimal lookup table, integer tens/units, 30 ms stable-input debounce, edge events and clamping. Refresh continues during input debounce.
- Observe 09→10, 10→09, 98→99→99 and 01→00→00. Rapid short taps under 30 ms should not count; a deliberate press should count once.

Simulation evidence does not certify physical hardware, an unknown display's polarity, actual brightness or human-visible flicker. For a physical build, verify the exact package and use a current-limited supply. Never substitute 220 Ω resistors in the direct-common design.
