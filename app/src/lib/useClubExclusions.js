import { useCallback, useEffect, useRef, useState } from 'react';
import { getClubExclusions, setClubExclusions, hasClubExclusionsRecord } from './db.js';
import { enqueueReport } from './reportOutbox.js';
import { isReportable } from './equipmentReports.js';
import { shippedDefaultFor } from '../data/clubEquipment.js';

/**
 * Reads and mutates one club's equipment-overlay exclusions (tech-plan-build-b.md D21).
 *
 * The tri-state is explicit rather than an accident of `useState(undefined)`:
 * `excludedIds === null` means "IndexedDB has not answered yet" and every
 * consumer must render UNFILTERED for that state; `new Set()` means
 * "loaded, nothing excluded". The two render identically today, which is
 * exactly why the distinction has to live in the type rather than in a
 * comment — a permanently-null hook would otherwise still pass a shallow
 * "renders unfiltered" check.
 *
 * `writeFailed` drives R7.3's inline note. The toggle applies in memory
 * FIRST, the write failure is recorded SECOND (R7.3 — the flow must never
 * be blocked by a persistence failure).
 *
 * club-equipment-reporting — this hook is THE single mutation path for club
 * membership (the Settings overlay, the Catálogo chip and the session «No está»
 * row all call `exclude`/`include`), so it is where the two new behaviours live,
 * once each:
 *
 * - REPORTING (AC2/AC5/AC10, D8): a REAL flip of a catalog id, with a club,
 *   enqueues an anonymous absent/present report with `method`. "Real" is
 *   decided against a ref mirror of the set OUTSIDE the state updater (an
 *   updater may run twice under StrictMode and must stay pure). Reporting never
 *   gates the local apply or the persist (AC8) and any failure is swallowed.
 * - SEEDING (AC12, D9): when the club has NO local record (`getClubExclusions`
 *   is `[]` AND `hasClubExclusionsRecord` is false) and the team shipped a
 *   default with a non-empty `absent` list, the local overlay is seeded from it
 *   and persisted — after which the local record is authoritative and the
 *   shipped default can never overwrite it. `excludedIds` stays `null` until
 *   that decision is made. Seeding is NOT a user signal and is never reported.
 *
 * @param {string|null} clubId
 * @param {{method?: 'session'|'catalog'}} [options] the surface the edits come from
 * @returns {{excludedIds: Set<string>|null, exclude: (id: string) => void, include: (id: string) => void, writeFailed: boolean}}
 */
export function useClubExclusions(clubId, { method = 'catalog' } = {}) {
  const [excludedIds, setExcludedIds] = useState(null);
  const [writeFailed, setWriteFailed] = useState(false);
  // Always equals the set the UI is (about to be) showing; see the docblock.
  const mirror = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    mirror.current = new Set();
    setExcludedIds(null);
    setWriteFailed(false);

    if (!clubId) return undefined;

    // Promise.resolve().then(...) so a synchronous throw from the db layer
    // degrades to "nothing excluded" like a rejection does.
    Promise.resolve()
      .then(() => getClubExclusions(clubId))
      .then(async (ids) => {
        const stored = Array.isArray(ids) ? ids : [];
        if (stored.length > 0) return new Set(stored);

        // AC12 — no exclusions stored: either a never-written club (seed it) or
        // a record the user emptied on purpose (authoritative — leave it).
        const shipped = shippedDefaultFor(clubId);
        const absent = shipped && Array.isArray(shipped.absent) ? shipped.absent : [];
        if (absent.length === 0) return new Set();
        if (await hasClubExclusionsRecord(clubId)) return new Set();

        const seeded = new Set(absent);
        // Silent by design: a failed seed write just means the next mount seeds
        // again. It never surfaces R7.3's note and is never a report.
        Promise.resolve()
          .then(() => setClubExclusions(clubId, Array.from(seeded)))
          .catch(() => {});
        return seeded;
      })
      .catch(() => new Set())
      .then((resolved) => {
        if (cancelled) return;
        mirror.current = resolved;
        setExcludedIds(resolved);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const persist = useCallback(
    (nextSet) => {
      if (!clubId) return;
      setClubExclusions(clubId, Array.from(nextSet))
        .then(() => setWriteFailed(false))
        .catch(() => setWriteFailed(true));
    },
    [clubId]
  );

  // AC2/AC5/AC10: the ONE place an equipment report is enqueued for club
  // membership. Fire-and-forget; nothing here can throw into the caller.
  const report = useCallback(
    (id, signal) => {
      if (!isReportable({ clubId, equipmentId: id })) return;
      try {
        Promise.resolve(enqueueReport({ clubId, equipmentId: id, signal, method })).catch(() => {});
      } catch {
        // AC8: the local effect is already applied.
      }
    },
    [clubId, method]
  );

  const exclude = useCallback(
    (id) => {
      const before = mirror.current;
      const next = new Set(before);
      next.add(id);
      mirror.current = next;
      setExcludedIds(next);
      persist(next);
      if (!before.has(id)) report(id, 'absent');
    },
    [persist, report]
  );

  const include = useCallback(
    (id) => {
      const before = mirror.current;
      const next = new Set(before);
      next.delete(id);
      mirror.current = next;
      setExcludedIds(next);
      persist(next);
      if (before.has(id)) report(id, 'present');
    },
    [persist, report]
  );

  return { excludedIds, exclude, include, writeFailed };
}
