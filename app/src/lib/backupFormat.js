/**
 * full-data-backup — the isomorphic, PURE backup format layer.
 *
 * Constraints (tech-plan AD-1/AD-8): no fs/path/process, no IndexedDB, no
 * localStorage, no DOM. `ajv` (a normal dep) + `./exerciseKey.js` + the schema
 * JSON are the only imports. Reusable verbatim by the future backend (spec D4).
 *
 * `buildBackup` takes plain data in and returns the envelope object;
 * `parseBackup` takes raw text plus an INJECTED rutina validator (the app
 * passes `validateImportedRutina`; tests pass a stub) — this is what keeps the
 * module free of `equipment.json` and app paths (AD-1).
 */

import Ajv from 'ajv';
import backupSchema from '../../../data/schema/backup.schema.json';
import { exerciseKey } from './exerciseKey.js';

/** Backup envelope format version. Starts at 1 (spec AC2). */
export const CURRENT_FORMAT_VERSION = 1;

// strict:false — backup.schema.json declares `"format": "date-time"` on
// `exportedAt` and `ajv-formats` is NOT installed; ajv v8's default
// strict:true throws at compile() on an unknown format. Same idiom as
// scripts/lib/rutina-validator.js:28. No test depends on date-time validation.
const ajv = new Ajv({ allErrors: true, strict: false });
const validateEnvelope = ajv.compile(backupSchema);

/**
 * Builds the backup envelope from already-read state. PURE — never mutates its
 * input, never touches IndexedDB / localStorage / the network. The only field
 * that differs between two consecutive calls on unchanged state is
 * `exportedAt` (spec AC5).
 *
 * @param {{ db: { rutinas: any[], activeRutinaId: string|null, sessions: any[], lastWeights: any[] },
 *           settings: Record<string,string>, appVersion: string, now?: Date }} input
 * @returns {{ formatVersion: number, appVersion: string, exportedAt: string,
 *             data: { rutinas: any[], activeRutinaId: string|null, sessions: any[], lastWeights: any[], settings: Record<string,string> } }}
 */
export function buildBackup(input) {
  const { db, settings, appVersion, now } = input || {};
  const src = db || {};
  const when = now instanceof Date ? now : new Date();
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    appVersion: String(appVersion),
    exportedAt: when.toISOString(),
    data: {
      rutinas: Array.isArray(src.rutinas) ? src.rutinas : [],
      activeRutinaId: src.activeRutinaId != null ? src.activeRutinaId : null,
      sessions: Array.isArray(src.sessions) ? src.sessions : [],
      lastWeights: Array.isArray(src.lastWeights) ? src.lastWeights : [],
      settings: settings && typeof settings === 'object' ? { ...settings } : {},
    },
  };
}

/** Identity migration for now — v1 is the only format. Kept as the seam a
 *  future `formatVersion < CURRENT` file passes through (spec AC10). */
function migrate(envelope) {
  return envelope;
}

/**
 * Parses + validates a backup file. Rejection order (tech-plan §1 "Data flow —
 * restore"): JSON parse → formatVersion integer → newer-version → migrate →
 * envelope schema → every rutina through the injected validator. Nothing is
 * written by this function — it only decides.
 *
 * @param {string} text  raw file contents
 * @param {(rutina: any) => { valid: boolean, errors: string[] }} validateRutina  injected (tests stub it; app passes validateImportedRutina)
 * @returns {{ ok: true, envelope: any } | { ok: false, error: { kind: 'invalid-json'|'invalid-schema'|'newer-version'|'invalid-rutina', detail?: string } }}
 */
export function parseBackup(text, validateRutina) {
  let env;
  try {
    env = JSON.parse(text);
  } catch {
    return { ok: false, error: { kind: 'invalid-json' } };
  }

  if (env === null || typeof env !== 'object' || Array.isArray(env)) {
    return { ok: false, error: { kind: 'invalid-schema' } };
  }
  if (!Number.isInteger(env.formatVersion)) {
    return { ok: false, error: { kind: 'invalid-schema' } };
  }
  if (env.formatVersion > CURRENT_FORMAT_VERSION) {
    return { ok: false, error: { kind: 'newer-version' } };
  }
  if (env.formatVersion < CURRENT_FORMAT_VERSION) {
    env = migrate(env);
  }
  if (!validateEnvelope(env)) {
    return { ok: false, error: { kind: 'invalid-schema' } };
  }

  const validate = typeof validateRutina === 'function' ? validateRutina : () => ({ valid: true, errors: [] });
  for (const entry of env.data.rutinas) {
    const result = validate(entry && entry.rutina);
    if (!result || !result.valid) {
      const first = result && Array.isArray(result.errors) ? result.errors[0] : undefined;
      return { ok: false, error: { kind: 'invalid-rutina', detail: first } };
    }
  }

  return { ok: true, envelope: env };
}

/**
 * The ONE lastWeights reconciliation rule (spec AC8) — shared by db.js
 * restoreFromBackup and any caller. Latest `completedAt` wins per
 * `exerciseKey(ex)`, under the exact `saveSession` predicate
 * (`weightUsed != null && completedAt`). Untrackable exercises (null key) drop.
 * @param {any[]} sessions
 * @returns {Array<{ exerciseKey: string, weight: number, loggedAt: string, equipmentId: any, name: any }>}
 */
export function reconcileLastWeights(sessions) {
  const winners = new Map();
  for (const session of sessions || []) {
    const exercises = (session && session.exercises) || [];
    for (const ex of exercises) {
      if (!ex || ex.weightUsed == null || !ex.completedAt) continue;
      const key = exerciseKey(ex);
      if (key == null) continue;
      const existing = winners.get(key);
      if (!existing || ex.completedAt > existing.loggedAt) {
        winners.set(key, {
          exerciseKey: key,
          weight: ex.weightUsed,
          loggedAt: ex.completedAt,
          equipmentId: ex.equipmentId,
          name: ex.name,
        });
      }
    }
  }
  return Array.from(winners.values());
}
