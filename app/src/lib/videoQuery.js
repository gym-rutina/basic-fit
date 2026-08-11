import { equipmentDisplayName } from '../data/equipment.js';
import { slugifyExerciseName } from './exerciseKey.js';
import { tFor, DEFAULT_LOCALE } from '../i18n/index.js';

/**
 * Composes the YouTube search query for an exercise's tutorial link
 * (spec.md's Data contract, tech-plan.md D6). One machine hosts several
 * exercises, so the machine's catalog video cannot be "the tutorial" for
 * any of them — this composes exercise name + equipment's human-readable
 * name + a technique word, deliberately NEVER the Matrix model code or
 * series (AC16), which return near-empty YouTube results.
 *
 * `equipmentDisplayName` is a pure function over `{names:{…}}` (see
 * app/src/data/equipment.js), so this module can be driven by plain
 * fixtures in tests without loading the real catalog.
 *
 * pwa-ui-language: the machine/technique words now come from the shared
 * catalog (`equipment.machineWord`/`equipment.techniqueWord`) instead of a
 * locally hardcoded map — the words themselves are Spanish/English/Belarusian
 * text, and AC9's stray-literal scanner correctly flags hardcoded copy
 * outside `i18n/`.
 */

/**
 * @param {{name?: string, equipmentId?: string|null, videoQuery?: string}} exercise
 * @param {object|null} equipment - catalog entry (or a plain `{names}` fixture), or null when unresolved
 * @param {string} [lang]
 * @returns {string}
 */
export function buildVideoQuery(exercise, equipment, lang = DEFAULT_LOCALE) {
  if (exercise?.videoQuery) return exercise.videoQuery;

  const t = tFor(lang);
  const machineWord = t('equipment.machineWord');
  const techniqueWord = t('equipment.techniqueWord');

  const parts = [exercise?.name];
  const label = equipmentDisplayName(equipment, lang);
  if (label && slugifyExerciseName(label) !== slugifyExerciseName(exercise?.name)) {
    parts.push(label);
  } else if (exercise?.equipmentId) {
    parts.push(machineWord);
  }
  parts.push(techniqueWord);

  return parts.join(' ');
}
