import { describe, it, expect } from 'vitest';
import { resolveNextDayIndex } from './nextDay.js';

/**
 * home-next-workout-and-picker — spec.md § A (AC1–AC3, AC5–AC7).
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
 *   already builds) — the resolver stays zero-import and host-independent.
 * - Weekday-name matching is DELIBERATELY gone (AC3): this reverses
 *   pwa-ui-language AC18 by decision of the user on 2026-08-23 — see spec.md
 *   Summary. There is no `now` parameter; the proposal is calendar-blind.
 * - Stale/out-of-range guards: a rutina replaced by a shorter import can
 *   leave old completed sessions pointing past `dayCount` — those are
 *   ignored (fall back to 0) rather than crashing or proposing nonsense.
 *
 * Status: RED until Cmok creates nextDay.js (module does not exist yet).
 * Cmok also deletes today.js / today.test.js / today.locale.test.js in the
 * same change (tech-plan.md File Surgery).
 */

describe('resolveNextDayIndex', () => {
  it('proposes lastCompleted + 1 for a mid-program completion (AC1)', () => {
    // Newest-first: Día 2 (index 1) just finished → propose Día 3 (index 2).
    const sessions = [
      { dayIndex: 1, status: 'completed' },
      { dayIndex: 0, status: 'completed' },
    ];
    expect(resolveNextDayIndex(3, sessions)).toBe(2);
  });

  it('wraps to day 0 after completing the LAST day, on any cycle number (AC5)', () => {
    // The bug scenario, second lap: every index has history but rotation
    // must keep moving — last completed = 2 → propose 0, NOT stuck at 0-as-
    // fallback (fallback logic would use findIndex semantics over membership,
    // not the newest session).
    const fullCycle = [
      { dayIndex: 2, status: 'completed' },
      { dayIndex: 1, status: 'completed' },
      { dayIndex: 0, status: 'completed' },
    ];
    expect(resolveNextDayIndex(3, fullCycle)).toBe(0);
    // Same SET of completions in reversed order: now the most recent one is
    // dayIndex 0 → propose 1. Rotation follows RECENCY, not membership — an
    // implementation that ignores array order cannot pass both assertions.
    expect(resolveNextDayIndex(3, [...fullCycle].reverse())).toBe(1);
  });

  it('keeps rotating on the Nth pass — proposes 2 after another Día-2 completion (AC5)', () => {
    const twoCyclesIn = [
      { dayIndex: 1, status: 'completed' },
      { dayIndex: 0, status: 'completed' },
      { dayIndex: 2, status: 'completed' },
      { dayIndex: 1, status: 'completed' },
      { dayIndex: 0, status: 'completed' },
    ];
    expect(resolveNextDayIndex(3, twoCyclesIn)).toBe(2);
  });

  it('uses the MOST RECENTLY completed session when several exist (AC1)', () => {
    // Newest-first order: an older Día-3 completion sits below a newer
    // Día-2 one — the newer wins.
    const sessions = [
      { dayIndex: 1, status: 'completed' }, // newer
      { dayIndex: 2, status: 'completed' }, // older
    ];
    expect(resolveNextDayIndex(3, sessions)).toBe(2);
  });

  it('does NOT advance rotation on an abandoned attempt — re-proposes that day (AC6)', () => {
    // Last completed = Día 1 (index 0); user then started Día 2 and
    // abandoned it. Rotation never advanced, so Día 2 is proposed again.
    const sessions = [
      { dayIndex: 1, status: 'abandoned' },
      { dayIndex: 0, status: 'completed' },
    ];
    expect(resolveNextDayIndex(3, sessions)).toBe(1);
  });

  it('ignores active sessions entirely (they are neither completed nor final)', () => {
    const sessions = [{ dayIndex: 2, status: 'active' }];
    expect(resolveNextDayIndex(3, sessions)).toBe(0);
  });

  it('bootstraps at index 0 with no completed history (AC2)', () => {
    expect(resolveNextDayIndex(3, [])).toBe(0);
    expect(resolveNextDayIndex(3, undefined)).toBe(0);
    expect(resolveNextDayIndex(3, null)).toBe(0);
  });

  it('bootstraps at index 0 when history has no completions (AC2)', () => {
    const onlyAbandonedAndActive = [
      { dayIndex: 1, status: 'abandoned' },
      { dayIndex: 0, status: 'active' },
    ];
    expect(resolveNextDayIndex(3, onlyAbandonedAndActive)).toBe(0);
  });

  it('never crashes on a single-day rutina and always proposes it (AC7)', () => {
    expect(() => resolveNextDayIndex(1, [])).not.toThrow();
    expect(resolveNextDayIndex(1, [])).toBe(0);
    expect(resolveNextDayIndex(1, [{ dayIndex: 0, status: 'completed' }])).toBe(0); // (0+1) % 1
  });

  it('falls back to 0 when a stale session points past a SHORTER rutina', () => {
    // User imported a new 3-day program while history remembers a 6-day one.
    const staleHistory = [
      { dayIndex: 4, status: 'completed' },
      { dayIndex: 2, status: 'completed' },
    ];
    expect(resolveNextDayIndex(3, staleHistory)).toBe(0);
  });

  it('ignores malformed dayIndex values instead of producing NaN (defensive)', () => {
    expect(resolveNextDayIndex(3, [{ dayIndex: undefined, status: 'completed' }])).toBe(0);
    expect(resolveNextDayIndex(3, [{ dayIndex: -1, status: 'completed' }])).toBe(0);
    expect(resolveNextDayIndex(3, [{ status: 'completed' }])).toBe(0);
  });

  it('treats a degenerate dayCount (< 1) defensively as index 0', () => {
    expect(resolveNextDayIndex(0, [{ dayIndex: 0, status: 'completed' }])).toBe(0);
  });
});
