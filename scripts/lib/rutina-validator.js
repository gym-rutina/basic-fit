'use strict';

/**
 * Shared rutina validation module.
 *
 * Isomorphic by design: this file must run unmodified in Node (this
 * project's scripts/validate-rutina.js CLI) AND, later, in the browser
 * as part of rutina-pwa's "Import rutina" screen (bundled via webpack/
 * vite, which resolve the `require('ajv')` and the JSON schema import
 * below to browser-safe equivalents — ajv ships a browser build).
 *
 * No Node-only APIs (fs, path, process) appear anywhere in this file.
 * File I/O (reading the candidate rutina.json and data/equipment.json
 * off disk) is the CLI wrapper's job, not this module's — see
 * scripts/validate-rutina.js.
 */

const Ajv = require('ajv');
const schema = require('../../data/schema/rutina.schema.json');

// allErrors: true is required so ajv reports every violation in one pass
// (e.g. multiple missing required fields across different nested objects)
// instead of stopping at the first one — this project's validator
// contract is "collect all errors, report the union in a single run."
// strict: false avoids ajv's strict-mode errors for schema conventions
// (like the plain-string `lastUpdated` date field) that don't need a
// separate `ajv-formats` dependency for this project's purposes.
const ajv = new Ajv({ allErrors: true, strict: false });
const runSchemaValidation = ajv.compile(schema);

/**
 * Convert an ajv instancePath (e.g. "/program/phaseName" or "/days/0")
 * into the project's pasteable dotted/bracket path style
 * (e.g. "program.phaseName" or "days[0]").
 */
function formatInstancePath(instancePath) {
  return (instancePath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`))
    .join('')
    .replace(/^\./, '');
}

/**
 * Format a single ajv error object into a one-line, LLM-pasteable message.
 */
function formatSchemaError(err) {
  const path = formatInstancePath(err.instancePath);

  if (err.keyword === 'required') {
    const missing = err.params.missingProperty;
    return path ? `${path}.${missing}: required` : `${missing}: required`;
  }

  if (err.keyword === 'additionalProperties') {
    const extra = err.params.additionalProperty;
    const full = path ? `${path}.${extra}` : extra;
    return `${full}: unrecognized property (not allowed by schema)`;
  }

  const label = path || '(root)';
  return `${label}: ${err.message}`;
}

/**
 * Cross-check every days[].exercises[].equipmentId against the union of the
 * catalog and this rutina's own extraEquipment (R4.1). Null-safe on
 * purpose: this must produce useful output even when the input already
 * failed schema validation and `days`/`exercises`/`extraEquipment` are
 * missing, malformed, or not arrays at all.
 *
 * tech-plan.md D10: `equipmentId` is now OPTIONAL (R3.2, X2 — bodyweight
 * exercises). Both `undefined` (absent) and `null` (explicit) mean
 * bodyweight and are skipped — not "not found". Today's early return
 * covered only `undefined`; `null` used to fall through to `validIds.has(null)`
 * and be wrongly reported as unresolved.
 *
 * The third parameter defaults to `data?.extraEquipment` so existing call
 * sites — in particular `app/src/lib/validateImport.js`'s two-argument
 * `validateRutina(parsed, equipmentData.equipment)` — keep working
 * unchanged; the rutina's own extraEquipment is picked up automatically.
 *
 * @param {*} data - parsed rutina.json contents (may be structurally invalid)
 * @param {Array} equipmentArray - parsed data.equipment array from equipment.json
 * @param {Array} [extraEquipment] - this rutina's own extraEquipment[]; defaults to data?.extraEquipment
 * @returns {string[]} one formatted error per unresolved equipmentId
 */
function crossCheckEquipmentIds(data, equipmentArray, extraEquipment = data && data.extraEquipment) {
  const errors = [];
  const idsOf = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((item) => item && item.id)
      .filter((id) => id !== undefined);

  const validIds = new Set([...idsOf(equipmentArray), ...idsOf(extraEquipment)]);

  const days = data && Array.isArray(data.days) ? data.days : [];
  days.forEach((day, dayIndex) => {
    const exercises = day && Array.isArray(day.exercises) ? day.exercises : [];
    exercises.forEach((exercise, exerciseIndex) => {
      if (!exercise || typeof exercise !== 'object') return;
      const id = exercise.equipmentId;
      if (id === undefined || id === null) return; // bodyweight (R3.2, X2, D10) — not "not found"
      if (!validIds.has(id)) {
        errors.push(
          `days[${dayIndex}].exercises[${exerciseIndex}].equipmentId "${id}" not found in data/equipment.json or extraEquipment`
        );
      }
    });
  });

  return errors;
}

/**
 * Detect extraEquipment ids that collide with an existing catalog id, or
 * that are declared more than once within the same rutina (AC23). A
 * collision is a validation error, not a silent shadow — a rutina that
 * "redefines" `g3-s10` as gear would make every prior exercise referencing
 * the real g3-s10 ambiguous.
 *
 * @param {Array} extraEquipment
 * @param {Array} equipmentArray - parsed data.equipment array from equipment.json
 * @returns {string[]}
 */
function findExtraEquipmentCollisions(extraEquipment, equipmentArray) {
  const errors = [];
  const catalogIds = new Set(
    (Array.isArray(equipmentArray) ? equipmentArray : [])
      .map((item) => item && item.id)
      .filter((id) => id !== undefined)
  );

  const seen = new Set();
  for (const gearItem of Array.isArray(extraEquipment) ? extraEquipment : []) {
    const id = gearItem && gearItem.id;
    if (id === undefined) continue;
    if (catalogIds.has(id)) {
      errors.push(`extraEquipment id "${id}" collides with an existing catalog id`);
    }
    if (seen.has(id)) {
      errors.push(`extraEquipment id "${id}" is declared more than once`);
    }
    seen.add(id);
  }

  return errors;
}

/**
 * Count days/exercises for the success summary line. Null-safe.
 */
function countDaysAndExercises(data) {
  const days = data && Array.isArray(data.days) ? data.days : [];
  const dayCount = days.length;
  const exerciseCount = days.reduce(
    (sum, day) => sum + (day && Array.isArray(day.exercises) ? day.exercises.length : 0),
    0
  );
  return { dayCount, exerciseCount };
}

/**
 * Validate a parsed rutina object against the schema AND cross-check every
 * equipment reference against the parsed equipment catalog.
 *
 * Both passes ALWAYS run, regardless of whether the other one failed —
 * schema validation failing does not short-circuit the equipment
 * cross-check (traversal is null-safe). Callers get the full union of
 * errors from a single call, matching validate-data.js's existing
 * accumulate-then-report style.
 *
 * @param {*} data - parsed rutina.json contents
 * @param {Array} equipmentArray - parsed data.equipment array from equipment.json
 * @returns {{ valid: boolean, errors: string[], dayCount: number, exerciseCount: number }}
 */
function validateRutina(data, equipmentArray) {
  const errors = [];

  const schemaOk = runSchemaValidation(data);
  if (!schemaOk) {
    (runSchemaValidation.errors || []).forEach((err) => errors.push(formatSchemaError(err)));
  }

  // Always run, even when schema validation failed above.
  errors.push(...crossCheckEquipmentIds(data, equipmentArray));
  errors.push(...findExtraEquipmentCollisions(data && data.extraEquipment, equipmentArray));

  const { dayCount, exerciseCount } = countDaysAndExercises(data);

  return {
    valid: errors.length === 0,
    errors,
    dayCount,
    exerciseCount,
  };
}

module.exports = {
  validateRutina,
  crossCheckEquipmentIds,
  findExtraEquipmentCollisions,
  formatSchemaError,
};
