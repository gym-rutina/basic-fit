import { describe, it, expect } from 'vitest';
import {
  CURRENT_FORMAT_VERSION,
  buildBackup,
  parseBackup,
  reconcileLastWeights,
} from './backupFormat.js';

/**
 * full-data-backup — the isomorphic, PURE format layer (tech-plan.md AD-1/AD-8).
 * No IndexedDB, no localStorage, no DOM here — buildBackup takes plain data in
 * and returns the envelope; parseBackup takes text + an injected rutina
 * validator. This is the module the future backend reuses verbatim (spec D4).
 *
 * Red-first: fails until Cmok writes app/src/lib/backupFormat.js +
 * data/schema/backup.schema.json.
 */

// A minimal valid library entry (shape from db.js `rutinas` store).
const entry = (id, seq, name = `Prog ${id}`) => ({
  id,
  seq,
  importedAt: `2026-0${seq}-01T00:00:00.000Z`,
  rutina: { schemaVersion: 1, program: { name }, days: [{ label: 'Lunes', exercises: [] }] },
});

const session = (over = {}) => ({
  id: over.id ?? 'sess-1',
  status: over.status ?? 'completed',
  startedAt: over.startedAt ?? '2026-07-01T09:00:00.000Z',
  endedAt: over.endedAt ?? '2026-07-01T09:50:00.000Z',
  dayIndex: 0,
  rutinaId: over.rutinaId ?? 'r1',
  exercises: over.exercises ?? [],
});

const ex = (over = {}) => ({
  equipmentId: over.equipmentId ?? 'chest-press',
  name: over.name ?? 'Chest Press',
  weightUsed: 'weightUsed' in over ? over.weightUsed : 40,
  difficulty: over.difficulty ?? 'ok',
  completedAt: 'completedAt' in over ? over.completedAt : '2026-07-01T09:20:00.000Z',
});

const dbState = (over = {}) => ({
  rutinas: over.rutinas ?? [entry('r1', 1), entry('r2', 2)],
  activeRutinaId: 'activeRutinaId' in over ? over.activeRutinaId : 'r1',
  sessions: over.sessions ?? [session()],
  lastWeights: over.lastWeights ?? [
    { exerciseKey: 'chest-press::chest-press', weight: 40, loggedAt: '2026-07-01T09:20:00.000Z', equipmentId: 'chest-press', name: 'Chest Press' },
  ],
});

/** stub validator with the validateImportedRutina return shape */
const okValidator = () => ({ valid: true, errors: [] });
const failValidator = (msg) => () => ({ valid: false, errors: [msg, 'second error ignored'] });

describe('backupFormat.buildBackup — envelope shape (AC1, AC2)', () => {
  it('includes formatVersion, appVersion, exportedAt and the full data block', () => {
    const env = buildBackup({ db: dbState(), settings: { 'rutina:uiLang': 'es' }, appVersion: '1.17.1' });

    expect(env.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(env.formatVersion).toBe(1);
    expect(env.appVersion).toBe('1.17.1');
    expect(typeof env.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(env.exportedAt))).toBe(false);

    expect(env.data).toMatchObject({
      rutinas: expect.any(Array),
      activeRutinaId: 'r1',
      sessions: expect.any(Array),
      lastWeights: expect.any(Array),
      settings: { 'rutina:uiLang': 'es' },
    });
    expect(env.data.rutinas).toHaveLength(2);
  });

  it('empty state → valid envelope with empty arrays and activeRutinaId null (AC3)', () => {
    const env = buildBackup({
      db: { rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] },
      settings: {},
      appVersion: '1.17.1',
    });
    expect(env.data.rutinas).toEqual([]);
    expect(env.data.sessions).toEqual([]);
    expect(env.data.lastWeights).toEqual([]);
    expect(env.data.activeRutinaId).toBeNull();
    // and it must round-trip
    const parsed = parseBackup(JSON.stringify(env), okValidator);
    expect(parsed.ok).toBe(true);
  });

  it('does not mutate its input; two calls are equal except exportedAt (AC5)', () => {
    const db = dbState();
    const snapshot = structuredClone(db);
    const a = buildBackup({ db, settings: { x: '1' }, appVersion: '1.0.0' });
    const b = buildBackup({ db, settings: { x: '1' }, appVersion: '1.0.0' });

    expect(db).toEqual(snapshot); // input untouched
    delete a.exportedAt;
    delete b.exportedAt;
    expect(a).toEqual(b);
  });

  it('settings block carries only what it was given — no key invented (AC14)', () => {
    const env = buildBackup({ db: dbState(), settings: { 'rutina:club': '{"clubId":"x"}' }, appVersion: '1' });
    expect(Object.keys(env.data.settings)).toEqual(['rutina:club']);
    expect(env.data.settings).not.toHaveProperty('rutina:session');
  });
});

describe('backupFormat.parseBackup — happy path (AC7)', () => {
  it('round-trips a buildBackup output', () => {
    const env = buildBackup({ db: dbState(), settings: { 'rutina:uiLang': 'es' }, appVersion: '1.17.1' });
    const res = parseBackup(JSON.stringify(env), okValidator);
    expect(res.ok).toBe(true);
    expect(res.envelope.data).toEqual(env.data);
  });

  it('runs EVERY rutina through the injected validator (AC11)', () => {
    const seen = [];
    const spyValidator = (r) => { seen.push(r.program.name); return { valid: true, errors: [] }; };
    const env = buildBackup({ db: dbState({ rutinas: [entry('r1', 1, 'A'), entry('r2', 2, 'B')] }), settings: {}, appVersion: '1' });
    parseBackup(JSON.stringify(env), spyValidator);
    expect(seen).toEqual(['A', 'B']);
  });

  it('unknown top-level field on a known formatVersion is ignored, not fatal (AC10)', () => {
    const env = buildBackup({ db: dbState(), settings: {}, appVersion: '1' });
    const withExtra = { ...env, somethingFromTheFuture: { nested: true } };
    const res = parseBackup(JSON.stringify(withExtra), okValidator);
    expect(res.ok).toBe(true);
  });
});

describe('backupFormat.parseBackup — rejection matrix (AC10, AC11)', () => {
  it('non-JSON → invalid-json, nothing else', () => {
    const res = parseBackup('{ not json', okValidator);
    expect(res).toEqual({ ok: false, error: { kind: 'invalid-json' } });
  });

  it('valid JSON but missing data / wrong types → invalid-schema', () => {
    expect(parseBackup(JSON.stringify({ formatVersion: 1, appVersion: '1', exportedAt: 'x' }), okValidator))
      .toMatchObject({ ok: false, error: { kind: 'invalid-schema' } });
    expect(parseBackup(JSON.stringify({ formatVersion: 1, appVersion: '1', exportedAt: 'x', data: { rutinas: 'nope', activeRutinaId: null, sessions: [], lastWeights: [], settings: {} } }), okValidator))
      .toMatchObject({ ok: false, error: { kind: 'invalid-schema' } });
  });

  it('formatVersion is not an integer → invalid-schema', () => {
    const res = parseBackup(JSON.stringify({ formatVersion: '1', appVersion: '1', exportedAt: 'x', data: {} }), okValidator);
    expect(res).toMatchObject({ ok: false, error: { kind: 'invalid-schema' } });
  });

  it('formatVersion higher than the app understands → newer-version (AC10)', () => {
    const env = buildBackup({ db: dbState(), settings: {}, appVersion: '1' });
    const res = parseBackup(JSON.stringify({ ...env, formatVersion: CURRENT_FORMAT_VERSION + 1 }), okValidator);
    expect(res).toEqual({ ok: false, error: { kind: 'newer-version' } });
  });

  it('one invalid rutina → invalid-rutina carrying the FIRST validator error (AC11)', () => {
    const env = buildBackup({ db: dbState(), settings: {}, appVersion: '1' });
    const res = parseBackup(JSON.stringify(env), failValidator('days[2].exercises[0]: "label" is required'));
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe('invalid-rutina');
    expect(res.error.detail).toBe('days[2].exercises[0]: "label" is required');
  });
});

describe('backupFormat.reconcileLastWeights (AC8)', () => {
  it('picks the latest completedAt per exerciseKey, under weightUsed!=null && completedAt', () => {
    const sessions = [
      session({ id: 's1', exercises: [ex({ weightUsed: 40, completedAt: '2026-07-01T09:00:00.000Z' })] }),
      session({ id: 's2', exercises: [ex({ weightUsed: 45, completedAt: '2026-07-08T09:00:00.000Z' })] }),
      session({ id: 's3', exercises: [ex({ weightUsed: 42, completedAt: '2026-07-05T09:00:00.000Z' })] }),
    ];
    const out = reconcileLastWeights(sessions);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ exerciseKey: 'chest-press::chest-press', weight: 45, loggedAt: '2026-07-08T09:00:00.000Z' });
  });

  it('ignores exercises with null weightUsed or no completedAt', () => {
    const sessions = [
      session({ id: 's1', exercises: [
        ex({ name: 'A', weightUsed: null }),
        ex({ name: 'B', completedAt: null }),
        ex({ name: 'C', weightUsed: 30, completedAt: '2026-07-01T10:00:00.000Z' }),
      ] }),
    ];
    const out = reconcileLastWeights(sessions);
    expect(out.map((w) => w.weight)).toEqual([30]);
  });

  it('drops exercises that are not trackable (no id, no usable name)', () => {
    const sessions = [session({ id: 's1', exercises: [{ equipmentId: '', name: '', weightUsed: 20, completedAt: '2026-07-01T10:00:00.000Z' }] })];
    expect(reconcileLastWeights(sessions)).toEqual([]);
  });

  it('returns [] for no sessions', () => {
    expect(reconcileLastWeights([])).toEqual([]);
  });
});
