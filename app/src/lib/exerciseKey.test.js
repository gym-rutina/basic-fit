import { describe, it, expect } from 'vitest';
import { slugifyExerciseName, exerciseKey } from './exerciseKey.js';

/**
 * exercise-level-tracking (spec.md AC2, AC3).
 *
 * The exercise key is the identity every tracking surface now groups by. It is
 * DERIVED, never stored — session rows keep carrying `equipmentId` + `name`,
 * and the key is recomputed at read time. That is what makes existing history
 * split by exercise retroactively (AC7) with no backfill, and it is why this
 * module has zero imports: it runs inside screens, aggregators, and IndexedDB
 * transactions alike.
 */

describe('slugifyExerciseName (AC2)', () => {
  it('lowercases, strips diacritics, and collapses whitespace to a single dash', () => {
    // All three spellings are the same exercise and must not split a history.
    expect(slugifyExerciseName('Elevación Lateral')).toBe('elevacion-lateral');
    expect(slugifyExerciseName('elevacion lateral')).toBe('elevacion-lateral');
    expect(slugifyExerciseName('ELEVACIÓN  LATERAL')).toBe('elevacion-lateral');
  });

  it('maps every non-alphanumeric run to one dash and trims the ends', () => {
    expect(slugifyExerciseName('  Press de Banca (inclinado)  ')).toBe('press-de-banca-inclinado');
    expect(slugifyExerciseName('Curl 21s — bíceps')).toBe('curl-21s-biceps');
  });

  it('returns an empty string for null, empty, and punctuation-only names', () => {
    expect(slugifyExerciseName(null)).toBe('');
    expect(slugifyExerciseName(undefined)).toBe('');
    expect(slugifyExerciseName('')).toBe('');
    expect(slugifyExerciseName('   ')).toBe('');
    expect(slugifyExerciseName('!!!')).toBe('');
  });

  it('does not throw on non-string input', () => {
    // Names come from user-authored rutina JSON and this runs inside an
    // IndexedDB transaction — a malformed name must degrade to "untrackable",
    // never abort a session write.
    expect(slugifyExerciseName(42)).toBe('');
    expect(slugifyExerciseName({})).toBe('');
  });
});

describe('exerciseKey (AC3)', () => {
  it('joins equipmentId and slug with :: in the normal case', () => {
    expect(exerciseKey({ equipmentId: 'g3-s10', name: 'Prensa de Pecho' })).toBe('g3-s10::prensa-de-pecho');
  });

  it('gives two different keys to two exercises on the same machine (AC1 premise)', () => {
    const chest = exerciseKey({ equipmentId: 'g3-s10', name: 'Prensa de Pecho' });
    const shoulder = exerciseKey({ equipmentId: 'g3-s10', name: 'Press de Hombro' });
    expect(chest).not.toBe(shoulder);
  });

  it('gives ONE key to the same exercise seen in two programs (AC12 premise)', () => {
    // Cross-program sharing is a property of the key itself, not of any caller.
    expect(exerciseKey({ equipmentId: 'g3-s10', name: 'Prensa de Pecho' })).toBe(
      exerciseKey({ equipmentId: 'g3-s10', name: 'prensa de pecho' })
    );
  });

  it('prefixes with :: when there is no equipmentId (bodyweight)', () => {
    expect(exerciseKey({ equipmentId: null, name: 'Plancha' })).toBe('::plancha');
    expect(exerciseKey({ name: 'Plancha' })).toBe('::plancha');
    expect(exerciseKey({ equipmentId: undefined, name: 'Plancha' })).toBe('::plancha');
  });

  it('returns the bare equipmentId when the name slugs to empty', () => {
    // No "::" in this form, so it can never collide with a composite key.
    expect(exerciseKey({ equipmentId: 'g3-s10', name: '' })).toBe('g3-s10');
    expect(exerciseKey({ equipmentId: 'g3-s10', name: '!!!' })).toBe('g3-s10');
    expect(exerciseKey({ equipmentId: 'g3-s10' })).toBe('g3-s10');
  });

  it('returns null when neither an id nor a usable name is present', () => {
    // A null key means "not trackable": no lastWeights row (AC4), excluded
    // from trend/progress/export grouping.
    expect(exerciseKey({ equipmentId: null, name: '' })).toBeNull();
    expect(exerciseKey({})).toBeNull();
    expect(exerciseKey()).toBeNull();
  });
});
