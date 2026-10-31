# Real-Time Circuit Builder, Apple iOS UI/UX, & Core Features Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static 3-LED card in Ask OHMI into a real-time, accurate circuit generator (for any request like 6 LEDs, 4 LEDs, battery DC circuits, etc.), redesign the UI to a modern iOS/Apple frosted-glass style without AI-slop stars/sparkles, and optimize Ask OHMI, Circuit Checker, and Step-by-Step Guide for speed and intelligence.

**Architecture:**
1. A modular `circuit-generator.ts` engine in `web-app/src/lib/playground/` that extracts hardware requirements (Arduino vs. Battery, 1–8 LEDs, resistor values, switch, colors) from conversational prompts, generates matching Arduino C++ sketches, builds valid `designElectronics` (`.dez`) documents, and connects directly to the WASM playground.
2. An iOS Apple-inspired design system implementation in `playground.css` and `chat.tsx`: translucent frosted materials (`backdrop-filter: blur(20px)`), 1px hairline borders (`rgba(255,255,255,0.08)`), capsule pill badges, Xcode-style code inspectors, and zero generic star/sparkle icons.
3. Client-side performance enhancements across Ask OHMI (instant optimistic parsing), Circuit Checker (image pre-optimization to reduce upload payload by >80% and smart pre-flight heuristics), and Step-by-Step Guide (keyboard controls, component checklist, smooth transitions).

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React (clean engineering icons), WXT/Vite (root extension), WebAssembly (`designElectronics` engine).

---

## Global Constraints
- Preserve existing authentication, Supabase Row-Level Security, and billing bounds.
- Pixel-art mascot identity in `docs/OHMI_MASCOT.md` remains intact and preserved.
- Never claim an electrical circuit was physically verified without actual verification.
- Output clean, idiomatic TypeScript with strict type checking (`npm run typecheck`).
- Push completed and verified work to `https://github.com/janveryuu/OHMI.git`.

---

## Review Focus
1. **Arbitrary LED counts**: User asks for 6 LEDs or 4 LEDs; the system must generate exactly 6 or 4 LEDs, 6 or 4 series resistors, pins D8–D13 or D8–D11, and matching code.
2. **Battery DC circuits**: User asks for battery circuits; the system must switch from Arduino Uno to DC supply (e.g., 9V battery), connect series resistors, LEDs, and optional switch.
3. **Engine Document Validity**: Any generated `.dez` document must pass `validateElectronicsDocument` without throwing.
4. **Zero Stars/Sparkles**: Audit for `<Sparkles>` or star symbols and replace with semantic, professional icons.
5. **No Broken Mobile/Desktop Layouts**: All new iOS cards must maintain responsiveness, fit cleanly inside chat bubbles, and avoid horizontal overflow.

---

### Task 1: Real-Time Dynamic Circuit Generator & Playground Integration
**Files:**
- Create: `web-app/src/lib/playground/circuit-generator.ts`
- Modify: `web-app/src/components/chat.tsx`
- Modify: `web-app/src/components/electronics-workspace.tsx`
- Test: `web-app/tests/circuit-generator.test.mjs`

- [ ] Step 1.1: Create `circuit-generator.ts` with natural language parsing for component counts (1–8 LEDs, power source, switch, colors), dynamic Arduino C++ code generation, and valid `.dez` document synthesis.
- [ ] Step 1.2: Add unit tests in `web-app/tests/circuit-generator.test.mjs` testing 6 LEDs, 4 LEDs, 3-LED traffic light, and 9V battery circuit.
- [ ] Step 1.3: Update `chat.tsx` to use `parseCircuitIntent` and `generateCircuit`, dynamically populating the action card and setting `ohmi_active_circuit_doc` in `sessionStorage` on "Build in Playground" click.
- [ ] Step 1.4: Update `electronics-workspace.tsx` to check `sessionStorage.getItem("ohmi_active_circuit_doc")` and load it into the engine with zoom fit and running simulation.
- [ ] Step 1.5: Run `npm run test` in `web-app` to verify all generator and model tests pass.

---

### Task 2: Modern iOS Apple-Style UI/UX Redesign & Anti-AI Slop (Purge Stars/Sparkles)
**Files:**
- Modify: `web-app/src/app/playground.css`
- Modify: `web-app/src/components/chat.tsx`
- Modify: `web-app/src/components/saved-guides.tsx`
- Modify: `web-app/src/components/guide.tsx`

- [ ] Step 2.1: Purge all `<Sparkles>` and star symbols from `chat.tsx`, `saved-guides.tsx`, and `guide.tsx`. Replace with semantic engineering icons (`CircuitBoard`, `Cpu`, `BookOpen`).
- [ ] Step 2.2: Redesign `.circuit-action-card` in `playground.css` to iOS Liquid Glass style:
  - Frosted glass translucent background (`rgba(28, 28, 30, 0.72)`, `backdrop-filter: blur(20px)`).
  - 1px hairline border (`rgba(255, 255, 255, 0.09)`), smooth 18px corners.
  - Apple SF-style status pill (`rgba(48, 209, 88, 0.15)` bg, `#30d158` text, subtle border).
  - Apple metadata tags for components (`Arduino Uno`, `6× LEDs`, etc.).
  - Capsule buttons with active press scaling (`transform: scale(0.98)`).
- [ ] Step 2.3: Redesign the Xcode / macOS code inspector panel with dark canvas, traffic-light window indicators, clean copy action, and structured pinout wiring checklist.

---

### Task 3: Performance & Intelligence Optimizations (Ask OHMI, Circuit Checker, Step-by-Step Guide)
**Files:**
- Modify: `web-app/src/components/chat.tsx`
- Modify: `web-app/src/components/circuit-checker.tsx`
- Modify: `web-app/src/components/guide.tsx`

- [ ] Step 3.1: Optimize Ask OHMI:
  - Instant circuit intent evaluation without lag.
  - Add smart electronics calculations: Ohm's law formulas and pin safety limits displayed directly in the circuit card.
- [ ] Step 3.2: Optimize Circuit Checker:
  - Fast client-side image compression (max 1280px WebP/JPEG) reducing upload payload from 3MB to ~150KB (5x faster upload & processing).
  - Add instant smart pre-flight heuristics to catch common student errors (missing series resistor, reverse LED polarity).
  - Apple-style progress indicator with smooth stage badges.
- [ ] Step 3.3: Optimize Step-by-Step Guide:
  - Add keyboard shortcuts (ArrowLeft/ArrowRight for steps, Space/Enter to check step).
  - Add interactive component checklist.
  - Add instant "Open in Playground" shortcut button for direct hands-on testing.

---

### Task 4: Complete Test Suite Execution, Verification, and GitHub Push
**Files:**
- Repository source, tests, documentation

- [ ] Step 4.1: Run `cd web-app; npm run test` and `npm run typecheck`.
- [ ] Step 4.2: Run root `npm test -- --run` to ensure all 25 test suites pass.
- [ ] Step 4.3: Git commit with comprehensive message and push to `https://github.com/janveryuu/OHMI.git`.
