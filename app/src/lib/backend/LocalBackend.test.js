import { describe, it, expect, vi, afterEach } from 'vitest';
import { LocalBackend } from './LocalBackend.js';
import { BackendError } from './errors.js';

/**
 * backend-bootstrap AC13 (tech-plan.md §2 D4) — LocalBackend IS today's app:
 * no server, no account, no network, no storage writes. Every remote method
 * rejects with `backend_unavailable`, which callers treat as "act as the
 * offline free app" (cloud spec AC1/AC2/AC6).
 *
 * AMENDED vs spec AC13 (tech-plan §2 D4): the seam has NO club-equipment
 * method at all. The report path is `useClubExclusions → reportOutbox →
 * reportFlush` and stays the only one; a second entry point would have to call
 * `enqueueReport(`, which club-equipment-reporting's AC10 guard forbids outside
 * `useClubExclusions.js`.
 */

afterEach(() => vi.restoreAllMocks());

const REMOTE_METHODS = {
  signUp: [{ email: 'a@b.c', password: 'x' }],
  signIn: [{ email: 'a@b.c', password: 'x' }],
  getAccount: [],
  deleteAccount: [],
  getCreditPacks: ['es'],
  getCreditBalance: [],
  startCheckout: [{ packId: 'pack' }],
  getSubscription: [],
  startSubscriptionCheckout: [{ plan: 'plus', locale: 'es', consent: { version: '1', accepted: true } }],
  openSubscriptionPortal: [],
  submitWithdrawal: [{ purchaseRef: 'x' }],
  startGeneration: [{}],
  getGeneration: ['job-1'],
  setSyncEnabled: [true],
  fetchSnapshot: [],
  pushSnapshot: [{}, '"1"'],
};

describe('LocalBackend', () => {
  it('is not remote and has no session', () => {
    const b = new LocalBackend();
    expect(b.isRemote).toBe(false);
    expect(b.getSession()).toBeNull();
  });

  it.each(Object.entries(REMOTE_METHODS))('%s rejects with backend_unavailable', async (method, args) => {
    const b = new LocalBackend();
    expect(typeof b[method], `${method} must exist`).toBe('function');
    await expect(b[method](...args)).rejects.toMatchObject({ code: 'backend_unavailable' });
    await expect(b[method](...args)).rejects.toBeInstanceOf(BackendError);
  });

  it('signOut is idempotent (already signed out) and resolves', async () => {
    await expect(new LocalBackend().signOut()).resolves.toBeUndefined();
  });

  it('never touches the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const b = new LocalBackend();
    await Promise.allSettled(Object.entries(REMOTE_METHODS).map(([m, a]) => b[m](...a)));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('never writes storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const b = new LocalBackend();
    await Promise.allSettled(Object.entries(REMOTE_METHODS).map(([m, a]) => b[m](...a)));
    expect(setItem).not.toHaveBeenCalled();
  });

  it('has NO club-equipment method — the report path stays reportOutbox/reportFlush (D4)', () => {
    const b = new LocalBackend();
    expect('submitClubEquipmentReport' in b).toBe(false);
    expect('drainClubEquipmentOutbox' in b).toBe(false);
  });
});
