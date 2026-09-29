import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  putReport,
  getReport,
  listReports,
  deleteReports,
  hasClubExclusionsRecord,
  setClubExclusions,
  readAllForBackup,
  saveSession,
} from './db.js';

/**
 * club-equipment-reporting AC7 (tech-plan.md §2 D5/D6) — the local report
 * outbox lives in IndexedDB (`reportOutbox`, DB_VERSION 5), keyed by the
 * natural (club, equipment) key so a re-tap REPLACES the pending report
 * instead of growing the queue. `hasClubExclusionsRecord` exists because
 * `getClubExclusions` returns [] for BOTH "no record" and "empty record",
 * and AC12's seeding must tell them apart.
 */

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

const rec = (over = {}) => ({
  key: 'club-a|g3-s10',
  reportId: 'rid-1',
  clubId: 'club-a',
  equipmentId: 'g3-s10',
  signal: 'absent',
  method: 'session',
  reportedAt: '2026-09-29T10:00:00.000Z',
  origin: 'explicit',
  ...over,
});

describe('reportOutbox store', () => {
  it('round-trips a record by key', async () => {
    expect(await getReport('club-a|g3-s10')).toBeNull();
    await putReport(rec());
    expect(await getReport('club-a|g3-s10')).toEqual(rec());
  });

  it('put on the same key REPLACES (last write wins) — the queue cannot grow per re-tap', async () => {
    await putReport(rec());
    await putReport(rec({ reportId: 'rid-2', signal: 'present' }));
    const all = await listReports();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ reportId: 'rid-2', signal: 'present' });
  });

  it('lists oldest first by reportedAt', async () => {
    await putReport(rec({ key: 'club-a|b', equipmentId: 'b', reportId: 'r-b', reportedAt: '2026-09-29T12:00:00.000Z' }));
    await putReport(rec({ key: 'club-a|a', equipmentId: 'a', reportId: 'r-a', reportedAt: '2026-09-29T09:00:00.000Z' }));
    expect((await listReports()).map((r) => r.reportId)).toEqual(['r-a', 'r-b']);
  });

  it('deleteReports removes only records whose stored reportId still matches (a report replaced mid-flight survives)', async () => {
    await putReport(rec({ reportId: 'sent-id' }));
    await putReport(rec({ reportId: 'newer-id', signal: 'present' })); // user flipped while the send was in flight
    await deleteReports([rec({ reportId: 'sent-id' })]);
    expect((await listReports()).map((r) => r.reportId)).toEqual(['newer-id']);

    await deleteReports([rec({ reportId: 'newer-id' })]);
    expect(await listReports()).toEqual([]);
  });

  it('deleteReports on an already-missing record is a no-op, not an error', async () => {
    await expect(deleteReports([rec()])).resolves.not.toThrow();
  });
});

describe('DB_VERSION 5 upgrade', () => {
  it('creates the reportOutbox store (keyPath key) on a fresh install and on upgrade from v4, keeping v4 data', async () => {
    // seed a v4 database with a session, then let db.js upgrade it
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('basicfit-rutina', 4);
      open.onupgradeneeded = () => {
        const d = open.result;
        d.createObjectStore('activeRutina', { keyPath: 'key' });
        const s = d.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('by-status', 'status');
        s.createIndex('by-startedAt', 'startedAt');
        d.createObjectStore('lastWeights', { keyPath: 'exerciseKey' });
        d.createObjectStore('clubEquipment', { keyPath: 'clubId' });
        d.createObjectStore('rutinas', { keyPath: 'id' });
      };
      open.onsuccess = () => {
        const tx = open.result.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').put({ id: 'keep-me', status: 'completed', startedAt: '2026-09-01T00:00:00.000Z', exercises: [] });
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });

    expect(await listReports()).toEqual([]); // any db.js call runs the upgrade

    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('basicfit-rutina');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      expect(db.version).toBe(5);
      expect(db.objectStoreNames.contains('reportOutbox')).toBe(true);
      expect(db.transaction('reportOutbox').objectStore('reportOutbox').keyPath).toBe('key');
      const got = await new Promise((resolve, reject) => {
        const r = db.transaction('sessions').objectStore('sessions').get('keep-me');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      expect(got).toMatchObject({ id: 'keep-me' });
    } finally {
      db.close();
    }
  });
});

describe('outbox stays out of the backup/sync payload (integration-plan Phase 1 step 4)', () => {
  it('readAllForBackup has exactly the four user-data keys and none of the outbox', async () => {
    await putReport(rec());
    await saveSession({ id: 's1', status: 'completed', startedAt: '2026-09-29T09:00:00.000Z', exercises: [] });
    const backup = await readAllForBackup();
    expect(Object.keys(backup).sort()).toEqual(['activeRutinaId', 'lastWeights', 'rutinas', 'sessions']);
    expect(JSON.stringify(backup)).not.toContain('club-a|g3-s10');
  });
});

describe('hasClubExclusionsRecord (AC12 seeding gate)', () => {
  it('is false for a club that has never been written', async () => {
    expect(await hasClubExclusionsRecord('club-x')).toBe(false);
  });

  it('is true once a record exists — even an EMPTY one (the user re-included everything)', async () => {
    await setClubExclusions('club-x', []);
    expect(await hasClubExclusionsRecord('club-x')).toBe(true);
  });

  it('is scoped per club', async () => {
    await setClubExclusions('club-x', ['g3-s10']);
    expect(await hasClubExclusionsRecord('club-y')).toBe(false);
  });
});
