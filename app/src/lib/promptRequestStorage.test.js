import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PROMPT_REQUEST_KEY, readPromptRequest, writePromptRequest, clearPromptRequest } from './promptRequestStorage.js';

/**
 * onboarding-request-fields R2.1-R2.4, R1.7, R1.8 (tech-plan.md §2.1).
 *
 * Pending Cmok implementation — see tech-plan.md. Failures here are expected
 * until Cmok implements promptRequestStorage.js with this exact shape.
 *
 * Mirrors clubStorage.js's contract on purpose (same rutina: namespace, same
 * synchronous/defensive/never-throws convention) — R2.2's whole reason is
 * that GuideOverlay must render filled answers on its FIRST paint, exactly
 * the reason clubStorage.js is not in IndexedDB.
 */

const RECORD = {
  field1: 'Elena — Fase 2',
  field2: 'Hipertrofia, más volumen',
  field3: 4,
  field4: '45-60 min',
  field5: 'Evitar press militar por hombro derecho',
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('PROMPT_REQUEST_KEY', () => {
  it('follows the existing rutina: namespace convention', () => {
    // Needs a strayLiterals.test.js allowlist entry for the same documented
    // reason rutina:club / rutina:uiLang / rutina:onboardingSeen have one.
    expect(PROMPT_REQUEST_KEY).toBe('rutina:promptRequest');
  });
});

describe('readPromptRequest / writePromptRequest (R2.1-R2.2)', () => {
  it('returns an empty record when nothing is stored', () => {
    expect(readPromptRequest()).toEqual({});
  });

  it('round-trips a full record through localStorage (AC9)', () => {
    writePromptRequest(RECORD);
    expect(readPromptRequest()).toEqual(RECORD);
  });

  it('reads synchronously — the returned value is usable in the same tick', () => {
    writePromptRequest(RECORD);
    const result = readPromptRequest();
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.field1).toBe(RECORD.field1);
  });

  it('overwrites the previous record rather than merging (last write wins)', () => {
    writePromptRequest(RECORD);
    writePromptRequest({ field1: 'Only this now' });
    expect(readPromptRequest()).toEqual({ field1: 'Only this now' });
  });

  it('a partial record round-trips without inventing the missing fields', () => {
    writePromptRequest({ field2: 'Solo el objetivo' });
    const stored = readPromptRequest();
    expect(stored.field2).toBe('Solo el objetivo');
    expect(stored.field1).toBeUndefined();
    expect(stored.field3).toBeUndefined();
  });
});

describe('trimming and length caps on write (R1.7)', () => {
  it('trims leading/trailing whitespace from every text field', () => {
    writePromptRequest({ field1: '  Elena — Fase 2  ', field4: '\t45-60 min\n' });
    const stored = readPromptRequest();
    expect(stored.field1).toBe('Elena — Fase 2');
    expect(stored.field4).toBe('45-60 min');
  });

  it('truncates field1 at 200 characters rather than rejecting it', () => {
    writePromptRequest({ field1: 'x'.repeat(250) });
    expect(readPromptRequest().field1).toHaveLength(200);
  });

  it('truncates field2 at 800 characters (Rev4-SF1)', () => {
    writePromptRequest({ field2: 'y'.repeat(900) });
    expect(readPromptRequest().field2).toHaveLength(800);
  });

  it('truncates field4 at 200 characters', () => {
    writePromptRequest({ field4: 'z'.repeat(250) });
    expect(readPromptRequest().field4).toHaveLength(200);
  });

  it('truncates field5 at 500 characters', () => {
    writePromptRequest({ field5: 'w'.repeat(600) });
    expect(readPromptRequest().field5).toHaveLength(500);
  });

  it('does not truncate a value already under every cap', () => {
    writePromptRequest(RECORD);
    expect(readPromptRequest()).toEqual(RECORD);
  });
});

describe('field3 (days per week) validation — R1.8, AC7', () => {
  it('accepts every integer 1 through 7', () => {
    for (let n = 1; n <= 7; n++) {
      writePromptRequest({ field3: n });
      expect(readPromptRequest().field3).toBe(n);
    }
  });

  it('drops 0 and 8 as out of range — treated as unanswered', () => {
    writePromptRequest({ field3: 0 });
    expect(readPromptRequest().field3).toBeUndefined();
    writePromptRequest({ field3: 8 });
    expect(readPromptRequest().field3).toBeUndefined();
  });

  it('drops a non-integer (3.5) as unanswered', () => {
    writePromptRequest({ field3: 3.5 });
    expect(readPromptRequest().field3).toBeUndefined();
  });

  it('drops a non-numeric value ("abc") as unanswered, never throwing', () => {
    expect(() => writePromptRequest({ field3: 'abc' })).not.toThrow();
    expect(readPromptRequest().field3).toBeUndefined();
  });

  it('sanitizes an out-of-range field3 even if it reaches storage some other way (defense against a corrupted/future-version record)', () => {
    localStorage.setItem(PROMPT_REQUEST_KEY, JSON.stringify({ field3: 99 }));
    expect(readPromptRequest().field3).toBeUndefined();
  });
});

describe('defensive reads — R2.3, R2.4', () => {
  it.each(['{', 'null', '[]', '"x"'])('treats a corrupt stored value (%s) as no answers, not a crash', (raw) => {
    localStorage.setItem(PROMPT_REQUEST_KEY, raw);
    expect(() => readPromptRequest()).not.toThrow();
    expect(readPromptRequest()).toEqual({});
  });

  it('ignores an unknown extra key while still loading the known fields', () => {
    localStorage.setItem(
      PROMPT_REQUEST_KEY,
      JSON.stringify({ field1: 'Elena', field99: 'from a future version', unrelated: true })
    );
    const stored = readPromptRequest();
    expect(stored.field1).toBe('Elena');
    expect(stored.field99).toBeUndefined();
    expect(stored.unrelated).toBeUndefined();
  });

  it('never throws when storage is unavailable on read (private browsing)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => readPromptRequest()).not.toThrow();
    expect(readPromptRequest()).toEqual({});
  });

  it('never throws when a write is rejected (quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writePromptRequest(RECORD)).not.toThrow();
  });
});

describe('clearPromptRequest', () => {
  it('removes the stored record', () => {
    writePromptRequest(RECORD);
    clearPromptRequest();
    expect(readPromptRequest()).toEqual({});
  });

  it('is safe to call when nothing is stored', () => {
    expect(() => clearPromptRequest()).not.toThrow();
  });
});
