import { exerciseKey } from './exerciseKey.js';

/**
 * Per-exercise trend list for the History screen ("Por ejercicio": last N
 * logged weights/difficulties, newest first). Deliberately separate from
 * exportFormat.js's buildExportPayload: that function's json.exercises[key]
 * shape is a tested contract (exact {date,weightUsed,difficulty} tuples,
 * chronological ascending, no `name` field) — bolting a display-only `name`
 * field or a "last N" truncation onto it would risk breaking that contract
 * for no shared benefit, since the two consumers (LLM-paste export vs.
 * in-app trend list) have different shapes and ordering needs.
 *
 * Grouped by exercise key, not equipmentId (exercise-level-tracking AC9): one
 * machine hosting two exercises now produces two groups. An exercise whose
 * key is `null` (not trackable) is excluded, same as everywhere else.
 */

/**
 * @param {Array} sessions - full session history (any status)
 * @param {{limit?: number}} options - pass `limit: Infinity` to return the
 *   full newest-first series (History default stays 3; Progress uses
 *   buildWeightSeries from progress.js for its ascending uncapped chart).
 * @returns {Array<{exerciseKey: string, equipmentId: string|null, name: string, entries: Array<{date, weightUsed, difficulty}>}>}
 *   newest-first, each capped at `limit` entries (default 3)
 */
export function buildExerciseTrends(sessions = [], { limit = 3 } = {}) {
  const order = []; // preserves first-seen exercise-key order
  const byKey = new Map();

  for (const session of sessions) {
    for (const ex of session.exercises || []) {
      if (ex.completedAt == null) continue;
      const key = exerciseKey(ex);
      if (key == null) continue;
      if (!byKey.has(key)) {
        byKey.set(key, { equipmentId: ex.equipmentId, name: ex.name, entries: [] });
        order.push(key);
      }
      byKey.get(key).entries.push({
        date: ex.completedAt.slice(0, 10),
        weightUsed: ex.weightUsed,
        difficulty: ex.difficulty,
        completedAt: ex.completedAt,
      });
    }
  }

  return order.map((key) => {
    const group = byKey.get(key);
    const newestFirst = [...group.entries].sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
    return {
      exerciseKey: key,
      equipmentId: group.equipmentId,
      name: group.name,
      entries: newestFirst.slice(0, limit).map(({ date, weightUsed, difficulty }) => ({ date, weightUsed, difficulty })),
    };
  });
}
