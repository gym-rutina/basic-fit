import { describe, it, expect } from 'vitest';
import {
  GYM_INDEX,
  COUNTRIES,
  TOTAL_CLUBS,
  citiesFor,
  loadClubs,
  findClubById,
  resolveLegacyGymId,
} from './gyms.js';

/**
 * gym-directory-and-catalog D2 / D18 — the app's single directory module.
 *
 * D1's whole no-loading-state guarantee rests on one property asserted here:
 * the INDEX is a static import and carries `countries[].cities[]`, so the
 * country and city dropdowns need no country file at all. Only the third
 * combobox needs a chunk, and its `import()` is kicked off in the
 * country-select handler — long before the user has picked a city.
 *
 * If `citiesFor` ever becomes async, ux-design §2's "loading: n/a" row for the
 * picker silently becomes false and every returning user gets a flash.
 */

describe('GYM_INDEX (D1 — static import)', () => {
  it('is available synchronously at module scope', () => {
    expect(GYM_INDEX).toBeDefined();
    expect(GYM_INDEX).not.toBeInstanceOf(Promise);
  });

  it('carries metadata with a club total', () => {
    expect(typeof GYM_INDEX.metadata.totalClubs).toBe('number');
    expect(GYM_INDEX.metadata.totalClubs).toBeGreaterThan(0);
  });
});

describe('COUNTRIES (D2)', () => {
  it('lists the six countries the scraper covers', () => {
    expect(COUNTRIES.map((c) => c.code).sort()).toEqual(['BE', 'DE', 'ES', 'FR', 'LU', 'NL']);
  });

  it('keeps the scraper\'s fixed order rather than sorting by club count', () => {
    // D2: sorting countries by count would reorder the picker on every
    // monthly refresh, moving the option under the user's finger.
    expect(COUNTRIES.map((c) => c.code)).toEqual(['NL', 'BE', 'FR', 'LU', 'ES', 'DE']);
  });

  it('gives every country trilingual names (never a bare code in the UI)', () => {
    for (const country of COUNTRIES) {
      expect(country.names.en).toBeTruthy();
      expect(country.names.es).toBeTruthy();
      expect(country.names.be).toBeTruthy();
    }
  });

  it('gives every country a non-empty city list', () => {
    for (const country of COUNTRIES) {
      expect(Array.isArray(country.cities)).toBe(true);
      expect(country.cities.length).toBeGreaterThan(0);
    }
  });
});

describe('TOTAL_CLUBS (AC45 — the Catálogo StatCard)', () => {
  it('reads the network-wide total from the index metadata', () => {
    expect(TOTAL_CLUBS).toBe(GYM_INDEX.metadata.totalClubs);
  });

  it('is the real scraped total, not a country count or a placeholder', () => {
    // The live storefront reports 1,727 clubs (NL 255 · BE 243 · FR 911 ·
    // LU 10 · ES 246 · DE 62). AC1 requires >= 1,700. Asserting a floor
    // rather than the exact number keeps a genuine monthly refresh from
    // reddening the suite while still catching the failure that matters:
    // TOTAL_CLUBS falling back to COUNTRIES.length (6) or to the old
    // GYMS.length (7).
    expect(TOTAL_CLUBS).toBeGreaterThanOrEqual(1700);
    expect(TOTAL_CLUBS).not.toBe(COUNTRIES.length);
    expect(TOTAL_CLUBS).not.toBe(7);
  });

  it('equals the sum of every country\'s per-city club counts (AC5)', () => {
    const summed = COUNTRIES.reduce(
      (total, country) => total + country.cities.reduce((n, city) => n + city.clubCount, 0),
      0
    );
    expect(summed).toBe(TOTAL_CLUBS);
  });
});

describe('citiesFor (D1 — no country file needed)', () => {
  it('returns cities synchronously from the index', () => {
    const cities = citiesFor('ES');
    expect(Array.isArray(cities)).toBe(true);
    expect(cities.length).toBeGreaterThan(0);
  });

  it('orders cities by club count descending, then by name (D2)', () => {
    // The picker's city list is then useful with no app-side sort — Madrid
    // first, matching ux-design.md's wireframe.
    const cities = citiesFor('ES');
    for (let i = 1; i < cities.length; i += 1) {
      const prev = cities[i - 1];
      const cur = cities[i];
      expect(
        prev.clubCount > cur.clubCount || (prev.clubCount === cur.clubCount && prev.name <= cur.name)
      ).toBe(true);
    }
  });

  it('gives every city a key, a display name and a club count', () => {
    /**
     * The index's `cities[]` entries carry `key`, NOT `cityKey` — that is the
     * shipped Build A contract, asserted at `scripts/lib/gym-scrape-core.test.js`
     * (`buildIndex` › keeps cities[] to key/name/clubCount and nothing heavier).
     * `cityKey` is the CLUB record's field (`buildCountryFile`). An earlier
     * version of this file asserted `city.cityKey`, which contradicted that
     * contract and was unsatisfiable — the two field names belong to two
     * different shapes and must not be conflated.
     */
    for (const city of citiesFor('ES')) {
      expect(Object.keys(city).sort()).toEqual(['clubCount', 'key', 'name']);
      expect(city.key).toBeTruthy();
      expect(city.name).toBeTruthy();
      expect(typeof city.clubCount).toBe('number');
    }
  });

  it('uses the same city vocabulary as the club records it indexes (cycle-9 correction)', () => {
    // Since cycle 9 (AC4 payload-budget correction — tech-plan-build-b.md
    // D6a), club records no longer carry `cityKey`; the picker matches a
    // selected city to its clubs by `city` (display name) instead. The
    // index's city `name` must therefore match the clubs' `city` values, or
    // the picker's city selection can never filter the club list.
    const names = new Set(citiesFor('ES').map((c) => c.name));
    expect(names.size).toBeGreaterThan(0);
    return loadClubs('ES').then((clubs) => {
      const orphans = [...new Set(clubs.map((c) => c.city))].filter((n) => !names.has(n));
      expect({ orphans }).toEqual({ orphans: [] });
    });
  });

  it('returns [] for an unknown country rather than throwing', () => {
    expect(citiesFor('XX')).toEqual([]);
    expect(citiesFor(undefined)).toEqual([]);
  });
});

describe('loadClubs (D1 — the lazy country chunk)', () => {
  it('resolves to the country\'s clubs', async () => {
    const clubs = await loadClubs('ES');
    expect(Array.isArray(clubs)).toBe(true);
    expect(clubs.length).toBeGreaterThan(0);
  });

  it('gives every club the permitted fields and no banned ones (AC4, cycle-9 correction)', async () => {
    const clubs = await loadClubs('ES');
    for (const club of clubs.slice(0, 25)) {
      expect(club.id).toMatch(/^[0-9a-f]{32}$/);
      expect(club.name).toBeTruthy();
      expect(club.city).toBeTruthy();
      expect(club.address).toBeTruthy();
      // AC4 — opening hours and club URLs never enter the shipped data.
      // coordinates and cityKey were dropped this cycle (tech-plan-build-b.md
      // D6a) to bring the real payload under AC4's ≤300KB cap — the shipped
      // 604.9KB with both fields present was 2x over budget.
      expect(club.hours).toBeUndefined();
      expect(club.url).toBeUndefined();
      expect(club.coordinates).toBeUndefined();
      expect(club.cityKey).toBeUndefined();
    }
  });

  it('matches the index\'s per-city counts (AC5)', async () => {
    const clubs = await loadClubs('ES');
    const fromIndex = citiesFor('ES').reduce((n, c) => n + c.clubCount, 0);
    expect(clubs.length).toBe(fromIndex);
  });

  it('resolves to [] for an unknown country rather than rejecting', async () => {
    await expect(loadClubs('XX')).resolves.toEqual([]);
  });
});

describe('findClubById', () => {
  it('finds a club that exists', async () => {
    const clubs = await loadClubs('ES');
    const target = clubs[0];
    expect(await findClubById('ES', target.id)).toEqual(target);
  });

  it('resolves to null for an id that is not in the country (D16)', async () => {
    // The miss is what drives D16's stale-club degradation, so it must be a
    // clean null — never a throw, which would take down the whole trigger.
    await expect(findClubById('ES', 'f'.repeat(32))).resolves.toBeNull();
  });
});

describe('resolveLegacyGymId (AC33, AC10 — tech-plan D8, cycle-9 correction)', () => {
  // Verified against the real scraped data (data/gyms/ES.json) by matching
  // each pre-Build-B `data/gyms.json` legacy record (git rev e596c91~1) to
  // its real club by name+address — see Bagnik's cycle-8 code-QA return
  // entry (handoff-log.md, 04:15) for the full derivation. The cycle-8
  // version of this test asserted only `club.id`, which passed while gymId 3
  // resolved to a club 1,000km from Málaga (A Coruña). Pinning the exact
  // expected id AND city per legacyId is what makes this test capable of
  // catching that class of bug.
  const EXPECTED_BY_LEGACY_ID = {
    1: { id: 'a435aa51b62e43ea8fb5d8bb5d643a78', city: 'Málaga' },
    2: { id: 'e33f130aad2b423fa94bb27502b138c6', city: 'Málaga' },
    3: { id: '85c4896006bc45d89f562c977651600c', city: 'Málaga' },
    4: { id: '18eab10cbcc84775a1d3faa95223a56a', city: 'Málaga' },
    5: { id: 'ede4d9d858804c2baaac9c08e4dc269e', city: 'Málaga' },
    6: { id: 'faf211e37b4d4ee98493fe825cf45d67', city: 'Málaga' },
    // legacyId 7 is Rincón de la Victoria, a neighbouring town — not
    // literally Málaga, despite AC10's "7 Málaga clubs" wording (a
    // pre-existing wording imprecision noted in spec.md, not a resolution
    // bug — see the AC10 note added this cycle).
    7: { id: '5c43f08f993e4e1fab21f033ebac2e51', city: 'Rincón de la Victoria' },
  };

  it.each(Object.entries(EXPECTED_BY_LEGACY_ID))(
    'resolves legacyId %s to the correct real club, not merely a non-null one',
    async (legacyId, expected) => {
      const club = await resolveLegacyGymId(Number(legacyId));
      expect(club).not.toBeNull();
      expect(club.id).toBe(expected.id);
      expect(club.city).toBe(expected.city);
    }
  );

  it('resolves to null for an id outside the legacy range', async () => {
    await expect(resolveLegacyGymId(8)).resolves.toBeNull();
    await expect(resolveLegacyGymId(0)).resolves.toBeNull();
    await expect(resolveLegacyGymId(undefined)).resolves.toBeNull();
  });

  it('accepts a numeric string, since an imported rutina may carry either', async () => {
    const fromNumber = await resolveLegacyGymId(3);
    const fromString = await resolveLegacyGymId('3');
    expect(fromString).toEqual(fromNumber);
  });
});
