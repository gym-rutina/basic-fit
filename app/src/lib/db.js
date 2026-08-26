import { openDB } from 'idb';
import { exerciseKey } from './exerciseKey.js';

/**
 * IndexedDB wrapper (db name `basicfit-rutina`, version 4). Storage schema
 * per tech-plan.md:
 *   rutinas       — keyPath id: { id, rutina, importedAt, seq } — the LIBRARY
 *                    (multi-rutina-library, DB_VERSION 4, tech-plan.md D-A).
 *                    One validated rutina payload per entry; `seq` is a
 *                    monotonic insertion counter so listRutinas() can honour
 *                    insertion order despite random UUID keys (IndexedDB's
 *                    getAll returns primary-key order).
 *   activeRutina  — fixed key "current", REPURPOSED at v4 as the ACTIVE
 *                    POINTER: { key, rutinaId }. Exactly one pointer row means
 *                    activation is a single atomic write (AC2) and a field-on-
 *                    -entry scheme's clear-old/set-new window cannot exist.
 *                    The pre-v4 shape { key, rutina, importedAt } is migrated
 *                    into `rutinas` by the v3→v4 upgrade below.
 *   sessions      — keyPath id, indexes by-status / by-startedAt. Sessions
 *                    created post-v4 carry attribution (rutinaId + display
 *                    snapshot); rows that predate it were backfilled during
 *                    the v3→v4 migration when a migratable current record
 *                    existed (AC14/OQ-6).
 *   lastWeights   — keyPath exerciseKey: { exerciseKey, weight, loggedAt,
 *                    equipmentId, name } (exercise-level-tracking, DB_VERSION 2 —
 *                    equipmentId/name are plain, non-key fields, retained for
 *                    debuggability and a future re-key, DD-001).
 *                    UNTOUCHED BY THE LIBRARY ON PURPOSE (spec D2): weight
 *                    prefill is a property of the EXERCISE, not of the program
 *                    that scheduled it — never re-key this store per rutina.
 *   clubEquipment — keyPath clubId: { clubId, excludedEquipmentIds[], updatedAt }
 *                    (gym-directory-and-catalog, DB_VERSION 3 — tech-plan.md D4).
 *                    The equipment overlay's per-club exclusion list (R7.4).
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
const DB_VERSION = 4;

/** Mirrors sessionMachine.js's id helper — a local, non-security-sensitive record id. */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * multi-rutina-library D-A — the v3→v4 data migration, run INSIDE the
 * version-change transaction (`tx`) so IndexedDB's own atomicity covers all
 * of it: either the whole shape change commits or none of it does. Steps:
 *
 * 1. Read `activeRutina.current`. Migrate it ONLY if it carries `.rutina` —
 *    the OLD value shape ({key, rutina, importedAt}). This is a VALUE-SHAPE
 *    check, deliberately not an oldVersion check: re-entering with an
 *    already-migrated pointer ({key, rutinaId}) is a harmless no-op, and a
 *    fresh install (no current row at all) passes through untouched. The
 *    v1→v2 "drop because unmigratable" precedent does NOT apply — dropping
 *    the current record would be data loss (AC4).
 * 2. Seed the library: put({id, rutina, importedAt}) preserving the ORIGINAL
 *    importedAt (AC4), then overwrite current with the pointer
 *    {key:'current', rutinaId}.
 * 3. Backfill attribution onto every session lacking rutinaId (OQ-6
 *    denormalisation): {rutinaId, rutinaName, phaseName, phaseNumber}
 *    snapshotted from the migrated rutina, so Historial can attribute
 *    pre-feature sessions even after the originating entry is deleted
 *    (AC13/AC14). No migratable current ⇒ sessions stay orphaned and render
 *    the neutral "programa desconocido" attribution instead. Post-upgrade,
 *    undefined rutinaIds can never be created again (createSession always
 *    stamps), so downstream matching is strict ===.
 */
async function migrateLegacyCurrentIntoLibrary(tx) {
  const activeStore = tx.objectStore('activeRutina');
  const current = await activeStore.get('current');
  if (!current || typeof current !== 'object' || !('rutina' in current)) return;

  const migratedId = generateId();
  await tx.objectStore('rutinas').put({
    id: migratedId,
    rutina: current.rutina,
    importedAt: current.importedAt != null ? current.importedAt : new Date().toISOString(),
    seq: 1,
  });
  await activeStore.put({ key: 'current', rutinaId: migratedId });

  const program = (current.rutina && current.rutina.program) || {};
  const sessionsStore = tx.objectStore('sessions');
  const legacySessions = await sessionsStore.getAll();
  for (const s of legacySessions) {
    if (!s || s.rutinaId !== undefined) continue;
    await sessionsStore.put({
      ...s,
      rutinaId: migratedId,
      rutinaName: program.name,
      phaseName: program.phaseName,
      phaseNumber: program.phaseNumber,
    });
  }
}

/**
 * `idb`'s upgrade callback is `(db, oldVersion, newVersion, tx, event)` —
 * `oldVersion` gates store drops; `tx` carries the data migration. The async
 * body is fine here: idb keeps the version-change transaction alive across
 * awaits on its wrapped requests.
 *
 * History of the branches below:
 * - v1→v2: `lastWeights` moves from keyPath `equipmentId` to keyPath
 *   `exerciseKey`: the store is DROPPED and recreated rather than migrated in
 *   place, because a v1 row carries no `name` field, so no exercise key can be
 *   derived from it — it is unmigratable. Not re-seeded (DD-002); prefill
 *   self-heals after one workout per exercise.
 * - v2→v3 (gym-directory-and-catalog D4): adds `clubEquipment`, purely
 *   additively. The `if (!contains(...))` guards (not oldVersion checks) are
 *   deliberate — a BRAND-NEW install never runs any old branch, and creating
 *   a store only inside an oldVersion guard would leave fresh installs
 *   missing it.
 * - v3→v4 (multi-rutina-library D-A): adds `rutinas`, then seeds it from the
 *   legacy current record via migrateLegacyCurrentIntoLibrary above.
 */
async function upgrade(db, oldVersion, newVersion, tx) {
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
  if (!db.objectStoreNames.contains('clubEquipment')) {
    db.createObjectStore('clubEquipment', { keyPath: 'clubId' });
  }
  if (!db.objectStoreNames.contains('rutinas')) {
    db.createObjectStore('rutinas', { keyPath: 'id' });
  }
  await migrateLegacyCurrentIntoLibrary(tx);
}

async function withDb(fn) {
  const db = await openDB(DB_NAME, DB_VERSION, { upgrade });
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

// ── Rutina library (multi-rutina-library D-B) ─────────────────────────────
//
// All IDB access stays centralised here. The library is N entries in
// `rutinas` plus ONE pointer row in `activeRutina` — activation writes only
// the pointer, so "zero or two active" states cannot be observed (AC2), and
// delete-and-activate spans both stores in one transaction (AC7).

/**
 * Adds a validated rutina payload as a NEW library entry — never overwrites
 * (AC1). `importedAt` is stamped here; the caller-supplied rutina object is
 * stored as-is so round-trips are byte-identical.
 *
 * @param {object} rutina - a validateImportedRutina-passed payload
 * @returns {Promise<{id: string, rutina: object, importedAt: string, seq: number}>}
 */
export async function saveRutinaEntry(rutina) {
  return withDb(async (db) => {
    const tx = db.transaction('rutinas', 'readwrite');
    const store = tx.objectStore('rutinas');
    const existing = await store.getAll();
    const entry = {
      id: generateId(),
      rutina,
      importedAt: new Date().toISOString(),
      seq: existing.reduce((max, e) => Math.max(max, (e && e.seq) || 0), 0) + 1,
    };
    await store.put(entry);
    await tx.done;
    return entry;
  });
}

/** @returns {Promise<Array<{id, rutina, importedAt, seq}>>} insertion order; UI may re-sort */
export async function listRutinas() {
  return withDb(async (db) => {
    const entries = await db.getAll('rutinas');
    return entries.sort((a, b) => ((a && a.seq) || 0) - ((b && b.seq) || 0));
  });
}

/**
 * Points 'current' at the given entry — ONE put, atomic by construction
 * (AC2). The transaction spans both library stores so a concurrent
 * delete/activate pair serialises against the same lock set.
 *
 * @param {string} id
 */
export async function activateRutina(id) {
  return withDb(async (db) => {
    const tx = db.transaction(['rutinas', 'activeRutina'], 'readwrite');
    await tx.objectStore('activeRutina').put({ key: 'current', rutinaId: id });
    await tx.done;
  });
}

/**
 * The joined active entry ({id, rutina, importedAt, seq}) or exactly `null`
 * when no pointer exists or it dangles (entry deleted without a successor —
 * AC5's empty state). Never returns undefined.
 */
export async function getActiveEntry() {
  return withDb(async (db) => {
    const pointer = await db.get('activeRutina', 'current');
    if (!pointer || pointer.rutinaId == null) return null;
    const entry = await db.get('rutinas', pointer.rutinaId);
    return entry ?? null;
  });
}

/**
 * Removes one entry ONLY. Callers pick the variant (plain delete vs
 * delete+activate); the pointer is deliberately left alone — a dangling
 * pointer after deleting the last entry reads as null via getActiveEntry/
 * getActiveRutina, which is exactly the AC5 empty state, and deleting a
 * NON-active entry must not disturb the pointer (AC6). Sessions are NOT
 * touched (AC13).
 *
 * @param {string} id
 */
export async function deleteRutina(id) {
  return withDb(async (db) => {
    await db.delete('rutinas', id);
  });
}

/**
 * Deletes one entry and activates its chosen successor in ONE readwrite
 * transaction over both stores (AC7's atomicity: no observable window where
 * the old entry is gone but the pointer still names it).
 *
 * @param {string} deleteId
 * @param {string} activateId
 */
export async function deleteAndActivateRutina(deleteId, activateId) {
  return withDb(async (db) => {
    const tx = db.transaction(['rutinas', 'activeRutina'], 'readwrite');
    await tx.objectStore('rutinas').delete(deleteId);
    await tx.objectStore('activeRutina').put({ key: 'current', rutinaId: activateId });
    await tx.done;
  });
}

// ── Legacy single-rutina shell API (kept for contract compatibility) ──────

/**
 * DEPRECATED production-wise (multi-rutina-library moved imports onto
 * saveRutinaEntry + activateRutina) but kept working for the established
 * shell contract: saves the payload as a NEW library entry and points
 * 'current' at it. Two calls create two entries — this is an add, not an
 * overwrite, because silently replacing library data is what this feature
 * exists to stop.
 */
export async function saveActiveRutina(rutina) {
  const entry = await saveRutinaEntry(rutina);
  await activateRutina(entry.id);
  return entry;
}

/**
 * Shell compatibility (D-B): same name, same consumers, but now returns the
 * JOINED active entry — the legacy { key, rutina, importedAt } shape with the
 * entry's stable `id` (and `rutinaId`, `seq`) added. App.jsx reads `.rutina`
 * exactly as before; screens gain `rutina.id`. Null when there is no pointer,
 * it dangles, or nothing was ever saved.
 */
export async function getActiveRutina() {
  const entry = await getActiveEntry();
  if (!entry) return null;
  return { key: 'current', rutinaId: entry.id, ...entry };
}

/**
 * Clears the ACTIVE POINTER only. Library entries are never destroyed here —
 * deletion is a deliberate per-entry act on /library (AC5-AC7). With no
 * pointer, getActiveRutina()/getActiveEntry() read null and the Shell
 * redirects to /import.
 */
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

/**
 * gym-directory-and-catalog R7.4 — the equipment overlay's exclusion list
 * for one club. Defaults to `[]` ("all present") for a club that has never
 * been edited — never `null`-that-means-error, so the Catálogo filter can
 * tell "no exclusions" apart from "not loaded yet" (D21's job, one layer up
 * in useClubExclusions.js).
 *
 * @param {string} clubId
 * @returns {Promise<string[]>}
 */
export async function getClubExclusions(clubId) {
  return withDb(async (db) => {
    const record = await db.get('clubEquipment', clubId);
    return record ? record.excludedEquipmentIds : [];
  });
}

/**
 * Overwrites (never merges) the exclusion list for one club — re-ticking a
 * box must actually remove the exclusion, so a merge here would make
 * exclusions permanently un-undoable. Stamps `updatedAt` so a later refresh
 * (M13's monthly re-scrape) can reason about staleness.
 *
 * @param {string} clubId
 * @param {Iterable<string>} excludedEquipmentIds
 */
export async function setClubExclusions(clubId, excludedEquipmentIds) {
  return withDb(async (db) => {
    await db.put('clubEquipment', {
      clubId,
      excludedEquipmentIds: Array.from(excludedEquipmentIds || []),
      updatedAt: new Date().toISOString(),
    });
  });
}
