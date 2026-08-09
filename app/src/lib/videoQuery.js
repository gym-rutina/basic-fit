import { equipmentDisplayName } from '../data/equipment.js';
import { slugifyExerciseName } from './exerciseKey.js';

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
 */

const MACHINE_WORD = { es: 'máquina', en: 'machine', be: 'трэнажор' };
const TECHNIQUE_WORD = { es: 'técnica', en: 'form', be: 'тэхніка' };

/**
 * @param {{name?: string, equipmentId?: string|null, videoQuery?: string}} exercise
 * @param {object|null} equipment - catalog entry (or a plain `{names}` fixture), or null when unresolved
 * @param {string} [lang='es']
 * @returns {string}
 */
export function buildVideoQuery(exercise, equipment, lang = 'es') {
  if (exercise?.videoQuery) return exercise.videoQuery;

  const machineWord = MACHINE_WORD[lang] || MACHINE_WORD.es;
  const techniqueWord = TECHNIQUE_WORD[lang] || TECHNIQUE_WORD.es;

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
