import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  saveRutinaEntry,
  activateRutina,
  saveSession,
  getActiveRutina,
  getLastWeight,
  readAllForBackup,
  restoreFromBackup,
} from './db.js';

/**
 * full-data-backup — db.js bulk read + ATOMIC bulk-replace (tech-plan.md
 * AD-2). readAllForBackup is a pure read over one readonly tx; restoreFromBackup
 * clears+rewrites all four stores in ONE readwrite tx and recomputes lastWeights
 * from the restored sessions (AC8). A mid-restore failure must leave the prior
 * DB fully intact (AC9).
 *
 * Red-first: fails until Cmok adds readAllForBackup + restoreFromBackup to db.js.
 */

function resetDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('basicfit-rutina');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
beforeEach(async () => { await resetDb(); });

const RUTINA = (name) => ({ schemaVersion: 1, program: { name }, days: [{ label: 'Lunes', exercises: [] }] });

const sess = (id, over = {}) => ({
  id,
  status: 'completed',
  startedAt: over.startedAt ?? `2026-07-0${id.slice(-1)}T09:00:00.000Z`,
  endedAt: `2026-07-0${id.slice(-1)}T09:50:00.000Z`,
  dayIndex: 0,
  rutinaId: over.rutinaId ?? 'lib-1',
  exercises: over.exercises ?? [
    { equipmentId: 'chest-press', name: 'Chest Press', weightUsed: 40, difficulty: 'ok', completedAt: `2026-07-0${id.slice(-1)}T09:20:00.000Z` },
  ],
});

async function seedPopulated() {
  const a = await saveRutinaEntry(RUTINA('Phase 1'));
  const b = await saveRutinaEntry(RUTINA('Phase 2'));
  await activateRutina(a.id);
  await saveSession(sess('s1'));
  await saveSession(sess('s2', { exercises: [{ equipmentId: 'chest-press', name: 'Chest Press', weightUsed: 50, difficulty: 'ok', completedAt: '2026-07-09T09:20:00.000Z' }] }));
  return { a, b };
}

describe('readAllForBackup (AC1, AC3, AC5)', () => {
  it('empty DB → all stores empty, activeRutinaId null (AC3)', async () => {
    const data = await readAllForBackup();
    expect(data).toEqual({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] });
  });

  it('populated DB → every store, rutinas seq-sorted, activeRutinaId from the pointer (AC1)', async () => {
    const { a } = await seedPopulated();
    const data = await readAllForBackup();

    expect(data.rutinas.map((r) => r.rutina.program.name)).toEqual(['Phase 1', 'Phase 2']);
    expect(data.activeRutinaId).toBe(a.id);
    expect(data.sessions.map((s) => s.id).sort()).toEqual(['s1', 's2']);
    expect(data.lastWeights.length).toBe(1); // chest-press, latest logged
    expect(data.lastWeights[0].weight).toBe(50);
  });

  it('is a pure read — called twice, DB unchanged, results equal (AC5)', async () => {
    await seedPopulated();
    const first = await readAllForBackup();
    const second = await readAllForBackup();
    expect(second).toEqual(first);
  });

  it('completes for a 500-session history (AC6 — scales, no throw)', async () => {
    await saveRutinaEntry(RUTINA('Big'));
    for (let i = 0; i < 500; i++) {
      await saveSession({ id: `b${i}`, status: 'completed', startedAt: '2026-07-01T09:00:00.000Z', endedAt: '2026-07-01T09:50:00.000Z', dayIndex: 0, rutinaId: 'x', exercises: [] });
    }
    const data = await readAllForBackup();
    expect(data.sessions).toHaveLength(500);
  });
});

describe('restoreFromBackup — round-trip fidelity (AC7)', () => {
  it('export → wipe → restore reproduces rutinas, active pointer, sessions', async () => {
    const { a } = await seedPopulated();
    const exported = await readAllForBackup();

    await resetDb();
    expect(await readAllForBackup()).toEqual({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] });

    await restoreFromBackup(exported);
    const back = await readAllForBackup();

    expect(back.rutinas).toEqual(exported.rutinas);
    expect(back.activeRutinaId).toBe(a.id);
    expect(back.sessions.map((s) => s.id).sort()).toEqual(['s1', 's2']);

    const active = await getActiveRutina();
    expect(active.rutina.program.name).toBe('Phase 1');
  });

  it('restoring an EMPTY snapshot onto a populated DB clears everything (AC7)', async () => {
    await seedPopulated();
    await restoreFromBackup({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] });
    expect(await readAllForBackup()).toEqual({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] });
    expect(await getActiveRutina()).toBeNull();
  });

  it('ignores the file lastWeights and recomputes from the restored sessions (AC8)', async () => {
    const data = {
      rutinas: [],
      activeRutinaId: null,
      sessions: [
        { id: 'x1', status: 'completed', startedAt: '2026-07-01T09:00:00.000Z', endedAt: '2026-07-01T10:00:00.000Z', dayIndex: 0, rutinaId: 'r', exercises: [
          { equipmentId: 'leg-press', name: 'Leg Press', weightUsed: 120, difficulty: 'ok', completedAt: '2026-07-01T09:30:00.000Z' },
        ] },
      ],
      // deliberately WRONG — not justified by any session
      lastWeights: [
        { exerciseKey: 'ghost::ghost', weight: 999, loggedAt: '2030-01-01T00:00:00.000Z', equipmentId: 'ghost', name: 'Ghost' },
        { exerciseKey: 'leg-press::leg-press', weight: 500, loggedAt: '2030-01-01T00:00:00.000Z', equipmentId: 'leg-press', name: 'Leg Press' },
      ],
    };
    await restoreFromBackup(data);

    expect(await getLastWeight('ghost::ghost')).toBeNull();
    const legPress = await getLastWeight('leg-press::leg-press');
    expect(legPress.weight).toBe(120); // from the session, not the file's 500
    const all = await readAllForBackup();
    expect(all.lastWeights).toHaveLength(1);
  });
});

describe('restoreFromBackup — atomicity (AC9)', () => {
  it('a mid-restore failure leaves the previous DB fully intact', async () => {
    const { a } = await seedPopulated();
    const before = await readAllForBackup();

    const poisoned = {
      rutinas: [{ id: 'newlib', seq: 1, importedAt: '2026-08-01T00:00:00.000Z', rutina: RUTINA('Restored') }],
      activeRutinaId: 'newlib',
      sessions: [
        { id: 'ok', status: 'completed', startedAt: '2026-08-01T09:00:00.000Z', endedAt: '2026-08-01T10:00:00.000Z', dayIndex: 0, rutinaId: 'newlib', exercises: [] },
        // non-cloneable → IndexedDB put throws DataCloneError mid-transaction
        { id: 'bad', status: 'completed', startedAt: '2026-08-02T09:00:00.000Z', notCloneable: () => {}, exercises: [] },
      ],
      lastWeights: [],
    };

    await expect(restoreFromBackup(poisoned)).rejects.toBeTruthy();

    const after = await readAllForBackup();
    expect(after).toEqual(before);            // nothing half-applied
    expect(after.activeRutinaId).toBe(a.id);  // still the original active entry
    const active = await getActiveRutina();
    expect(active.rutina.program.name).toBe('Phase 1');
  });
});
