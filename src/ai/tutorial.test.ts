import { describe, it, expect } from 'vitest';
import { validateTutorialResult, extractTutorialJson } from './tutorial.js';

describe('Tutorial Result Schema Validation and Extraction', () => {
  it('validates a correct multi-step tutorial', () => {
    const raw = {
      status: 'tutorial',
      title: 'Arduino LED Blink Tutorial',
      objective: 'Build an LED circuit controlled by Arduino Pin 9',
      components: [
        { name: 'Red LED', quantity: 1 },
        { name: '330 Ohm Resistor', quantity: 1 },
        { name: 'Arduino UNO', quantity: 1 }
      ],
      steps: [
        {
          step: 1,
          instruction: 'Place the red LED on the breadboard across two rows.',
          why: 'The breadboard rows provide separated electrical nodes for anode and cathode.',
          check: 'Note the longer leg (anode) and shorter leg (cathode).'
        },
        {
          step: 2,
          instruction: 'Connect the 330 ohm resistor in series with the LED cathode to breadboard ground rail.',
          why: 'The resistor limits the current so the LED does not burn out.',
          check: 'Verify one resistor leg shares the cathode row, and the other leg touches the GND rail.'
        },
        {
          step: 3,
          instruction: 'Connect a jumper wire from Arduino digital pin 9 to the LED anode row.',
          why: 'Pin 9 will supply 5V when driven HIGH by the sketch.',
          check: 'Confirm the jumper wire is seated firmly in pin 9 and the LED anode row.'
        }
      ],
      code: `void setup() {
  pinMode(9, OUTPUT);
}
void loop() {
  digitalWrite(9, HIGH);
  delay(500);
  digitalWrite(9, LOW);
  delay(500);
}`
    };

    const res = validateTutorialResult(raw);
    expect(res.valid).toBe(true);
    expect(res.result?.status).toBe('tutorial');
    expect(res.result?.steps).toHaveLength(3);
    expect(res.result?.components).toHaveLength(3);
    expect(res.result?.arduinoValidation?.valid).toBe(true);
    expect(res.result?.arduinoValidation?.hasSetup).toBe(true);
    expect(res.result?.arduinoValidation?.hasLoop).toBe(true);
  });

  it('rejects tutorials with non-sequential step numbers', () => {
    const raw = {
      status: 'tutorial',
      steps: [
        { step: 1, instruction: 'Do step 1', why: 'Why 1', check: 'Check 1' },
        { step: 3, instruction: 'Do step 3', why: 'Why 3', check: 'Check 3' } // step 2 missing
      ]
    };
    const res = validateTutorialResult(raw);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('strictly sequential');
  });

  it('rejects tutorials with missing instructions or checks', () => {
    const raw = {
      status: 'tutorial',
      steps: [
        { step: 1, instruction: '', why: 'Why 1', check: 'Check 1' }
      ]
    };
    const res = validateTutorialResult(raw);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('missing an instruction');
  });

  it('rejects tutorials with zero steps or > 24 steps', () => {
    const emptyRes = validateTutorialResult({ status: 'tutorial', steps: [] });
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.error).toContain('between 1 and 24');

    const tooMany = Array.from({ length: 25 }, (_, i) => ({
      step: i + 1,
      instruction: `Step ${i + 1}`,
      why: 'Why',
      check: 'Check'
    }));
    const tooManyRes = validateTutorialResult({ status: 'tutorial', steps: tooMany });
    expect(tooManyRes.valid).toBe(false);
    expect(tooManyRes.error).toContain('between 1 and 24');
  });

  it('accepts needs_clarification with questions', () => {
    const raw = {
      status: 'needs_clarification',
      clarificationQuestions: [
        'What is your supply voltage?',
        'What is the forward voltage and target current of your LED?'
      ],
      notes: 'Cannot determine resistor value without supply voltage.'
    };
    const res = validateTutorialResult(raw);
    expect(res.valid).toBe(true);
    expect(res.result?.status).toBe('needs_clarification');
    expect(res.result?.clarificationQuestions).toHaveLength(2);
  });

  it('extracts JSON from markdown code fences or surrounding text', () => {
    const withFences = `Here is your guide:
\`\`\`json
{
  "status": "needs_clarification",
  "clarificationQuestions": ["Question 1?"]
}
\`\`\`
Hope this helps!`;
    const parsed = extractTutorialJson(withFences) as any;
    expect(parsed).not.toBeNull();
    expect(parsed.status).toBe('needs_clarification');
    expect(parsed.clarificationQuestions[0]).toBe('Question 1?');
  });
});
