import { describe, it, expect } from 'vitest';
import { buildVideoQuery } from './videoQuery.js';

/**
 * exercise-level-tracking (spec.md AC15, AC16).
 *
 * One machine hosts several exercises, so the machine's catalog video cannot be
 * "the tutorial" for any of them. This module composes a YouTube search query
 * from the EXERCISE name plus the equipment's human-readable name — never the
 * Matrix model code or series, which return near-empty YouTube results.
 *
 * Fixtures are plain objects rather than real catalog entries: equipmentDisplayName
 * only needs `names`, and the AC15 table is a contract about composition, not
 * about what happens to be in data/equipment.json today.
 */

const PRENSA_PECHO = { names: { es: 'Prensa de Pecho', en: 'Chest Press', be: 'Жым лежачы' } };

describe('buildVideoQuery — the AC15 worked cases (lang = es)', () => {
  it('adds the machine word when the equipment name IS the exercise name', () => {
    // Repeating "Prensa de Pecho Prensa de Pecho" would waste the query; the
    // generic word keeps it a machine-exercise search.
    const q = buildVideoQuery({ name: 'Prensa de Pecho', equipmentId: 'g3-s70' }, PRENSA_PECHO);
    expect(q).toBe('Prensa de Pecho máquina técnica');
  });

  it('names the equipment when it differs from the exercise', () => {
    const q = buildVideoQuery({ name: 'Press de Hombro', equipmentId: 'g3-s70' }, PRENSA_PECHO);
    expect(q).toBe('Press de Hombro Prensa de Pecho técnica');
  });

  it('omits any equipment word entirely for a bodyweight exercise', () => {
    const q = buildVideoQuery({ name: 'Plancha', equipmentId: null }, null);
    expect(q).toBe('Plancha técnica');
  });

  it('returns an explicit videoQuery verbatim, overriding composition', () => {
    const q = buildVideoQuery(
      { name: 'Press de Hombro', equipmentId: 'g3-s70', videoQuery: 'overhead press form' },
      PRENSA_PECHO
    );
    expect(q).toBe('overhead press form');
  });
});

describe('buildVideoQuery — composition rules', () => {
  it('treats a case/accent variant of the equipment name as the same word', () => {
    // Duplicate suppression runs through slugifyExerciseName, so casing and
    // diacritics cannot smuggle the same word in twice.
    const q = buildVideoQuery({ name: 'prensa de pecho', equipmentId: 'g3-s70' }, PRENSA_PECHO);
    expect(q).toBe('prensa de pecho máquina técnica');
  });

  it('falls back to the machine word when the equipment id does not resolve', () => {
    const q = buildVideoQuery({ name: 'Curl Bíceps', equipmentId: 'mancuerna-libre-15kg' }, null);
    expect(q).toBe('Curl Bíceps máquina técnica');
  });

  it('never contains a Matrix model code or series (AC16)', () => {
    const eq = { modelCode: 'G3-S70', series: 'Aura', names: { es: 'Prensa de Piernas' } };
    const q = buildVideoQuery({ name: 'Prensa de Piernas', equipmentId: 'g3-s70' }, eq);
    expect(q).not.toMatch(/G3-S70/i);
    expect(q).not.toMatch(/aura/i);
    expect(q).not.toMatch(/matrix/i);
  });

  it('produces different queries for two exercises on the same machine (AC16)', () => {
    const a = buildVideoQuery({ name: 'Prensa de Pecho', equipmentId: 'g3-s10' }, PRENSA_PECHO);
    const b = buildVideoQuery({ name: 'Press de Hombro', equipmentId: 'g3-s10' }, PRENSA_PECHO);
    expect(a).not.toBe(b);
  });
});

describe('buildVideoQuery — languages', () => {
  it('uses the English word table', () => {
    expect(buildVideoQuery({ name: 'Chest Press', equipmentId: 'g3-s70' }, PRENSA_PECHO, 'en')).toBe(
      'Chest Press machine form'
    );
  });

  it('uses the Belarusian word table', () => {
    expect(buildVideoQuery({ name: 'Планка', equipmentId: null }, null, 'be')).toBe('Планка тэхніка');
  });

  it('uses the French word table', () => {
    expect(buildVideoQuery({ name: 'Plancha', equipmentId: null }, null, 'fr')).toBe('Plancha technique');
  });

  it('uses the Dutch word table', () => {
    expect(buildVideoQuery({ name: 'Plancha', equipmentId: null }, null, 'nl')).toBe('Plancha techniek');
  });

  it('uses the German word table', () => {
    expect(buildVideoQuery({ name: 'Plancha', equipmentId: null }, null, 'de')).toBe('Plancha Technik');
  });

  it('falls back to Spanish for an unmapped language', () => {
    // Must stay genuinely unmapped — fr/nl/de are registered catalogs since
    // expand-ui-locales and resolve their own word tables above; only a
    // locale absent from CATALOGS exercises the es fallback (DEC-6).
    expect(buildVideoQuery({ name: 'Plancha', equipmentId: null }, null, 'it')).toBe('Plancha técnica');
  });
});
