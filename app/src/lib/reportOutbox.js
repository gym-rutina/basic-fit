import { buildReport, reportKey, toWire } from './equipmentReports.js';
import { putReport, getReport, listReports } from './db.js';
import { scheduleFlush } from './reportFlush.js';

/**
 * club-equipment-reporting — the local report outbox (spec AC2/AC3/AC5/AC7/AC8,
 * tech-plan.md D5–D7). One pending record per (club, equipment) in the
 * IndexedDB `reportOutbox` store, so:
 *
 * - a re-tap REPLACES the pending report (last explicit signal wins) and the
 *   queue cannot grow per tap;
 * - an IMPLICIT present (an exercise was completed, AC3) never overrides or
 *   duplicates anything already pending — an explicit «No está» always wins;
 * - what later leaves the device is exactly the six wire fields (`toWire`).
 *
 * Every function is async and NEVER throws (AC7/AC8): a validation or
 * persistence failure is swallowed, so the caller's local effect (the
 * exclusion, the completion) is never blocked or undone.
 *
 * `deps = { db, now, newId, scheduleFlush }` exists for tests only.
 */

function resolveDb(deps) {
  return deps && deps.db ? deps.db : { putReport, getReport, listReports };
}

function resolveSchedule(deps) {
  return deps && typeof deps.scheduleFlush === 'function' ? deps.scheduleFlush : scheduleFlush;
}

/**
 * Enqueue an EXPLICIT report — «No está», an overlay checkbox, a catalog chip.
 * The payload is read field by field by `buildReport`; anything else on it
 * (notes, weight, difficulty …) is structurally dropped (AC18).
 *
 * @param {{clubId: string, equipmentId: string, signal: 'present'|'absent', method: 'session'|'catalog'}} payload
 * @param {{db?: object, now?: () => string, newId?: () => string, scheduleFlush?: () => void}} [deps]
 * @returns {Promise<void>}
 */
export async function enqueueReport(payload, deps = {}) {
  try {
    const report = buildReport(payload, deps);
    if (!report) return;
    const db = resolveDb(deps);
    await db.putReport({ key: reportKey(report.clubId, report.equipmentId), ...report, origin: 'explicit' });
    resolveSchedule(deps)();
  } catch {
    // Silent by design (AC7/AC8): the local effect is already applied.
  }
}

/**
 * Enqueue the IMPLICIT present-report for a completed exercise (AC3). A no-op
 * when anything is already pending for the key — never overrides an explicit
 * report, never duplicates an implicit one (D7).
 *
 * @param {{clubId: string, equipmentId: string}} input
 * @param {{db?: object, now?: () => string, newId?: () => string, scheduleFlush?: () => void}} [deps]
 * @returns {Promise<void>}
 */
export async function enqueueImplicitPresent(input, deps = {}) {
  try {
    const { clubId, equipmentId } = input || {};
    const report = buildReport({ clubId, equipmentId, signal: 'present', method: 'session' }, deps);
    if (!report) return;
    const db = resolveDb(deps);
    const key = reportKey(report.clubId, report.equipmentId);
    const existing = await db.getReport(key);
    if (existing) return;
    await db.putReport({ key, ...report, origin: 'implicit' });
    resolveSchedule(deps)();
  } catch {
    // Silent by design (AC7/AC8).
  }
}

/**
 * The pending reports in exact WIRE shape (no local-only `key`/`origin`),
 * oldest first. `[]` when the store cannot be read.
 *
 * @param {{db?: object}} [deps]
 * @returns {Promise<Array<object>>}
 */
export async function listPendingReports(deps = {}) {
  try {
    const rows = await resolveDb(deps).listReports();
    return Array.isArray(rows) ? rows.map(toWire) : [];
  } catch {
    return [];
  }
}
