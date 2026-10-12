import { describe, expect, it } from 'vitest';
import { demoReply, readPreferences } from './preview';

describe('preview preferences', () => {
  it('uses safe defaults for missing or unsupported stored values', () => {
    expect(readPreferences(null)).toEqual({ language: 'english', animations: true, appearance: 'light' });
    expect(readPreferences({ language: 'unknown', animations: 'false', appearance: 'purple' })).toEqual({ language: 'english', animations: true, appearance: 'light' });
  });

  it('retains supported preferences without accepting unrelated stored data', () => {
    expect(readPreferences({ language: 'taglish', animations: false, appearance: 'dark', token: 'ignore' })).toEqual({ language: 'taglish', animations: false, appearance: 'dark' });
  });

  it('offers a distinct fixed sample explanation in each supported language', () => {
    expect(demoReply('english')).toContain('resistor');
    expect(demoReply('filipino')).toContain('Nililimitahan');
    expect(demoReply('taglish')).toContain('nagli-limit');
    const languages = ['english', 'filipino', 'taglish'] as const;
    expect(new Set(languages.map(demoReply)).size).toBe(3);
  });
});
