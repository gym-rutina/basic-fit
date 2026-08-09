import { getEquipmentById, equipmentDisplayName } from '../data/equipment.js';
import { slugifyExerciseName } from './exerciseKey.js';

/**
 * Disambiguation for list surfaces where the exercise key has split rows
 * that used to be merged (tech-plan.md D10 — added after Bagnik's test gate
 * flagged it, since ux-design.md specifies this but no decision recorded
 * it). Re-keying makes two rows that used to be one, so every exercise list
 * needs a way to say WHICH machine a row belongs to.
 *
 * History (HistoryScreen "Por ejercicio") renders `machineLabel` ALWAYS —
 * a permanent identity line. Progress (ProgressScreen picker) renders the
 * lighter `collisionSuffix` below, and only when two exercise NAMES collide.
 */

/**
 * @param {string|null|undefined} equipmentId
 * @param {string} exerciseName
 * @returns {string|null} null for a bodyweight exercise (nothing to disambiguate)
 */
export function machineLabel(equipmentId, exerciseName) {
  if (!equipmentId) return null; // bodyweight — nothing to show
  const eq = getEquipmentById(equipmentId);
  if (!eq) return equipmentId; // unresolved — raw id, muted
  const name = equipmentDisplayName(eq);
  if (slugifyExerciseName(name) === slugifyExerciseName(exerciseName)) return eq.modelCode; // name would be redundant
  return `${eq.modelCode} · ${name}`;
}

/**
 * Progress picker's collision-only suffix (ux-design.md's Copy table:
 * ` · {modelCode}` / ` · sin equipo`). Deliberately just the model code —
 * unlike `machineLabel`, it never repeats the equipment's display name,
 * because the picker only needs to tell two same-named pills apart, not
 * orient the user to "what machine is this" the way History's sub-line does.
 *
 * @param {string|null|undefined} equipmentId
 * @returns {string}
 */
export function collisionSuffix(equipmentId) {
  if (!equipmentId) return ' · sin equipo';
  const eq = getEquipmentById(equipmentId);
  return eq ? ` · ${eq.modelCode}` : ` · ${equipmentId}`;
}
