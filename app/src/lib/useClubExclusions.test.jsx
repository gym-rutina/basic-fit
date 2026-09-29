import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClubExclusions } from './useClubExclusions.js';

/**
 * club-equipment-reporting AC2/AC5/AC8/AC10/AC12 (tech-plan.md §2 D3/D4/D8).
 *
 * useClubExclusions is THE single mutation path for club membership — the
 * Settings overlay, the Catálogo chip and the session «No está» row all call
 * its exclude/include. So reporting is attached HERE, once (AC10), and
 * shipped-default seeding (AC12) happens in its load step, once. The hook had
 * no dedicated test file before this feature; this is it.
 *
 * Doubles: db.js is an in-memory per-club store (so the seeded record really
 * becomes authoritative on the next mount); reportOutbox.js and the shipped
 * defaults lookup are spies.
 */

const fx = vi.hoisted(() => {
  const store = new Map();
  const f = {
    store,
    getClubExclusions: vi.fn(async (id) => [...(store.get(id) ?? [])]),
    setClubExclusions: vi.fn(async (id, ids) => {
      store.set(id, [...ids]);
    }),
    hasClubExclusionsRecord: vi.fn(async (id) => store.has(id)),
    enqueueReport: vi.fn(async () => {}),
    shippedDefaultFor: vi.fn(() => null),
  };
  return f;
});

vi.mock('./db.js', () => ({
  getClubExclusions: fx.getClubExclusions,
  setClubExclusions: fx.setClubExclusions,
  hasClubExclusionsRecord: fx.hasClubExclusionsRecord,
}));
vi.mock('./reportOutbox.js', () => ({ enqueueReport: fx.enqueueReport }));
vi.mock('../data/clubEquipment.js', () => ({ shippedDefaultFor: fx.shippedDefaultFor }));

const CLUB = 'club-a';
const A = 'g3-s10';
const B = 'g3-s30';

beforeEach(() => {
  fx.store.clear();
  for (const k of ['getClubExclusions', 'setClubExclusions', 'hasClubExclusionsRecord', 'enqueueReport', 'shippedDefaultFor']) {
    fx[k].mockClear();
  }
  fx.enqueueReport.mockImplementation(async () => {});
  fx.shippedDefaultFor.mockImplementation(() => null);
});

async function loaded(clubId = CLUB, opts) {
  const hook = renderHook(() => useClubExclusions(clubId, opts));
  await waitFor(() => expect(hook.result.current.excludedIds).not.toBeNull());
  return hook;
}

describe('reporting attached to the single mutation path (AC2, AC5, AC10)', () => {
  it('exclude(id) enqueues an absent report with method "catalog" by default', async () => {
    const { result } = await loaded();
    act(() => result.current.exclude(A));
    expect(fx.enqueueReport).toHaveBeenCalledTimes(1);
    expect(fx.enqueueReport).toHaveBeenCalledWith({ clubId: CLUB, equipmentId: A, signal: 'absent', method: 'catalog' });
  });

  it('include(id) enqueues a present report', async () => {
    fx.store.set(CLUB, [A]);
    const { result } = await loaded();
    act(() => result.current.include(A));
    expect(fx.enqueueReport).toHaveBeenCalledWith({ clubId: CLUB, equipmentId: A, signal: 'present', method: 'catalog' });
  });

  it('the caller picks the method: {method: "session"} is carried through (the «No está» row)', async () => {
    const { result } = await loaded(CLUB, { method: 'session' });
    act(() => result.current.exclude(A));
    expect(fx.enqueueReport).toHaveBeenCalledWith({ clubId: CLUB, equipmentId: A, signal: 'absent', method: 'session' });
  });

  it('the payload holds exactly the four contract fields — nothing else can be threaded through (AC18)', async () => {
    const { result } = await loaded();
    act(() => result.current.exclude(A, { notes: 'x', weightUsed: 5 }));
    expect(Object.keys(fx.enqueueReport.mock.calls[0][0]).sort()).toEqual(['clubId', 'equipmentId', 'method', 'signal']);
  });

  it('does NOT report a no-op edit (excluding what is already excluded, including what is already included)', async () => {
    fx.store.set(CLUB, [A]);
    const { result } = await loaded();
    act(() => result.current.exclude(A));
    act(() => result.current.include(B));
    expect(fx.enqueueReport).not.toHaveBeenCalled();
  });

  it('reports each real flip once, in order', async () => {
    const { result } = await loaded();
    act(() => result.current.exclude(A));
    act(() => result.current.exclude(B));
    act(() => result.current.include(A));
    expect(fx.enqueueReport.mock.calls.map(([p]) => `${p.equipmentId}:${p.signal}`)).toEqual([`${A}:absent`, `${B}:absent`, `${A}:present`]);
  });

  it('does not report for a non-catalog id (gear / unresolved) — AC4', async () => {
    const { result } = await loaded();
    act(() => result.current.exclude('my-own-foam-roller'));
    expect(fx.enqueueReport).not.toHaveBeenCalled();
  });

  it('does not report without a club (clubId null)', async () => {
    const { result } = renderHook(() => useClubExclusions(null));
    act(() => result.current.exclude(A));
    expect(fx.enqueueReport).not.toHaveBeenCalled();
  });
});

describe('local effect is never gated on the report (AC8)', () => {
  it('a rejecting enqueue does not block the in-memory flip or the persisted write', async () => {
    fx.enqueueReport.mockRejectedValue(new Error('outbox down'));
    const { result } = await loaded();
    act(() => result.current.exclude(A));
    expect(result.current.excludedIds.has(A)).toBe(true);
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalledWith(CLUB, [A]));
  });

  it('a synchronously throwing enqueue does not block either', async () => {
    fx.enqueueReport.mockImplementation(() => {
      throw new Error('boom');
    });
    const { result } = await loaded();
    expect(() => act(() => result.current.exclude(A))).not.toThrow();
    expect(result.current.excludedIds.has(A)).toBe(true);
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalled());
  });

  it('a failed persist still enqueues the report, and writeFailed surfaces as before', async () => {
    fx.setClubExclusions.mockRejectedValueOnce(new Error('quota'));
    const { result } = await loaded();
    act(() => result.current.exclude(A));
    await waitFor(() => expect(result.current.writeFailed).toBe(true));
    expect(fx.enqueueReport).toHaveBeenCalledTimes(1);
    expect(result.current.excludedIds.has(A)).toBe(true);
  });

  it('applies and reports even while the initial load has not resolved (tri-state: null → still editable)', async () => {
    fx.getClubExclusions.mockImplementationOnce(() => new Promise(() => {}));
    const { result } = renderHook(() => useClubExclusions(CLUB));
    expect(result.current.excludedIds).toBeNull();
    act(() => result.current.exclude(A));
    expect(result.current.excludedIds.has(A)).toBe(true);
  });
});

describe('shipped-default seeding (AC12, AC10 of the data file)', () => {
  it('seeds the local overlay from the shipped default when the club has NO local record, and persists it', async () => {
    fx.shippedDefaultFor.mockImplementation((id) => (id === CLUB ? { absent: [A, B], present: [] } : null));
    const { result } = await loaded();
    expect([...result.current.excludedIds].sort()).toEqual([A, B].sort());
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalledTimes(1));
    expect([...fx.setClubExclusions.mock.calls[0][1]].sort()).toEqual([A, B].sort());
    expect(fx.store.has(CLUB)).toBe(true); // the seeded record is now the user's own — authoritative
  });

  it('seeding is NOT a user signal: it enqueues no report', async () => {
    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [A], present: [] }));
    await loaded();
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalled());
    expect(fx.enqueueReport).not.toHaveBeenCalled();
  });

  it('keeps the tri-state honest: excludedIds stays null until the seed decision is made — never a flash of "unseeded"', async () => {
    let resolveHas;
    fx.hasClubExclusionsRecord.mockImplementationOnce(() => new Promise((r) => (resolveHas = r)));
    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [A], present: [] }));
    const { result } = renderHook(() => useClubExclusions(CLUB));
    await waitFor(() => expect(fx.hasClubExclusionsRecord).toHaveBeenCalled());
    expect(result.current.excludedIds).toBeNull();
    resolveHas(false);
    await waitFor(() => expect(result.current.excludedIds).not.toBeNull());
    expect(result.current.excludedIds.has(A)).toBe(true);
  });

  it('NEVER overwrites an existing local record — even an EMPTY one (the user re-included everything)', async () => {
    fx.store.set(CLUB, []); // record exists, nothing excluded
    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [A, B], present: [] }));
    const { result } = await loaded();
    expect(result.current.excludedIds.size).toBe(0);
    expect(fx.setClubExclusions).not.toHaveBeenCalled();
  });

  it('a local record with content never even consults the shipped default', async () => {
    fx.store.set(CLUB, [B]);
    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [A], present: [] }));
    const { result } = await loaded();
    expect([...result.current.excludedIds]).toEqual([B]);
    expect(fx.hasClubExclusionsRecord).not.toHaveBeenCalled();
    expect(fx.setClubExclusions).not.toHaveBeenCalled();
  });

  it('with no shipped default for the club, nothing is seeded and no record is created', async () => {
    const { result } = await loaded();
    expect(result.current.excludedIds.size).toBe(0);
    expect(fx.hasClubExclusionsRecord).not.toHaveBeenCalled();
    expect(fx.setClubExclusions).not.toHaveBeenCalled();
    expect(fx.store.has(CLUB)).toBe(false);
  });

  it('a shipped default with an empty absent list creates no record (future defaults can still apply)', async () => {
    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [], present: [A] }));
    await loaded();
    expect(fx.setClubExclusions).not.toHaveBeenCalled();
  });

  it('a later default change never rewrites what was seeded: second mount reads the stored record', async () => {
    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [A], present: [] }));
    const first = await loaded();
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalledTimes(1));
    first.unmount();

    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [A, B], present: [] })); // new release ships more
    const second = await loaded();
    expect([...second.result.current.excludedIds]).toEqual([A]);
    expect(fx.setClubExclusions).toHaveBeenCalledTimes(1);
  });

  it('after seeding, a user edit is a normal reported edit', async () => {
    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [A], present: [] }));
    const { result } = await loaded();
    act(() => result.current.include(A));
    expect(fx.enqueueReport).toHaveBeenCalledWith({ clubId: CLUB, equipmentId: A, signal: 'present', method: 'catalog' });
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenLastCalledWith(CLUB, []));
  });

  it('a failing seed check degrades to "nothing excluded" without throwing', async () => {
    fx.hasClubExclusionsRecord.mockRejectedValueOnce(new Error('IDB'));
    fx.shippedDefaultFor.mockImplementation(() => ({ absent: [A], present: [] }));
    const { result } = await loaded();
    expect(result.current.excludedIds.size).toBe(0);
  });
});
