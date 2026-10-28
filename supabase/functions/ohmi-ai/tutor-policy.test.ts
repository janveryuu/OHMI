import { describe, it, expect } from 'vitest';
import {
  OHMI_TUTOR_VERSION,
  OHMI_CHAT_VERSION,
  formatLanguageDescription,
  getCoreTutorPolicy,
  buildAskSystemInstruction,
  buildTutorialSystemInstruction,
  buildCircuitCheckSystemInstruction
} from './tutor-policy.ts';
import { buildCircuitPrompt } from './circuit.ts';
import type { CircuitRequestV2, CircuitEvidence } from '../../../src/backend/contracts.ts';

describe('OHMI Unified Versioned Tutor Policy (Milestone F2)', () => {
  it('defines the correct version constant', () => {
    expect(OHMI_TUTOR_VERSION).toBe('ohmi-tutor-v4');
  });

  describe('formatLanguageDescription', () => {
    it('formats English by default and for unrecognized strings', () => {
      expect(formatLanguageDescription('english')).toBe('clear English');
      expect(formatLanguageDescription('spanish')).toBe('clear English');
      expect(formatLanguageDescription('')).toBe('clear English');
    });

    it('formats Filipino (Tagalog)', () => {
      expect(formatLanguageDescription('filipino')).toBe('Filipino (Tagalog)');
    });

    it('formats natural Taglish with educational context', () => {
      const desc = formatLanguageDescription('taglish');
      expect(desc).toContain('Taglish');
      expect(desc).toContain('Filipino engineering students');
    });
  });

  describe('getCoreTutorPolicy invariants', () => {
    const policy = getCoreTutorPolicy('english');

    it('embeds the prompt version', () => {
      expect(policy).toContain(OHMI_TUTOR_VERSION);
    });

    it('enforces the behavioral contract', () => {
      expect(policy).toContain('patient circuit buddy: clear, observant, practical and quietly witty');
      expect(policy).toContain('Answer the actual question first');
      expect(policy).toContain('explain why when useful');
      expect(policy).toContain('suggest one concrete next check');
      expect(policy).toContain('Correct mistakes kindly');
      expect(policy).toContain('No repeated greetings, persona introductions, excessive emojis, canned praise or filler');
    });

    it('defines calibrated conciseness targets without rigid truncation', () => {
      expect(policy).toContain('40–100 words');
      expect(policy).toContain('150–300 words');
      expect(policy).toContain('Tutorials use small complete steps');
      expect(policy).toContain('Never cut off a warning, equation, code block or required clarification');
    });

    it('defines intent-adaptive structures and bans chain-of-thought in output', () => {
      expect(policy).toContain('Quick fact / concept');
      expect(policy).toContain('Calculation');
      expect(policy).toContain('Code help');
      expect(policy).toContain('Troubleshooting');
      expect(policy).toContain('Never output internal chain-of-thought or raw reasoning');
    });

    it('grounds electronics math and physics formulas', () => {
      // Ohm's law
      expect(policy).toContain('V = I * R');
      expect(policy).toContain('I = V / R');
      expect(policy).toContain('R = V / I');

      // LED resistor & forward voltage check
      expect(policy).toContain('R = (Vs - Vf) / I');
      expect(policy).toContain('Vs <= Vf');

      // Standard E12 & power rating check
      expect(policy).toContain('standard E12 values');
      expect(policy).toContain('P = V * I = I² * R');
      expect(policy).toContain('confirm the rating rather than assuming it is universal');

      // Series & parallel
      expect(policy).toContain('Rs = R1 + R2 + ... + Rn');
      expect(policy).toContain('1/Rp = 1/R1 + 1/R2 + ... + 1/Rn');
    });

    it('includes Arduino Uno R3 guidelines and serial pin 0/1 warning', () => {
      expect(policy).toContain('setup() and loop()');
      expect(policy).toContain('pin modes (OUTPUT, INPUT, INPUT_PULLUP)');
      expect(policy).toContain('pins 0 and 1');
      expect(policy).toContain('hardware Serial RX/TX on Uno R3');
      expect(policy).toContain('interferes with sketch uploading and Serial Monitor debugging');
    });

    it('enforces uncertainty discipline and image limitations', () => {
      expect(policy).toContain('Acknowledge missing or ambiguous info honestly');
      expect(policy).toContain('do NOT assume a single answer — explain what values are needed and ask the student for clarification');
      expect(policy).toContain('Never claim a circuit is electrically verified from an image alone');
      expect(policy).toContain('Wires crossing visually on a breadboard do not prove electrical connection');
      expect(policy).toContain('Do not invent component datasheets, Tinkercad controls, unsupported parts');
    });
  });

  describe('buildAskSystemInstruction', () => {
    it('appends Markdown and LaTeX formatting guidance for chat', () => {
      const askPrompt = buildAskSystemInstruction('english', 'chat');
      expect(askPrompt).toContain(OHMI_CHAT_VERSION);
      expect(askPrompt).toContain('Markdown');
      expect(askPrompt).toContain('fenced code with language tags');
      expect(askPrompt).toContain('$...$ or $$...$$');
    });

    it('appends image analysis instructions for image operation', () => {
      const imgPrompt = buildAskSystemInstruction('english', 'image');
      expect(imgPrompt).toContain('Image Analysis: Inspect the visible circuit screenshot');
      expect(imgPrompt).toContain('never guess unseen breadboard pins or connections');
    });

    it('appends PDF analysis instructions for pdf operation', () => {
      const pdfPrompt = buildAskSystemInstruction('english', 'pdf');
      expect(pdfPrompt).toContain('Document Analysis: Analyze the assignment PDF');
      expect(pdfPrompt).toContain('Cite specific page numbers for each requirement');
    });
  });

  describe('buildTutorialSystemInstruction', () => {
    it('appends tutorial output contract and 8-step sequence', () => {
      const tutPrompt = buildTutorialSystemInstruction('english');
      expect(tutPrompt).toContain(OHMI_TUTOR_VERSION);
      expect(tutPrompt).toContain('Tutorial Assembly Output Contract');
      expect(tutPrompt).toContain('"status": "needs_clarification"');
      expect(tutPrompt).toContain('Each step MUST include non-empty "instruction", "why", and "check"');
      expect(tutPrompt).toContain('8-step pedagogical sequence');
    });
  });

  describe('buildCircuitCheckSystemInstruction & buildCircuitPrompt', () => {
    it('appends circuit review rules and evidence citation contract', () => {
      const ccPrompt = buildCircuitCheckSystemInstruction('english');
      expect(ccPrompt).toContain(OHMI_TUTOR_VERSION);
      expect(ccPrompt).toContain('Circuit Review Rules');
      expect(ccPrompt).toContain("cite imageId ('overview' or 'detail')");
      expect(ccPrompt).toContain('cite startLine and endLine');
      expect(ccPrompt).toContain('quote an exact substring from the user\'s simulation text');
      expect(ccPrompt).toContain('CircuitCheckResult schema (schemaVersion: 2)');
    });

    it('integrates seamlessly with buildCircuitPrompt in circuit.ts', () => {
      const fakeReq: CircuitRequestV2 = {
        schemaVersion: 2,
        requestId: '00000000-0000-0000-0000-000000000001',
        message: 'Why is my LED not blinking?',
        board: 'uno-r3',
        language: 'english'
      };
      const fakeEvidence: CircuitEvidence = {};
      const prompt = buildCircuitPrompt(fakeReq, fakeEvidence);

      expect(prompt.systemInstruction).toContain(OHMI_TUTOR_VERSION);
      expect(prompt.systemInstruction).toContain('patient circuit buddy');
      expect(prompt.systemInstruction).toContain('CircuitCheckResult schema:');
      expect(prompt.systemInstruction).toContain('"schemaVersion": 2');
      expect(prompt.userPrompt).toContain('Student Question / Message:\nWhy is my LED not blinking?');
      expect(prompt.userPrompt).toContain('Declared Board: Arduino UNO R3');
    });
  });
});

it('does not infer hardware safety from typical LED or resistor ratings',()=>{
 expect(getCoreTutorPolicy('english')).toContain('Do not declare a real component safe');
 expect(getCoreTutorPolicy('taglish')).toContain('20 mA');
});

it('circuit prompt states the same clarification invariants as result validation',()=>{
 const policy=buildCircuitCheckSystemInstruction('english');expect(policy).toContain('steps MUST be []');expect(policy).toContain('omit codeSuggestion');
});
