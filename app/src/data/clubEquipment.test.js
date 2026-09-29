import { describe, it, expect } from 'vitest';
import { createDefaultsLookup, shippedDefaultFor } from './clubEquipment.js';

/**
 * club-equipment-reporting AC10/AC12 — the client's window onto the
 * team-merged `data/club-equipment.json`. Defensive by construction: the file
 * is data, and a malformed or missing entry must degrade to "no default",
 * never to a crash on club selection.
 */

const CLUB = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);

describe('createDefaultsLookup', () => {
  const lookup = createDefaultsLookup({
    schemaVersion: 1,
    clubs: {
      [CLUB]: { absent: ['g3-s10', 'g3-s30'], present: ['g3-s70'] },
      [OTHER]: { absent: ['g3-s45'] },
    },
  });

  it('returns {absent, present} for a club with a shipped default', () => {
    expect(lookup(CLUB)).toEqual({ absent: ['g3-s10', 'g3-s30'], present: ['g3-s70'] });
  });

  it('defaults the optional `present` list to []', () => {
    expect(lookup(OTHER)).toEqual({ absent: ['g3-s45'], present: [] });
  });

  it('returns null for an unknown club', () => {
    expect(lookup('c'.repeat(32))).toBeNull();
    expect(lookup(null)).toBeNull();
    expect(lookup(undefined)).toBeNull();
  });

  it('hands out copies — a caller mutating the result cannot corrupt the shipped data', () => {
    const a = lookup(CLUB);
    a.absent.push('mutated');
    expect(lookup(CLUB).absent).toEqual(['g3-s10', 'g3-s30']);
  });

  it.each([
    ['null data', null],
    ['no clubs key', {}],
    ['clubs is an array', { clubs: [] }],
    ['entry is not an object', { clubs: { [CLUB]: 'nope' } }],
    ['absent is not an array', { clubs: { [CLUB]: { absent: 'g3-s10' } } }],
  ])('degrades to null (never throws) on malformed data: %s', (_label, data) => {
    expect(() => createDefaultsLookup(data)(CLUB)).not.toThrow();
    expect(createDefaultsLookup(data)(CLUB)).toBeNull();
  });

  it('drops non-string ids inside a list instead of poisoning the overlay', () => {
    const l = createDefaultsLookup({ clubs: { [CLUB]: { absent: ['g3-s10', 42, null, {}] } } });
    expect(l(CLUB)).toEqual({ absent: ['g3-s10'], present: [] });
  });
});

describe('shippedDefaultFor (the real bundled file)', () => {
  it('returns null for a club nobody has reported on yet — the file ships empty in v1', () => {
    expect(shippedDefaultFor('f'.repeat(32))).toBeNull();
  });
});
