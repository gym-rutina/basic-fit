// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  parseStoreTiles,
  parseMapFeatures,
  joinMapAndTiles,
  normalizeCityKey,
  pickCityDisplayName,
  collectTiles,
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

/**
 * The seven club GUIDs the two tile fixtures carry between them. `collectTiles`
 * takes this set as its completeness ORACLE (tech-plan-build-b.md D17): the map
 * endpoint independently knows every club id, so the tile enumeration can be
 * PROVEN complete rather than trusted.
 */
const ALL_IDS = new Set([
  '1ec43550fd654c7d8e23bc6c96cd2ff0', // Málaga
  '2a1b3c4d5e6f70819a2b3c4d5e6f7081', // Madrid
  '3b2c4d5e6f708192a3b4c5d6e7f80912', // A Coruna
  '4c3d5e6f708192a3b4c5d6e7f8091223', // A Coruña
  '5d4e6f708192a3b4c5d6e7f809122334', // Torrejon de Ardoz
  '6e5f708192a3b4c5d6e7f80912233445', // Torrejon de Ardoz
  '7f60819a2b3c4d5e6f708192a3b4c5d6', // Torrejón de Ardoz
]);

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.basic-fit.com/es-es/gimnasios/torrejon-de-ardoz</loc></url>
  <url><loc>https://www.basic-fit.com/es-es/gimnasios/madrid</loc></url>
  <url><loc>https://www.basic-fit.com/on/demandware.store/Sites-BFE-Site/es_ES/Search-ShowContent?fdid=vilagarc%c3%ada</loc></url>
  <url><loc>https://www.basic-fit.com/es-es/clubs/basic-fit-malaga-alameda-1ec43550fd654c7d8e23bc6c96cd2ff0.html</loc></url>
</urlset>`;

/**
 * Fixture-backed stand-in for the real axios call, modelling the LIVE contract
 * (tech-plan-build-b.md §0): the unfiltered call is capped and reports
 * `isComplete:false`; a `q` query returns just that city's tiles and reports
 * `isComplete:true`. Records every request so the tests can assert the fast
 * path really is one request.
 */
function fixtureFetcher({ unfilteredComplete = false } = {}) {
  const calls = [];
  const tilesFor = (ids) => {
    const all = [...parseStoreTiles(page1.storeTilesHtml), ...parseStoreTiles(page2.storeTilesHtml)];
    const keep = all.filter((t) => ids.includes(t.id));
    // Re-emit as html the parser can read back, mirroring the real response.
    return keep
      .map(
        (t) =>
          `<li class="store-tile" data-pid="${t.id}" data-name="${t.name}">` +
          `<span class="store-tile-street">${t.address},</span>` +
          `<span class="store-tile-city">${t.city}</span></li>`
      )
      .join('\n');
  };

  return {
    calls,
    fetchTiles: async ({ q, sz }) => {
      calls.push({ q, sz });
      if (q === undefined || q === null || q === '') {
        // The unfiltered call — capped at the first 4 tiles unless the test
        // asks for the small-country fast path.
        return unfilteredComplete
          ? { isComplete: true, pageStart: 4, pageSize: sz, storeTilesHtml: page1.storeTilesHtml + page2.storeTilesHtml }
          : { isComplete: false, pageStart: sz, pageSize: sz, storeTilesHtml: page1.storeTilesHtml };
      }
      const byTerm = {
        'torrejon-de-ardoz': ['5d4e6f708192a3b4c5d6e7f809122334', '6e5f708192a3b4c5d6e7f80912233445', '7f60819a2b3c4d5e6f708192a3b4c5d6'],
        madrid: ['2a1b3c4d5e6f70819a2b3c4d5e6f7081'],
        'malaga-alameda': ['1ec43550fd654c7d8e23bc6c96cd2ff0'],
      };
      const ids = byTerm[q] ?? [];
      return { isComplete: true, pageStart: ids.length, pageSize: sz, storeTilesHtml: tilesFor(ids) };
    },
    fetchSitemap: async () => {
      calls.push({ sitemap: true });
      return SITEMAP_XML;
    },
  };
}

describe('collectTiles — the fast path (tech-plan-build-b.md D17 phase 2)', () => {
  it('stops after ONE request when the unfiltered call reports isComplete', async () => {
    // NL/BE/ES/LU/DE all still take exactly this path. The fanout must be
    // entered because the DATA says so, never from a hardcoded country list.
    const { fetchTiles, fetchSitemap, calls } = fixtureFetcher({ unfilteredComplete: true });

    const { tiles, viaFanout } = await collectTiles({ fetchTiles, fetchSitemap, mapIds: ALL_IDS });

    expect(viaFanout).toBe(false);
    expect(tiles).toHaveLength(7);
    expect(calls).toEqual([{ q: undefined, sz: MAX_PAGE_SIZE }]);
  });

  it('never reads the sitemap on the fast path', async () => {
    const { fetchTiles, fetchSitemap, calls } = fixtureFetcher({ unfilteredComplete: true });

    await collectTiles({ fetchTiles, fetchSitemap, mapIds: ALL_IDS });

    expect(calls.some((c) => c.sitemap)).toBe(false);
  });

  it('never requests a page size above MAX_PAGE_SIZE (sz >= 350 is HTTP 500)', async () => {
    // Corrected from the plan's assumed 400: 350, 399, 400 and 500 all 500 on
    // fr_FR. 300 sits just under a cliff that is lower than anyone thought.
    const { fetchTiles, fetchSitemap, calls } = fixtureFetcher({ unfilteredComplete: true });

    await collectTiles({ fetchTiles, fetchSitemap, mapIds: ALL_IDS, sz: 1000 });

    expect(MAX_PAGE_SIZE).toBe(300);
    for (const call of calls.filter((c) => !c.sitemap)) {
      expect(call.sz).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    }
  });
});

describe('collectTiles — the city fanout (D17 phases 3-4, the France path)', () => {
  it('falls back to per-city queries when the unfiltered call is capped', async () => {
    const { fetchTiles, fetchSitemap } = fixtureFetcher();

    const { tiles, viaFanout } = await collectTiles({ fetchTiles, fetchSitemap, mapIds: ALL_IDS });

    expect(viaFanout).toBe(true);
    expect(new Set(tiles.map((t) => t.id))).toEqual(ALL_IDS);
  });

  it('reads the sitemap for city terms only on the fanout path', async () => {
    const { fetchTiles, fetchSitemap, calls } = fixtureFetcher();

    await collectTiles({ fetchTiles, fetchSitemap, mapIds: ALL_IDS });

    expect(calls.some((c) => c.sitemap)).toBe(true);
  });

  it('deduplicates clubs seen in both the unfiltered call and a city query', async () => {
    // Málaga arrives in the capped unfiltered page AND again via its own
    // term. A union that appended blindly would double-count every club in
    // the first 300 — inflating totalClubs and breaking AC5's per-city counts.
    const { fetchTiles, fetchSitemap } = fixtureFetcher();

    const { tiles } = await collectTiles({ fetchTiles, fetchSitemap, mapIds: ALL_IDS });

    expect(tiles).toHaveLength(ALL_IDS.size);
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);
  });

  it('never sends a request carrying a StoreID parameter (robots.txt)', async () => {
    // robots.txt Disallows /*?StoreID=* outright. The design must not reach
    // for a per-store route even as a fallback — and there is none anyway
    // (q=<GUID> returns 0 tiles).
    const { fetchTiles, fetchSitemap, calls } = fixtureFetcher();

    await collectTiles({ fetchTiles, fetchSitemap, mapIds: ALL_IDS });

    for (const call of calls.filter((c) => !c.sitemap)) {
      expect(String(call.q ?? '')).not.toMatch(/StoreID/i);
      expect(String(call.q ?? '')).not.toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('draws every query term from an allowed source (robots.txt §0.12)', async () => {
    /**
     * PROVENANCE, not a forbidden value. The previous version of this test
     * asserted no term contained `a-coruna` — but `a-coruna` is legitimately
     * reachable: D17 phase 3 assembles terms from phase-2 tiles PLUS the
     * sitemap, and page1 carries the cities "A Coruna" and "A Coruña", both
     * of which normalise to exactly that. So the assertion rejected a correct
     * implementation, and the only way to satisfy it was to drop tile-derived
     * terms and rely on the sitemap alone — which §0.11 shows is incomplete
     * (909 club URLs vs the map's 911). The test steered toward the design
     * that breaks in production, under a robots.txt banner.
     *
     * The fix asserts where a term may COME FROM rather than what it may not
     * be: every query term must belong to (phase-2 tile city keys) ∪
     * (sitemap path segments from entries that are not Search-ShowContent).
     *
     * The fixture's disallowed entry now names `vilagarcía` — a city present
     * in NEITHER the tiles nor any allowed sitemap path — so harvesting it is
     * observable. It stays URL-encoded (`vilagarc%c3%ada`) so the check also
     * catches an implementation that harvests the entry WITHOUT decoding it:
     * the raw and decoded forms are both absent from the allowed set.
     */
    const { fetchTiles, fetchSitemap, calls } = fixtureFetcher();

    await collectTiles({ fetchTiles, fetchSitemap, mapIds: ALL_IDS });

    const fold = (s) =>
      decodeURIComponent(String(s)).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    // Source 1 — the cities the phase-2 tiles actually returned.
    const tileCityKeys = parseStoreTiles(page1.storeTilesHtml).map((t) => normalizeCityKey(t.city));

    // Source 2 — sitemap path segments, EXCLUDING the disallowed pipeline.
    const allowedSitemapSegments = [...SITEMAP_XML.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((url) => !/Search-ShowContent/i.test(url))
      .map((url) => fold(url.split('?')[0].split('/').filter(Boolean).pop() ?? ''))
      .map((seg) => seg.replace(/\.html$/, '').replace(/-[0-9a-f]{32}$/, '').replace(/^basic-fit-/, ''));

    const allowed = new Set([...tileCityKeys.map(fold), ...allowedSitemapSegments]);

    const terms = calls.filter((c) => !c.sitemap && c.q).map((c) => c.q);
    expect(terms.length).toBeGreaterThan(0); // a vacuous pass here would prove nothing

    for (const term of terms) {
      expect(term).not.toMatch(/Search-ShowContent/i);
      expect(term).not.toMatch(/fdid/i);
      expect({ term, allowed: allowed.has(fold(term)) }).toEqual({ term, allowed: true });
    }
  });
});

describe('collectTiles — the oracle (D17 phase 5, X5 in its real form)', () => {
  it('throws IncompleteDirectoryError when the fanout cannot resolve every map id', async () => {
    // THE test of this feature. The map says 7 clubs exist; the fanout finds
    // 6. Returning 6 is the 300-instead-of-911 bug wearing a different hat,
    // and every downstream count check would pass on the short result.
    const { fetchTiles, fetchSitemap } = fixtureFetcher();
    const oracleWithGhost = new Set([...ALL_IDS, 'deadbeefdeadbeefdeadbeefdeadbeef']);

    await expect(
      collectTiles({ fetchTiles, fetchSitemap, mapIds: oracleWithGhost })
    ).rejects.toBeInstanceOf(IncompleteDirectoryError);
  });

  it('names the unresolved ids in the error, so a maintainer can act on it', async () => {
    const { fetchTiles, fetchSitemap } = fixtureFetcher();
    const oracleWithGhost = new Set([...ALL_IDS, 'deadbeefdeadbeefdeadbeefdeadbeef']);

    await expect(
      collectTiles({ fetchTiles, fetchSitemap, mapIds: oracleWithGhost })
    ).rejects.toThrow(/deadbeefdeadbeefdeadbeefdeadbeef/);
  });

  it('refuses an empty oracle rather than passing vacuously', async () => {
    // An empty mapIds makes "every map id was resolved" trivially true, which
    // would turn the single most important guard in this module into a no-op.
    // If parseMapFeatures ever regresses to returning 0 again — which is
    // exactly what just happened in production — this is what catches it.
    const { fetchTiles, fetchSitemap } = fixtureFetcher();

    await expect(
      collectTiles({ fetchTiles, fetchSitemap, mapIds: new Set() })
    ).rejects.toBeInstanceOf(IncompleteDirectoryError);
  });

  it('refuses a missing oracle for the same reason', async () => {
    const { fetchTiles, fetchSitemap } = fixtureFetcher();

    await expect(collectTiles({ fetchTiles, fetchSitemap })).rejects.toBeInstanceOf(
      IncompleteDirectoryError
    );
  });

  it('throws when a q query comes back capped, EVEN IF its rows would complete the union', async () => {
    /**
     * Discrimination matters here and the obvious version of this test does
     * not have it. If the capped query returned only SOME clubs, an
     * implementation that ignored `isComplete` entirely would still throw at
     * phase 5 (union short) with the same error class — so the test would
     * pass against the broken implementation it is meant to catch.
     *
     * So the capped query below returns EVERY club. A correct implementation
     * still throws, because a capped result set is unusable regardless of
     * what it happens to contain: the storefront returned the first N of an
     * unknown total, and treating that as authoritative is exactly the X5
     * silent truncation one level down. An implementation that ignores
     * `isComplete` sees a complete union and resolves — failing this test.
     */
    const { fetchSitemap } = fixtureFetcher();
    const allTilesHtml = page1.storeTilesHtml + page2.storeTilesHtml;
    const cappedButComplete = async ({ q, sz }) => ({
      isComplete: false, // never completes, at any phase
      pageStart: sz,
      pageSize: sz,
      storeTilesHtml: allTilesHtml, // …yet carries all seven clubs
    });

    await expect(
      collectTiles({ fetchTiles: cappedButComplete, fetchSitemap, mapIds: ALL_IDS })
    ).rejects.toBeInstanceOf(IncompleteDirectoryError);
  });

  it('distinguishes a capped query from an incomplete union in its message', async () => {
    // The two failures need different fixes — a capped term must be
    // subdivided; an incomplete union means the term set missed a city. An
    // error that cannot tell a maintainer which one happened sends them to
    // the wrong place at 3am.
    const { fetchSitemap } = fixtureFetcher();
    const allTilesHtml = page1.storeTilesHtml + page2.storeTilesHtml;
    const cappedButComplete = async ({ sz }) => ({
      isComplete: false,
      pageStart: sz,
      pageSize: sz,
      storeTilesHtml: allTilesHtml,
    });

    await expect(
      collectTiles({ fetchTiles: cappedButComplete, fetchSitemap, mapIds: ALL_IDS })
    ).rejects.toThrow(/complete|capped|isComplete/i);
  });

  it('throws rather than fanning out unboundedly past maxTerms', async () => {
    const { fetchTiles } = fixtureFetcher();
    const hugeSitemap = async () =>
      `<urlset>${Array.from({ length: 50 }, (_, i) => `<url><loc>https://www.basic-fit.com/es-es/gimnasios/city-${i}</loc></url>`).join('')}</urlset>`;

    await expect(
      collectTiles({ fetchTiles, fetchSitemap: hugeSitemap, mapIds: ALL_IDS, maxTerms: 3 })
    ).rejects.toBeInstanceOf(IncompleteDirectoryError);
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

describe('parseMapFeatures — the clusters wrapper (AC3, D17b)', () => {
  /**
   * This block exists because parseMapFeatures shipped in Build A returning
   * ZERO clubs for all six locales while its unit tests stayed green. It read
   * `geojson.features`; the live response nests the FeatureCollection at
   * `clusters.features`. The old fixture was hand-written in the assumed
   * shape, so the test and the bug agreed with each other.
   *
   * Consequence had it shipped: every club in every country written with no
   * coordinates at all — AC3's ">= 99% carry coordinates" failing at 0% while
   * the scraper reported success.
   */
  it('reads features from clusters.features, not from the top level', () => {
    const coords = parseMapFeatures(mapEs);

    expect(coords.size).toBe(6);
    expect(coords.get('1ec43550fd654c7d8e23bc6c96cd2ff0')).toBeDefined();
  });

  it('returns nothing for a top-level features array (the shape that never existed)', () => {
    // Pins the direction of the fix. If someone "restores" the old path as a
    // compatibility fallback, this fails — and the fixture below stops being
    // a real capture, which is the whole point of D17b.
    expect(parseMapFeatures({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { ID: 'a'.repeat(32) }, geometry: { type: 'Point', coordinates: [1, 2] } },
    ] }).size).toBe(0);
  });

  it('keeps the fixture in the real nested shape', () => {
    // Guards the fixture itself against being "tidied" back into the shape
    // that hid the bug.
    expect(mapEs.clusters).toBeDefined();
    expect(Array.isArray(mapEs.clusters.features)).toBe(true);
    expect(mapEs.features).toBeUndefined();
  });

  it('degrades to an empty map for a malformed response rather than throwing', () => {
    expect(parseMapFeatures(undefined).size).toBe(0);
    expect(parseMapFeatures({}).size).toBe(0);
    expect(parseMapFeatures({ clusters: {} }).size).toBe(0);
    expect(parseMapFeatures({ clusters: { features: null } }).size).toBe(0);
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

  it('emits only the four permitted fields plus optional legacyId (D6a, cycle-9 correction)', () => {
    // `coordinates` and `cityKey` dropped this cycle — tech-plan-build-b.md
    // D6a. Bagnik's cycle-8 code QA measured the shipped directory (both
    // fields present) at 604.9KB against AC4's ≤300KB cap, 2x over budget;
    // dropping both, plus shipping the country files minified, is what
    // brings it back under.
    const file = buildCountryFile('ES', clubsFor());

    expect(file.country).toBe('ES');
    for (const club of file.clubs) {
      expect(Object.keys(club).sort()).toEqual(
        expect.arrayContaining(['address', 'city', 'id', 'name'])
      );
      const allowed = ['id', 'legacyId', 'name', 'city', 'address'];
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

  it('gives every club a non-empty id, name, city and address (AC3, cycle-9 correction)', () => {
    for (const club of buildCountryFile('ES', clubsFor()).clubs) {
      expect(club.id).toMatch(/^[0-9a-f]{32}$/);
      expect(club.name.length).toBeGreaterThan(0);
      expect(club.city.length).toBeGreaterThan(0);
      expect(club.address.length).toBeGreaterThan(0);
      // cityKey dropped this cycle (D6a) — the picker now matches a
      // selected city to its clubs by `city` display name instead.
      expect(club.cityKey).toBeUndefined();
      expect(club.coordinates).toBeUndefined();
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

  it('stamps legacyId on the known legacy clubs and on nothing else (AC10, cycle-9 correction)', () => {
    // Cycle-8 code QA (Bagnik, handoff-log.md 04:15) found the previous
    // version of this test hardcoded the WRONG "verified" GUID
    // (1ec43550fd654c7d8e23bc6c96cd2ff0) — that id belongs to a real club in
    // A Coruña, 1,000km from Málaga, not to any of the seven legacy gyms.
    // The shared map/tile fixtures (mapEs/page1/page2) predate the real
    // 7-GUID correction and don't contain any of the corrected ids, so this
    // constructs minimal synthetic input directly — `buildCountryFile`
    // accepts a plain `{id, name, address, city, coordinates?}` array per
    // its own docblock — keeping the test decoupled from the shared
    // fixtures' unrelated content while still proving both the positive and
    // negative stamping cases against the real, frozen `LEGACY_CLUBS`.
    const clubs = [
      { id: '85c4896006bc45d89f562c977651600c', name: 'Alameda', city: 'Málaga', address: 'Avda. Andalucia s/n' },
      { id: 'f'.repeat(32), name: 'Not Legacy', city: 'Málaga', address: 'Calle Ejemplo 1' },
    ];
    const file = buildCountryFile('ES', clubs);

    const alameda = file.clubs.find((c) => c.id === '85c4896006bc45d89f562c977651600c');
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

  it('maps all seven legacy ids to their real, verified GUIDs (cycle-9 correction)', () => {
    // Cycle-8 code QA (Bagnik, handoff-log.md 04:15) found the previous
    // single "verified" entry (1ec43550fd654c7d8e23bc6c96cd2ff0 → 3) was
    // wrong — that GUID belongs to a real club in A Coruña, 1,000km from
    // Málaga. All seven were re-verified against the real scraped data
    // (data/gyms/ES.json) by matching each pre-Build-B legacy record to its
    // real club by name and address.
    expect(LEGACY_CLUBS['a435aa51b62e43ea8fb5d8bb5d643a78']).toBe(1);
    expect(LEGACY_CLUBS['e33f130aad2b423fa94bb27502b138c6']).toBe(2);
    expect(LEGACY_CLUBS['85c4896006bc45d89f562c977651600c']).toBe(3);
    expect(LEGACY_CLUBS['18eab10cbcc84775a1d3faa95223a56a']).toBe(4);
    expect(LEGACY_CLUBS['ede4d9d858804c2baaac9c08e4dc269e']).toBe(5);
    expect(LEGACY_CLUBS['faf211e37b4d4ee98493fe825cf45d67']).toBe(6);
    expect(LEGACY_CLUBS['5c43f08f993e4e1fab21f033ebac2e51']).toBe(7);
    expect(LEGACY_CLUBS['1ec43550fd654c7d8e23bc6c96cd2ff0']).toBeUndefined();
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
