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

/** sz >= 400 is HTTP 500 on fr_FR (X5). Never request more than this. */
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
  '1ec43550fd654c7d8e23bc6c96cd2ff0': 3, // Centro Comercial Alameda — verified in spec.md
  [placeholderGuid(1)]: 1,
  [placeholderGuid(2)]: 2,
  [placeholderGuid(4)]: 4,
  [placeholderGuid(5)]: 5,
  [placeholderGuid(6)]: 6,
  [placeholderGuid(7)]: 7,
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
    const name = $el.find('.store-tile-title').first().text().trim();
    // Trailing comma is a storefront artifact; interior commas (e.g. "Avda.
    // X, Centro Comercial Y") are part of the address and must survive.
    const address = $el.find('.store-tile-street').first().text().trim().replace(/,\s*$/, '');
    const city = $el.find('.store-tile-city').first().text().trim();
    tiles.push({ id, name, address, city });
  });

  return tiles;
}

/**
 * Parse a `Store-FinderMap` GeoJSON FeatureCollection into a Map of
 * club GUID -> {lat, lng}. Coordinates arrive as GeoJSON's [lng, lat] — NOT
 * [lat, lng] — swapping the pair silently drops every club into the wrong
 * hemisphere and no count check would ever notice.
 *
 * @param {*} geojson
 * @returns {Map<string, {lat: number, lng: number}>}
 */
function parseMapFeatures(geojson) {
  const map = new Map();
  const features = geojson && Array.isArray(geojson.features) ? geojson.features : [];

  for (const feature of features) {
    const id = feature && feature.properties && feature.properties.ID;
    const coords = feature && feature.geometry && feature.geometry.coordinates;
    if (!id || !Array.isArray(coords) || coords.length < 2) continue;
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

/**
 * Loop `fetchPage({start, sz})` until the response says `isComplete: true`
 * — the ONLY acceptable exit (R1.2, AC6, X5). `sz` is clamped to
 * `MAX_PAGE_SIZE` before the first call (sz >= 400 is HTTP 500 on fr_FR);
 * `start` advances by the number of tiles the page actually returned, not
 * by the requested `sz`, so a short page mid-run cannot make the loop skip
 * clubs.
 *
 * @param {{fetchPage: (args:{start:number, sz:number}) => Promise<{pageStart:number, pageSize:number, isComplete:boolean, storeTilesHtml:string}>, sz?: number, maxPages?: number}} args
 * @returns {Promise<{tiles: Array, pages: number}>}
 */
async function paginate({ fetchPage, sz = MAX_PAGE_SIZE, maxPages = 20 }) {
  const clampedSz = Math.min(sz, MAX_PAGE_SIZE);
  let start = 0;
  let pages = 0;
  const tiles = [];

  while (pages < maxPages) {
    const page = await fetchPage({ start, sz: clampedSz });
    pages += 1;

    const pageTiles = parseStoreTiles(page && page.storeTilesHtml);
    tiles.push(...pageTiles);

    if (page && page.isComplete === true) {
      return { tiles, pages };
    }

    if (pageTiles.length === 0) {
      // A page that is both incomplete AND empty cannot make progress —
      // looping further would spin forever or (worse) silently stop with a
      // truncated result. This is the exact shape of the France bug: an
      // incomplete page must never look like a clean finish.
      throw new IncompleteDirectoryError(
        `page at start=${start} returned no tiles and isComplete was not true`
      );
    }

    start += pageTiles.length;
  }

  throw new IncompleteDirectoryError(
    `pagination did not complete within ${maxPages} pages (last start=${start}) — ` +
      'refusing to return a possibly-truncated result'
  );
}

/**
 * Build one country's output file. Determines each club's cityKey/display
 * name from the FULL set of clubs passed in (so accent-variant grouping is
 * correct), then emits only the six permitted fields plus optional
 * `legacyId` (D6), in a fixed order (D2) so an unchanged upstream re-run is
 * byte-identical (AC8) regardless of the order clubs were scraped in.
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

  const built = clubs.map((club) => {
    const cityKey = normalizeCityKey(club.city);
    const out = {
      id: club.id,
      name: club.name,
      cityKey,
      city: displayNameByKey.get(cityKey),
      address: club.address,
    };
    if (club.coordinates) out.coordinates = club.coordinates;
    const legacyId = LEGACY_CLUBS[club.id];
    if (legacyId !== undefined) out.legacyId = legacyId;
    return out;
  });

  built.sort((a, b) => {
    if (a.cityKey !== b.cityKey) return a.cityKey < b.cityKey ? -1 : 1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { country: countryCode, clubs: built };
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
      if (!cityGroups.has(club.cityKey)) {
        cityGroups.set(club.cityKey, { key: club.cityKey, name: club.city, clubCount: 0 });
      }
      cityGroups.get(club.cityKey).clubCount += 1;
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
  paginate,
  buildCountryFile,
  buildIndex,
  countryCountDropExceeded,
  LEGACY_CLUBS,
  MAX_PAGE_SIZE,
  IncompleteDirectoryError,
};
