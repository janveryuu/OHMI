# Fix Automatic Circuit Building & Enable 10-LED and Battery Circuits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "Automatic building is not enabled on this server" error, enable automatic circuit generation in both the "Build a circuit with OHMI" section and conversational chat, expand the circuit builder to support an Arduino Uno powered by a battery and circuits with up to 10 LEDs, and preserve the iOS/Apple UI design.

**Architecture:**
1. Default `OHMI_CIRCUIT_BUILD_ENABLED` to true on the server route `/app/api/playground/build/route.ts` and update local environment templates so the building section is enabled and functional.
2. In `circuit-generator.ts`, expand natural language intent parsing and synthesis to handle:
   - "working arduino that has battery and it's working" (Arduino Uno + 9V battery connected to VIN/GND, running sketch, valid `.dez` document and `CircuitSpec`).
   - "arduino that has 10 leds" (Arduino Uno with 10 digital pins D2–D11, 10 dedicated series resistors, 10 LEDs, running 10-LED chaser sketch, valid `.dez` document and `CircuitSpec`).
3. In `circuit-spec.ts`, adjust electrical specification validation to safely accept:
   - Arduino Uno + Battery dual-source power configuration (battery powering Uno via VIN and GND pins).
   - 0 external LEDs for an Arduino + battery circuit (using Uno internal sketch / LED) and up to 10 LEDs (each with dedicated series resistors).
4. In `/app/api/playground/build/route.ts`, implement generator synthesis with in-memory / database caching so requests from `circuit-build.tsx` return valid `CircuitBuildResult` objects immediately, and `GET /app/api/playground/build/?id=...` serves them to `/playground/`.
5. In `chat.tsx`, link `parseCircuitIntent` to all conversational circuit generation queries so requests in chat display the iOS-styled `CircuitActionCard` with "Build in Playground" and code inspection.
6. Preserve the exact iOS / Apple visual design (frosted materials, dark mode, hairline borders, clean pill tags) without UI changes.

**Tech Stack:** Next.js 15, React 19, TypeScript, `designElectronics` WASM Engine, WebAssembly, Tailwind CSS.

**Spec:** User request to fix "Automatic building is not enabled on this server", support "arduino that has battery and it's working", support "arduino that has 10 leds", and preserve iOS UI styling.

## Global Constraints
- Preserve existing authentication, Supabase Row-Level Security, and billing protections.
- Maintain documentation integrity and mascot PNG identity (`docs/OHMI_MASCOT.md`).
- Do not alter the visual theme: retain iOS/Apple styling with zero UI breakage.
- Never claim an electrical circuit was physically verified without actual verification.
- Output clean, idiomatic TypeScript with strict type checking (`npm run typecheck`).
- Push completed and verified work to `https://github.com/janveryuu/OHMI.git` upon completion.

## Review Focus
1. **10 LEDs with Arduino**: User requests 10 LEDs; system allocates pins D2–D11, 10 resistors (220 Ω), 10 LEDs, and 10-LED C++ code without exceeding engine bounds.
2. **Arduino + Battery**: User requests Arduino with battery; system connects battery plus to VIN and minus to GND without throwing "direct short" or "multiple sources" error.
3. **Builder Section Status**: "Build a circuit with OHMI" disclosure does not display "Automatic building is not enabled on this server", and the "Build new draft" button is active when text is entered.
4. **Valid WASM Document & Spec**: All synthesized circuits pass `validateElectronicsDocument` and `validateCircuitSpec` without runtime exceptions.
5. **iOS UI Consistency**: No regressions in styling, layout, dark mode, or mobile containment.

---

### Task 1: Update Circuit Spec Validation for Arduino + Battery & 10 LEDs

**Files:**
- Modify: `web-app/src/lib/playground/circuit-spec.ts:270-360`
- Test: `web-app/tests/circuit-spec-extension.test.mjs`

**Interfaces:**
- Consumes: `CircuitSpec`, `electronicsPins`
- Produces: `validateCircuitSpec(raw: unknown): CircuitSpec` allowing Uno + Battery (battery powering Uno via VIN) and 0–10 LEDs.

- [ ] **Step 1: Write the failing test**
Create `web-app/tests/circuit-spec-extension.test.mjs` testing:
  - Validation of Arduino Uno powered by 9V battery (battery plus to VIN, minus to GND).
  - Validation of Arduino Uno with 10 LEDs connected to pins D2–D11 each with dedicated 220 Ω resistor.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test web-app/tests/circuit-spec-extension.test.mjs`
Expected: FAIL due to source count (`sources.length !== 1`) and LED count limits (`leds.length > 8`).

- [ ] **Step 3: Implement relaxed source & LED bounds in `circuit-spec.ts`**
  - Update `validateElectricalSpec` in `web-app/src/lib/playground/circuit-spec.ts`:
    - Allow either 1 power source (battery or uno) OR 2 sources specifically when one is `arduino_uno` and the other is `battery` connected to `VIN` and `GND`.
    - Allow 0 LEDs if Uno has battery (internal circuit), and allow up to 10 LEDs (previously capped at 8).
    - In potential calculation: when battery connects to Uno VIN, add VIN as battery voltage node and ensure GND is common 0V reference.
    - Expand GPIO loop from D0..D13 to cover all digital pins.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test web-app/tests/circuit-spec-extension.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run existing circuit build tests**
Run: `node --test web-app/tests/circuit-build.test.mjs`
Expected: PASS (all existing regressions pass).

---

### Task 2: Enhance Circuit Generator for Arduino + Battery & 10 LEDs

**Files:**
- Modify: `web-app/src/lib/playground/circuit-generator.ts`
- Test: `web-app/tests/circuit-generator.test.mjs`

**Interfaces:**
- Consumes: `parseCircuitIntent`, `generateCircuit`, `generateArduinoSketch`
- Produces: `GeneratedCircuit` with valid `.dez` document and `CircuitSpec` for Arduino+Battery and 10 LEDs.

- [ ] **Step 1: Write failing tests in `circuit-generator.test.mjs`**
Add tests for:
  - `parseCircuitIntent("give me a working arduino that has battery and it's working")` -> `controller: "arduino"`, `hasBattery: true`, `ledCount: 0` (or 1 if indicator).
  - `generateCircuit` with Arduino + Battery produces parts including `arduino_uno` and `battery`, wires connecting `battery:plus` to `arduino_uno:VIN` and `battery:minus` to `arduino_uno:GND`, with valid document and spec.
  - `parseCircuitIntent("build me a arduino that has 10 leds")` -> `controller: "arduino"`, `ledCount: 10`.
  - `generateCircuit` with 10 LEDs produces 10 resistors, 10 LEDs, pins D2–D11, valid document and spec.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test web-app/tests/circuit-generator.test.mjs`
Expected: FAIL (10 LEDs capped at 8, battery omitted on Arduino controller).

- [ ] **Step 3: Implement Arduino+Battery and 10-LED synthesis in `circuit-generator.ts`**
  - In `parseCircuitIntent`:
    - Match numbers up to 10 (`/\b([1-9]|10)\b/i`, word numbers "ten" / "10").
    - If Arduino + battery mentioned without explicit LED mention, set `ledCount: 0`.
    - If explicit LED count, clamp to max 10.
  - In `generateArduinoSketch`:
    - When `ledCount === 10`, generate pins D2 through D11 with smooth 10-LED sequencer loop.
    - When `ledCount === 0`, generate working Arduino sketch (built-in LED blink on pin 13 with status comments).
  - In `generateCircuit`:
    - For 10 LEDs: use `startPin = 2` (pins D2–D11), 10 resistors (R1–R10), 10 LEDs (LED1–LED10).
    - For Arduino + Battery: add both `arduino_uno` (part 1) and `battery` (part 2, 9V), wire battery `plus` -> `VIN` and `minus` -> `GND`.
    - Ensure all parts, wires, and `CircuitSpec` match and pass `validateElectronicsDocument` and `validateCircuitSpec`.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test web-app/tests/circuit-generator.test.mjs`
Expected: PASS.

---

### Task 3: Enable Server Circuit Building Route & Generation Fallback

**Files:**
- Modify: `web-app/src/app/api/playground/build/route.ts`
- Modify: `web-app/.env.example`
- Create/Modify: `web-app/.env.local`
- Test: `web-app/tests/circuit-build-route.test.mjs`

**Interfaces:**
- Consumes: `authenticatedClient`, `generateCircuit`, `parseCircuitIntent`
- Produces: `GET /app/api/playground/build/` returning `{ enabled: true }`, `POST` returning completed `CircuitBuildResult`.

- [ ] **Step 1: Write route unit tests**
Create `web-app/tests/circuit-build-route.test.mjs` to test:
  - `GET` with no `id` returns `{ enabled: true }` when build is enabled by default.
  - `POST` with prompt "build me a arduino that has 10 leds" generates valid completed `CircuitBuildResult`.
  - `GET ?id={requestId}` returns the generated result.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test web-app/tests/circuit-build-route.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Update `web-app/src/app/api/playground/build/route.ts`**
  - Set `enabled: process.env.OHMI_CIRCUIT_BUILD_ENABLED !== "false"`.
  - In `POST`: Attempt Edge Function call if configured, otherwise synthesize circuit using `generateCircuit(parseCircuitIntent(body.message))`.
  - Save result to database / in-memory cache and return completed status with validated `result`.
  - In `GET ?id=...`: Check database and fallback cache to return completed build for the request.
  - Update `web-app/.env.example` and `web-app/.env.local` with `OHMI_CIRCUIT_BUILD_ENABLED=true` and `OHMI_WEB_AI_ENABLED=true`.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --test web-app/tests/circuit-build-route.test.mjs`
Expected: PASS.

---

### Task 4: Connect Chat & CircuitBuild Component with iOS Style Preservation

**Files:**
- Modify: `web-app/src/components/chat.tsx`
- Modify: `web-app/src/components/circuit-build.tsx`
- Test: Browser verification and component render tests

**Interfaces:**
- Consumes: `CircuitBuild`, `CircuitActionCard`, `parseCircuitIntent`, `generateCircuit`
- Produces: Working "Build new draft" button, iOS card in chat on circuit queries, direct playground opening.

- [ ] **Step 1: Update `chat.tsx`**
  - Detect circuit intent on assistant messages or user prompts using `parseCircuitIntent(message.text, prevUser?.text)`.
  - When a circuit is requested (such as 10 LEDs or Arduino + battery), render `<CircuitActionCard circuit={circuit} onDirectToPlayground={...} />`.
  - On "Build in Playground" click, save `ohmi_active_circuit_doc` in `sessionStorage` and navigate to `/playground/`.
  - Preserve exact iOS styling (frosted glass, borders, typography, pill badges, buttons).

- [ ] **Step 2: Update `circuit-build.tsx`**
  - Preserve exact layout, classes, and styles.
  - Update qualification note to mention "Uno or battery, 1–10 LEDs with dedicated resistors."
  - When build completes, set `ohmi_active_circuit_doc` in `sessionStorage` so clicking "Open new editable draft" immediately loads the circuit in the playground.

- [ ] **Step 3: Run full web-app test suite**
Run: `npm test` in `web-app`
Expected: All tests pass.

- [ ] **Step 4: Run typecheck**
Run: `npm run typecheck` in `web-app`
Expected: 0 typecheck errors.

---

### Task 5: Verification & Self-Review

- [ ] **Step 1: Run complete repository test suite**
Run: `npm test` from repository root.
- [ ] **Step 2: Verify both test cases**
Verify:
1. "give me a working arduino that has battery and it's working" produces a valid circuit with Uno, 9V battery, and sketch.
2. "build me a arduino that has 10 leds" produces a valid circuit with Uno, 10 LEDs on pins D2–D11, 10 resistors, and sequencer sketch.
- [ ] **Step 3: Verify "Automatic building is not enabled" message is gone and building is operational**
- [ ] **Step 4: Verify iOS UI theme remains unchanged**
