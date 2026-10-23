import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { MessageContent } from './MessageContent';

describe('MessageContent safe markdown and math rendering (Milestones F1 & F4)', () => {
  describe('Standard formatting and structure', () => {
    it('renders paragraphs, bold text, headings, and nested lists cleanly', () => {
      const markdown = '### Resistor Basics\n\nHere is a **resistor** explanation:\n\n- Step 1: Gather parts\n  - Subpart: 220 Ω resistor\n- Step 2: Orient LED';
      const html = renderToString(<MessageContent content={markdown} />);
      expect(html).toContain('<h4>Resistor Basics</h4>');
      expect(html).toContain('<strong>resistor</strong>');
      expect(html).toContain('Step 1: Gather parts');
      expect(html).toContain('220 Ω resistor');
      expect(html).toContain('Step 2: Orient LED');
      expect(html).toContain('<li');
    });

    it('preserves Arduino code blocks and characters (#include, <, >, *, backslashes, newlines)', () => {
      const code = '```cpp\n#include <Arduino.h>\nvoid setup() {\n  if (x < 5) Serial.println("\\n");\n  int a = b * c;\n}\n```';
      const html = renderToString(<MessageContent content={code} />);
      expect(html).toContain('ohmi-code-block');
      expect(html).toContain('#include &lt;Arduino.h&gt;');
      expect(html).toContain('if (x &lt; 5) Serial.println(&quot;\\n&quot;);');
      expect(html).toContain('int a = b * c;');
    });

    it('preserves inline code with literal technical symbols', () => {
      const text = 'Use pin `D13` and set `pinMode(13, OUTPUT);` with `*ptr` variable.';
      const html = renderToString(<MessageContent content={text} />);
      expect(html).toContain('>D13</code>');
      expect(html).toContain('>pinMode(13, OUTPUT);</code>');
      expect(html).toContain('>*ptr</code>');
    });
  });

  describe('LaTeX math and technical formulas', () => {
    it('renders inline math and display math via KaTeX', () => {
      const mathText = 'Use Ohm\'s law: $V = I \\times R$ to calculate resistance: $$R = \\frac{V}{I}$$';
      const html = renderToString(<MessageContent content={mathText} />);
      expect(html).toContain('katex');
    });

    it('renders LED resistor formula with subscripts and fractions', () => {
      const formula = 'Formula: $R = \\frac{V_s - V_f}{I}$ for supply $V_s = 5\\text{V}$.';
      const html = renderToString(<MessageContent content={formula} />);
      expect(html).toContain('katex');
    });

    it('normalizes legacy LaTeX delimiters \\( ... \\) and \\[ ... \\]', () => {
      const legacyMath = 'Ohm\'s Law: \\(V = IR\\) and \\[P = VI\\]';
      const html = renderToString(<MessageContent content={legacyMath} />);
      expect(html).toContain('katex');
    });

    it('preserves units (Ω, µF, V, mA, W) in both math and standard prose', () => {
      const technicalProse = 'Ang resistansya ay 220 Ω, kapasitor ay 10 µF, boltahe ay 5 V, at kuryente ay 20 mA.';
      const html = renderToString(<MessageContent content={technicalProse} />);
      expect(html).toContain('220 Ω');
      expect(html).toContain('10 µF');
      expect(html).toContain('5 V');
      expect(html).toContain('20 mA');
    });

    it('handles malformed math gracefully without throwing an uncaught exception', () => {
      const malformed = 'Formula: $\\frac{incomplete$ and normal text';
      expect(() => renderToString(<MessageContent content={malformed} />)).not.toThrow();
    });

    it('handles literal currency without breaking surrounding text', () => {
      const currency = 'The parts kit costs $15 and the shipping is $5.';
      const html = renderToString(<MessageContent content={currency} />);
      expect(html).toContain('costs');
      expect(html).toContain('parts kit');
    });
  });

  describe('Security and adversarial sanitization', () => {
    it('disallows raw HTML and script tags', () => {
      const xss = '<script>alert("xss")</script>\n\nHello **world**';
      const html = renderToString(<MessageContent content={xss} />);
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert(');
      expect(html).toContain('Hello <strong>world</strong>');
    });

    it('disallows event handlers and image tracking tags', () => {
      const imgXss = '<img src="x" onerror="alert(1)" /> and <img src="https://tracker.com/pixel.png" />';
      const html = renderToString(<MessageContent content={imgXss} />);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('tracker.com');
    });

    it('disallows unsafe javascript: links but allows valid https: links with rel="noopener noreferrer"', () => {
      const links = '[Bad link](javascript:alert(1)) and [Good link](https://example.com)';
      const html = renderToString(<MessageContent content={links} />);
      expect(html).not.toContain('href="javascript:');
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('disallows data: and file: URLs in markdown links', () => {
      const links = '[Data link](data:text/html,<script>alert(1)</script>) and [Local file](file:///etc/passwd)';
      const html = renderToString(<MessageContent content={links} />);
      expect(html).not.toContain('href="data:');
      expect(html).not.toContain('href="file:');
      expect(html).toContain('<span>Data link</span>');
      expect(html).toContain('<span>Local file</span>');
    });

    it('handles deeply nested Markdown and unmatched fences without hanging', () => {
      const weird = '`````cpp\nUnmatched fence\n* list item\n**unclosed bold';
      expect(() => renderToString(<MessageContent content={weird} />)).not.toThrow();
    });

    it('renders legacy raw JSON tutorial payload as safe readable text', () => {
      const jsonAnswer = '{"status":"tutorial","title":"Blink LED","steps":[{"instruction":"Wire LED"}]}';
      const html = renderToString(<MessageContent content={jsonAnswer} />);
      expect(html).toContain('Blink LED');
      expect(html).not.toContain('<script>');
    });
  });
});
