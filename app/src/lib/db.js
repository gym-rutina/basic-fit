import { openDB } from 'idb';
import { exerciseKey } from './exerciseKey.js';

/**
 * IndexedDB wrapper (db name `basicfit-rutina`, version 2). Storage schema
 * per tech-plan.md:
 *   activeRutina  — fixed key "current": { key, rutina, importedAt }
 *   sessions      — keyPath id, indexes by-status / by-startedAt
 *   lastWeights   — keyPath exerciseKey: { exerciseKey, weight, loggedAt,
 *                    equipmentId, name } (exercise-level-tracking, DB_VERSION 2 —
 *                    equipmentId/name are plain, non-key fields, retained for
 *                    debuggability and a future re-key, DD-001)
 *
 * Each exported function opens its own short-lived connection and closes it
 * before returning, rather than caching one module-level connection. This
 * is deliberate, not an oversight: a cached connection would sit open
 * across calls and block any later `indexedDB.deleteDatabase(...)` (per the
 * IndexedDB spec, deleteDatabase waits — effectively hangs — while a
 * connection stays open), which is exactly what db.test.js's `beforeEach`
 * does between every test. Opening fresh per call keeps this module correct
 * under that test harness AND safe for the app's own actual call volume
 * (a handful of writes per workout session — the extra open/close cost is
 * immaterial).
 *
 * `lastWeights` single-writer assumption, restated in KEY terms
 * (exercise-level-tracking): today the ONLY writers of this store are
 * `saveSession`'s mirror (below) and `deleteSessions`'s scoped rollback —
 * both derive every record from the `sessions` store, grouped by exercise
 * key, never from an independent input. That is what makes the
 * `deleteSessions` recompute well-defined: it can safely reconstruct "the
 * most recent surviving logged value for this exercise" by re-scanning
 * sessions. If anything ever writes `lastWeights` from a source other than
 * a session's own exercises, this assumption breaks and the recompute can
 * silently diverge from reality.
 */

const DB_NAME = 'basicfit-rutina';
const DB_VERSION = 2;

/**
 * `idb`'s upgrade callback is `(db, oldVersion, newVersion, tx, event)` —
 * only `oldVersion` is needed here. `lastWeights` moves from keyPath
 * `equipmentId` to keyPath `exerciseKey` at version 2: the store is DROPPED
 * and recreated rather than migrated in place, because a v1 row carries no
 * `name` field, so no exercise key can be derived from it — it is
 * unmigratable. Not re-seeded (DD-002); prefill self-heals after one
 * workout per exercise. `sessions` and `activeRutina` are untouched.
 */
function upgrade(db, oldVersion) {
  if (!db.objectStoreNames.contains('activeRutina')) {
    db.createObjectStore('activeRutina', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('sessions')) {
    const store = db.createObjectStore('sessions', { keyPath: 'id' });
    store.createIndex('by-status', 'status');
    store.createIndex('by-startedAt', 'startedAt');
  }
  if (oldVersion < 2 && db.objectStoreNames.contains('lastWeights')) {
    db.deleteObjectStore('lastWeights');
  }
  if (!db.objectStoreNames.contains('lastWeights')) {
    db.createObjectStore('lastWeights', { keyPath: 'exerciseKey' });
  }
}

async function withDb(fn) {
  const db = await openDB(DB_NAME, DB_VERSION, { upgrade });
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

export async function saveActiveRutina(rutina) {
  return withDb(async (db) => {
    await db.put('activeRutina', { key: 'current', rutina, importedAt: new Date().toISOString() });
  });
}

export async function getActiveRutina() {
  return withDb(async (db) => {
    const record = await db.get('activeRutina', 'current');
    return record ?? null;
  });
}

export async function clearActiveRutina() {
  return withDb(async (db) => {
    await db.delete('activeRutina', 'current');
  });
}

/**
 * Upserts a session (by id). Also mirrors every logged exercise's weight
 * into `lastWeights`, in the SAME transaction as the sessions write
 * (tech-plan.md's Decision: "single write path so it can't drift out of
 * sync with sessions" — an O(1)-lookup denormalized store instead of
 * scanning all sessions on every render to prefill a weight input).
 * Idempotent: re-saving an already-saved session just re-writes the same
 * lastWeights values.
 *
 * Keyed by exercise key, not equipmentId (exercise-level-tracking AC1/AC4):
 * an exercise whose key is `null` (no id and no usable name) is not
 * trackable and the mirror skips it rather than writing an undefined-keyed
 * row.
 */
export async function saveSession(session) {
  return withDb(async (db) => {
    const tx = db.transaction(['sessions', 'lastWeights'], 'readwrite');
    const sessionsStore = tx.objectStore('sessions');
    const weightsStore = tx.objectStore('lastWeights');

    await sessionsStore.put(session);
    for (const ex of session.exercises || []) {
      if (ex.weightUsed != null && ex.completedAt) {
        const key = exerciseKey(ex);
        if (key == null) continue;
        await weightsStore.put({
          exerciseKey: key,
          weight: ex.weightUsed,
          loggedAt: ex.completedAt,
          equipmentId: ex.equipmentId,
          name: ex.name,
        });
      }
    }

    await tx.done;
  });
}

export async function getActiveSession() {
  return withDb(async (db) => {
    const activeSessions = await db.getAllFromIndex('sessions', 'by-status', 'active');
    return activeSessions[0] ?? null;
  });
}

/**
 * @param {{from?: string, to?: string}} range - inclusive ISO startedAt bounds, both optional
 * @returns newest-first
 */
export async function listSessions({ from, to } = {}) {
  return withDb(async (db) => {
    let sessions = await db.getAllFromIndex('sessions', 'by-startedAt');
    if (from) sessions = sessions.filter((s) => s.startedAt >= from);
    if (to) sessions = sessions.filter((s) => s.startedAt <= to);
    return sessions.reverse();
  });
}

/**
 * Deletes one or many sessions and rolls back `lastWeights` for every
 * exercise key they logged, in ONE `readwrite` transaction over
 * ['sessions', 'lastWeights'] (spec.md AC1, AC6-AC9, AC17, AC18; re-keyed
 * onto exercise identity by exercise-level-tracking AC8).
 *
 * A single batch entry point — never N per-id calls — because this module
 * opens a fresh connection per exported call (see docblock above): N calls
 * would mean N transactions and a partial-failure window where some
 * sessions are gone and lastWeights is only half rolled back. That would
 * also make the multi-delete confirm sheet's "se borrarán N sesiones" a lie.
 *
 * The rollback winner for each affected exercise key is chosen by the SAME
 * predicate saveSession uses to write lastWeights in the first place
 * (`weightUsed != null && completedAt`, see saveSession above) — using a
 * looser predicate here could invent a lastWeights value saveSession itself
 * would never have written.
 *
 * @param {string[]} ids
 */
export async function deleteSessions(ids) {
  if (!ids || ids.length === 0) return;
  return withDb(async (db) => {
    const tx = db.transaction(['sessions', 'lastWeights'], 'readwrite');
    const sessionsStore = tx.objectStore('sessions');
    const weightsStore = tx.objectStore('lastWeights');

    const idSet = new Set(ids);
    const allSessions = await sessionsStore.getAll();
    const toDelete = allSessions.filter((s) => idSet.has(s.id));
    const survivors = allSessions.filter((s) => !idSet.has(s.id));

    // AC6/AC8 scope: every exercise key that had a LOGGED exercise in a
    // deleted session — an exercise that was never completed never seeded a
    // lastWeights value, so it must not be touched. A null key (not
    // trackable) never had a row either, so it is skipped too.
    const affected = new Set();
    for (const s of toDelete) {
      for (const ex of s.exercises || []) {
        if (ex.completedAt == null) continue;
        const key = exerciseKey(ex);
        if (key != null) affected.add(key);
      }
    }

    for (const id of ids) {
      await sessionsStore.delete(id);
    }

    for (const key of affected) {
      let winner = null;
      for (const s of survivors) {
        for (const ex of s.exercises || []) {
          if (exerciseKey(ex) !== key) continue;
          if (ex.weightUsed == null || !ex.completedAt) continue; // mirrors saveSession's mirror condition exactly
          if (!winner || ex.completedAt > winner.completedAt) winner = ex;
        }
      }
      if (winner) {
        await weightsStore.put({
          exerciseKey: key,
          weight: winner.weightUsed,
          loggedAt: winner.completedAt,
          equipmentId: winner.equipmentId,
          name: winner.name,
        });
      } else {
        await weightsStore.delete(key); // no survivor, remove the record entirely
      }
    }

    await tx.done;
  });
}

export async function getLastWeight(key) {
  return withDb(async (db) => {
    const record = await db.get('lastWeights', key);
    return record ?? null;
  });
}

/**
 * Test-only escape hatch (no production callers — the app writes
 * `lastWeights` exclusively through `saveSession`'s mirror and
 * `deleteSessions`'s rollback, both above). `equipmentId`/`name` are
 * optional plain fields, kept for debuggability and a future re-key
 * (DD-001).
 */
export async function setLastWeight(key, weight, loggedAt = new Date().toISOString(), { equipmentId, name } = {}) {
  return withDb(async (db) => {
    await db.put('lastWeights', { exerciseKey: key, weight, loggedAt, equipmentId, name });
  });
}
