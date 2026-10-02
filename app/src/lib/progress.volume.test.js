import { describe, it, expect } from 'vitest';
import { buildSessionVolumes, parseRepsCount } from './progress.js';

/**
 * progress-volume-fix (spec.md AC1-AC6).
 *
 * The root cause this pins: rutina.schema.json defines `reps` as a STRING
 * ("10-12", "30s"), so `sets * reps * weightUsed` was NaN for any range or
 * hold, and a NaN session volume poisoned the chart's max. progress.test.js
 * only ever used numeric reps (`reps: 10`), which is why nothing caught it.
 * Every fixture here uses STRING reps on purpose (AC6).
 *
 * Calculation rules (user-accepted, spec.md P1-P3):
 *   P1 range -> lower bound; "8 c/lado" / "8 each" -> leading integer (no x2)
 *   P2 timed holds and unparseable text -> 0, never NaN, never poison a total
 *   P3 volume stays a planned proxy: sets x parsed reps x logged weight
 *
 * Dates are at 09:00-10:40Z so localDateKey() lands on the same calendar day in
 * every timezone from UTC-9 to UTC+13 (same convention as progress.test.js).
 */

const WHEN = '2026-07-06T09:10:00.000Z';

/** A logged exercise that carries the creation-time sets/reps snapshot. */
function snapEx(name, { sets, reps, weightUsed, equipmentId = 'g3-s10' }) {
  return { equipmentId, name, sets, reps, weightUsed, difficulty: 'normal', completedAt: WHEN };
}

/** A logged exercise WITHOUT a snapshot (legacy rows): joined against the rutina. */
function legacyEx(name, weightUsed, equipmentId = 'g3-s10') {
  return { equipmentId, name, weightUsed, difficulty: 'normal', completedAt: WHEN };
}

function sess(id, exercises, over = {}) {
  return {
    id,
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'completed',
    startedAt: '2026-07-06T09:00:00.000Z',
    endedAt: '2026-07-06T09:50:00.000Z',
    exercises,
    ...over,
  };
}

const ACTIVE = (exercises) => ({ id: 'r-active', days: [{ label: 'Lunes', exercises }] });

/**
 * The AC2 table. [input, expected rep count]. 0 means "not load x reps" (P2).
 * Literal expectations on purpose: computing them with parseRepsCount would
 * make the shared-parser tests below circular.
 */
const REPS_CASES = [
  // plain counts
  [10, 10],
  ['10', 10],
  [' 12 ', 12],
  ['12 reps', 12],
  // ranges -> lower bound (P1), every separator a human or an LLM writes
  ['10-12', 10],
  ['10–12', 10], // en dash
  ['10—12', 10], // em dash
  ['10 - 12', 10],
  ['8 a 10', 8],
  ['8 to 10', 8],
  // per-side / each -> leading integer, NOT doubled (P1)
  ['8 c/lado', 8],
  ['8 por lado', 8],
  ['8 each', 8],
  // timed holds -> 0 (P2)
  ['30s', 0],
  ['45 s', 0],
  ['30 seg', 0],
  ['1 min', 0],
  ['2 minutos', 0],
  ['30-45s', 0], // a RANGE of seconds is still a hold
  // unparseable / missing -> 0 (P2)
  ['AMRAP', 0],
  ['al fallo', 0],
  ['', 0],
  ['   ', 0],
  [undefined, 0],
  [null, 0],
  [NaN, 0],
  [Infinity, 0],
  [-5, 0],
  [0, 0],
  ['0', 0],
  [{}, 0],
  [[], 0],
  [true, 0],
];

describe('parseRepsCount (AC2)', () => {
  it('is exported from lib/progress.js as a function', () => {
    expect(typeof parseRepsCount).toBe('function');
  });

  it.each(REPS_CASES)('parses %o as %i', (input, expected) => {
    expect(parseRepsCount(input)).toBe(expected);
  });

  it('always returns a finite integer >= 0, never NaN/Infinity (AC1)', () => {
    for (const [input] of REPS_CASES) {
      const n = parseRepsCount(input);
      expect({ input, ok: Number.isInteger(n) && n >= 0 }).toEqual({ input, ok: true });
    }
  });
});

describe('buildSessionVolumes — string reps, SNAPSHOT tier (AC1, AC2, AC3, AC6)', () => {
  it('counts a range at its lower bound: 3 x "10-12" x 50 = 1500 (was NaN)', () => {
    const sessions = [sess('s1', [snapEx('Prensa', { sets: 3, reps: '10-12', weightUsed: 50 })])];
    expect(buildSessionVolumes(sessions, ACTIVE([]))).toEqual([
      { sessionId: 's1', date: '2026-07-06', volume: 1500 },
    ]);
  });

  it('a timed hold contributes 0 and the volume is a finite number, not NaN', () => {
    const sessions = [sess('s1', [snapEx('Plancha', { sets: 3, reps: '30s', weightUsed: 20 })])];
    const [point] = buildSessionVolumes(sessions, ACTIVE([]));
    expect(point.volume).toBe(0);
    expect(Number.isFinite(point.volume)).toBe(true);
  });

  it('one range-reps session and one plain session: neither is NaN, the series max is finite (the blank-chart repro)', () => {
    // The user's symptom (spec D2): a chart that is EMPTY. VolumeBarChart takes
    // Math.max over these volumes, so a single NaN here blanked every bar.
    const sessions = [
      sess('plain', [snapEx('Prensa', { sets: 3, reps: '10', weightUsed: 40 })], {
        startedAt: '2026-07-06T09:00:00.000Z',
        endedAt: '2026-07-06T09:50:00.000Z',
      }),
      sess('range', [snapEx('Prensa', { sets: 3, reps: '10-12', weightUsed: 50 })], {
        startedAt: '2026-07-08T09:00:00.000Z',
        endedAt: '2026-07-08T09:50:00.000Z',
      }),
      sess('hold', [snapEx('Plancha', { sets: 3, reps: '30s', weightUsed: 10 })], {
        startedAt: '2026-07-10T09:00:00.000Z',
        endedAt: '2026-07-10T09:50:00.000Z',
      }),
    ];
    const result = buildSessionVolumes(sessions, ACTIVE([]));

    expect(result.map((p) => [p.sessionId, p.volume])).toEqual([
      ['plain', 1200], // 3 x 10 x 40 — untouched by its neighbours' bad reps
      ['range', 1500], // 3 x 10 x 50
      ['hold', 0],
    ]);
    expect(result.every((p) => Number.isFinite(p.volume))).toBe(true);
    expect(Number.isFinite(Math.max(...result.map((p) => p.volume), 1))).toBe(true);
  });

  it('totals only the countable exercises of a mixed session (AC3)', () => {
    const sessions = [
      sess('mixed', [
        snapEx('Prensa', { sets: 3, reps: '10-12', weightUsed: 50 }), // 3 x 10 x 50 = 1500
        snapEx('Plancha', { sets: 3, reps: '30s', weightUsed: 20 }), //              0
        snapEx('Dominadas', { sets: 2, reps: 'AMRAP', weightUsed: 10 }), //          0
        snapEx('Zancadas', { sets: 4, reps: '8 c/lado', weightUsed: 25 }), // 4 x 8 x 25 = 800
        snapEx('Curl', { sets: 3, reps: '8 a 10', weightUsed: 12 }), //       3 x 8 x 12 = 288
      ]),
    ];
    expect(buildSessionVolumes(sessions, ACTIVE([]))[0].volume).toBe(1500 + 800 + 288);
  });

  it('numeric strings behave exactly like numbers: "10" === 10', () => {
    const asString = [sess('s', [snapEx('Prensa', { sets: 3, reps: '10', weightUsed: 30 })])];
    const asNumber = [sess('s', [snapEx('Prensa', { sets: 3, reps: 10, weightUsed: 30 })])];
    expect(buildSessionVolumes(asString, ACTIVE([]))).toEqual(buildSessionVolumes(asNumber, ACTIVE([])));
  });

  it('a genuinely weightless session with range reps is still a zero bar, not NaN (AC10 contract)', () => {
    const sessions = [
      sess('zw', [snapEx('Prensa', { sets: 3, reps: '10-12', weightUsed: null })], { rutinaId: 'r-old' }),
    ];
    expect(buildSessionVolumes(sessions, ACTIVE([]))).toEqual([
      { sessionId: 'zw', date: '2026-07-06', volume: 0 },
    ]);
  });
});

describe('buildSessionVolumes — string reps, SCOPED LEGACY JOIN tier (AC4, AC6)', () => {
  it('reads a range from the rutina map: 3 x "10-12" x 50 = 1500 (was NaN)', () => {
    const rutina = ACTIVE([{ equipmentId: 'g3-s10', name: 'Prensa', sets: 3, reps: '10-12' }]);
    const sessions = [sess('leg', [legacyEx('Prensa', 50)], { rutinaId: 'r-active' })];
    expect(buildSessionVolumes(sessions, rutina)).toEqual([
      { sessionId: 'leg', date: '2026-07-06', volume: 1500 },
    ]);
  });

  it('a hold in the rutina map contributes 0 and leaves the other exercise intact (AC3)', () => {
    const rutina = ACTIVE([
      { equipmentId: 'g3-s10', name: 'Prensa', sets: 3, reps: '10-12' },
      { equipmentId: null, name: 'Plancha', sets: 3, reps: '45 s' },
    ]);
    const sessions = [
      sess('leg', [legacyEx('Prensa', 50), legacyEx('Plancha', 10, null)], { rutinaId: 'r-active' }),
    ];
    expect(buildSessionVolumes(sessions, rutina)[0].volume).toBe(1500);
  });

  it('keeps the per-exercise key join when the prescriptions are strings (two exercises, one machine)', () => {
    // progress.test.js AC11 proves the key join with numeric reps; this is the
    // same shape with the strings the schema actually produces.
    const rutina = ACTIVE([
      { equipmentId: 'g3-s10', name: 'Prensa de Pecho', sets: 3, reps: '10-12' },
      { equipmentId: 'g3-s10', name: 'Press de Hombro', sets: 4, reps: '8 a 10' },
    ]);
    const sessions = [
      sess('a', [legacyEx('Prensa de Pecho', 10), legacyEx('Press de Hombro', 10)], { rutinaId: 'r-active' }),
    ];
    // 3 x 10 x 10 + 4 x 8 x 10 = 300 + 320
    expect(buildSessionVolumes(sessions, rutina)[0].volume).toBe(620);
  });

  it('one range session next to a plain session does not blank the series (the blank-chart repro, legacy tier)', () => {
    const rutina = ACTIVE([
      { equipmentId: 'g3-s10', name: 'Prensa', sets: 3, reps: '10-12' },
      { equipmentId: 'g3-s20', name: 'Jalón', sets: 4, reps: '8' },
    ]);
    const sessions = [
      sess('range', [legacyEx('Prensa', 50)], {
        rutinaId: 'r-active',
        startedAt: '2026-07-06T09:00:00.000Z',
        endedAt: '2026-07-06T09:50:00.000Z',
      }),
      sess('plain', [legacyEx('Jalón', 40, 'g3-s20')], {
        rutinaId: 'r-active',
        startedAt: '2026-07-08T09:00:00.000Z',
        endedAt: '2026-07-08T09:50:00.000Z',
      }),
    ];
    const result = buildSessionVolumes(sessions, rutina);
    expect(result.map((p) => p.volume)).toEqual([1500, 1280]); // 3x10x50, 4x8x40
    expect(result.every((p) => Number.isFinite(p.volume))).toBe(true);
  });
});

describe('buildSessionVolumes — EXCLUDED tier is unchanged by string reps (AC4)', () => {
  it('still drops a no-snapshot session of ANOTHER rutina — not a zero bar, not NaN', () => {
    const rutina = ACTIVE([{ equipmentId: 'g3-s10', name: 'Prensa', sets: 3, reps: '10-12' }]);
    const sessions = [sess('gone', [legacyEx('Prensa', 50)], { rutinaId: 'r-old' })];
    expect(buildSessionVolumes(sessions, rutina)).toEqual([]);
  });
});

describe('buildSessionVolumes — one parser for every tier (AC1, AC4)', () => {
  const SETS = 3;
  const WEIGHT = 20;

  it.each(REPS_CASES)('reps %o: snapshot and legacy join agree and are finite', (reps, count) => {
    const expected = SETS * count * WEIGHT;

    // Tier 1 — snapshot. A missing reps value is a HALF snapshot (sets without
    // reps) and legitimately falls through to a lower tier, so for null /
    // undefined only the AC1 invariant is asserted here; the legacy run below
    // covers them for the value.
    const snapshotSession = sess('snap', [snapEx('Prensa', { sets: SETS, reps, weightUsed: WEIGHT })], {
      rutinaId: 'r-old',
    });
    const snapshot = buildSessionVolumes([snapshotSession], ACTIVE([]));
    for (const p of snapshot) {
      expect({ reps, finite: Number.isFinite(p.volume) && p.volume >= 0 }).toEqual({ reps, finite: true });
    }
    if (reps != null) {
      expect(snapshot).toEqual([{ sessionId: 'snap', date: '2026-07-06', volume: expected }]);
    }

    // Tier 2 — legacy join: the rutina's own `reps` is the same kind of string.
    const rutina = ACTIVE([{ equipmentId: 'g3-s10', name: 'Prensa', sets: SETS, reps }]);
    const legacySession = sess('leg', [legacyEx('Prensa', WEIGHT)], { rutinaId: 'r-active' });
    expect(buildSessionVolumes([legacySession], rutina)).toEqual([
      { sessionId: 'leg', date: '2026-07-06', volume: expected },
    ]);
  });
});

describe('buildSessionVolumes — non-finite sets or weight never poison a total (AC1 hardening)', () => {
  it('counts the healthy exercise and zeroes the NaN / Infinity / non-numeric ones', () => {
    // weightUsed is parsed with Number() by the session screen, so a NaN weight
    // is reachable; sets is a free string in a hand-edited import.
    const sessions = [
      sess('s1', [
        snapEx('Prensa', { sets: 3, reps: '10', weightUsed: NaN }),
        snapEx('Jalón', { sets: 'abc', reps: '10', weightUsed: 50, equipmentId: 'g3-s20' }),
        snapEx('Remo', { sets: 4, reps: '8', weightUsed: Infinity, equipmentId: 'g3-s30' }),
        snapEx('Curl', { sets: 4, reps: '8', weightUsed: 25, equipmentId: 'g3-s40' }), // 800
      ]),
    ];
    const [point] = buildSessionVolumes(sessions, ACTIVE([]));
    expect(point.volume).toBe(800);
  });
});

describe('buildSessionVolumes — deterministic same-day ordering (AC5)', () => {
  // Same local day throughout except d0. Ordering by endedAt would put x1 LAST
  // (it ends at 10:40), so this pins "tie-break by startedAt", not by end time.
  const FIXTURE = [
    sess('d0', [snapEx('Prensa', { sets: 3, reps: '10', weightUsed: 10 })], {
      startedAt: '2026-07-09T09:00:00.000Z',
      endedAt: '2026-07-09T09:50:00.000Z',
    }),
    sess('x1', [snapEx('Prensa', { sets: 3, reps: '10', weightUsed: 10 })], {
      startedAt: '2026-07-10T09:00:00.000Z',
      endedAt: '2026-07-10T10:40:00.000Z',
    }),
    sess('m2', [snapEx('Prensa', { sets: 3, reps: '10', weightUsed: 10 })], {
      startedAt: '2026-07-10T09:30:00.000Z',
      endedAt: '2026-07-10T09:50:00.000Z',
    }),
    // identical startedAt -> final tie-break is the session id, ascending
    sess('b3', [snapEx('Prensa', { sets: 3, reps: '10', weightUsed: 10 })], {
      startedAt: '2026-07-10T10:00:00.000Z',
      endedAt: '2026-07-10T10:20:00.000Z',
    }),
    sess('a3', [snapEx('Prensa', { sets: 3, reps: '10', weightUsed: 10 })], {
      startedAt: '2026-07-10T10:00:00.000Z',
      endedAt: '2026-07-10T10:30:00.000Z',
    }),
  ];
  const EXPECTED_ORDER = ['d0', 'x1', 'm2', 'a3', 'b3'];

  function permutations(items) {
    if (items.length <= 1) return [items];
    return items.flatMap((item, i) =>
      permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
    );
  }

  it('orders day first, then startedAt, then id — for EVERY input order of the same sessions', () => {
    const all = permutations(FIXTURE);
    expect(all).toHaveLength(120);
    for (const input of all) {
      const order = buildSessionVolumes(input, ACTIVE([])).map((p) => p.sessionId);
      expect({ input: input.map((s) => s.id), order }).toEqual({
        input: input.map((s) => s.id),
        order: EXPECTED_ORDER,
      });
    }
  });

  it('does not add fields to the returned points (existing toEqual contracts depend on the 3-key shape)', () => {
    const [point] = buildSessionVolumes([FIXTURE[0]], ACTIVE([]));
    expect(Object.keys(point).sort()).toEqual(['date', 'sessionId', 'volume']);
  });
});
