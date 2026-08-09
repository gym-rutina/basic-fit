import { describe, it, expect } from 'vitest';
import { buildExportPayload } from './exportFormat.js';

const SESSIONS = [
  {
    id: 's1',
    dayLabel: 'Lunes',
    status: 'completed',
    startedAt: '2026-07-06T09:00:00.000Z',
    endedAt: '2026-07-06T09:50:00.000Z',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 32,
        difficulty: 'hard',
        completedAt: '2026-07-06T09:10:00.000Z',
      },
    ],
  },
  {
    id: 's2',
    dayLabel: 'Lunes',
    status: 'completed',
    startedAt: '2026-07-08T09:00:00.000Z',
    endedAt: '2026-07-08T09:45:00.000Z',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 32,
        difficulty: 'normal',
        completedAt: '2026-07-08T09:10:00.000Z',
      },
    ],
  },
  {
    id: 's3',
    dayLabel: 'Lunes',
    status: 'abandoned',
    startedAt: '2026-07-01T09:00:00.000Z',
    endedAt: '2026-07-01T09:20:00.000Z',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: null,
        difficulty: null,
        completedAt: null,
      },
    ],
  },
];

describe('buildExportPayload', () => {
  it('groups the json export by exercise key in chronological order', () => {
    const { json } = buildExportPayload(SESSIONS);
    expect(json.exercises['g3-s10::prensa-de-pecho']).toEqual([
      { date: '2026-07-06', weightUsed: 32, difficulty: 'hard' },
      { date: '2026-07-08', weightUsed: 32, difficulty: 'normal' },
    ]);
  });

  it('excludes abandoned/unlogged entries from the per-exercise json rollup', () => {
    const { json } = buildExportPayload(SESSIONS);
    // 2, not 3 — the abandoned session logged nothing for this exercise
    expect(json.exercises['g3-s10::prensa-de-pecho']).toHaveLength(2);
  });

  it('markdown groups by exercise name+id and calls out skipped/abandoned sessions separately', () => {
    const { markdown } = buildExportPayload(SESSIONS);
    expect(markdown).toContain('Prensa de Pecho (g3-s10)');
    expect(markdown).toContain('32kg');
    expect(markdown).toMatch(/abandon/i);
  });

  it('filters by date range when from/to are given', () => {
    const { json } = buildExportPayload(SESSIONS, { from: '2026-07-07', to: '2026-07-31' });
    expect(json.exercises['g3-s10::prensa-de-pecho']).toEqual([
      { date: '2026-07-08', weightUsed: 32, difficulty: 'normal' },
    ]);
  });

  it('handles an empty session history without throwing', () => {
    const { json, markdown } = buildExportPayload([]);
    expect(json.exercises).toEqual({});
    expect(typeof markdown).toBe('string');
  });
});

/**
 * exercise-level-tracking (spec.md AC13, AC14).
 *
 * json.exercises is re-keyed from equipmentId to the exercise key; the entry
 * ARRAY SHAPE is deliberately unchanged ({date, weightUsed, difficulty},
 * chronological ascending) because that tuple is a tested contract. A sibling
 * exerciseNames map keeps the JSON self-describing now that the key is opaque.
 *
 * Nothing re-imports this payload — ImportScreen accepts rutinas only — so the
 * key change is safe; its blast radius is docs/export-format.md.
 */
const TWO_ON_ONE_MACHINE = [
  {
    id: 's1',
    dayLabel: 'Lunes',
    status: 'completed',
    startedAt: '2026-07-06T09:00:00.000Z',
    endedAt: '2026-07-06T09:50:00.000Z',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 32,
        difficulty: 'hard',
        completedAt: '2026-07-06T09:10:00.000Z',
      },
      {
        equipmentId: 'g3-s10',
        name: 'Press de Hombro',
        weightUsed: 24,
        difficulty: 'normal',
        completedAt: '2026-07-06T09:20:00.000Z',
      },
      {
        equipmentId: null,
        name: 'Plancha',
        weightUsed: null,
        difficulty: 'easy',
        completedAt: '2026-07-06T09:40:00.000Z',
      },
    ],
  },
];

describe('buildExportPayload — exercise-level keying (AC13)', () => {
  it('keys json.exercises by exercise key, so one machine yields two entries', () => {
    const { json } = buildExportPayload(TWO_ON_ONE_MACHINE);

    expect(Object.keys(json.exercises)).toEqual([
      'g3-s10::prensa-de-pecho',
      'g3-s10::press-de-hombro',
      '::plancha',
    ]);
  });

  it('leaves the entry-object shape and chronological order untouched', () => {
    const { json } = buildExportPayload(TWO_ON_ONE_MACHINE);

    expect(json.exercises['g3-s10::press-de-hombro']).toEqual([
      { date: '2026-07-06', weightUsed: 24, difficulty: 'normal' },
    ]);
  });

  it('emits a matching exerciseNames map', () => {
    const { json } = buildExportPayload(TWO_ON_ONE_MACHINE);

    expect(json.exerciseNames).toEqual({
      'g3-s10::prensa-de-pecho': 'Prensa de Pecho',
      'g3-s10::press-de-hombro': 'Press de Hombro',
      '::plancha': 'Plancha',
    });
  });

  it('keeps exerciseNames in step with a date-filtered exercises map', () => {
    // A key filtered out of exercises must not linger in exerciseNames.
    const { json } = buildExportPayload(TWO_ON_ONE_MACHINE, { from: '2026-07-10' });

    expect(json.exercises).toEqual({});
    expect(json.exerciseNames).toEqual({});
  });

  it('emits both maps empty for an empty history', () => {
    const { json } = buildExportPayload([]);

    expect(json.exercises).toEqual({});
    expect(json.exerciseNames).toEqual({});
  });
});

describe('buildExportPayload — markdown blocks (AC14)', () => {
  it('emits one block per exercise, so one equipmentId can head several', () => {
    const { markdown } = buildExportPayload(TWO_ON_ONE_MACHINE);

    expect(markdown).toContain('Prensa de Pecho (g3-s10)');
    expect(markdown).toContain('Press de Hombro (g3-s10)');
  });

  it('omits the parenthetical entirely for a bodyweight exercise', () => {
    const { markdown } = buildExportPayload(TWO_ON_ONE_MACHINE);

    expect(markdown).toContain('Plancha');
    expect(markdown).not.toContain('Plancha (');
    expect(markdown).not.toContain('()');
    expect(markdown).not.toContain('(null)');
  });
});
