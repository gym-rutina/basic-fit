// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  parseStoreTiles,
  parseMapFeatures,
  joinMapAndTiles,
  normalizeCityKey,
  pickCityDisplayName,
  paginate,
  buildCountryFile,
  buildIndex,
  countryCountDropExceeded,
  LEGACY_CLUBS,
  MAX_PAGE_SIZE,
  IncompleteDirectoryError,
} from './gym-scrape-core.js';

import page1 from '../fixtures/gyms/store-finder-more-es-page1.json';
import page2 from '../fixtures/gyms/store-finder-more-es-page2.json';
import mapEs from '../fixtures/gyms/store-finder-map-es.json';

/**
 * spec.md S1 — the directory scraper's pure core.
 *
 * Every test here runs with NO network and NO filesystem (AC7). That is a
 * property of the architecture, not of mocking: tech-plan.md D5 puts the
 * page loop behind an injected `fetchPage`, so the fixture below IS the
 * upstream as far as this module is concerned.
 *
 * The reason this file is the most important one in Build A: X5's failure
 * mode is silent. An incomplete page comes back HTTP 200, so a wrong loop
 * writes 300 French clubs instead of 911 and every count check downstream
 * passes. Nothing but this file catches that.
 */

const PAGES = [page1, page2];

/** Fixture-backed stand-in for the real axios call. Records what it was asked for. */
function fixtureFetcher({ pages = PAGES } = {}) {
  const calls = [];
  return {
    calls,
    fetchPage: async ({ start, sz }) => {
      calls.push({ start, sz });
      const page = pages.find((p) => p.pageStart === start);
      if (!page) throw new Error(`fixture has no page starting at ${start}`);
      return page;
    },
  };
}

describe('paginate (R1.2, AC6, AC7 — X5, the silent-truncation guard)', () => {
  it('keeps fetching while isComplete is false and returns every page\'s tiles', async () => {
    const { fetchPage } = fixtureFetcher();

    const { tiles, pages } = await paginate({ fetchPage, sz: 4 });

    // Page 1 alone carries 4 tiles and comes back HTTP 200. A loop that
    // stops there returns 4 and looks completely healthy — this assertion
    // is the whole point of the fixture spanning a page boundary.
    expect(pages).toBe(2);
    expect(tiles).toHaveLength(7);
  });

  it('stops ONLY on isComplete: true', async () => {
    const { fetchPage, calls } = fixtureFetcher();

    await paginate({ fetchPage, sz: 4 });

    expect(calls).toEqual([
      { start: 0, sz: 4 },
      { start: 4, sz: 4 },
    ]);
  });

  it('throws IncompleteDirectoryError when the loop ends without isComplete: true (AC6)', async () => {
    // France's real shape, truncated: every page reports isComplete:false and
    // the page cap is reached. The ONLY acceptable outcome is a throw —
    // returning what was collected is exactly the 300-instead-of-911 bug.
    const neverComplete = async ({ start }) => ({
      pageStart: start,
      pageSize: 4,
      isComplete: false,
      storeTilesHtml: page1.storeTilesHtml,
    });

    await expect(paginate({ fetchPage: neverComplete, sz: 4, maxPages: 3 })).rejects.toBeInstanceOf(
      IncompleteDirectoryError
    );
  });

  it('throws rather than returning a short result when a page comes back empty', async () => {
    const emptyThenNothing = async ({ start }) =>
      start === 0
        ? page1
        : { pageStart: start, pageSize: 4, isComplete: false, storeTilesHtml: '' };

    await expect(paginate({ fetchPage: emptyThenNothing, sz: 4, maxPages: 5 })).rejects.toBeInstanceOf(
      IncompleteDirectoryError
    );
  });

  it('never requests a page size above 300 (sz >= 400 is HTTP 500 on fr_FR)', async () => {
    const { fetchPage, calls } = fixtureFetcher();

    await paginate({ fetchPage, sz: 1000 });

    expect(MAX_PAGE_SIZE).toBe(300);
    for (const call of calls) {
      expect(call.sz).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    }
  });

  it('advances start by the tiles actually returned, not by the requested sz', async () => {
    // A short page mid-run must not make the loop skip clubs. Page 1 here
    // returns 4 tiles for a requested sz of 10; the next start must be 4.
    const shortFirstPage = async ({ start }) => {
      if (start === 0) return { ...page1, pageSize: 10 };
      if (start === 4) return { ...page2, pageStart: 4, pageSize: 10 };
      throw new Error(`unexpected start ${start}`);
    };

    const { tiles } = await paginate({ fetchPage: shortFirstPage, sz: 10 });

    expect(tiles).toHaveLength(7);
  });
});

describe('parseStoreTiles (R1.6, AC3, AC4)', () => {
  const tiles = () => parseStoreTiles(page1.storeTilesHtml);

  it('extracts id, name, address and city from every tile', () => {
    const parsed = tiles();

    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toMatchObject({
      id: '1ec43550fd654c7d8e23bc6c96cd2ff0',
      name: 'Centro Comercial Alameda',
      city: 'Málaga',
    });
  });

  it('strips the trailing comma the storefront leaves on .store-tile-street', () => {
    const [alameda, conangla] = tiles();

    expect(alameda.address).toBe('Avda. Andalucía s/n, Centro Comercial Alameda');
    // Interior commas must survive — only the trailing one goes.
    expect(conangla.address).toBe('Calle Alcalde Conangla 9');
  });

  it('keeps name and address as separate values even when they are near-identical (X9)', () => {
    const [sanJuan] = parseStoreTiles(page2.storeTilesHtml);

    // 34 of 246 ES club names ARE their own street. Collapsing them to one
    // field is what makes a 37-club Madrid dropdown unusable.
    expect(sanJuan.name).toBe('Calle San Juan 33');
    expect(sanJuan.address).toBe('Calle San Juan 33');
  });

  it('returns an empty array for empty html rather than throwing', () => {
    expect(parseStoreTiles('')).toEqual([]);
  });
});

describe('parseMapFeatures + joinMapAndTiles (R1.3, AC3)', () => {
  it('reads coordinates as [lng, lat], not [lat, lng]', () => {
    const coords = parseMapFeatures(mapEs);

    // Málaga is 36.7N, 4.4W. Swapping the pair yields lat -4.42, which is in
    // the Gulf of Guinea — and no club count would notice.
    expect(coords.get('1ec43550fd654c7d8e23bc6c96cd2ff0')).toEqual({ lat: 36.7213, lng: -4.4214 });
  });

  it('joins coordinates onto tiles by club GUID', () => {
    const clubs = joinMapAndTiles(parseStoreTiles(page1.storeTilesHtml), parseMapFeatures(mapEs));

    expect(clubs.find((c) => c.id === '2a1b3c4d5e6f70819a2b3c4d5e6f7081').coordinates).toEqual({
      lat: 40.4168,
      lng: -3.7038,
    });
  });

  it('keeps a club that has no map feature instead of dropping it', () => {
    const tiles = parseStoreTiles(page2.storeTilesHtml);
    const clubs = joinMapAndTiles(tiles, parseMapFeatures(mapEs));

    const orphan = clubs.find((c) => c.id === '7f60819a2b3c4d5e6f708192a3b4c5d6');
    expect(orphan).toBeDefined();
    expect(orphan.coordinates).toBeUndefined();
    expect(clubs).toHaveLength(3);
  });
});

describe('city normalisation (R1.4, AC9)', () => {
  it('collapses accent variants onto one grouping key', () => {
    expect(normalizeCityKey('A Coruña')).toBe(normalizeCityKey('A Coruna'));
    expect(normalizeCityKey('Torrejón de Ardoz')).toBe(normalizeCityKey('Torrejon de Ardoz'));
    expect(normalizeCityKey('A Coruña')).toBe('a-coruna');
    expect(normalizeCityKey('Torrejón de Ardoz')).toBe('torrejon-de-ardoz');
  });

  it.each([
    ['A Coruna', 'A Coruña', 'A Coruña'],
    ['Cornella', 'Cornellà de Llobregat', 'Cornellà de Llobregat'],
    ['Gijon', 'Gijón', 'Gijón'],
    ['Leganes', 'Leganés', 'Leganés'],
    ['Logrono', 'Logroño', 'Logroño'],
    ['Torrejon de Ardoz', 'Torrejón de Ardoz', 'Torrejón de Ardoz'],
  ])('picks the accented display name for %s / %s', (plain, accented, expected) => {
    expect(pickCityDisplayName([plain, accented])).toBe(expected);
    expect(pickCityDisplayName([accented, plain])).toBe(expected);
  });

  it('lets diacritics beat frequency — the case a frequency-only rule gets wrong', () => {
    // The spec's own counterexample: the unaccented spelling is MORE common.
    expect(
      pickCityDisplayName(['Torrejon de Ardoz', 'Torrejon de Ardoz', 'Torrejón de Ardoz'])
    ).toBe('Torrejón de Ardoz');
  });

  it('breaks a genuine tie by frequency', () => {
    expect(pickCityDisplayName(['Madrid', 'Madrid', 'MADRID'])).toBe('Madrid');
  });
});

describe('buildCountryFile (R1.6, AC3, AC4, AC8)', () => {
  const clubsFor = () =>
    joinMapAndTiles(
      [...parseStoreTiles(page1.storeTilesHtml), ...parseStoreTiles(page2.storeTilesHtml)],
      parseMapFeatures(mapEs)
    );

  it('emits only the six permitted fields plus optional legacyId (D6)', () => {
    const file = buildCountryFile('ES', clubsFor());

    expect(file.country).toBe('ES');
    for (const club of file.clubs) {
      expect(Object.keys(club).sort()).toEqual(
        expect.arrayContaining(['address', 'city', 'cityKey', 'id', 'name'])
      );
      const allowed = ['id', 'legacyId', 'name', 'cityKey', 'city', 'address', 'coordinates'];
      expect(Object.keys(club).filter((k) => !allowed.includes(k))).toEqual([]);
    }
  });

  it('never stores hours or url, even though the tiles carry both (AC4)', () => {
    // Both fields are present in the fixture HTML and are 59% of the payload.
    // Parsed-and-discarded, not never-parsed — so this has to be asserted on
    // the OUTPUT, not on the parser.
    const file = buildCountryFile('ES', clubsFor());
    const serialized = JSON.stringify(file);

    expect(serialized).not.toContain('hours');
    expect(serialized).not.toContain('06:00-23:00');
    expect(serialized).not.toContain('js-store-tile-link');
    expect(serialized).not.toContain('/es-ES/club/');
    for (const club of file.clubs) {
      expect(club).not.toHaveProperty('hours');
      expect(club).not.toHaveProperty('url');
    }
  });

  it('gives every club a non-empty id, name, city, cityKey and address (AC3)', () => {
    for (const club of buildCountryFile('ES', clubsFor()).clubs) {
      expect(club.id).toMatch(/^[0-9a-f]{32}$/);
      expect(club.name.length).toBeGreaterThan(0);
      expect(club.city.length).toBeGreaterThan(0);
      expect(club.cityKey).toBe(normalizeCityKey(club.city));
      expect(club.address.length).toBeGreaterThan(0);
    }
  });

  it('resolves every accent variant in a city group to one display name (AC9)', () => {
    const cities = new Set(buildCountryFile('ES', clubsFor()).clubs.map((c) => c.city));

    expect(cities.has('A Coruña')).toBe(true);
    expect(cities.has('A Coruna')).toBe(false);
    expect(cities.has('Torrejón de Ardoz')).toBe(true);
    expect(cities.has('Torrejon de Ardoz')).toBe(false);
  });

  it('is order-independent, so an unchanged upstream re-run is byte-identical (AC8)', () => {
    const clubs = clubsFor();
    const shuffled = [clubs[4], clubs[0], clubs[6], clubs[2], clubs[5], clubs[1], clubs[3]];

    expect(JSON.stringify(buildCountryFile('ES', shuffled))).toBe(
      JSON.stringify(buildCountryFile('ES', clubs))
    );
  });

  it('stamps legacyId on the known Málaga clubs and on nothing else (AC10)', () => {
    const file = buildCountryFile('ES', clubsFor());

    const alameda = file.clubs.find((c) => c.id === '1ec43550fd654c7d8e23bc6c96cd2ff0');
    expect(alameda.legacyId).toBe(3);

    for (const club of file.clubs) {
      if (LEGACY_CLUBS[club.id] === undefined) {
        expect(club).not.toHaveProperty('legacyId');
      }
    }
  });
});

describe('LEGACY_CLUBS (R1.5, AC10, AC33 — tech-plan D8)', () => {
  it('maps exactly the seven original gyms to ids 1..7', () => {
    const entries = Object.entries(LEGACY_CLUBS);

    expect(entries).toHaveLength(7);
    expect(Object.values(LEGACY_CLUBS).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('is keyed by 32-hex club GUID, not by name (X9 — names are unreliable join keys)', () => {
    for (const guid of Object.keys(LEGACY_CLUBS)) {
      expect(guid).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('keeps the one GUID already verified in the spec pointing at gymId 3', () => {
    // Every existing rutina with `gymId: 3` resolves through this entry.
    expect(LEGACY_CLUBS['1ec43550fd654c7d8e23bc6c96cd2ff0']).toBe(3);
  });

  it('is frozen, so a scrape run cannot mutate the legacy mapping', () => {
    expect(Object.isFrozen(LEGACY_CLUBS)).toBe(true);
  });
});

describe('buildIndex (D2, AC1, AC5)', () => {
  const country = (code, clubs) => ({
    code,
    names: { en: code, es: code, be: code },
    locale: `${code.toLowerCase()}_${code}`,
    file: `${code}.json`,
    clubs,
  });

  const esClubs = () =>
    buildCountryFile(
      'ES',
      joinMapAndTiles(
        [...parseStoreTiles(page1.storeTilesHtml), ...parseStoreTiles(page2.storeTilesHtml)],
        parseMapFeatures(mapEs)
      )
    ).clubs;

  it('totals every country\'s clubs into metadata.totalClubs (AC1)', () => {
    const index = buildIndex({
      lastUpdated: '2026-08-15',
      countries: [country('ES', esClubs()), country('DE', [])],
    });

    expect(index.metadata.totalClubs).toBe(7);
    expect(index.countries).toHaveLength(2);
    expect(index.countries.find((c) => c.code === 'ES').clubCount).toBe(7);
  });

  it('gives each country a cities[] whose counts equal the real per-city counts (AC5)', () => {
    const index = buildIndex({ lastUpdated: '2026-08-15', countries: [country('ES', esClubs())] });
    const cities = index.countries[0].cities;

    const summed = cities.reduce((n, c) => n + c.clubCount, 0);
    expect(summed).toBe(7);
    expect(cities.find((c) => c.key === 'torrejon-de-ardoz')).toEqual({
      key: 'torrejon-de-ardoz',
      name: 'Torrejón de Ardoz',
      clubCount: 3,
    });
    expect(cities.find((c) => c.key === 'a-coruna').clubCount).toBe(2);
  });

  it('orders cities by club count descending so the picker\'s default list is useful', () => {
    const cities = buildIndex({
      lastUpdated: '2026-08-15',
      countries: [country('ES', esClubs())],
    }).countries[0].cities;

    expect(cities.map((c) => c.key)).toEqual([
      'torrejon-de-ardoz',
      'a-coruna',
      'madrid',
      'malaga',
    ]);
  });

  it('keeps cities[] to key/name/clubCount and nothing heavier', () => {
    const cities = buildIndex({
      lastUpdated: '2026-08-15',
      countries: [country('ES', esClubs())],
    }).countries[0].cities;

    for (const city of cities) {
      expect(Object.keys(city).sort()).toEqual(['clubCount', 'key', 'name']);
    }
  });

  it('rejects a duplicate club id rather than emitting a directory with one (AC1)', () => {
    const clubs = esClubs();
    expect(() =>
      buildIndex({ lastUpdated: '2026-08-15', countries: [country('ES', [...clubs, clubs[0]])] })
    ).toThrow(/duplicate/i);
  });
});

describe('countryCountDropExceeded (R1.8, AC6)', () => {
  it('flags a drop of more than 20 per cent', () => {
    expect(countryCountDropExceeded(911, 300)).toBe(true);
    expect(countryCountDropExceeded(246, 100)).toBe(true);
  });

  it('allows normal churn', () => {
    expect(countryCountDropExceeded(911, 905)).toBe(false);
    expect(countryCountDropExceeded(246, 246)).toBe(false);
    expect(countryCountDropExceeded(246, 260)).toBe(false);
  });

  it('does not flag a first run, where there is no previous count', () => {
    expect(countryCountDropExceeded(undefined, 246)).toBe(false);
    expect(countryCountDropExceeded(0, 246)).toBe(false);
  });
});
