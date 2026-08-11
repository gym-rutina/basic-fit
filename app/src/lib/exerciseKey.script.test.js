import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugifyExerciseName, exerciseKey } from './exerciseKey.js';
import equipmentData from '../../../data/equipment.json';
import exampleRutina from '../../../data/examples/phase1-monday.json';

/**
 * pwa-ui-language AC17 — the D1 fix (tech-plan.md D1).
 *
 * THE constraint on this module: `exerciseKey` is derived at read time and
 * never stored, so a changed slug does not migrate anything — it orphans it.
 * Every working weight, trend point, progress chart and export row for an
 * existing user is addressed by the output of this function. A one-character
 * difference in Latin output is silent, total, unrecoverable data loss.
 *
 * So the byte-identity claim is not asserted on a handful of examples. The
 * legacy algorithm is frozen below, verbatim as it shipped, and the two are
 * compared across every Latin-script string this repo contains plus a full
 * character sweep. `exerciseKey.test.js` is left untouched (AC22) — this file
 * is additive.
 */

/** The shipped algorithm, frozen at the commit before this feature. Do not "fix" it. */
function legacySlugify(name) {
  if (typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const NON_LATIN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/** True for a name whose key must not move: it is written in Latin script. */
function isLatinScript(name) {
  return !NON_LATIN.test(String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

function goldenCorpus() {
  const corpus = new Set();

  // 1. Every equipment display name, all three locales — machineLabel.js and
  //    videoQuery.js both slugify these to decide whether a name is redundant.
  for (const item of equipmentData.equipment) {
    for (const value of Object.values(item.names || {})) corpus.add(value);
  }

  // 2. Every authored name/label in the shipped example rutina.
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string' && /^(name|label|phaseName|intro|focus)$/.test(key)) corpus.add(value);
        else walk(value);
      }
    }
  };
  walk(exampleRutina);

  // 3. A full sweep of Latin-1, Latin Extended-A/B, IPA, spacing modifiers and
  //    Latin Extended Additional, in four positions each — leading, trailing,
  //    embedded, and alone. This is what turns "we checked some accents" into
  //    "no Latin-script input can move".
  const sweep = [];
  for (let cp = 0x20; cp <= 0x2ff; cp++) sweep.push(String.fromCodePoint(cp));
  for (let cp = 0x1e00; cp <= 0x1eff; cp++) sweep.push(String.fromCodePoint(cp));
  for (const ch of sweep) {
    corpus.add(ch);
    corpus.add(`${ch}curl`);
    corpus.add(`curl${ch}`);
    corpus.add(`press ${ch} banca`);
  }

  // 4. Every input the shipped exerciseKey.test.js asserts on.
  for (const s of [
    'Elevación Lateral', 'elevacion lateral', 'ELEVACIÓN  LATERAL',
    '  Press de Banca (inclinado)  ', 'Curl 21s — bíceps',
    '', '   ', '!!!', 'Plancha', 'Prensa de Pecho', 'Press de Hombro', 'prensa de pecho',
  ]) corpus.add(s);

  // 5. Latin-script strings that are NOT Spanish — the ones a naive
  //    \p{L}\p{N} rule silently re-keys.
  for (const s of ['Fußpresse', 'Press inclinado 45º', '1ª serie', 'Łydki', 'Dĳbeen', 'Ø-press', '💪 Press', 'Œuf curl'])
    corpus.add(s);

  return [...corpus];
}

describe('slugifyExerciseName — Latin-script keys are frozen (AC17)', () => {
  const corpus = goldenCorpus();
  const latin = corpus.filter(isLatinScript);

  it('has a corpus big enough for the claim to mean something', () => {
    expect(latin.length).toBeGreaterThan(1500);
  });

  it('produces byte-identical output to the shipped algorithm for every Latin-script input', () => {
    const moved = latin
      .filter((name) => slugifyExerciseName(name) !== legacySlugify(name))
      .map((name) => ({ name, was: legacySlugify(name), now: slugifyExerciseName(name) }));
    expect(moved).toEqual([]);
  });

  it('leaves Latin-script keys that are not Spanish alone too', () => {
    // \p{L} would preserve ß/ø/ł/ĳ/œ and re-key every user who has one.
    expect(slugifyExerciseName('Fußpresse')).toBe('fu-presse');
    expect(slugifyExerciseName('Press inclinado 45º')).toBe('press-inclinado-45');
    expect(slugifyExerciseName('Dĳbeen')).toBe('d-been');
  });

  it('keeps the documented degenerate forms', () => {
    expect(slugifyExerciseName('!!!')).toBe('');
    expect(slugifyExerciseName('   ')).toBe('');
    expect(slugifyExerciseName('')).toBe('');
    expect(slugifyExerciseName(42)).toBe('');
    expect(slugifyExerciseName({})).toBe('');
    expect(slugifyExerciseName(null)).toBe('');
    expect(slugifyExerciseName(undefined)).toBe('');
  });
});

describe('slugifyExerciseName — non-Latin scripts become trackable (AC17)', () => {
  it('gives a non-empty slug to a Belarusian name', () => {
    expect(slugifyExerciseName('Жым ад грудзей')).not.toBe('');
    expect(slugifyExerciseName('Планка')).not.toBe('');
  });

  it('gives DIFFERENT slugs to two different Belarusian names', () => {
    expect(slugifyExerciseName('Жым ад грудзей')).not.toBe(slugifyExerciseName('Развядзенне рук'));
  });

  it('splits mixed-script names that the ASCII rule collapses onto one key', () => {
    // Both of these slug to "45" under the shipped rule — the subtle half of
    // D1, and the reason "fall back only when the ASCII slug is empty" was
    // rejected.
    expect(legacySlugify('Жым 45')).toBe(legacySlugify('Развядзенне 45'));
    expect(slugifyExerciseName('Жым 45')).not.toBe(slugifyExerciseName('Развядзенне 45'));
    expect(slugifyExerciseName('Bench Жым')).not.toBe(slugifyExerciseName('Bench Прэс'));
  });

  it('handles other scripts, not just the one we happen to ship', () => {
    expect(slugifyExerciseName('推胸')).not.toBe('');
    expect(slugifyExerciseName('ضغط الصدر')).not.toBe('');
    expect(slugifyExerciseName('Πίεση στήθους')).not.toBe('');
    expect(slugifyExerciseName('ベンチプレス')).not.toBe('');
  });

  it('is still idempotent and case/whitespace-insensitive for non-Latin names', () => {
    expect(slugifyExerciseName('  ЖЫМ  АД  ГРУДЗЕЙ  ')).toBe(slugifyExerciseName('жым ад грудзей'));
  });
});

describe('exerciseKey — D1 consequences are gone (AC17)', () => {
  it('no longer merges two Belarusian exercises on one machine', () => {
    const press = exerciseKey({ equipmentId: 'g3-s10', name: 'Жым ад грудзей' });
    const fly = exerciseKey({ equipmentId: 'g3-s10', name: 'Развядзенне рук' });
    expect(press).not.toBe(fly);
    expect(press).not.toBe('g3-s10');
    expect(fly).not.toBe('g3-s10');
  });

  it('no longer makes a non-Latin bodyweight exercise untrackable', () => {
    // Returning null meant: no lastWeights write, excluded from trends,
    // progress and export entirely.
    expect(exerciseKey({ equipmentId: null, name: 'Планка' })).not.toBeNull();
    expect(exerciseKey({ equipmentId: null, name: 'Планка' })).toBe('::планка');
  });

  it('still returns null when there is genuinely nothing to key on', () => {
    expect(exerciseKey({ equipmentId: null, name: '!!!' })).toBeNull();
    expect(exerciseKey({})).toBeNull();
    expect(exerciseKey()).toBeNull();
  });

  it('keeps every Latin-script key exactly where it was', () => {
    expect(exerciseKey({ equipmentId: 'g3-s10', name: 'Prensa de Pecho' })).toBe('g3-s10::prensa-de-pecho');
    expect(exerciseKey({ equipmentId: null, name: 'Plancha' })).toBe('::plancha');
    expect(exerciseKey({ equipmentId: 'g3-s10', name: '!!!' })).toBe('g3-s10');
  });
});

describe('exerciseKey.js boundary rule', () => {
  it('still has zero imports — it runs inside IndexedDB transactions', () => {
    const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'exerciseKey.js');
    const source = fs.readFileSync(file, 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\s*\(/);
  });
});
