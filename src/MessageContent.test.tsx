import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { MessageContent } from './MessageContent';

describe('MessageContent safe markdown and math rendering', () => {
  it('renders paragraphs, bold text, and lists cleanly', () => {
    const markdown = 'Here is a **resistor** explanation:\n\n- Step 1: Gather parts\n- Step 2: Orient LED';
    const html = renderToString(<MessageContent content={markdown} />);
    expect(html).toContain('<strong>resistor</strong>');
    expect(html).toContain('Step 1: Gather parts');
    expect(html).toContain('Step 2: Orient LED');
    expect(html).toContain('<li');
  });

  it('preserves Arduino code blocks and characters (#include, <, >, *, backslashes)', () => {
    const code = '```cpp\n#include <Arduino.h>\nvoid setup() {\n  if (x < 5) Serial.println("\\n");\n  int a = b * c;\n}\n```';
    const html = renderToString(<MessageContent content={code} />);
    expect(html).toContain('ohmi-code-block');
    expect(html).toContain('#include &lt;Arduino.h&gt;');
    expect(html).toContain('if (x &lt; 5) Serial.println(&quot;\\n&quot;);');
    expect(html).toContain('int a = b * c;');
  });

  it('renders inline math and display math via KaTeX', () => {
    const mathText = 'Use Ohm\'s law: $V = I \\times R$ to calculate resistance: $$R = \\frac{V}{I}$$';
    const html = renderToString(<MessageContent content={mathText} />);
    expect(html).toContain('katex');
  });

  it('normalizes legacy LaTeX delimiters \\( ... \\) and \\[ ... \\]', () => {
    const legacyMath = 'Ohm\'s Law: \\(V = IR\\) and \\[P = VI\\]';
    const html = renderToString(<MessageContent content={legacyMath} />);
    expect(html).toContain('katex');
  });

  it('disallows raw HTML and script tags', () => {
    const xss = '<script>alert("xss")</script>\n\nHello **world**';
    const html = renderToString(<MessageContent content={xss} />);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Hello <strong>world</strong>');
  });

  it('disallows unsafe javascript: links but allows valid https: links', () => {
    const links = '[Bad link](javascript:alert(1)) and [Good link](https://example.com)';
    const html = renderToString(<MessageContent content={links} />);
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('handles malformed math without throwing', () => {
    const malformed = 'Formula: $\\frac{incomplete$ and normal text';
    expect(() => renderToString(<MessageContent content={malformed} />)).not.toThrow();
  });
});
