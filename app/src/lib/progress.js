import { exerciseKey } from './exerciseKey.js';
import { defaultT } from '../i18n/index.js';

/**
 * Aggregators for the Progress screen (AC2/AC3/AC4).
 * Pure functions — no I/O; all data comes from the caller.
 *
 * Kept separate from trends.js intentionally: trends.js owns the History
 * screen's "last N newest-first" contract; this module owns ascending full-
 * history series, per-session volume joins, and frequency bucketing.
 *
 * Day keys throughout are computed via localDateKey() (local calendar date,
 * not UTC slice) so evening sessions don't land on the wrong cell in
 * timezones east of UTC (tech-plan Decision 5).
 *
 * Grouped by exercise key, not equipmentId (exercise-level-tracking AC10-AC12):
 * one machine hosting two exercises used to collapse into one chart line,
 * one picker entry, and — in buildRutinaMap — one prescription, silently
 * discarding the other's sets×reps. Re-keying is the fix for all three.
 */

/**
 * Returns the local-time YYYY-MM-DD string for a Date object.
 * Use this instead of .toISOString().slice(0,10) which gives UTC dates.
 *
 * @param {Date} [date=new Date()]
 * @returns {string} e.g. "2026-07-15"
 */
export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the first-seen unique exercises that have at least one logged
 * (completedAt set) entry across all sessions, keyed by exercise key so two
 * exercises sharing one machine are two entries, not one (AC10).
 *
 * @param {Array} sessions
 * @returns {Array<{exerciseKey: string, equipmentId: string|null, name: string}>}
 */
export function listLoggedExercises(sessions = []) {
  const seen = new Map();
  const order = [];
  for (const session of sessions) {
    for (const ex of session.exercises || []) {
      if (ex.completedAt == null) continue;
      const key = exerciseKey(ex);
      if (key == null) continue;
      if (!seen.has(key)) {
        seen.set(key, { equipmentId: ex.equipmentId, name: ex.name });
        order.push(key);
      }
    }
  }
  return order.map((key) => ({ exerciseKey: key, ...seen.get(key) }));
}

/**
 * Returns chronological ascending weight-series points for one exercise key.
 * Uncapped (unlike buildExerciseTrends which defaults to last 3). The same
 * key in two different imported programs is one continuous series (AC12).
 *
 * @param {Array} sessions
 * @param {string} exerciseKeyValue
 * @returns {Array<{date: string, weightUsed: number, difficulty: string, completedAt: string}>}
 */
export function buildWeightSeries(sessions = [], exerciseKeyValue) {
  const points = [];
  for (const session of sessions) {
    for (const ex of session.exercises || []) {
      if (ex.completedAt == null) continue;
      if (exerciseKey(ex) !== exerciseKeyValue) continue;
      points.push({
        date: localDateKey(new Date(ex.completedAt)),
        weightUsed: ex.weightUsed,
        difficulty: ex.difficulty,
        completedAt: ex.completedAt,
      });
    }
  }
  return points.sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1));
}

/**
 * Builds a rutina map from exercise key to {sets, reps}. Keyed by exercise
 * key, not equipmentId (AC11 — the pre-existing bug this fixes): a day with
 * two exercises on one machine used to have the second silently overwrite
 * the first's prescription, so a chest-only log wrongly scored the
 * shoulder day's sets×reps.
 *
 * @param {object} rutina
 * @returns {Map<string, {sets: number, reps: number}>}
 */
function buildRutinaMap(rutina) {
  const map = new Map();
  for (const day of (rutina && rutina.days) || []) {
    for (const ex of day.exercises || []) {
      const key = exerciseKey(ex);
      if (key == null) continue;
      map.set(key, { sets: ex.sets, reps: ex.reps });
    }
  }
  return map;
}

/**
 * Computes per-session total volume (Σ sets × reps × weightUsed) for all
 * past sessions (status !== 'active'), joined against the current rutina by
 * exercise key. Exercises absent from the current rutina are excluded.
 * Abandoned sessions with no completed exercises appear with volume: 0.
 *
 * @param {Array} sessions
 * @param {object} rutina
 * @returns {Array<{sessionId: string, date: string, volume: number}>} chronological ascending
 */
export function buildSessionVolumes(sessions = [], rutina) {
  const rutinaMap = buildRutinaMap(rutina);
  const past = sessions.filter((s) => s.status !== 'active');
  return past
    .map((s) => {
      let volume = 0;
      for (const ex of s.exercises || []) {
        if (ex.completedAt == null) continue;
        const key = exerciseKey(ex);
        const rutinaEx = key != null ? rutinaMap.get(key) : undefined;
        if (!rutinaEx) continue;
        if (ex.weightUsed == null) continue;
        volume += rutinaEx.sets * rutinaEx.reps * ex.weightUsed;
      }
      const dateRef = s.endedAt || s.startedAt;
      return { sessionId: s.id, date: localDateKey(new Date(dateRef)), volume };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Builds a set of days that have ≥1 exercise with completedAt set.
 * Used by both buildFrequencyGrid and buildFrequencyStats.
 *
 * @param {Array} sessions
 * @returns {Set<string>} YYYY-MM-DD keys
 */
function qualifyingDays(sessions) {
  const days = new Set();
  for (const session of sessions) {
    for (const ex of session.exercises || []) {
      if (ex.completedAt == null) continue;
      days.add(localDateKey(new Date(ex.completedAt)));
    }
  }
  return days;
}

/**
 * Builds a 12×7 Monday-start calendar-heatmap grid (84 cells) covering the
 * trailing `weeks` weeks ending with the Sunday of the week containing
 * `todayKey`. A cell is filled iff that day has ≥1 session with ≥1 exercise
 * whose completedAt is set.
 *
 * @param {Array} sessions
 * @param {{weeks?: number, todayKey?: string, t?: (key: string) => string}} options
 * @returns {{cells: Array<{date: string, filled: boolean, ariaLabel: string}>, weeks: number}}
 */
export function buildFrequencyGrid(sessions = [], { weeks = 12, todayKey = localDateKey(), t = defaultT } = {}) {
  const filledDays = qualifyingDays(sessions);

  // Mon-start: getDay() Sun=0, Mon=1..Sat=6 → Mon-indexed: (getDay()+6)%7 → Mon=0..Sun=6
  const todayDate = new Date(todayKey + 'T12:00:00');
  const daysFromMonday = (todayDate.getDay() + 6) % 7;

  // Monday of current week
  const currentWeekMonday = new Date(todayDate);
  currentWeekMonday.setDate(todayDate.getDate() - daysFromMonday);

  // Grid starts (weeks-1) full weeks before the current week's Monday
  const gridStart = new Date(currentWeekMonday);
  gridStart.setDate(currentWeekMonday.getDate() - (weeks - 1) * 7);

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const dateKey = localDateKey(d);
    const filled = filledDays.has(dateKey);
    cells.push({
      date: dateKey,
      filled,
      ariaLabel: filled ? t('a11y.sessionCompleted') : t('a11y.noSession'),
    });
  }

  return { cells, weeks };
}

/**
 * Computes frequency stats:
 * - last7: count of qualifying days in the last 7 days (including today)
 * - last30: count of qualifying days in the last 30 days (including today)
 * - streak: consecutive qualifying days counting back from today (or from the
 *   most recent qualifying day if today has no session)
 *
 * @param {Array} sessions
 * @param {{todayKey?: string}} options
 * @returns {{last7: number, last30: number, streak: number}}
 */
export function buildFrequencyStats(sessions = [], { todayKey = localDateKey() } = {}) {
  const filledDays = qualifyingDays(sessions);

  if (filledDays.size === 0) return { last7: 0, last30: 0, streak: 0 };

  const today = new Date(todayKey + 'T12:00:00');
  let last7 = 0;
  let last30 = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localDateKey(d);
    if (filledDays.has(key)) {
      if (i < 7) last7++;
      last30++;
    }
  }

  // Streak: count back from today, or from the most recent qualifying day if today is empty
  let streakAnchor = todayKey;
  if (!filledDays.has(todayKey)) {
    const sortedDays = [...filledDays].sort().reverse();
    streakAnchor = sortedDays[0];
  }

  let streak = 0;
  const cursor = new Date(streakAnchor + 'T12:00:00');
  while (filledDays.has(localDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { last7, last30, streak };
}
