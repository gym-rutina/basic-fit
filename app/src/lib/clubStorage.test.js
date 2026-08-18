import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CLUB_KEY, readClub, writeClub, clearClub, isStale } from './clubStorage.js';

/**
 * gym-directory-and-catalog R5.5 + D16 (tech-plan.md D3).
 *
 * Selection lives in localStorage, NOT IndexedDB, and the reason is a UX
 * one that these tests pin: the read must be synchronous so GuideOverlay's
 * trigger and CatalogScreen's club row render correctly on the FIRST paint.
 * An async read would flash "Selecciona tu club" at every returning user.
 *
 * D16 is the half that is easy to skip and expensive to get wrong. The
 * directory is re-scraped monthly (M13) and a club's GUID is the only join
 * key. When a persisted club vanishes from a later refresh, the app must
 * DEGRADE — show the cached name with a re-select affordance — not crash and
 * not silently forget the user's choice. That is why the record caches
 * display fields instead of storing a bare id.
 */

const CLUB = {
  countryCode: 'ES',
  clubId: '1ec43550fd654c7d8e23bc6c96cd2ff0',
  name: 'Alameda',
  address: 'Av. de Andalucía 12',
  city: 'Málaga',
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('CLUB_KEY', () => {
  it('follows the existing rutina: namespace convention', () => {
    // Same convention as rutina:uiLang / rutina:onboardingSeen. This string
    // also needs a strayLiterals.test.js allowlist entry for the documented
    // reason those two have one (it is an identifier, not user-visible copy).
    expect(CLUB_KEY).toBe('rutina:club');
  });
});

describe('readClub / writeClub (R5.5)', () => {
  it('returns null when nothing is stored', () => {
    expect(readClub()).toBeNull();
  });

  it('round-trips the full record including the cached display fields', () => {
    writeClub(CLUB);
    expect(readClub()).toEqual(CLUB);
  });

  it('caches name, address and city — not just the id (D16)', () => {
    // A bare-id record cannot render the trigger when the club has vanished
    // from the directory, which is precisely the degradation D16 requires.
    writeClub(CLUB);
    const stored = readClub();
    expect(stored.name).toBe('Alameda');
    expect(stored.address).toBe('Av. de Andalucía 12');
    expect(stored.city).toBe('Málaga');
    expect(stored.countryCode).toBe('ES');
  });

  it('reads synchronously — the returned value is usable in the same tick', () => {
    // Pins D3's core claim. If this ever becomes a promise, the no-flash
    // guarantee on first paint is gone and the UX states matrix's "loading:
    // n/a" row becomes a lie.
    writeClub(CLUB);
    const result = readClub();
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.clubId).toBe(CLUB.clubId);
  });

  it('overwrites a previous selection rather than appending', () => {
    writeClub(CLUB);
    writeClub({ ...CLUB, clubId: 'other', name: 'Teatinos' });
    expect(readClub().clubId).toBe('other');
    expect(readClub().name).toBe('Teatinos');
  });

  it('survives a corrupt stored value by returning null, not throwing', () => {
    localStorage.setItem(CLUB_KEY, '{not json');
    expect(readClub()).toBeNull();
  });

  it('returns null for a stored value that is valid JSON but not a club record', () => {
    localStorage.setItem(CLUB_KEY, '"just a string"');
    expect(readClub()).toBeNull();
    localStorage.setItem(CLUB_KEY, '{"nope":1}');
    expect(readClub()).toBeNull();
  });

  it('never throws when storage is unavailable (private browsing)', () => {
    // Same defensive convention as uiLangStorage/onboardingStorage: a device
    // with storage disabled must lose the preference, not fail to boot.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => readClub()).not.toThrow();
    expect(readClub()).toBeNull();
  });

  it('never throws when a write is rejected (quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeClub(CLUB)).not.toThrow();
  });
});

describe('clearClub', () => {
  it('removes the selection', () => {
    writeClub(CLUB);
    clearClub();
    expect(readClub()).toBeNull();
  });

  it('is safe to call when nothing is stored', () => {
    expect(() => clearClub()).not.toThrow();
  });
});

describe('isStale — D16 degradation', () => {
  /**
   * `isStale` is the separate resolution step D16 requires: readClub()
   * returns the record verbatim, and resolving it against the directory is
   * a DIFFERENT call, so a vanished club never blanks the trigger.
   */
  it('reports a club still present in the directory as fresh', () => {
    expect(isStale(CLUB, [{ id: CLUB.clubId }, { id: 'zzz' }])).toBe(false);
  });

  it('reports a club absent from a later refresh as stale', () => {
    expect(isStale(CLUB, [{ id: 'zzz' }])).toBe(true);
  });

  it('treats a null selection as not stale — there is nothing to degrade', () => {
    expect(isStale(null, [{ id: 'zzz' }])).toBe(false);
  });

  it('does NOT treat an unresolved directory as stale (X — the dangerous default)', () => {
    // The country chunk may not have loaded yet. Reporting "stale" here would
    // show every returning user a spurious "re-select your club" prompt on
    // every cold start. Undefined means "cannot tell", which is not "gone".
    expect(isStale(CLUB, undefined)).toBe(false);
    expect(isStale(CLUB, null)).toBe(false);
  });

  it('treats an empty club list as inconclusive, not as proof of removal', () => {
    // An empty array is what a failed/partial chunk load looks like. Same
    // reasoning as above: never delete a user's correction on weak evidence.
    expect(isStale(CLUB, [])).toBe(false);
  });
});
