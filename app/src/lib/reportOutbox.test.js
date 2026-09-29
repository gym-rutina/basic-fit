import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { enqueueReport, enqueueImplicitPresent, listPendingReports } from './reportOutbox.js';
import { listReports, getReport } from './db.js';

/**
 * club-equipment-reporting AC2/AC3/AC5/AC6/AC7/AC8/AC18 (tech-plan.md §2
 * D5–D7). Real fake-indexeddb underneath; the module's contract:
 *
 * - every function is async and NEVER throws (AC7/AC8 — a persistence or
 *   validation failure is swallowed, the caller's local effect is untouched);
 * - (club, equipment) is the natural key, last explicit signal wins;
 * - an IMPLICIT present (exercise completed, AC3) never overrides or
 *   duplicates anything already pending for that key — explicit wins;
 * - what leaves the device is exactly the six wire fields (AC6/AC18).
 */

const CLUB = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ids = (() => {
  let n = 0;
  return () => `rid-${++n}`;
})();
const deps = { now: () => '2026-09-29T10:00:00.000Z', newId: ids };

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

const payload = (over = {}) => ({ clubId: CLUB, equipmentId: 'g3-s10', signal: 'absent', method: 'session', ...over });

describe('enqueueReport (explicit — AC2, AC5)', () => {
  it('stores one pending report and exposes it in exact wire shape', async () => {
    await enqueueReport(payload(), deps);
    const pending = await listPendingReports();
    expect(pending).toHaveLength(1);
    expect(Object.keys(pending[0]).sort()).toEqual(['clubId', 'equipmentId', 'method', 'reportId', 'reportedAt', 'signal']);
    expect(pending[0]).toMatchObject({ clubId: CLUB, equipmentId: 'g3-s10', signal: 'absent', method: 'session' });
  });

  it('last explicit signal wins for the same (club, equipment): absent then present → ONE report, present, new id', async () => {
    await enqueueReport(payload(), deps);
    const firstId = (await listPendingReports())[0].reportId;
    await enqueueReport(payload({ signal: 'present', method: 'catalog' }), deps);
    const pending = await listPendingReports();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ signal: 'present', method: 'catalog' });
    expect(pending[0].reportId).not.toBe(firstId);
  });

  it('keeps different equipment / different clubs as separate reports', async () => {
    await enqueueReport(payload(), deps);
    await enqueueReport(payload({ equipmentId: 'g3-s30' }), deps);
    await enqueueReport(payload({ clubId: 'b'.repeat(32) }), deps);
    expect(await listPendingReports()).toHaveLength(3);
  });

  it('is bounded: 100 re-taps of one machine leave exactly one record', async () => {
    for (let i = 0; i < 100; i += 1) {
      await enqueueReport(payload({ signal: i % 2 ? 'present' : 'absent', method: 'catalog' }), deps);
    }
    expect(await listReports()).toHaveLength(1);
  });

  it('never stores anything outside the payload contract — notes/weight/difficulty cannot reach IndexedDB (AC18)', async () => {
    await enqueueReport({ ...payload(), notes: 'sin polea', weightUsed: 42, difficulty: 'hard' }, deps);
    const raw = JSON.stringify(await listReports());
    expect(raw).not.toMatch(/sin polea|weightUsed|difficulty|notes/);
  });

  it('ignores an invalid payload silently (no record, no throw)', async () => {
    await expect(enqueueReport(payload({ signal: 'maybe' }), deps)).resolves.not.toThrow();
    await expect(enqueueReport(undefined, deps)).resolves.not.toThrow();
    expect(await listReports()).toEqual([]);
  });

  it('swallows a storage failure — the caller is never blocked (AC7/AC8)', async () => {
    const broken = {
      ...deps,
      db: {
        putReport: () => {
          throw new Error('IDB exploded');
        },
        getReport: () => Promise.reject(new Error('IDB exploded')),
        listReports: () => Promise.reject(new Error('IDB exploded')),
      },
    };
    await expect(enqueueReport(payload(), broken)).resolves.not.toThrow();
    await expect(enqueueImplicitPresent({ clubId: CLUB, equipmentId: 'g3-s10' }, broken)).resolves.not.toThrow();
    await expect(listPendingReports(broken)).resolves.toEqual([]);
  });
});

describe('enqueueImplicitPresent (AC3 — exercise completed)', () => {
  it('enqueues a present/session report when nothing is pending for the key', async () => {
    await enqueueImplicitPresent({ clubId: CLUB, equipmentId: 'g3-s10' }, deps);
    const pending = await listPendingReports();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ signal: 'present', method: 'session', clubId: CLUB, equipmentId: 'g3-s10' });
  });

  it('is idempotent: a second implicit present for the same key adds nothing', async () => {
    await enqueueImplicitPresent({ clubId: CLUB, equipmentId: 'g3-s10' }, deps);
    const id = (await listPendingReports())[0].reportId;
    await enqueueImplicitPresent({ clubId: CLUB, equipmentId: 'g3-s10' }, deps);
    const pending = await listPendingReports();
    expect(pending).toHaveLength(1);
    expect(pending[0].reportId).toBe(id);
  });

  it('never overrides a pending EXPLICIT absent — explicit beats implicit', async () => {
    await enqueueReport(payload({ signal: 'absent', method: 'session' }), deps);
    await enqueueImplicitPresent({ clubId: CLUB, equipmentId: 'g3-s10' }, deps);
    const pending = await listPendingReports();
    expect(pending).toHaveLength(1);
    expect(pending[0].signal).toBe('absent');
  });

  it('a later explicit report replaces a pending implicit one', async () => {
    await enqueueImplicitPresent({ clubId: CLUB, equipmentId: 'g3-s10' }, deps);
    await enqueueReport(payload({ signal: 'absent', method: 'catalog' }), deps);
    const pending = await listPendingReports();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ signal: 'absent', method: 'catalog' });
  });

  it('keeps the local-only origin marker out of the wire shape but in the stored record', async () => {
    await enqueueImplicitPresent({ clubId: CLUB, equipmentId: 'g3-s10' }, deps);
    const stored = (await listReports())[0];
    expect(stored.origin).toBe('implicit');
    expect(Object.keys((await listPendingReports())[0])).not.toContain('origin');
    expect(await getReport(stored.key)).toMatchObject({ origin: 'implicit' });
  });

  it('rejects unusable input silently', async () => {
    await expect(enqueueImplicitPresent({ clubId: '', equipmentId: 'g3-s10' }, deps)).resolves.not.toThrow();
    expect(await listReports()).toEqual([]);
  });
});
