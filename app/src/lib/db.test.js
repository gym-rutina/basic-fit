import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  saveActiveRutina,
  getActiveRutina,
  clearActiveRutina,
  saveSession,
  getActiveSession,
  listSessions,
  getLastWeight,
  setLastWeight,
  deleteSessions,
} from './db.js';
import { exerciseKey } from './exerciseKey.js';

const RUTINA = { schemaVersion: 1, program: { name: 'Test' }, days: [{ label: 'Lunes', exercises: [] }] };

/**
 * exercise-level-tracking: `lastWeights` is keyed by exercise key, not
 * equipmentId. The fixtures below name every exercise after its machine, so
 * this helper spells out the key the store actually holds.
 */
const K = (equipmentId, name = equipmentId) => exerciseKey({ equipmentId, name });

function resetDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('basicfit-rutina');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await resetDb();
});

describe('db (IndexedDB wrapper)', () => {
  it('round-trips the active rutina', async () => {
    expect(await getActiveRutina()).toBeNull();
    await saveActiveRutina(RUTINA);
    const stored = await getActiveRutina();
    expect(stored.rutina).toEqual(RUTINA);
    await clearActiveRutina();
    expect(await getActiveRutina()).toBeNull();
  });

  it('saveSession + getActiveSession round-trips a status:active session', async () => {
    const session = {
      id: 'sess-1',
      dayLabel: 'Lunes',
      dayIndex: 0,
      status: 'active',
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: null,
      exercises: [],
    };
    await saveSession(session);
    expect(await getActiveSession()).toEqual(session);
  });

  it('completing a session clears it from getActiveSession', async () => {
    const session = {
      id: 'sess-1',
      dayLabel: 'Lunes',
      dayIndex: 0,
      status: 'active',
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: null,
      exercises: [],
    };
    await saveSession(session);
    await saveSession({ ...session, status: 'completed', endedAt: '2026-07-13T09:50:00.000Z' });
    expect(await getActiveSession()).toBeNull();
  });

  it('listSessions returns sessions newest-first', async () => {
    await saveSession({
      id: 'a',
      dayLabel: 'Lunes',
      dayIndex: 0,
      status: 'completed',
      startedAt: '2026-07-01T09:00:00.000Z',
      endedAt: '2026-07-01T09:50:00.000Z',
      exercises: [],
    });
    await saveSession({
      id: 'b',
      dayLabel: 'Lunes',
      dayIndex: 0,
      status: 'completed',
      startedAt: '2026-07-08T09:00:00.000Z',
      endedAt: '2026-07-08T09:50:00.000Z',
      exercises: [],
    });
    const sessions = await listSessions();
    expect(sessions.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('getLastWeight is null until set, then returns the latest logged value', async () => {
    const key = K('g3-s10', 'Prensa de Pecho');
    expect(await getLastWeight(key)).toBeNull();
    await setLastWeight(key, 32, '2026-07-06T09:10:00.000Z');
    await setLastWeight(key, 35, '2026-07-08T09:10:00.000Z');
    expect(await getLastWeight(key)).toMatchObject({ weight: 35 });
  });
});

/**
 * session-discard-and-history-delete (spec.md AC1, AC6–AC9, AC24).
 *
 * deleteSessions(ids) is the single batch-capable entry point behind BOTH the
 * active-session discard and Historial's per-entry / multi-select delete —
 * from the store's point of view they are the same operation. It must remove
 * the rows AND roll the lastWeights prefills back in ONE transaction over
 * ['sessions','lastWeights'], mirroring saveSession's single-write-path
 * invariant (db.js:67-75) so the two stores cannot drift.
 */
function logged(equipmentId, weightUsed, completedAt) {
  return { equipmentId, name: equipmentId, weightUsed, difficulty: 'normal', completedAt };
}

function pending(equipmentId) {
  return { equipmentId, name: equipmentId, weightUsed: null, difficulty: null, completedAt: null };
}

function sessionOf(id, startedAt, exercises, overrides = {}) {
  return {
    id,
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'completed',
    startedAt,
    endedAt: startedAt,
    exercises,
    ...overrides,
  };
}

describe('db — deleteSessions (discard + history delete)', () => {
  it('removes the session row so getActiveSession returns null (AC1)', async () => {
    const active = sessionOf('sess-active', '2026-08-03T09:00:00.000Z', [pending('g3-s10')], {
      status: 'active',
      endedAt: null,
    });
    await saveSession(active);
    expect(await getActiveSession()).not.toBeNull();

    await deleteSessions([active.id]);

    expect(await getActiveSession()).toBeNull();
    expect(await listSessions()).toEqual([]);
  });

  it('recomputes lastWeights to the most recent surviving entry (AC6)', async () => {
    // Two sessions logged g3-s10. Deleting the newer must roll the prefill
    // back to the older one's weight, not leave the deleted session's value.
    await saveSession(
      sessionOf('older', '2026-07-20T09:00:00.000Z', [logged('g3-s10', 30, '2026-07-20T09:10:00.000Z')])
    );
    await saveSession(
      sessionOf('newer', '2026-07-27T09:00:00.000Z', [logged('g3-s10', 40, '2026-07-27T09:10:00.000Z')])
    );
    expect(await getLastWeight(K('g3-s10'))).toMatchObject({ weight: 40 });

    await deleteSessions(['newer']);

    expect(await getLastWeight(K('g3-s10'))).toMatchObject({ weight: 30 });
  });

  it('removes the lastWeights record when no surviving session logged it (AC7)', async () => {
    await saveSession(
      sessionOf('only', '2026-07-27T09:00:00.000Z', [logged('g3-s10', 40, '2026-07-27T09:10:00.000Z')])
    );
    expect(await getLastWeight(K('g3-s10'))).toMatchObject({ weight: 40 });

    await deleteSessions(['only']);

    // Must be REMOVED, not zeroed — getLastWeight() returning null is what
    // stops ExerciseLogCard prefilling from deleted data (AC7).
    expect(await getLastWeight(K('g3-s10'))).toBeNull();
  });

  it('leaves lastWeights untouched for equipment not in the deleted sessions (AC8)', async () => {
    await saveSession(
      sessionOf('keep', '2026-07-20T09:00:00.000Z', [logged('g3-s20', 55, '2026-07-20T09:10:00.000Z')])
    );
    await saveSession(
      sessionOf('drop', '2026-07-27T09:00:00.000Z', [logged('g3-s10', 40, '2026-07-27T09:10:00.000Z')])
    );

    await deleteSessions(['drop']);

    // Scoped recompute, not a rebuild of the whole store.
    expect(await getLastWeight(K('g3-s20'))).toMatchObject({ weight: 55 });
    expect(await getLastWeight(K('g3-s10'))).toBeNull();
  });

  it('ignores exercises that were never logged when scoping the rollback (AC6/AC8)', async () => {
    // g3-s30 appears in the deleted session but was never completed, so it
    // never seeded a lastWeights value and must not be disturbed.
    await saveSession(
      sessionOf('seed', '2026-07-20T09:00:00.000Z', [logged('g3-s30', 25, '2026-07-20T09:10:00.000Z')])
    );
    await saveSession(sessionOf('drop', '2026-07-27T09:00:00.000Z', [pending('g3-s30')]));

    await deleteSessions(['drop']);

    expect(await getLastWeight(K('g3-s30'))).toMatchObject({ weight: 25 });
  });

  it('deletes N sessions and rolls back weights in a single call (AC9)', async () => {
    await saveSession(
      sessionOf('a', '2026-07-06T09:00:00.000Z', [logged('g3-s10', 20, '2026-07-06T09:10:00.000Z')])
    );
    await saveSession(
      sessionOf('b', '2026-07-13T09:00:00.000Z', [logged('g3-s10', 30, '2026-07-13T09:10:00.000Z')])
    );
    await saveSession(
      sessionOf('c', '2026-07-20T09:00:00.000Z', [logged('g3-s10', 40, '2026-07-20T09:10:00.000Z')])
    );

    // ONE call for all of them — never a per-id loop, which would open one
    // connection + one transaction each and leave partial-failure windows.
    await deleteSessions(['b', 'c']);

    expect((await listSessions()).map((s) => s.id)).toEqual(['a']);
    expect(await getLastWeight(K('g3-s10'))).toMatchObject({ weight: 20 });
  });

  it('recomputes from the most recent completedAt, not session start order (AC6)', async () => {
    // A session that STARTED earlier can hold a LATER completedAt. The
    // rollback winner is decided by completedAt, matching what saveSession
    // actually mirrors into lastWeights (db.js:85).
    await saveSession(
      sessionOf('early-start', '2026-07-20T08:00:00.000Z', [logged('g3-s10', 33, '2026-07-20T11:30:00.000Z')])
    );
    await saveSession(
      sessionOf('late-start', '2026-07-20T09:00:00.000Z', [logged('g3-s10', 31, '2026-07-20T09:30:00.000Z')])
    );
    await saveSession(
      sessionOf('drop', '2026-07-27T09:00:00.000Z', [logged('g3-s10', 45, '2026-07-27T09:10:00.000Z')])
    );

    await deleteSessions(['drop']);

    expect(await getLastWeight(K('g3-s10'))).toMatchObject({ weight: 33 });
  });

  it('is a no-op for ids that do not exist', async () => {
    await saveSession(
      sessionOf('real', '2026-07-20T09:00:00.000Z', [logged('g3-s10', 30, '2026-07-20T09:10:00.000Z')])
    );

    await deleteSessions(['ghost']);

    expect((await listSessions()).map((s) => s.id)).toEqual(['real']);
    expect(await getLastWeight(K('g3-s10'))).toMatchObject({ weight: 30 });
  });

  it('accepts an empty id list without touching anything', async () => {
    await saveSession(
      sessionOf('real', '2026-07-20T09:00:00.000Z', [logged('g3-s10', 30, '2026-07-20T09:10:00.000Z')])
    );

    await deleteSessions([]);

    expect((await listSessions()).map((s) => s.id)).toEqual(['real']);
    expect(await getLastWeight(K('g3-s10'))).toMatchObject({ weight: 30 });
  });

  it('does not alter FINISH/ABANDON semantics for surviving sessions (AC24)', async () => {
    await saveSession(
      sessionOf('completed', '2026-07-20T09:00:00.000Z', [logged('g3-s10', 30, '2026-07-20T09:10:00.000Z')], {
        status: 'completed',
      })
    );
    await saveSession(
      sessionOf('abandoned', '2026-07-21T09:00:00.000Z', [pending('g3-s20')], { status: 'abandoned' })
    );
    await saveSession(sessionOf('drop', '2026-07-22T09:00:00.000Z', [pending('g3-s30')]));

    await deleteSessions(['drop']);

    const survivors = await listSessions();
    expect(survivors.map((s) => s.status).sort()).toEqual(['abandoned', 'completed']);
  });
});

/**
 * exercise-level-tracking (spec.md AC1, AC4, AC6, AC8).
 *
 * `lastWeights` moves from keyPath `equipmentId` to keyPath `exerciseKey` at
 * DB_VERSION 2. The key is derived from (equipmentId, name) at write time —
 * nothing is stored in the session rows, so history splits by exercise
 * retroactively (AC7) with no backfill.
 */
function loggedEx(equipmentId, name, weightUsed, completedAt) {
  return { equipmentId, name, weightUsed, difficulty: 'normal', completedAt };
}

/** Opens the CURRENT database version without upgrading it. */
async function openCurrent() {
  const { openDB } = await import('idb');
  return openDB('basicfit-rutina');
}

async function allLastWeights() {
  const db = await openCurrent();
  try {
    return await db.getAll('lastWeights');
  } finally {
    db.close();
  }
}

describe('db — exercise-level keying (v2)', () => {
  const CHEST = { equipmentId: 'g3-s10', name: 'Prensa de Pecho' };
  const SHOULDER = { equipmentId: 'g3-s10', name: 'Press de Hombro' }; // SAME machine

  it('mirrors two exercises on one machine as two independent rows (AC1)', async () => {
    await saveSession(
      sessionOf('s1', '2026-08-01T09:00:00.000Z', [
        loggedEx(CHEST.equipmentId, CHEST.name, 32, '2026-08-01T09:10:00.000Z'),
        loggedEx(SHOULDER.equipmentId, SHOULDER.name, 24, '2026-08-01T09:20:00.000Z'),
      ])
    );

    // Before this feature the second write overwrote the first: one machine,
    // one row, one weight.
    expect(await getLastWeight(exerciseKey(CHEST))).toMatchObject({ weight: 32 });
    expect(await getLastWeight(exerciseKey(SHOULDER))).toMatchObject({ weight: 24 });
    expect(await allLastWeights()).toHaveLength(2);
  });

  it('logging the second exercise leaves the first exercise prefill untouched (AC1)', async () => {
    await saveSession(
      sessionOf('s1', '2026-08-01T09:00:00.000Z', [
        loggedEx(CHEST.equipmentId, CHEST.name, 32, '2026-08-01T09:10:00.000Z'),
      ])
    );
    await saveSession(
      sessionOf('s2', '2026-08-03T09:00:00.000Z', [
        loggedEx(SHOULDER.equipmentId, SHOULDER.name, 24, '2026-08-03T09:10:00.000Z'),
      ])
    );

    expect(await getLastWeight(exerciseKey(CHEST))).toMatchObject({ weight: 32 });
  });

  it('retains equipmentId and name as plain fields on the record', async () => {
    // Non-key fields, kept for debuggability and a future re-key (DD-001).
    await saveSession(
      sessionOf('s1', '2026-08-01T09:00:00.000Z', [
        loggedEx(CHEST.equipmentId, CHEST.name, 32, '2026-08-01T09:10:00.000Z'),
      ])
    );

    expect(await getLastWeight(exerciseKey(CHEST))).toMatchObject({
      exerciseKey: 'g3-s10::prensa-de-pecho',
      equipmentId: 'g3-s10',
      name: 'Prensa de Pecho',
      weight: 32,
    });
  });

  it('writes a row for a bodyweight exercise, keyed by name alone', async () => {
    await saveSession(
      sessionOf('s1', '2026-08-01T09:00:00.000Z', [
        loggedEx(null, 'Plancha', 0, '2026-08-01T09:10:00.000Z'),
      ])
    );

    expect(await getLastWeight('::plancha')).toMatchObject({ weight: 0 });
  });

  it('writes NO row for an exercise whose key is null (AC4)', async () => {
    // No equipmentId and no usable name — not trackable, so the mirror must
    // skip it rather than write an undefined-keyed row.
    await saveSession(
      sessionOf('s1', '2026-08-01T09:00:00.000Z', [
        loggedEx(null, '', 30, '2026-08-01T09:10:00.000Z'),
        loggedEx(CHEST.equipmentId, CHEST.name, 32, '2026-08-01T09:20:00.000Z'),
      ])
    );

    const rows = await allLastWeights();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ exerciseKey: 'g3-s10::prensa-de-pecho' });
  });

  it('rolls lastWeights back per exercise key, not per machine (AC8)', async () => {
    // Both exercises live on g3-s10. Deleting a session that logged only the
    // chest press must leave the shoulder press row exactly where it was.
    await saveSession(
      sessionOf('older', '2026-07-20T09:00:00.000Z', [
        loggedEx(CHEST.equipmentId, CHEST.name, 30, '2026-07-20T09:10:00.000Z'),
      ])
    );
    await saveSession(
      sessionOf('shoulder-only', '2026-07-25T09:00:00.000Z', [
        loggedEx(SHOULDER.equipmentId, SHOULDER.name, 24, '2026-07-25T09:10:00.000Z'),
      ])
    );
    await saveSession(
      sessionOf('newer', '2026-07-27T09:00:00.000Z', [
        loggedEx(CHEST.equipmentId, CHEST.name, 40, '2026-07-27T09:10:00.000Z'),
      ])
    );

    await deleteSessions(['newer']);

    // Chest press rolls back to its own previous value…
    expect(await getLastWeight(exerciseKey(CHEST))).toMatchObject({ weight: 30 });
    // …and the other exercise on the same machine is untouched.
    expect(await getLastWeight(exerciseKey(SHOULDER))).toMatchObject({ weight: 24 });
  });

  it('deletes the row when no surviving session logged that exercise (AC8)', async () => {
    await saveSession(
      sessionOf('only-chest', '2026-07-27T09:00:00.000Z', [
        loggedEx(CHEST.equipmentId, CHEST.name, 40, '2026-07-27T09:10:00.000Z'),
      ])
    );
    await saveSession(
      sessionOf('keep', '2026-07-27T10:00:00.000Z', [
        loggedEx(SHOULDER.equipmentId, SHOULDER.name, 24, '2026-07-27T10:10:00.000Z'),
      ])
    );

    await deleteSessions(['only-chest']);

    expect(await getLastWeight(exerciseKey(CHEST))).toBeNull();
    expect(await getLastWeight(exerciseKey(SHOULDER))).toMatchObject({ weight: 24 });
  });
});

describe('db — v1 to v2 migration (AC6)', () => {
  const V1_SESSION = {
    id: 'legacy',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'completed',
    startedAt: '2026-07-06T09:00:00.000Z',
    endedAt: '2026-07-06T09:50:00.000Z',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 32,
        difficulty: 'normal',
        completedAt: '2026-07-06T09:10:00.000Z',
      },
    ],
  };

  /** Recreates the shipped v1 schema and seeds it, as an existing device holds it. */
  async function seedV1() {
    const { openDB } = await import('idb');
    const db = await openDB('basicfit-rutina', 1, {
      upgrade(d) {
        d.createObjectStore('activeRutina', { keyPath: 'key' });
        const sessions = d.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('by-status', 'status');
        sessions.createIndex('by-startedAt', 'startedAt');
        d.createObjectStore('lastWeights', { keyPath: 'equipmentId' });
      },
    });
    await db.put('activeRutina', { key: 'current', rutina: RUTINA, importedAt: '2026-07-01T00:00:00.000Z' });
    await db.put('sessions', V1_SESSION);
    await db.put('lastWeights', { equipmentId: 'g3-s10', weight: 32, loggedAt: '2026-07-06T09:10:00.000Z' });
    db.close();
  }

  it('upgrades without error and keeps sessions and activeRutina intact', async () => {
    await seedV1();

    // Any db.js call opens at DB_VERSION 2 and runs the upgrade.
    const sessions = await listSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual(V1_SESSION);
    expect((await getActiveRutina()).rutina).toEqual(RUTINA);
  });

  it('leaves lastWeights empty — old rows are unmigratable and are not re-seeded', async () => {
    await seedV1();
    await listSessions(); // triggers the upgrade

    // A v1 row is keyed by equipmentId alone and carries no name, so no
    // exercise key can be derived from it. Prefill self-heals after one
    // workout per exercise (DD-002).
    expect(await allLastWeights()).toEqual([]);
    expect(await getLastWeight('g3-s10')).toBeNull();
    expect(await getLastWeight('g3-s10::prensa-de-pecho')).toBeNull();
  });

  it('recreates the store with keyPath exerciseKey', async () => {
    await seedV1();
    await listSessions();

    const db = await openCurrent();
    try {
      expect(db.version).toBe(2);
      expect(db.transaction('lastWeights').store.keyPath).toBe('exerciseKey');
    } finally {
      db.close();
    }
  });

  it('a post-upgrade session repopulates lastWeights under the new key (AC6 + AC7)', async () => {
    await seedV1();
    await saveSession({
      ...V1_SESSION,
      id: 'post-upgrade',
      startedAt: '2026-08-08T09:00:00.000Z',
      endedAt: '2026-08-08T09:50:00.000Z',
      exercises: [
        {
          equipmentId: 'g3-s10',
          name: 'Prensa de Pecho',
          weightUsed: 34,
          difficulty: 'normal',
          completedAt: '2026-08-08T09:10:00.000Z',
        },
      ],
    });

    expect(await getLastWeight('g3-s10::prensa-de-pecho')).toMatchObject({ weight: 34 });
    // The legacy session is still there and still readable.
    expect((await listSessions()).map((s) => s.id).sort()).toEqual(['legacy', 'post-upgrade']);
  });
});
