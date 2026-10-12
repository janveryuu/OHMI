import { describe, expect, it } from 'vitest';
import { isCircuitEditorUrl } from './editor-url';

describe('isCircuitEditorUrl', () => {
  it('accepts circuit editor URLs with a design name, query, or trailing slash', () => {
    expect(isCircuitEditorUrl(new URL('https://www.tinkercad.com/things/AbC123-my-circuit/editel?sharecode=abc'))).toBe(true);
    expect(isCircuitEditorUrl(new URL('https://www.tinkercad.com/things/AbC123/editel/'))).toBe(true);
  });

  it('rejects gallery pages, 3D editors, and other origins', () => {
    expect(isCircuitEditorUrl(new URL('https://www.tinkercad.com/circuits'))).toBe(false);
    expect(isCircuitEditorUrl(new URL('https://www.tinkercad.com/things/AbC123/edit'))).toBe(false);
    expect(isCircuitEditorUrl(new URL('https://example.com/things/AbC123/editel'))).toBe(false);
    expect(isCircuitEditorUrl(new URL('http://www.tinkercad.com/things/AbC123/editel'))).toBe(false);
  });
});
