import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveGuideLabel, resolveStepTitle } from "../src/lib/demo.mjs";

test("resolveGuideLabel accepts only trimmed nonempty titles and prioritizes analysis.title", () => {
  assert.equal(resolveGuideLabel(null), "Assignment Guide");
  assert.equal(resolveGuideLabel(undefined), "Assignment Guide");
  assert.equal(resolveGuideLabel({}), "Assignment Guide");

  // Whitespace-only titles bypass to next fallback
  assert.equal(resolveGuideLabel({ title: "   " }), "Assignment Guide");
  assert.equal(
    resolveGuideLabel({ title: "   ", payload: { title: "   " } }),
    "Assignment Guide",
  );

  // Payload title used when analysis.title is absent or whitespace
  assert.equal(
    resolveGuideLabel({ payload: { title: "Ultrasonic Alarm Guide" } }),
    "Ultrasonic Alarm Guide",
  );
  assert.equal(
    resolveGuideLabel({ title: "   ", payload: { title: "  Trimmed Payload Title  " } }),
    "Trimmed Payload Title",
  );

  // Analysis title preferred over payload title
  assert.equal(
    resolveGuideLabel({
      title: "  Analysis Preferred Title  ",
      payload: { title: "Payload Title" },
    }),
    "Analysis Preferred Title",
  );

  // Custom fallback respected
  assert.equal(
    resolveGuideLabel({ title: "" }, "Custom Fallback"),
    "Custom Fallback",
  );
});

test("resolveStepTitle retains explicit titles and preserves complete instructions without period-splitting or slicing", () => {
  // Explicit title used
  assert.equal(
    resolveStepTitle({ title: "  Place 330 Ω Resistor  ", instruction: "Some instruction" }, 0),
    "Place 330 Ω Resistor",
  );

  // Fallback to instruction: test decimals (e.g. 3.3V, 0.5s)
  const decimalInstruction = "Supply 3.3V to the breadboard positive rail.";
  assert.equal(
    resolveStepTitle({ instruction: decimalInstruction }, 0),
    decimalInstruction,
    "Decimal value must not be truncated at period",
  );

  // Fallback to instruction: test abbreviations (e.g., vs., i.e.)
  const abbrevInstruction = "Connect wire e.g. from Pin 9 to the LED anode.";
  assert.equal(
    resolveStepTitle({ instruction: abbrevInstruction }, 1),
    abbrevInstruction,
    "Abbreviation must not be truncated at period",
  );

  // Fallback to instruction: test newlines
  const multilineInstruction = "First wire the ground rail.\nThen attach the 5V line.";
  assert.equal(
    resolveStepTitle({ instruction: multilineInstruction }, 2),
    multilineInstruction,
    "Newlines must not truncate instruction title",
  );

  // Long instructions over 45 characters must NOT be truncated mid-word
  const longInstruction = "Place the Red LED and Green LED onto the breadboard separated rows.";
  assert.ok(longInstruction.length > 45);
  assert.equal(
    resolveStepTitle({ instruction: longInstruction }, 3),
    longInstruction,
    "Long instructions must not be truncated at 45 chars or mid-word",
  );

  // When both title and instruction are absent, returns Step N
  assert.equal(resolveStepTitle({}, 0), "Step 1");
  assert.equal(resolveStepTitle({ title: "  ", instruction: "  " }, 4), "Step 5");
  assert.equal(resolveStepTitle({ step: 10 }, 0), "Step 10");
});

test("CSS rules ensure active generator pill contrast and text wrapping without horizontal overflow", async () => {
  const css = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );

  // Active generator pill must have primary-foreground on primary background
  assert.ok(
    css.includes(".guide-pill.new-guide-pill.active"),
    "Defines active generator pill rule",
  );
  assert.ok(
    css.includes("color: var(--primary-foreground)"),
    "Active generator pill text contrast matches primary-foreground",
  );

  // Horizontal scrolling on pill container and non-collapsing pills
  assert.ok(
    css.includes(".guide-switcher-bar"),
    "Guide switcher bar container exists",
  );
  assert.ok(
    css.includes("overflow-x: auto"),
    "Guide switcher bar scrolls horizontally",
  );
  assert.ok(
    css.includes("flex-shrink: 0"),
    "Pills do not collapse under flex pressure",
  );

  // Text wrap and boundary constraints
  assert.ok(
    css.includes("overflow-wrap: break-word"),
    "Step buttons and headings wrap without clipping",
  );
});

test("Circuit checker removes awaited capability GET, guards duplicate submission, and passes fresh flag", async () => {
  const checkerSource = await readFile(
    new URL("../src/components/circuit-checker.tsx", import.meta.url),
    "utf8",
  );

  // No awaited GET /app/api/ai/ before askBackend in analyze()
  assert.ok(
    !checkerSource.includes('fetch("/app/api/ai/"'),
    "Avoids redundant capability GET preflight on critical path",
  );

  // Synchronous duplicate submit guard
  assert.ok(
    checkerSource.includes("submitting.current"),
    "Enforces synchronous submitting guard",
  );

  // Fresh flag passed to askBackend
  assert.ok(
    checkerSource.includes("{ fresh }"),
    "Passes fresh option to askBackend",
  );
});

test("Guide generator guards duplicate submission, passes fresh flag, and activates exact created tutorial", async () => {
  const generatorSource = await readFile(
    new URL("../src/components/saved-guides.tsx", import.meta.url),
    "utf8",
  );

  // Synchronous duplicate submit guard
  assert.ok(
    generatorSource.includes("submitting.current"),
    "Enforces synchronous submitting guard in GuideGenerator",
  );

  // Fresh flag passed to askBackend
  assert.ok(
    generatorSource.includes("{ fresh }"),
    "Passes fresh option to askBackend in GuideGenerator",
  );

  // Uses createdId from response directly
  assert.ok(
    generatorSource.includes("createdId && onCreated"),
    "Activates exact created tutorial ID without stale closure fallback",
  );
});
