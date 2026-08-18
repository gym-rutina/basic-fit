import { useCallback, useEffect, useState } from 'react';
import { getClubExclusions, setClubExclusions } from './db.js';

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
 * @param {string|null} clubId
 * @returns {{excludedIds: Set<string>|null, exclude: (id: string) => void, include: (id: string) => void, writeFailed: boolean}}
 */
export function useClubExclusions(clubId) {
  const [excludedIds, setExcludedIds] = useState(null);
  const [writeFailed, setWriteFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setExcludedIds(null);
    setWriteFailed(false);

    if (!clubId) return undefined;

    getClubExclusions(clubId)
      .then((ids) => {
        if (!cancelled) setExcludedIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setExcludedIds(new Set());
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

  const exclude = useCallback(
    (id) => {
      setExcludedIds((prev) => {
        const next = new Set(prev || []);
        next.add(id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const include = useCallback(
    (id) => {
      setExcludedIds((prev) => {
        const next = new Set(prev || []);
        next.delete(id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { excludedIds, exclude, include, writeFailed };
}
