import { describe, it, expect } from 'vitest';
import { buildExerciseTrends } from './trends.js';

const SESSIONS = [
  {
    id: 's1',
    status: 'completed',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa',
        weightUsed: 30,
        difficulty: 'normal',
        completedAt: '2026-07-01T09:10:00.000Z',
      },
      {
        equipmentId: 'g3-s10',
        name: 'Prensa',
        weightUsed: 32,
        difficulty: 'normal',
        completedAt: '2026-07-08T09:10:00.000Z',
      },
      {
        equipmentId: 'g3-s10',
        name: 'Prensa',
        weightUsed: 35,
        difficulty: 'hard',
        completedAt: '2026-07-15T09:10:00.000Z',
      },
      {
        equipmentId: 'g3-s10',
        name: 'Prensa',
        weightUsed: 40,
        difficulty: 'hard',
        completedAt: '2026-07-22T09:10:00.000Z',
      },
    ],
  },
];

describe('buildExerciseTrends — History contract', () => {
  it('defaults to newest-first capped at 3', () => {
    const [trend] = buildExerciseTrends(SESSIONS);
    expect(trend.equipmentId).toBe('g3-s10');
    expect(trend.entries).toEqual([
      { date: '2026-07-22', weightUsed: 40, difficulty: 'hard' },
      { date: '2026-07-15', weightUsed: 35, difficulty: 'hard' },
      { date: '2026-07-08', weightUsed: 32, difficulty: 'normal' },
    ]);
  });

  it('limit: Infinity returns the full newest-first series', () => {
    const [trend] = buildExerciseTrends(SESSIONS, { limit: Infinity });
    expect(trend.entries).toHaveLength(4);
    expect(trend.entries[0].weightUsed).toBe(40);
    expect(trend.entries[3].weightUsed).toBe(30);
  });
});

/**
 * exercise-level-tracking (spec.md AC9).
 *
 * The History "Por ejercicio" list groups by exercise key, so one machine can
 * head several rows. Each group carries exerciseKey, equipmentId and name —
 * the screen needs equipmentId to render its disambiguating sub-line.
 */
const TWO_ON_ONE_MACHINE = [
  {
    id: 's1',
    status: 'completed',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 32,
        difficulty: 'normal',
        completedAt: '2026-07-06T09:10:00.000Z',
      },
      {
        equipmentId: 'g3-s10',
        name: 'Press de Hombro',
        weightUsed: 24,
        difficulty: 'hard',
        completedAt: '2026-07-06T09:20:00.000Z',
      },
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 34,
        difficulty: 'normal',
        completedAt: '2026-07-13T09:10:00.000Z',
      },
    ],
  },
];

describe('buildExerciseTrends — exercise-level grouping (AC9)', () => {
  it('returns one group per exercise, not per machine', () => {
    const trends = buildExerciseTrends(TWO_ON_ONE_MACHINE);

    expect(trends).toHaveLength(2);
    expect(trends.map((t) => t.exerciseKey)).toEqual(['g3-s10::prensa-de-pecho', 'g3-s10::press-de-hombro']);
  });

  it('carries exerciseKey, equipmentId and name on every group', () => {
    const [chest] = buildExerciseTrends(TWO_ON_ONE_MACHINE);

    expect(chest).toMatchObject({
      exerciseKey: 'g3-s10::prensa-de-pecho',
      equipmentId: 'g3-s10',
      name: 'Prensa de Pecho',
    });
  });

  it('keeps each exercise entries separate', () => {
    const [chest, shoulder] = buildExerciseTrends(TWO_ON_ONE_MACHINE);

    expect(chest.entries.map((e) => e.weightUsed)).toEqual([34, 32]); // newest-first
    expect(shoulder.entries.map((e) => e.weightUsed)).toEqual([24]);
  });

  it('groups a bodyweight exercise under its name-only key', () => {
    const trends = buildExerciseTrends([
      {
        id: 's1',
        status: 'completed',
        exercises: [
          {
            equipmentId: null,
            name: 'Plancha',
            weightUsed: null,
            difficulty: 'normal',
            completedAt: '2026-07-06T09:10:00.000Z',
          },
        ],
      },
    ]);

    expect(trends).toHaveLength(1);
    expect(trends[0]).toMatchObject({ exerciseKey: '::plancha', equipmentId: null, name: 'Plancha' });
  });

  it('excludes an exercise whose key is null', () => {
    const trends = buildExerciseTrends([
      {
        id: 's1',
        status: 'completed',
        exercises: [
          {
            equipmentId: null,
            name: '',
            weightUsed: 30,
            difficulty: 'normal',
            completedAt: '2026-07-06T09:10:00.000Z',
          },
        ],
      },
    ]);

    expect(trends).toEqual([]);
  });
});
