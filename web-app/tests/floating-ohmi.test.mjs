import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateFile } from "../src/lib/demo.mjs";

test("Floating OHMI 2.0: Component and CSS File Integrity", () => {
  const compPath = path.resolve(process.cwd(), "src/components/floating-ohmi.tsx");
  const companionPath = path.resolve(process.cwd(), "src/components/companion.tsx");
  const cssPath = path.resolve(process.cwd(), "src/app/floating-ohmi.css");

  assert.ok(fs.existsSync(compPath), "floating-ohmi.tsx must exist");
  assert.ok(fs.existsSync(companionPath), "companion.tsx must exist");
  assert.ok(fs.existsSync(cssPath), "floating-ohmi.css must exist");

  const compContent = fs.readFileSync(compPath, "utf-8");
  const companionContent = fs.readFileSync(companionPath, "utf-8");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  // Verify Floating OHMI component exports
  assert.ok(compContent.includes("export function FloatingOhmi"), "FloatingOhmi component must be exported");

  // Verify Header elements
  assert.ok(compContent.includes("Your circuit buddy"), "Header must include 'Your circuit buddy'");
  assert.ok(!compContent.includes("floating-ohmi-status-dot"), "Header must not include a decorative status dot");
  assert.ok(!compContent.includes("Sparkles"), "Floating OHMI must not use decorative sparkle icons");
  assert.ok(compContent.includes("floating-ohmi-avatar-squircle"), "Header must include squircle mascot avatar");

  // Verify Welcome card matching reference image
  assert.ok(compContent.includes("Working on a circuit?"), "Must include 'Working on a circuit?' card title");
  assert.ok(
    compContent.includes("Ask me anything, send a screenshot, or paste your Arduino code"),
    "Must include description matching reference design",
  );

  // Verify Troubleshooting quick actions (Section 3)
  assert.ok(compContent.includes("Circuit screenshot"), "Must include 'Circuit screenshot' quick action");
  assert.ok(compContent.includes("Check code"), "Must include 'Check code' quick action");
  assert.ok(compContent.includes("Fix my error"), "Must include 'Fix my error' quick action");
  assert.ok(compContent.includes("Explain circuit"), "Must include 'Explain circuit' quick action");

  // Verify Workspace platform contexts
  assert.ok(compContent.includes("Tinkercad Circuits"), "Must support Tinkercad Circuits workspace context");
  assert.ok(compContent.includes("Arduino IDE"), "Must support Arduino IDE workspace context");
  assert.ok(compContent.includes("CircuitVerse"), "Must support CircuitVerse workspace context");

  // Verify Clipboard paste support
  assert.ok(compContent.includes("handlePaste"), "Must handle clipboard paste event for screenshots");
  assert.ok(compContent.includes("image/"), "Paste handler must check for image/* mime types");

  // Verify Code file upload support
  assert.ok(compContent.includes(".ino"), "Must support .ino Arduino sketch files");

  // Verify Conversation history drawer
  assert.ok(compContent.includes("floating-ohmi-drawer"), "Must include conversation history drawer");
  assert.ok(compContent.includes("newChat"), "Must support starting a new chat");

  // Verify Document Picture-in-Picture window configuration
  assert.ok(companionContent.includes("requestWindow({ width: 420, height: 640 })"), "Must request 420x640 PiP window");
  assert.ok(companionContent.includes("documentPictureInPicture"), "Must check documentPictureInPicture API");
  assert.ok(companionContent.includes("FloatingOhmi"), "companion.tsx must mount FloatingOhmi");
  assert.ok(companionContent.includes("MutationObserver"), "companion.tsx must observe style mutations");

  // Verify CSS contains iOS-style numbered step counters
  assert.ok(cssContent.includes("counter(ohmi-step)"), "CSS must format numbered steps with circled badges");
  assert.ok(cssContent.includes("floating-ohmi-window"), "CSS must contain floating-ohmi-window class");
  assert.ok(cssContent.includes("floating-ohmi-composer"), "CSS must contain floating-ohmi-composer class");
});

test("Floating OHMI 2.0: Promotional Card in App Shell", () => {
  const appShellPath = path.resolve(process.cwd(), "src/components/app-shell.tsx");
  assert.ok(fs.existsSync(appShellPath), "app-shell.tsx must exist");

  const appShellContent = fs.readFileSync(appShellPath, "utf-8");

  // Section 5 requirements
  assert.ok(
    appShellContent.includes("Your circuit buddy, always nearby."),
    "Must include suggested title 'Your circuit buddy, always nearby.'",
  );
  assert.ok(
    appShellContent.includes("Keep OHMI beside your workspace. Ask questions, check your wiring, and debug code without switching tabs."),
    "Must include suggested promotional copy",
  );
  assert.ok(
    appShellContent.includes('Companion trigger="Launch Floating OHMI"'),
    "Must render Companion trigger button",
  );
  assert.ok(
    !appShellContent.includes("companion-promo-badge") && !appShellContent.includes("Always nearby</span>"),
    "Sidebar promo must not include the decorative 'Always nearby' badge",
  );
});

test("Floating OHMI 2.0: Screenshot and Code File Validation", () => {
  // Test image validation for screenshots
  const validPng = {
    name: "circuit-screenshot.png",
    type: "image/png",
    size: 1024 * 500, // 500 KB
  };
  assert.equal(validateFile(validPng), null, "PNG screenshot should be valid");

  const validJpg = {
    name: "breadboard.jpg",
    type: "image/jpeg",
    size: 1024 * 800, // 800 KB
  };
  assert.equal(validateFile(validJpg), null, "JPG photo should be valid");

  const emptyFile = {
    name: "empty.png",
    type: "image/png",
    size: 0,
  };
  assert.notEqual(validateFile(emptyFile), null, "Empty file should be rejected");

  const oversizedFile = {
    name: "giant.png",
    type: "image/png",
    size: 12 * 1024 * 1024, // 12 MB
  };
  assert.notEqual(validateFile(oversizedFile), null, "Oversized file (>10MB) should be rejected");
});

test("Floating OHMI 2.0: Workspace Context Tags", () => {
  const contexts = [
    "Tinkercad Circuits",
    "Arduino IDE",
    "CircuitVerse",
    "General Electronics",
  ];

  for (const ctx of contexts) {
    const rawQuestion = "Why is my 7-segment display not lighting up?";
    const tagged = `[Workspace: ${ctx}]\n${rawQuestion}`;
    assert.ok(tagged.includes(ctx), `Message should include workspace context '${ctx}'`);
    assert.ok(tagged.includes(rawQuestion), "Message should preserve original student question");
  }
});
