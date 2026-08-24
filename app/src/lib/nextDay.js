/**
 * Next-day resolution — pure rotation from completed-session history.
 *
 * Replaces `resolveTodayDay` (today.js), whose fallback ("first day never
 * completed across ALL history") permanently collapsed to index 0 after one
 * full cycle through the program — the reported "proposes the same workout"
 * bug. The new contract is pure rotation: most recently COMPLETED session's
 * dayIndex + 1, mod dayCount.
 *
 * Contract notes (tech-plan.md):
 * - `pastSessions` arrives NEWEST-FIRST, per listSessions()'s contract — so
 *   "most recent completed" is simply `.find(s => s.status === 'completed')`.
 *   Items carry only `{ dayIndex, status }` (the exact mapping HomeScreen
 *   already builds) — this module stays zero-import and host-independent.
 * - Weekday-name matching is DELIBERATELY gone (AC3): this reverses
 *   pwa-ui-language AC18 by decision of the user on 2026-08-23 — see spec.md
 *   Summary. There is no `now` parameter; the proposal is calendar-blind.
 * - Stale/out-of-range guards: a rutina replaced by a shorter import can
 *   leave old completed sessions pointing past `dayCount`; malformed rows
 *   can carry missing or negative dayIndex. Those fall back to 0 rather
 *   than crashing or proposing nonsense.
 */

/**
 * @param {number} dayCount - rutina.days.length (schema floor minItems: 1)
 * @param {Array<{dayIndex: number, status: string>} | undefined | null} pastSessions
 *        newest-first, as built by HomeScreen's listSessions() mapping
 * @returns {number} index into rutina.days to propose next
 */
export function resolveNextDayIndex(dayCount, pastSessions = []) {
  if (!Number.isInteger(dayCount) || dayCount < 1) return 0;
  const lastCompleted = (pastSessions || []).find(
    (s) =>
      s &&
      s.status === 'completed' &&
      Number.isInteger(s.dayIndex) &&
      s.dayIndex >= 0 &&
      s.dayIndex < dayCount
  );
  if (!lastCompleted) return 0;
  return (lastCompleted.dayIndex + 1) % dayCount;
}
