import { describe, it, expect, vi } from 'vitest';
import { buildAskSystemInstruction } from './tutor-policy.ts';
import { answerChat } from './copilot.ts';

describe('focused Ask OHMI policy evaluation (offline, mocked model)', () => {
  it('keeps safety, language, formatting and calibrated depth in a compact chat policy', () => {
    const policy = buildAskSystemInstruction('taglish', 'chat');
    expect(new TextEncoder().encode(policy).length).toBeLessThan(3000);
    for (const term of ['Taglish', 'datasheet', 'electrically verified', 'Markdown', 'setup()', 'loop()', 'V = I', 'uncertain']) expect(policy).toContain(term);
    expect(policy).toMatch(/short|concise/i);
    expect(policy).toMatch(/step.by.step|worked/i);
  });
  const cases = [
    { language: 'english', question: 'What does a resistor do?', reply: 'A resistor limits current and creates a voltage drop. Its resistance is measured in ohms (Ω).', patterns: [/limits current/, /ohms/], maxWords: 45 },
    { language: 'filipino', question: 'Ano ang resistor?', reply: 'Nililimitahan ng resistor ang current sa circuit. Sinusukat ang resistance nito sa ohms (Ω).', patterns: [/Nililimitahan/, /current/], maxWords: 45 },
    { language: 'taglish', question: 'hii ohmi', reply: 'Hi! Anong gusto mong linawin sa circuit mo?', patterns: [/Anong/], maxWords: 20 },
    { language: 'english', question: '5 V across 1 kΩ: what current?', reply: String.raw`$I = V/R = 5/1000 = 0.005\,A = 5\,mA$. Check the actual resistor power rating before applying power.`, patterns: [/5\/1000/, /5\\,mA/, /rating/], maxWords: 50 },
    { language: 'taglish', question: '330 ohms, 5 V supply and 2 V LED drop. Safe ba?', reply: 'Current: $(5-2)/330 ≈ 9.1\,mA$. I-compare muna sa actual LED datasheet at resistor power rating; hindi confirmed ang safety mula sa assumed ratings.', patterns: [/9\.1/, /datasheet/, /hindi confirmed/], maxWords: 55 },
    { language: 'english', question: 'Can you verify my circuit without seeing it?', reply: 'I cannot electrically verify an unseen circuit or run its simulation. Share the schematic, ratings and observed behavior so we can check one issue at a time.', patterns: [/cannot electrically verify/, /observed/], maxWords: 55 },
    { language: 'english', question: 'Why does INPUT_PULLUP read LOW when pressed?', reply: 'INPUT_PULLUP holds the input HIGH when the switch is open. Pressing a switch wired to GND pulls it LOW. Use `pinMode(2, INPUT_PULLUP)` in `setup()` and read it in `loop()`.', patterns: [/GND/, /setup\(\)/, /loop\(\)/], maxWords: 60 },
  ];
  it.each(cases)('$language: $question', async ({ language, question, reply, patterns, maxWords }) => {
    const fetcher = vi.fn(async () => Response.json({ model: 'openai/gpt-oss-120b', choices: [{ message: { content: JSON.stringify({ scope: 'in_scope', reply }) } }] }));
    const result = await answerChat({ env: { GROQ_API_KEY: 'offline-key' }, system: buildAskSystemInstruction(language, 'chat'), messages: [{ role: 'user', content: question }], fetch: fetcher });
    expect(result.mode).toBe('ai');
    patterns.forEach(pattern => expect(result.answer).toMatch(pattern));
    expect(result.answer.split(/\s+/).length).toBeLessThanOrEqual(maxWords);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
