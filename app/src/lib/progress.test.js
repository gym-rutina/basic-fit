import { describe, it, expect } from 'vitest';
import {
  listLoggedExercises,
  buildWeightSeries,
  buildSessionVolumes,
  buildFrequencyGrid,
  buildFrequencyStats,
  localDateKey,
} from './progress.js';

const RUTINA = {
  days: [
    {
      label: 'Lunes',
      exercises: [
        { equipmentId: 'g3-s10', name: 'Prensa', sets: 3, reps: 10 },
        { equipmentId: 'g3-s20', name: 'Jalón', sets: 4, reps: 8 },
      ],
    },
  ],
};

function session(partial) {
  return {
    id: 's',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'completed',
    startedAt: '2026-07-06T09:00:00.000Z',
    endedAt: '2026-07-06T09:50:00.000Z',
    exercises: [],
    ...partial,
  };
}

describe('localDateKey', () => {
  it('formats a Date as YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 6, 15, 22, 30); // Jul 15 local
    expect(localDateKey(d)).toBe('2026-07-15');
  });
});

describe('listLoggedExercises', () => {
  it('returns first-seen equipment with ≥1 completed entry', () => {
    const sessions = [
      session({
        id: 'a',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 30,
            difficulty: 'normal',
            completedAt: '2026-07-06T09:10:00.000Z',
          },
          {
            equipmentId: 'g3-s20',
            name: 'Jalón',
            weightUsed: null,
            difficulty: null,
            completedAt: null,
          },
        ],
      }),
      session({
        id: 'b',
        startedAt: '2026-07-08T09:00:00.000Z',
        endedAt: '2026-07-08T09:40:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s20',
            name: 'Jalón',
            weightUsed: 40,
            difficulty: 'hard',
            completedAt: '2026-07-08T09:15:00.000Z',
          },
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 32,
            difficulty: 'normal',
            completedAt: '2026-07-08T09:20:00.000Z',
          },
        ],
      }),
    ];
    expect(listLoggedExercises(sessions)).toEqual([
      { exerciseKey: 'g3-s10::prensa', equipmentId: 'g3-s10', name: 'Prensa' },
      { exerciseKey: 'g3-s20::jalon', equipmentId: 'g3-s20', name: 'Jalón' },
    ]);
  });

  it('returns [] when nothing is logged', () => {
    expect(listLoggedExercises([])).toEqual([]);
    expect(
      listLoggedExercises([
        session({
          exercises: [
            {
              equipmentId: 'g3-s10',
              name: 'Prensa',
              weightUsed: null,
              difficulty: null,
              completedAt: null,
            },
          ],
        }),
      ])
    ).toEqual([]);
  });
});

describe('buildWeightSeries', () => {
  it('returns chronological ascending uncapped points for one exercise key', () => {
    const sessions = [
      session({
        id: 'newer',
        startedAt: '2026-07-20T09:00:00.000Z',
        endedAt: '2026-07-20T09:40:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 40,
            difficulty: 'hard',
            completedAt: '2026-07-20T09:10:00.000Z',
          },
        ],
      }),
      session({
        id: 'older',
        startedAt: '2026-07-06T09:00:00.000Z',
        endedAt: '2026-07-06T09:40:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 30,
            difficulty: 'normal',
            completedAt: '2026-07-06T09:10:00.000Z',
          },
        ],
      }),
      session({
        id: 'other',
        startedAt: '2026-07-10T09:00:00.000Z',
        endedAt: '2026-07-10T09:40:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s20',
            name: 'Jalón',
            weightUsed: 50,
            difficulty: 'normal',
            completedAt: '2026-07-10T09:10:00.000Z',
          },
        ],
      }),
    ];
    expect(buildWeightSeries(sessions, 'g3-s10::prensa')).toEqual([
      {
        date: '2026-07-06',
        weightUsed: 30,
        difficulty: 'normal',
        completedAt: '2026-07-06T09:10:00.000Z',
      },
      {
        date: '2026-07-20',
        weightUsed: 40,
        difficulty: 'hard',
        completedAt: '2026-07-20T09:10:00.000Z',
      },
    ]);
  });
});

describe('buildSessionVolumes', () => {
  it('computes sets×reps×weightUsed via current rutina join, chronological asc', () => {
    const sessions = [
      session({
        id: 's2',
        status: 'completed',
        startedAt: '2026-07-10T09:00:00.000Z',
        endedAt: '2026-07-10T09:50:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 40,
            difficulty: 'normal',
            completedAt: '2026-07-10T09:10:00.000Z',
          },
        ],
      }),
      session({
        id: 's1',
        status: 'completed',
        startedAt: '2026-07-06T09:00:00.000Z',
        endedAt: '2026-07-06T09:50:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 30,
            difficulty: 'normal',
            completedAt: '2026-07-06T09:10:00.000Z',
          },
          {
            equipmentId: 'g3-s20',
            name: 'Jalón',
            weightUsed: 50,
            difficulty: 'hard',
            completedAt: '2026-07-06T09:20:00.000Z',
          },
        ],
      }),
      session({
        id: 'active',
        status: 'active',
        startedAt: '2026-07-12T09:00:00.000Z',
        endedAt: null,
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 99,
            difficulty: 'normal',
            completedAt: '2026-07-12T09:10:00.000Z',
          },
        ],
      }),
    ];
    // s1: 3*10*30 + 4*8*50 = 900 + 1600 = 2500
    // s2: 3*10*40 = 1200
    expect(buildSessionVolumes(sessions, RUTINA)).toEqual([
      { sessionId: 's1', date: '2026-07-06', volume: 2500 },
      { sessionId: 's2', date: '2026-07-10', volume: 1200 },
    ]);
  });

  // REWRITTEN for multi-rutina-library (tech-plan.md §3): the old contract
  // kept an unjoinable session as a 0-VOLUME BAR ("excludes exercises
  // missing from the current rutina"). Under a library that bar lies — it is
  // really another phase's session (spec C2/AC19), so it is now EXCLUDED
  // from the series entirely. The fixture makes that explicit: the unjoinable
  // session belongs to a DIFFERENT rutinaId than the active one. A zero bar
  // survives only for genuinely weightless sessions (the abandoned-empty
  // case, unchanged below).
  it('EXCLUDES an unjoinable cross-rutina session instead of plotting a 0-volume bar (AC19)', () => {
    const sessions = [
      session({
        id: 'gone',
        rutinaId: 'r-other-phase', // not the active rutina → cannot join → excluded
        startedAt: '2026-07-01T09:00:00.000Z',
        endedAt: '2026-07-01T09:20:00.000Z',
        exercises: [
          {
            equipmentId: 'retired-machine',
            name: 'Old',
            weightUsed: 100,
            difficulty: 'hard',
            completedAt: '2026-07-01T09:10:00.000Z',
          },
        ],
      }),
      session({
        id: 'abandoned-empty',
        status: 'abandoned',
        startedAt: '2026-07-02T09:00:00.000Z',
        endedAt: '2026-07-02T09:05:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: null,
            difficulty: null,
            completedAt: null,
          },
        ],
      }),
    ];
    expect(buildSessionVolumes(sessions, RUTINA)).toEqual([
      { sessionId: 'abandoned-empty', date: '2026-07-02', volume: 0 },
    ]);
  });
});

describe('buildFrequencyGrid', () => {
  it('builds a 12×7 Mon-start grid with filled days that have completed work', () => {
    const todayKey = '2026-07-29'; // Wednesday
    const sessions = [
      session({
        id: 'a',
        startedAt: '2026-07-27T09:00:00.000Z', // Monday
        endedAt: '2026-07-27T10:00:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 30,
            difficulty: 'normal',
            completedAt: '2026-07-27T09:10:00.000Z',
          },
        ],
      }),
      session({
        id: 'skip',
        status: 'abandoned',
        startedAt: '2026-07-28T09:00:00.000Z',
        endedAt: '2026-07-28T09:05:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: null,
            difficulty: null,
            completedAt: null,
          },
        ],
      }),
    ];
    const { cells, weeks } = buildFrequencyGrid(sessions, { weeks: 12, todayKey });
    expect(weeks).toBe(12);
    expect(cells).toHaveLength(84);
    const mon = cells.find((c) => c.date === '2026-07-27');
    const tue = cells.find((c) => c.date === '2026-07-28');
    expect(mon).toMatchObject({ filled: true });
    expect(tue).toMatchObject({ filled: false });
    expect(mon.ariaLabel).toMatch(/sesión/i);
    expect(tue.ariaLabel).toMatch(/sin sesión/i);
  });
});

describe('buildFrequencyStats', () => {
  it('counts last 7 / 30 days and streak from today or most recent session day', () => {
    const todayKey = '2026-07-29';
    const sessions = [
      session({
        id: 'd1',
        startedAt: '2026-07-28T09:00:00.000Z',
        endedAt: '2026-07-28T10:00:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 30,
            difficulty: 'normal',
            completedAt: '2026-07-28T09:10:00.000Z',
          },
        ],
      }),
      session({
        id: 'd2',
        startedAt: '2026-07-27T09:00:00.000Z',
        endedAt: '2026-07-27T10:00:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 30,
            difficulty: 'normal',
            completedAt: '2026-07-27T09:10:00.000Z',
          },
        ],
      }),
      session({
        id: 'old',
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T10:00:00.000Z',
        exercises: [
          {
            equipmentId: 'g3-s10',
            name: 'Prensa',
            weightUsed: 30,
            difficulty: 'normal',
            completedAt: '2026-06-01T09:10:00.000Z',
          },
        ],
      }),
    ];
    // today empty → streak starts at 2026-07-28, then 27 → streak 2
    expect(buildFrequencyStats(sessions, { todayKey })).toEqual({
      last7: 2,
      last30: 2,
      streak: 2,
    });
  });

  it('returns zeros when there is no qualifying data', () => {
    expect(buildFrequencyStats([], { todayKey: '2026-07-29' })).toEqual({
      last7: 0,
      last30: 0,
      streak: 0,
    });
  });
});

/**
 * exercise-level-tracking (spec.md AC10, AC11, AC12).
 *
 * Every aggregator in this module used to group by equipmentId, so two
 * exercises sharing a machine collapsed into one chart line, one picker entry,
 * and — in buildRutinaMap — one prescription, silently discarding the other's
 * sets×reps. Re-keying is the fix for all three.
 */
const CHEST = { equipmentId: 'g3-s10', name: 'Prensa de Pecho' };
const SHOULDER = { equipmentId: 'g3-s10', name: 'Press de Hombro' }; // SAME machine
const CHEST_KEY = 'g3-s10::prensa-de-pecho';
const SHOULDER_KEY = 'g3-s10::press-de-hombro';

function ex(base, weightUsed, completedAt, difficulty = 'normal') {
  return { ...base, weightUsed, difficulty, completedAt };
}

describe('listLoggedExercises — exercise-level (AC10)', () => {
  it('returns one entry per exercise when a machine hosts two exercises', () => {
    const sessions = [
      session({
        id: 'a',
        exercises: [
          ex(CHEST, 32, '2026-07-06T09:10:00.000Z'),
          ex(SHOULDER, 24, '2026-07-06T09:20:00.000Z'),
        ],
      }),
    ];

    expect(listLoggedExercises(sessions)).toEqual([
      { exerciseKey: CHEST_KEY, equipmentId: 'g3-s10', name: 'Prensa de Pecho' },
      { exerciseKey: SHOULDER_KEY, equipmentId: 'g3-s10', name: 'Press de Hombro' },
    ]);
  });

  it('splits EXISTING session history by exercise without any backfill (AC7)', () => {
    // These rows were written before this feature existed: they carry
    // equipmentId + name and nothing else. The key is derived at read time.
    const sessions = [
      session({ id: 'old-1', exercises: [ex(CHEST, 30, '2026-06-01T09:10:00.000Z')] }),
      session({ id: 'old-2', exercises: [ex(SHOULDER, 22, '2026-06-08T09:10:00.000Z')] }),
    ];

    expect(listLoggedExercises(sessions).map((e) => e.exerciseKey)).toEqual([CHEST_KEY, SHOULDER_KEY]);
  });

  it('excludes an exercise whose key is null', () => {
    const sessions = [
      session({
        id: 'a',
        exercises: [
          ex({ equipmentId: null, name: '' }, 30, '2026-07-06T09:10:00.000Z'),
          ex(CHEST, 32, '2026-07-06T09:20:00.000Z'),
        ],
      }),
    ];

    expect(listLoggedExercises(sessions).map((e) => e.exerciseKey)).toEqual([CHEST_KEY]);
  });
});

describe('buildWeightSeries — exercise-level (AC10, AC12)', () => {
  it('charts only the requested exercise, not everything on its machine', () => {
    const sessions = [
      session({
        id: 'a',
        exercises: [
          ex(CHEST, 32, '2026-07-06T09:10:00.000Z'),
          ex(SHOULDER, 24, '2026-07-06T09:20:00.000Z'),
        ],
      }),
    ];

    expect(buildWeightSeries(sessions, CHEST_KEY).map((p) => p.weightUsed)).toEqual([32]);
    expect(buildWeightSeries(sessions, SHOULDER_KEY).map((p) => p.weightUsed)).toEqual([24]);
  });

  it('joins one continuous series across two different programs (AC12)', () => {
    // Fase 1 and Fase 2 are separate imported rutinas. The same
    // (equipmentId, name) pair is the same exercise, so the series continues.
    const sessions = [
      session({ id: 'fase1', exercises: [ex(CHEST, 30, '2026-06-01T09:10:00.000Z')] }),
      session({ id: 'fase2', exercises: [ex(CHEST, 36, '2026-08-01T09:10:00.000Z')] }),
    ];

    expect(buildWeightSeries(sessions, CHEST_KEY).map((p) => p.weightUsed)).toEqual([30, 36]);
  });

  it('treats a case/accent variant of the same name as the same exercise (AC12)', () => {
    const sessions = [
      session({ id: 'a', exercises: [ex(CHEST, 30, '2026-06-01T09:10:00.000Z')] }),
      session({
        id: 'b',
        exercises: [ex({ equipmentId: 'g3-s10', name: 'PRENSA DE PECHO' }, 36, '2026-08-01T09:10:00.000Z')],
      }),
    ];

    expect(buildWeightSeries(sessions, CHEST_KEY).map((p) => p.weightUsed)).toEqual([30, 36]);
  });
});

describe('buildSessionVolumes — exercise-level rutina join (AC11)', () => {
  const TWO_ON_ONE_MACHINE = {
    days: [
      {
        label: 'Lunes',
        exercises: [
          { equipmentId: 'g3-s10', name: 'Prensa de Pecho', sets: 3, reps: 10 },
          { equipmentId: 'g3-s10', name: 'Press de Hombro', sets: 4, reps: 8 },
        ],
      },
    ],
  };

  it('counts BOTH exercises on one machine instead of overwriting the first', () => {
    // The pre-existing bug this fixes: buildRutinaMap keyed on equipmentId, so
    // the second exercise overwrote the first and the day's volume was computed
    // from one prescription applied to both logs.
    const sessions = [
      session({
        id: 'a',
        exercises: [
          ex(CHEST, 10, '2026-07-06T09:10:00.000Z'), // 3 × 10 × 10 = 300
          ex(SHOULDER, 10, '2026-07-06T09:20:00.000Z'), // 4 ×  8 × 10 = 320
        ],
      }),
    ];

    expect(buildSessionVolumes(sessions, TWO_ON_ONE_MACHINE)).toEqual([
      { sessionId: 'a', date: '2026-07-06', volume: 620 },
    ]);
  });

  it('still excludes a logged exercise that is absent from the current rutina', () => {
    const sessions = [
      session({
        id: 'a',
        exercises: [
          ex(CHEST, 10, '2026-07-06T09:10:00.000Z'),
          ex({ equipmentId: 'g3-s99', name: 'Remo' }, 50, '2026-07-06T09:30:00.000Z'),
        ],
      }),
    ];

    expect(buildSessionVolumes(sessions, TWO_ON_ONE_MACHINE)[0].volume).toBe(300);
  });

  it('matches a rutina prescription by exercise, not by machine', () => {
    // The CHEST direction is the discriminating one. Today's equipmentId-keyed
    // map ends up holding whichever exercise the rutina lists LAST (shoulder,
    // 4×8), so a chest-only log wrongly scores 4×8×10 = 320 instead of
    // 3×10×10 = 300. Asserting the shoulder direction alone would pass against
    // the very bug this covers.
    const chestOnly = [session({ id: 'a', exercises: [ex(CHEST, 10, '2026-07-06T09:10:00.000Z')] })];
    expect(buildSessionVolumes(chestOnly, TWO_ON_ONE_MACHINE)[0].volume).toBe(300);

    const shoulderOnly = [session({ id: 'b', exercises: [ex(SHOULDER, 10, '2026-07-06T09:20:00.000Z')] })];
    expect(buildSessionVolumes(shoulderOnly, TWO_ON_ONE_MACHINE)[0].volume).toBe(320);
  });
});

/**
 * multi-rutina-library AC19/C2 — volume under multiple rutinas.
 * Matrix (tech-plan D-D): snapshot-first → scoped legacy join (same rutina)
 * → honest exclusion (other rutina, no snapshot). Zero bars remain possible
 * only for genuinely weightless sessions.
 * RED until Cmok implements the three-tier resolution.
 */
describe('buildSessionVolumes — multiple rutinas (multi-rutina-library AC19)', () => {
  const ACTIVE = {
    id: 'r-active',
    days: [{ label: 'Día A', exercises: [{ equipmentId: 'g3-s10', name: 'Prensa', sets: 3, reps: 10 }] }],
  };

  const baseEx = (over = {}) => ({
    equipmentId: 'g3-s10',
    name: 'Prensa',
    weightUsed: 50,
    completedAt: '2026-03-01T09:10:00.000Z',
    ...over,
  });

  it('counts a SNAPSHOT-carrying session from ANOTHER rutina at its own planned volume', () => {
    const sessions = [{
      id: 'f1', status: 'completed', startedAt: '2026-03-01T09:00:00Z', endedAt: '2026-03-01T09:30:00Z',
      rutinaId: 'r-old',
      exercises: [baseEx({ sets: 5, reps: 5 })], // 5×5×50 = 1250, NOT active's 3×10×50=1500
    }];
    const result = buildSessionVolumes(sessions, ACTIVE);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sessionId: 'f1', volume: 1250 });
  });

  it('keeps the legacy join for a NO-snapshot session of the ACTIVE rutina', () => {
    const sessions = [{
      id: 'leg', status: 'completed', startedAt: '2026-03-01T09:00:00Z', endedAt: '2026-03-01T09:30:00Z',
      rutinaId: 'r-active',
      exercises: [baseEx()], // no snapshot → join against active's 3×10
    }];
    const result = buildSessionVolumes(sessions, ACTIVE);
    expect(result[0].volume).toBe(1500);
  });

  it('EXCLUDES a no-snapshot session from a DIFFERENT rutina — not a zero bar (AC19)', () => {
    const sessions = [
      { id: 'gone', status: 'completed', startedAt: '2026-03-01T08:00:00Z', endedAt: '2026-03-01T08:30:00Z', rutinaId: 'r-old', exercises: [baseEx()] },
      { id: 'kept', status: 'completed', startedAt: '2026-03-01T09:00:00Z', endedAt: '2026-03-01T09:30:00Z', rutinaId: 'r-active', exercises: [baseEx({ sets: 3, reps: 10 })] },
    ];
    const result = buildSessionVolumes(sessions, ACTIVE);
    expect(result.map((r) => r.sessionId)).toEqual(['kept']);
  });

  it('zero-volume bar survives ONLY as a genuinely weightless snapshot session', () => {
    const sessions = [{
      id: 'zw', status: 'completed', startedAt: '2026-03-01T09:00:00Z', endedAt: '2026-03-01T09:30:00Z',
      rutinaId: 'r-old',
      exercises: [baseEx({ sets: 3, reps: 10, weightUsed: null })],
    }];
    const result = buildSessionVolumes(sessions, ACTIVE);
    expect(result).toHaveLength(1);
    expect(result[0].volume).toBe(0);
  });
});
