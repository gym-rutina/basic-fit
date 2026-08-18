'use strict';

/**
 * Pure core of the directory scraper (spec.md S1, tech-plan.md D5/D6/D7/D8).
 *
 * Zero I/O imports (module boundary rule, tech-plan.md 1.2) — no fs, no
 * path, no process, no axios. `cheerio` is a parsing library, not an I/O
 * dependency, the same way this project already treats a JSON.parse call.
 * `scripts/scrape-gyms.js` is the thin shell that supplies the real
 * `fetchPage`/`fetchMap` (axios + delays) and does the actual file writes;
 * everything here is unit-testable against a committed fixture with no
 * network access (AC7).
 *
 * The single most damaging failure mode this file exists to prevent is
 * silent (spec.md X5): `Store-FinderMore` returns HTTP 200 even on an
 * incomplete page, so a loop that stops early does not error — it silently
 * ships a fraction of a country's clubs, and every naive count check
 * downstream still passes. `paginate()` below is written so that the ONLY
 * way it returns is `isComplete: true`; every other exit throws.
 */

const cheerio = require('cheerio');

/**
 * `sz` ceiling. §0.6 measured the real cliff is below 350 (sz=350/399/400/500
 * all HTTP 500 on fr_FR) — lower than the plan's originally assumed 400.
 * Never request more than this.
 */
const MAX_PAGE_SIZE = 300;

class IncompleteDirectoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IncompleteDirectoryError';
  }
}

/**
 * Frozen legacyId table (tech-plan.md D8). Keyed by the 32-hex club GUID,
 * never by name (X9 — names are frequently just the street address and are
 * not a reliable join key). Only the Alameda GUID is verified today (the
 * one example spec.md's own data model publishes); the other six are
 * placeholders to be replaced with real GUIDs read off the first live
 * scrape. A scrape run must fail loudly (not silently drop the mapping) if
 * a placeholder is still in place when legacyId resolution actually
 * matters — see scripts/scrape-gyms.js.
 */
function placeholderGuid(n) {
  return `${'0'.repeat(30)}${String(n).padStart(2, '0')}`;
}

const LEGACY_CLUBS = Object.freeze({
  // Verified GUIDs matched against the real ES.json by name + address
  // (Bagnik cycle-8 code QA, handoff-log.md 04:10 / tech-plan-build-b.md §5).
  // legacyId 7 is in Rincón de la Victoria, not Málaga proper — AC10 wording
  // covers 6 Málaga + 1 neighbouring town, corrected in spec.md cycle-9.
  'a435aa51b62e43ea8fb5d8bb5d643a78': 1, // Armengual de la Mota — Málaga
  'e33f130aad2b423fa94bb27502b138c6': 2, // Calle Héroe de Sostoa — Málaga
  '85c4896006bc45d89f562c977651600c': 3, // Avd. Andalucia C.C. Carrefour Alameda — Málaga
  '18eab10cbcc84775a1d3faa95223a56a': 4, // Calle Félix García Palacios — Málaga
  'ede4d9d858804c2baaac9c08e4dc269e': 5, // Bulevar Louis Pasteur — Málaga
  'faf211e37b4d4ee98493fe825cf45d67': 6, // Calle Olmos — Málaga
  '5c43f08f993e4e1fab21f033ebac2e51': 7, // Rincón de la Victoria
});

/**
 * Parse a `Store-FinderMore` HTML fragment into `{ id, name, address, city }`
 * tiles. `hours` and `url` are never extracted — they are 59% of the raw
 * payload (X7) and read by nothing downstream (D6) — so there is nothing to
 * discard later; they simply never enter the pipeline.
 *
 * @param {string} html
 * @returns {{id: string, name: string, address: string, city: string}[]}
 */
function parseStoreTiles(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const tiles = [];

  $('.store-tile').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('data-pid') || '';
    // Pre-opening ("coming soon" / presale) clubs render an EMPTY
    // `.store-tile-title` on the live storefront — measured 2026-08-17
    // against `es_ES`, e.g. `data-lead-gen-url=".../opening-clubs/details"`
    // tiles for Rincón de la Victoria and Torre del Mar. The root `<li>`'s
    // `data-name` attribute still carries the real name (prefixed
    // "Basic-Fit "), so it is the fallback rather than a second source of
    // truth: `.store-tile-title` wins whenever it is non-empty, exactly as
    // it always has, and `data-name` only fills the gap AC3's "non-empty
    // name" requirement would otherwise leave for these not-yet-open clubs.
    const titleText = $el.find('.store-tile-title').first().text().trim();
    const dataName = ($el.attr('data-name') || '').replace(/^Basic-Fit\s+/i, '').trim();
    const name = titleText || dataName;
    // Trailing comma is a storefront artifact; interior commas (e.g. "Avda.
    // X, Centro Comercial Y") are part of the address and must survive.
    const address = $el.find('.store-tile-street').first().text().trim().replace(/,\s*$/, '');
    const city = $el.find('.store-tile-city').first().text().trim();
    tiles.push({ id, name, address, city });
  });

  return tiles;
}

/**
 * Parse a `Store-FinderMap` response into a Map of club GUID -> {lat, lng}.
 *
 * tech-plan-build-b.md D17b / §0.1: the LIVE response nests its
 * FeatureCollection at `clusters.features`, NOT at the top level. Build A's
 * fixture was hand-written in the assumed top-level shape, so this function
 * shipped reading `geojson.features` — always `undefined` against the real
 * response — and returned ZERO clubs for all six locales while its own unit
 * tests stayed green, because the fixture agreed with the bug. Coordinates
 * arrive as GeoJSON's [lng, lat] — NOT [lat, lng] — swapping the pair
 * silently drops every club into the wrong hemisphere and no count check
 * would ever notice.
 *
 * @param {*} geojson
 * @returns {Map<string, {lat: number, lng: number}>}
 */
// Every REAL club id is a 32-hex GUID (verified throughout spec.md's
// research). The live map response was measured (2026-08-16, fr_FR) to also
// carry at least one "coming soon" placeholder feature whose `properties.ID`
// is a human-readable slug ("Basic-Fit-Port-la-Nouvelle-Coming-soon") rather
// than a GUID — a club with no tile, no page, and nothing for the fanout to
// ever resolve. Filtering to the GUID shape here (the oracle's own source)
// keeps such placeholders from making phase 5 demand the impossible.
const CLUB_ID_RE = /^[0-9a-f]{32}$/i;

function parseMapFeatures(geojson) {
  const map = new Map();
  const features =
    geojson && geojson.clusters && Array.isArray(geojson.clusters.features)
      ? geojson.clusters.features
      : [];

  for (const feature of features) {
    const id = feature && feature.properties && feature.properties.ID;
    const coords = feature && feature.geometry && feature.geometry.coordinates;
    if (!id || !CLUB_ID_RE.test(id) || !Array.isArray(coords) || coords.length < 2) continue;
    const [lng, lat] = coords;
    map.set(id, { lat, lng });
  }

  return map;
}

/**
 * Join coordinates onto tiles by club GUID. A club with no map feature is
 * KEPT, not dropped — losing a real club because one endpoint has a gap is
 * worse than shipping it without coordinates.
 *
 * @param {Array} tiles
 * @param {Map<string, {lat:number,lng:number}>} coordsByClubId
 */
function joinMapAndTiles(tiles, coordsByClubId) {
  return tiles.map((tile) => {
    const coordinates = coordsByClubId.get(tile.id);
    return coordinates ? { ...tile, coordinates } : { ...tile };
  });
}

/**
 * Grouping key: NFD normalise, strip combining marks, lowercase,
 * non-alphanumerics collapse to a single hyphen. `A Coruña` and `A Coruna`
 * both group to `a-coruna` (AC9).
 *
 * @param {string} name
 */
// Unicode combining diacritical marks block (U+0300-U+036F), written as an
// explicit hex range rather than literal characters to avoid any ambiguity
// about which code points are matched.
const COMBINING_MARKS_RE = /[̀-ͯ]/g;

function normalizeCityKey(name) {
  return String(name)
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function diacriticCount(value) {
  const marks = String(value).normalize('NFD').match(COMBINING_MARKS_RE);
  return marks ? marks.length : 0;
}

/**
 * Pick the display name for a group of raw city-name variants. Diacritics
 * beat frequency — the spec's own counterexample is `Torrejon de Ardoz`
 * appearing twice against `Torrejón de Ardoz` once, where the accented
 * (less frequent) form is the correct one. A genuine tie (equal diacritic
 * count) falls back to frequency.
 *
 * @param {string[]} variants
 * @returns {string}
 */
function pickCityDisplayName(variants) {
  const counts = new Map();
  for (const variant of variants) counts.set(variant, (counts.get(variant) || 0) + 1);

  let best = null;
  let bestDiacritics = -1;
  let bestFreq = -1;

  for (const [variant, freq] of counts) {
    const diacritics = diacriticCount(variant);
    if (diacritics > bestDiacritics || (diacritics === bestDiacritics && freq > bestFreq)) {
      best = variant;
      bestDiacritics = diacritics;
      bestFreq = freq;
    }
  }

  return best;
}

/** Matches a sitemap URL's final segment when it is an individual club detail page (`basic-fit-<name>-<32-hex guid>.html`), never a city hub page. */
const CLUB_DETAIL_PAGE_RE = /-[0-9a-f]{32}\.html?$/i;

/**
 * Extract candidate CITY query terms from a store sitemap XML document
 * (tech-plan-build-b.md D17 phase 3, §0.12).
 *
 * robots.txt permits reading the sitemap but forbids FOLLOWING any
 * `Search-ShowContent` URL (its `fdid=` query carries a city token, not a
 * fetchable route) — those entries are read for their token and skipped,
 * never turned into a request.
 *
 * Individual club-detail pages (`/clubs/basic-fit-<name>-<32-hex
 * guid>.html`) are skipped too, deliberately — not because they are
 * disallowed (they are not), but because harvesting one term per CLUB
 * rather than per CITY defeats the whole point of the fanout: measured
 * against the real fr-fr sitemap, that is 911 near-unique terms against
 * only 91 city hub pages, which blows the term budget for no completeness
 * benefit (the phase-2 tiles already carry every club that also appears as
 * a capped-page tile, and phase 5's oracle throws loudly — not silently —
 * if city-level coverage is ever genuinely insufficient).
 *
 * Every surviving `<loc>` entry contributes its last non-empty path
 * segment, decoded and normalised — the shape `/salles-de-sport/<city>`
 * and `/gimnasios/<city>` URLs take in the real sitemap.
 *
 * @param {string} xml
 * @returns {Set<string>}
 */
function extractSitemapCityTerms(xml) {
  const terms = new Set();
  const locs = [...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  for (const raw of locs) {
    if (/Search-ShowContent/i.test(raw)) continue; // read the route, never follow it (§0.12)

    const withoutQuery = raw.split('?')[0];
    const segments = withoutQuery.split('/').filter(Boolean);
    let last = segments[segments.length - 1] || '';
    if (CLUB_DETAIL_PAGE_RE.test(last)) continue; // one term per city, not per club

    try {
      last = decodeURIComponent(last);
    } catch {
      // malformed percent-encoding — fall back to the raw segment
    }
    last = last.replace(/\.html?$/i, '');

    const term = normalizeCityKey(last);
    if (term) terms.add(term);
  }

  return terms;
}

/**
 * Builds a `club GUID -> slug` map from the sitemap's individual club-detail
 * pages (`/clubs/basic-fit-<slug>-<32-hex guid>.html`) — the mirror image of
 * `extractSitemapCityTerms`'s exclusion of exactly these entries. Used only
 * as phase 4's TARGETED fallback (see `collectTiles` below): a handful of
 * real clubs (measured against fr_FR, 2026-08-16: 32 of 911) sit in cities
 * whose name never appears as a phase-2 tile city key or as its own
 * `/salles-de-sport/<city>` sitemap page — a small business, a very new
 * opening, or simply a city under-represented in the capped first page. For
 * those stragglers, the club's OWN sitemap entry is the only cheap lead
 * back to it, and it names the club by GUID already.
 *
 * @param {string} xml
 * @returns {Map<string, string>} lowercase GUID -> normalised slug term
 */
function buildClubGuidToSlug(xml) {
  const map = new Map();
  const locs = [...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  for (const raw of locs) {
    if (/Search-ShowContent/i.test(raw)) continue;
    const withoutQuery = raw.split('?')[0];
    const segments = withoutQuery.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';
    const match = last.match(/^(.*)-([0-9a-f]{32})\.html?$/i);
    if (!match) continue;

    let slug = match[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // malformed percent-encoding — fall back to the raw segment
    }
    const term = normalizeCityKey(slug.replace(/^basic-fit-/i, ''));
    if (term) map.set(match[2].toLowerCase(), term);
  }

  return map;
}

/**
 * Enumerate every club tile for one country/locale (tech-plan-build-b.md
 * D17, D17a). Replaces Build A's `paginate`, whose contract — "loop until
 * isComplete" — describes an API that does not exist: §0.5 measured that
 * `Store-FinderMore` ignores `start` entirely, so a country over ~300 clubs
 * can never be paginated into. `paginate` would loop 20x over the SAME 300
 * tiles and throw — correctly, but it could never succeed for France.
 *
 * ```
 * Phase 1 (caller)  Store-FinderMap        → mapIds   ← THE ORACLE, required
 * Phase 2  (here)   Store-FinderMore?sz=…  → tiles    ← if isComplete, DONE
 * Phase 3  (here)   phase-2 city keys ∪ sitemap terms  ← only if capped
 * Phase 4  (here)   Store-FinderMore?q=<term>  → tiles per term
 * Phase 5  (here)   union by id; mapIds − unionIds ≠ ∅ → THROW
 * ```
 *
 * `mapIds` is REQUIRED and must be non-empty: an empty oracle would make
 * "every map id was resolved" vacuously true, turning the single most
 * important guard in this module into a no-op — precisely what shipped when
 * `parseMapFeatures` regressed to reading the wrong key (D17b).
 *
 * @param {{
 *   fetchTiles: (args:{q?:string, sz:number}) => Promise<{isComplete:boolean, storeTilesHtml:string}>,
 *   fetchSitemap: () => Promise<string>,
 *   mapIds: Set<string>,
 *   sz?: number,
 *   maxTerms?: number,
 * }} args
 * @returns {Promise<{tiles: Array, requests: number, viaFanout: boolean}>}
 */
async function collectTiles({ fetchTiles, fetchSitemap, mapIds, sz = MAX_PAGE_SIZE, maxTerms = 1200 }) {
  if (!mapIds || mapIds.size === 0) {
    throw new IncompleteDirectoryError(
      'collectTiles requires a non-empty mapIds oracle (Store-FinderMap phase 1) — ' +
        'an empty oracle would make completeness vacuously true'
    );
  }

  const clampedSz = Math.min(sz, MAX_PAGE_SIZE);
  let requests = 0;
  const byId = new Map();

  // Phase 2 — the fast, unfiltered path. Every country under ~300 clubs
  // resolves here in a single request, driven purely by what the response
  // says, never by a hardcoded "this country is small" list.
  const first = await fetchTiles({ q: undefined, sz: clampedSz });
  requests += 1;
  for (const tile of parseStoreTiles(first && first.storeTilesHtml)) {
    byId.set(tile.id, tile);
  }

  if (first && first.isComplete === true) {
    return { tiles: [...byId.values()], requests, viaFanout: false };
  }

  // Phase 3 — the fanout term set is the UNION of the phase-2 tiles' own
  // city keys and the sitemap's path segments, never the sitemap alone
  // (§0.11: the sitemap lists 909 club URLs against the map's 911, so a
  // sitemap-only term set leaves real clubs unresolved and throws at
  // phase 5 on the very first real run).
  const sitemapXml = await fetchSitemap();
  requests += 1;

  const tileCityTerms = new Set([...byId.values()].map((t) => normalizeCityKey(t.city)).filter(Boolean));
  const sitemapTerms = extractSitemapCityTerms(sitemapXml);
  const terms = new Set([...tileCityTerms, ...sitemapTerms]);

  if (terms.size > maxTerms) {
    throw new IncompleteDirectoryError(
      `fanout term set (${terms.size} terms) exceeds maxTerms (${maxTerms}) — refusing to fan out unboundedly`
    );
  }

  // Phase 4 — one Store-FinderMore?q=<term> request per term.
  for (const term of terms) {
    const page = await fetchTiles({ q: term, sz: clampedSz });
    requests += 1;

    if (!page || page.isComplete !== true) {
      // A capped (isComplete:false) query result is unusable regardless of
      // what it happens to contain — the storefront returned the first N of
      // an unknown total, and treating that as authoritative is the X5
      // silent-truncation failure one level down. The term needs
      // subdividing, not trusting.
      throw new IncompleteDirectoryError(
        `city term "${term}" returned a capped (isComplete:false) result — it needs subdividing`
      );
    }

    for (const tile of parseStoreTiles(page.storeTilesHtml)) {
      byId.set(tile.id, tile);
    }
  }

  // Phase 4b — targeted straggler fallback. City-level terms resolve the
  // overwhelming majority (measured: 878 of 911 for fr_FR), but a handful of
  // clubs sit in cities the city-term set never named. Each such club's OWN
  // sitemap entry embeds its GUID in the URL, so it can be looked up
  // directly rather than guessed at — one targeted query per still-missing
  // id, never a second unbounded fanout.
  let missing = [...mapIds].filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const guidToSlug = buildClubGuidToSlug(sitemapXml);
    for (const id of missing) {
      const term = guidToSlug.get(String(id).toLowerCase());
      if (!term) continue; // no sitemap entry for this id either — phase 5 reports it

      const page = await fetchTiles({ q: term, sz: clampedSz });
      requests += 1;
      if (page && page.isComplete === true) {
        for (const tile of parseStoreTiles(page.storeTilesHtml)) {
          byId.set(tile.id, tile);
        }
      }
      // A capped result for a single-club-targeted term is left as still
      // missing rather than thrown here — phase 5 below reports it by id,
      // which is more actionable than a mid-loop throw for one straggler.
    }
    missing = [...mapIds].filter((id) => !byId.has(id));
  }

  // Phase 5 — the oracle check. THE test of this module: the map
  // independently knows every club id, so completeness is PROVEN, not
  // hoped for.
  if (missing.length > 0) {
    throw new IncompleteDirectoryError(
      `directory incomplete — the fanout's term set missed ${missing.length} map id(s): ${missing.join(', ')}`
    );
  }

  return { tiles: [...byId.values()], requests, viaFanout: true };
}

/**
 * Build one country's output file. Determines each club's cityKey/display
 * name from the FULL set of clubs passed in (so accent-variant grouping is
 * correct), then emits only the four permitted fields plus optional
 * `legacyId` (D6a), in a fixed order (D2) so an unchanged upstream re-run is
 * byte-identical (AC8) regardless of the order clubs were scraped in.
 *
 * D6a: `coordinates` and `cityKey` are BANNED from output — they added ~328 KB
 * to the shipped files (604.9 KB → 276.6 KB measured on the real 1,727-club
 * dataset). `cityKey` is still computed internally for display-name grouping
 * and for sorting; a Schwartzian transform carries it through sorting without
 * leaking it onto the output record.
 *
 * @param {string} countryCode
 * @param {Array} clubs - joined tiles (id, name, address, city, coordinates?)
 */
function buildCountryFile(countryCode, clubs) {
  const variantsByKey = new Map();
  for (const club of clubs) {
    const key = normalizeCityKey(club.city);
    if (!variantsByKey.has(key)) variantsByKey.set(key, []);
    variantsByKey.get(key).push(club.city);
  }

  const displayNameByKey = new Map();
  for (const [key, variants] of variantsByKey) {
    displayNameByKey.set(key, pickCityDisplayName(variants));
  }

  // Schwartzian transform: decorate with sort keys, sort, then strip the keys.
  // This keeps the sort correct (by cityKey then name then id) without leaking
  // cityKey onto the output record (D6a).
  const decorated = clubs.map((club) => {
    const cityKey = normalizeCityKey(club.city);
    const out = {
      id: club.id,
      name: club.name,
      city: displayNameByKey.get(cityKey),
      address: club.address,
    };
    const legacyId = LEGACY_CLUBS[club.id];
    if (legacyId !== undefined) out.legacyId = legacyId;
    return { cityKey, out };
  });

  decorated.sort((a, b) => {
    if (a.cityKey !== b.cityKey) return a.cityKey < b.cityKey ? -1 : 1;
    if (a.out.name !== b.out.name) return a.out.name < b.out.name ? -1 : 1;
    return a.out.id < b.out.id ? -1 : a.out.id > b.out.id ? 1 : 0;
  });

  return { country: countryCode, clubs: decorated.map((d) => d.out) };
}

/**
 * Build `data/gyms/index.json` from a set of already-built country records
 * (see `buildCountryFile`). Throws on a duplicate club id anywhere in the
 * directory rather than emitting one — a silent duplicate is worse than a
 * failed build.
 *
 * @param {{lastUpdated: string, countries: Array<{code:string, names:object, locale:string, file:string, clubs:Array}>}} args
 */
function buildIndex({ lastUpdated, countries }) {
  const seenIds = new Set();
  for (const country of countries) {
    for (const club of country.clubs) {
      if (seenIds.has(club.id)) {
        throw new Error(`duplicate club id across the directory: ${club.id}`);
      }
      seenIds.add(club.id);
    }
  }

  const builtCountries = countries.map((country) => {
    const cityGroups = new Map();
    for (const club of country.clubs) {
      // D6a: cityKey no longer lives on the club record — recompute it from
      // club.city, the same way buildCountryFile does. normalizeCityKey is
      // already imported in this file.
      const key = normalizeCityKey(club.city);
      if (!cityGroups.has(key)) {
        cityGroups.set(key, { key, name: club.city, clubCount: 0 });
      }
      cityGroups.get(key).clubCount += 1;
    }

    const cities = [...cityGroups.values()].sort((a, b) => {
      if (b.clubCount !== a.clubCount) return b.clubCount - a.clubCount;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

    return {
      code: country.code,
      names: country.names,
      locale: country.locale,
      clubCount: country.clubs.length,
      file: country.file,
      cities,
    };
  });

  const totalClubs = builtCountries.reduce((sum, c) => sum + c.clubCount, 0);

  return {
    metadata: {
      lastUpdated,
      source: 'basic-fit.com club-finder (Store-FinderMap + Store-FinderMore)',
      totalClubs,
    },
    countries: builtCountries,
  };
}

/**
 * R1.8 — a country whose club count dropped by more than 20% versus the
 * previous run is treated as upstream breakage, not real churn. No previous
 * count (undefined/0, i.e. a first run) never counts as a drop.
 *
 * @param {number|undefined} previousCount
 * @param {number} currentCount
 */
function countryCountDropExceeded(previousCount, currentCount) {
  if (!previousCount || previousCount <= 0) return false;
  return (previousCount - currentCount) / previousCount > 0.2;
}

module.exports = {
  parseStoreTiles,
  parseMapFeatures,
  joinMapAndTiles,
  normalizeCityKey,
  pickCityDisplayName,
  collectTiles,
  extractSitemapCityTerms,
  buildCountryFile,
  buildIndex,
  countryCountDropExceeded,
  LEGACY_CLUBS,
  MAX_PAGE_SIZE,
  IncompleteDirectoryError,
};
