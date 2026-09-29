import { describe, it, expect } from 'vitest';
import { hasAnsweredFields } from './promptRequestMode.js';

// import-flow-guided-first AC14 (tech-plan AD-3) — RED until Cmok creates
// promptRequestMode.js. Decides whether wizard step 1 opens as a blank form
// ("Tu objetivo") or a pre-filled review ("Revisa tus respuestas").
describe('hasAnsweredFields', () => {
  it('is false for an empty record', () => {
    expect(hasAnsweredFields({})).toBe(false);
  });

  it('is false for null / non-object input', () => {
    expect(hasAnsweredFields(null)).toBe(false);
    expect(hasAnsweredFields(undefined)).toBe(false);
    expect(hasAnsweredFields('x')).toBe(false);
  });

  it('is false when text fields are empty or whitespace-only', () => {
    expect(hasAnsweredFields({ field1: '', field2: '   ', field4: '\n', field5: '' })).toBe(false);
  });

  it.each(['field1', 'field2', 'field4', 'field5'])('is true when %s has text', (key) => {
    expect(hasAnsweredFields({ [key]: 'algo' })).toBe(true);
  });

  it('is true when field3 is an integer 1-7', () => {
    expect(hasAnsweredFields({ field3: 4 })).toBe(true);
    expect(hasAnsweredFields({ field3: 1 })).toBe(true);
    expect(hasAnsweredFields({ field3: 7 })).toBe(true);
  });

  it('is false when field3 is out of range or not an integer', () => {
    expect(hasAnsweredFields({ field3: 0 })).toBe(false);
    expect(hasAnsweredFields({ field3: 8 })).toBe(false);
    expect(hasAnsweredFields({ field3: 2.5 })).toBe(false);
    expect(hasAnsweredFields({ field3: '3' })).toBe(false);
  });

  it('ignores unknown keys', () => {
    expect(hasAnsweredFields({ field9: 'algo', other: 1 })).toBe(false);
  });
});
