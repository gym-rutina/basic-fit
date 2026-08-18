#!/usr/bin/env node

/**
 * Build-time directory scraper (spec.md S1, tech-plan.md D5/D6/D7/D8,
 * tech-plan-build-b.md D17/D17a/D17c).
 *
 * Thin I/O shell around scripts/lib/gym-scrape-core.js's pure functions:
 * this file owns the network (axios), the User-Agent, the politeness delay
 * between requests, the CLI entry point, and the file writes. Everything
 * that decides WHAT the data looks like — enumeration, city normalisation,
 * ordering, legacyId resolution — lives in gym-scrape-core.js and is
 * unit-tested there with no network access (AC7).
 *
 * D17c — `makeFetchers(http = axios)` takes its HTTP client as a PARAMETER
 * rather than reaching for a module-scope `axios`. This is the same
 * dependency-inversion tech-plan.md D5 already requires of the core, applied
 * to the last place that still reached for a module-scope client. The
 * default parameter keeps every production caller (`run()` below) unchanged
 * — this is not an API widened for the test's benefit.
 *
 * Undocumented internal storefront routes (spec.md §"Verified research
 * findings"): treat any breakage as expected maintenance. R1.8's fail-loud
 * contract is what stops a silent upstream change from quietly emptying
 * the directory — see D6 below.
 *
 * robots.txt (§0.12): only Store-FinderMap and Store-FinderMore (including
 * `?q=`) are fetched. The sitemap is explicitly sanctioned and is read for
 * city TOKENS only — a `Search-ShowContent?fdid=…` entry it may contain is
 * never handed to the HTTP client (see gym-scrape-core.js's
 * extractSitemapCityTerms, which drops those entries before a term is ever
 * produced).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const {
  parseMapFeatures,
  joinMapAndTiles,
  collectTiles,
  buildCountryFile,
  buildIndex,
  countryCountDropExceeded,
  MAX_PAGE_SIZE,
} = require('./lib/gym-scrape-core.js');

const ROOT = path.join(__dirname, '..');
const GYMS_DIR = path.join(ROOT, 'data', 'gyms');
const USER_AGENT =
  'basicfit-rutina-scraper/1.0 (+https://github.com/; build-time club directory refresh; contact via repo issues)';
const REQUEST_DELAY_MS = 400; // R1.7 — politeness between sequential requests, floor 250ms (D17 fanout cost)
const BASE = 'https://www.basic-fit.com/on/demandware.store/Sites-BFE-Site';

// D4 — one canonical locale per country. Language variants of one country
// return an identical club GUID set (verified in spec.md's research), so
// this is 6 map requests instead of 13.
const COUNTRIES = [
  { code: 'NL', locale: 'nl_NL', names: { en: 'Netherlands', es: 'Países Bajos', be: 'Нідэрланды' } },
  { code: 'BE', locale: 'nl_BE', names: { en: 'Belgium', es: 'Bélgica', be: 'Бельгія' } },
  { code: 'FR', locale: 'fr_FR', names: { en: 'France', es: 'Francia', be: 'Францыя' } },
  { code: 'LU', locale: 'fr_LU', names: { en: 'Luxembourg', es: 'Luxemburgo', be: 'Люксембург' } },
  { code: 'ES', locale: 'es_ES', names: { en: 'Spain', es: 'España', be: 'Іспанія' } },
  { code: 'DE', locale: 'de_DE', names: { en: 'Germany', es: 'Alemania', be: 'Германія' } },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the three fetchers the scraper needs, all closing over the injected
 * `http` client — never a module-scope `axios` (D17c). `http` needs only a
 * `.get(url, config)` method, which both the real axios instance and a test
 * spy satisfy.
 *
 * @param {{get: Function}} [http]
 */
function makeFetchers(http = axios) {
  async function fetchMap(locale) {
    const url = `${BASE}/${locale}/Store-FinderMap`;
    const res = await http.get(url, { headers: { 'User-Agent': USER_AGENT }, validateStatus: () => true });
    if (res.status !== 200) {
      throw new Error(`Store-FinderMap ${locale} returned HTTP ${res.status}`);
    }
    return res.data;
  }

  /**
   * Returns a `fetchTiles({ q, sz })` function for one locale — the shape
   * `collectTiles` (gym-scrape-core.js) drives directly. `q` is omitted for
   * the unfiltered phase-2 call and set to a city term for phase-4 fanout
   * queries. `start` is never sent — §0.5 measured that Store-FinderMore
   * ignores it entirely, so including it would just be dead weight on every
   * URL.
   */
  function makeFetchPage(locale) {
    return async function fetchTiles({ q, sz = MAX_PAGE_SIZE } = {}) {
      const clampedSz = Math.min(sz, MAX_PAGE_SIZE);
      const params = new URLSearchParams({ sz: String(clampedSz) });
      if (q) params.set('q', q);
      const url = `${BASE}/${locale}/Store-FinderMore?${params.toString()}`;
      const res = await http.get(url, { headers: { 'User-Agent': USER_AGENT }, validateStatus: () => true });
      if (res.status !== 200) {
        throw new Error(`Store-FinderMore ${locale} q=${q ?? ''} returned HTTP ${res.status}`);
      }
      await sleep(REQUEST_DELAY_MS);
      return res.data;
    };
  }

  /**
   * The store sitemap — explicitly sanctioned by robots.txt (§0.12). Only
   * read on the fanout path (D17 phase 3), and read for city TOKENS: any
   * `Search-ShowContent` entry it lists is a route robots.txt forbids
   * FOLLOWING, and gym-scrape-core.js's term extraction drops it before a
   * request could ever be built from it.
   */
  async function fetchSitemap(locale) {
    // Verified against the live sitemap index (robots.txt's declared
    // `Sitemap:` root, 2026-08-16): store sitemaps are named
    // sitemap-store-<locale-kebab>-custom-sitemap.xml, e.g.
    // sitemap-store-fr-fr-custom-sitemap.xml (911 club pages + 91
    // salles-de-sport city pages for fr-fr, matching §0.11's counts).
    const slug = String(locale).toLowerCase().replace('_', '-');
    const url = `https://www.basic-fit.com/sitemap-store-${slug}-custom-sitemap.xml`;
    const res = await http.get(url, { headers: { 'User-Agent': USER_AGENT }, validateStatus: () => true });
    if (res.status !== 200) {
      throw new Error(`sitemap ${locale} returned HTTP ${res.status}`);
    }
    await sleep(REQUEST_DELAY_MS);
    return typeof res.data === 'string' ? res.data : String(res.data);
  }

  return { fetchMap, makeFetchPage, fetchSitemap };
}

function readExistingCountryCount(code) {
  try {
    const file = JSON.parse(fs.readFileSync(path.join(GYMS_DIR, `${code}.json`), 'utf8'));
    return Array.isArray(file.clubs) ? file.clubs.length : undefined;
  } catch (e) {
    return undefined; // no previous file — first run, R1.8's drop-guard is inert
  }
}

/**
 * D6 — fail-loud is a two-phase write: scrape ALL countries into memory,
 * validate the whole set, THEN write. A throw at any point before the
 * write phase leaves data/gyms/ exactly as it was on disk.
 */
async function scrapeAll(http = axios) {
  const { fetchMap, makeFetchPage, fetchSitemap } = makeFetchers(http);
  const countryFiles = [];

  for (const country of COUNTRIES) {
    console.log(`Scraping ${country.code} (${country.locale})...`);

    const mapData = await fetchMap(country.locale);
    await sleep(REQUEST_DELAY_MS);
    const coordsByClubId = parseMapFeatures(mapData);
    const mapIds = new Set(coordsByClubId.keys());

    const fetchTiles = makeFetchPage(country.locale);
    const fetchSitemapForLocale = () => fetchSitemap(country.locale);

    const { tiles, requests, viaFanout } = await collectTiles({
      fetchTiles,
      fetchSitemap: fetchSitemapForLocale,
      mapIds,
    });
    console.log(
      `  ${country.code}: ${tiles.length} tiles via ${requests} request(s)${viaFanout ? ' (city fanout)' : ''}`
    );

    const clubs = joinMapAndTiles(tiles, coordsByClubId);
    const file = buildCountryFile(country.code, clubs);

    const previousCount = readExistingCountryCount(country.code);
    if (countryCountDropExceeded(previousCount, file.clubs.length)) {
      throw new Error(
        `${country.code}: club count dropped more than 20% (was ${previousCount}, now ${file.clubs.length}) — refusing to write, treat as upstream breakage (R1.8)`
      );
    }

    countryFiles.push({ ...country, file: `${country.code}.json`, clubs: file.clubs });
  }

  const index = buildIndex({
    lastUpdated: new Date().toISOString().slice(0, 10),
    countries: countryFiles,
  });

  return { index, countryFiles };
}

function writeAll(index, countryFiles) {
  fs.mkdirSync(GYMS_DIR, { recursive: true });
  fs.writeFileSync(path.join(GYMS_DIR, 'index.json'), JSON.stringify(index) + '\n', 'utf8');
  for (const country of countryFiles) {
    const body = { country: country.code, clubs: country.clubs };
    fs.writeFileSync(path.join(GYMS_DIR, `${country.code}.json`), JSON.stringify(body) + '\n', 'utf8');
  }
}

async function run() {
  try {
    const { index, countryFiles } = await scrapeAll();
    writeAll(index, countryFiles);
    console.log(`\nWrote data/gyms/index.json + ${countryFiles.length} country files.`);
    console.log(`Total clubs: ${index.metadata.totalClubs}`);
    return 0;
  } catch (err) {
    console.error(`\nScrape failed, existing data/gyms/ left untouched: ${err.message}`);
    return 1;
  }
}

if (require.main === module) {
  run().then((code) => process.exit(code));
}

module.exports = { scrapeAll, writeAll, COUNTRIES, makeFetchers };
