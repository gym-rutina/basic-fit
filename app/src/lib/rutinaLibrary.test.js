import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import {
  listRutinas,
  saveRutinaEntry,
  activateRutina,
  getActiveEntry,
  deleteRutina,
  deleteAndActivateRutina,
  saveSession,
  listSessions,
  getLastWeight,
  setLastWeight,
} from './db.js';
import { exerciseKey } from './exerciseKey.js';

const K = (equipmentId, name = equipmentId) => exerciseKey({ equipmentId, name });

/** Same harness pattern as db.test.js: fake-indexeddb persists across tests
 *  within this file's worker, and every assertion below pins exact entry
 *  counts — so each test must start from a deleted database. */
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

/**
 * multi-rutina-library — the library API + v3→v4 migration.
 *
 * Storage shape (tech-plan.md D-A): NEW `rutinas` store keyed by generated id;
 * `activeRutina` store REPURPOSED as a one-row pointer `{key:'current',
 * rutinaId}` so activation is a single-write atomic operation (AC2);
 * `lastWeights` UNTOUCHED (spec D2). Migration backfills attribution
 * snapshots onto legacy sessions (OQ-6) and preserves the original
 * `importedAt` (AC4).
 *
 * RED until Cmok implements the store + API.
 */
const V3_RUTINA = {
  schemaVersion: 1,
  program: { name: 'Hipertrofia', phaseName: 'Fuerza', phaseNumber: 1, durationWeeks: 6, lastUpdated: '2026-01-01' },
  days: [{ label: 'Día A', exercises: [{ equipmentId: 'g3-s10', name: 'Prensa', sets: 3, reps: 10 }] }],
};

function makeSession(id, startedAt, overrides = {}) {
  return {
    id,
    dayLabel: 'Día A',
    dayIndex: 0,
    status: 'completed',
    startedAt,
    endedAt: startedAt,
    exercises: [],
    ...overrides,
  };
}

/** Seeds a genuine VERSION-3 database with old-shape data, then closes it —
 *  the next db.js call opens at 4 and runs the real upgrade path. */
async function seedV3({ withCurrent = true, sessions = [] } = {}) {
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('basicfit-rutina');
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  const db = await openDB('basicfit-rutina', 3, {
    upgrade(d) {
      d.createObjectStore('activeRutina', { keyPath: 'key' });
      const s = d.createObjectStore('sessions', { keyPath: 'id' });
      s.createIndex('by-status', 'status');
      s.createIndex('by-startedAt', 'startedAt');
      d.createObjectStore('lastWeights', { keyPath: 'exerciseKey' });
      d.createObjectStore('clubEquipment', { keyPath: 'clubId' });
    },
  });
  if (withCurrent) {
    await db.put('activeRutina', { key: 'current', rutina: V3_RUTINA, importedAt: '2026-01-01T00:00:00.000Z' });
  }
  for (const s of sessions) await db.put('sessions', s);
  db.close();
}

describe('rutina library (multi-rutina-library)', () => {
  it('saveRutinaEntry adds an entry WITHOUT touching existing ones (AC1)', async () => {
    const first = await saveRutinaEntry(V3_RUTINA);
    const second = await saveRutinaEntry(V3_RUTINA);

    const all = await listRutinas();
    expect(all).toHaveLength(2);
    expect(all.map((e) => e.id)).toEqual([first.id, second.id]);
    expect(first.id).not.toBe(second.id);
  });

  it('entries carry id/rutina/importedAt; id stable across activate cycles (AC3)', async () => {
    const entry = await saveRutinaEntry(V3_RUTINA);
    expect(entry.importedAt).toBeTruthy();

    await activateRutina(entry.id);
    await saveRutinaEntry(V3_RUTINA); // another entry appears; pointer unmoved unless activated
    await activateRutina(entry.id);

    const again = (await listRutinas()).find((e) => e.id === entry.id);
    expect(again.id).toBe(entry.id);
    expect(again.rutina.program.name).toBe('Hipertrofia');
  });

  it('activation flips ONE pointer — exactly one active at any observable time (AC2)', async () => {
    const a = await saveRutinaEntry(V3_RUTINA);
    const b = await saveRutinaEntry(V3_RUTINA);

    await activateRutina(a.id);
    expect((await getActiveEntry()).id).toBe(a.id);

    await activateRutina(b.id);
    const active = await getActiveEntry();
    expect(active.id).toBe(b.id);

    // No field-on-entry residue: entries themselves carry no active flag.
    const entries = await listRutinas();
    expect(entries.every((e) => e.active === undefined)).toBe(true);
  });

  it('deleteRutina removes only its entry and leaves SESSIONS intact (AC13, AC6)', async () => {
    const a = await saveRutinaEntry(V3_RUTINA);
    const b = await saveRutinaEntry(V3_RUTINA);
    await activateRutina(a.id);
    await saveSession(makeSession('s1', '2026-02-01T09:00:00.000Z', { rutinaId: b.id }));

    await deleteRutina(b.id);

    expect((await listRutinas()).map((e) => e.id)).toEqual([a.id]);
    expect((await getActiveEntry()).id).toBe(a.id); // pointer unchanged (AC6)
    const sessions = await listSessions();
    expect(sessions.map((s) => s.id)).toEqual(['s1']); // AC13
  });

  it('deleteAndActivateRutina swaps pointer and deletes in one operation (AC7 atomicity)', async () => {
    const a = await saveRutinaEntry(V3_RUTINA);
    const b = await saveRutinaEntry(V3_RUTINA);
    await activateRutina(a.id);

    await deleteAndActivateRutina(a.id, b.id);

    expect((await listRutinas()).map((e) => e.id)).toEqual([b.id]);
    expect((await getActiveEntry()).id).toBe(b.id);
  });

  it('lastWeights rows are byte-stable across activations (AC21 / spec D2)', async () => {
    const a = await saveRutinaEntry(V3_RUTINA);
    const b = await saveRutinaEntry(V3_RUTINA);
    await setLastWeight(K('g3-s10'), 45, '2026-02-01T09:00:00.000Z');

    await activateRutina(b.id);

    expect(await getLastWeight(K('g3-s10'))).toMatchObject({ weight: 45 });
  });

  describe('v3→v4 migration (AC4, AC12-backfill, AC14)', () => {
    it('migrates activeRutina.current into an active library entry, preserving importedAt', async () => {
      await seedV3();

      const entry = await getActiveEntry();

      expect(entry).not.toBeNull();
      expect(entry.rutina.program.name).toBe('Hipertrofia');
      expect(entry.importedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(typeof entry.id).toBe('string');
      // Old value shape replaced by the pointer:
      const all = await listRutinas();
      expect(all).toHaveLength(1);
    });

    it('is IDEMPOTENT — reopening never duplicates or re-migrates', async () => {
      await seedV3();
      await listRutinas(); // first v4 open runs migration
      await listRutinas(); // second open must be a no-op

      expect(await listRutinas()).toHaveLength(1);
    });

    it('backfills rutinaId + attribution snapshot onto legacy sessions (OQ-6/AC14)', async () => {
      await seedV3({
        sessions: [makeSession('legacy1', '2026-01-15T09:00:00.000Z')],
      });

      const entry = await getActiveEntry();
      const [s] = await listSessions();

      expect(s.rutinaId).toBe(entry.id);
      expect(s.rutinaName).toBe('Hipertrofia');
      expect(s.phaseName).toBe('Fuerza');
      expect(s.phaseNumber).toBe(1);
    });

    it('no current record ⇒ nothing migrated; sessions stay orphaned for the desconocido path', async () => {
      await seedV3({ withCurrent: false, sessions: [makeSession('orphan', '2026-01-15T09:00:00.000Z')] });

      expect(await getActiveEntry()).toBeNull();
      const [s] = await listSessions();
      expect(s.rutinaId).toBeUndefined();
    });
  });
});
