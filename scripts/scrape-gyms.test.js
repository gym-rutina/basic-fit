// @vitest-environment node
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import http from 'node:http';
import https from 'node:https';

/**
 * NETWORK GUARD — belt and braces, and it exists because this suite already
 * went to the wire TWICE with two different mechanisms.
 *
 * Gate cycle 5: the previous version used `vi.mock('axios')`, which rewrites
 * only THIS file's ESM import. `scripts/scrape-gyms.js` is CommonJS and does
 * `require('axios')`, so it kept the real client and reached the live
 * storefront.
 *
 * Gate cycle 6: the fix above (dependency injection) is sound, but the guard
 * that shipped alongside it stubbed `axios.defaults.adapter` on THIS file's
 * ESM-imported axios — the same ESM/CJS split, one layer up. Bagnik measured
 * `expect(cjsAxios).toBe(esmAxios)` FAIL: Vite's `import axios` here and the
 * shell's `require('axios')` are different module objects, so stubbing one's
 * adapter leaves the other's live. A decisive run reached the socket layer
 * (`VERDICT: REACHED-SOCKET`) — a real HTTPS request to basic-fit.com.
 *
 * The guard below intercepts `http`/`https` — the transport BOTH module
 * systems' axios ultimately calls into — so it is module-system agnostic and
 * cannot be defeated by an ESM/CJS split on either side. If injection ever
 * regresses, the request throws here instead of reaching a real server. This
 * is deliberately independent of the injection seam: a test-correctness
 * mistake must not be able to become a real-world one.
 */
const __networkAttempts = [];
const __realTransport = {};
beforeAll(() => {
  for (const [name, mod] of [['http', http], ['https', https]]) {
    for (const fn of ['request', 'get']) {
      __realTransport[`${name}.${fn}`] = mod[fn];
      mod[fn] = (...args) => {
        const target = args[0];
        const identified =
          (target && target.href) ||
          (typeof target === 'string' ? target : null) ||
          (target && (target.hostname || target.host) && `${target.hostname || target.host}${target.path || ''}`) ||
          '?';
        __networkAttempts.push(String(identified));
        throw new Error('scrape-gyms.test.js: network access is forbidden in this suite');
      };
    }
  }
});
afterAll(() => {
  http.request = __realTransport['http.request'];
  http.get = __realTransport['http.get'];
  https.request = __realTransport['https.request'];
  https.get = __realTransport['https.get'];
});

/**
 * gym-directory-and-catalog — the scraper's I/O shell (tech-plan-build-b.md
 * §0.12, D17).
 *
 * Build A shipped `scripts/scrape-gyms.js` with NO test of any kind. That was
 * accepted at the time because the shell is thin and every decision lives in
 * the pure core. D17 changes the calculus: the shell now also fetches a
 * sitemap and builds `?q=` query URLs, and it is **the only place in the
 * codebase where a request URL is constructed**. robots.txt compliance is
 * therefore a property of this file and of nothing else.
 *
 * These are deliberately STATIC SOURCE assertions, not behavioural ones. The
 * constraint being enforced is literally "this route must never appear in
 * this file", which is a text property; mocking axios to prove a negative
 * about URLs that are never built would be weaker and more brittle. No
 * network, no execution — the module is read, not imported (importing it
 * would run the CLI entry point).
 *
 * robots.txt (fetched 2026-08-16), the Disallow rules that bind us, written
 * without their leading glob so this docblock does not terminate itself:
 *   - any URL carrying "StoreID=" as a query parameter
 *   - the "Store-FindStores" pipeline
 *   - the "Store-Landing" pipeline
 *   - the "Search-ShowContent" pipeline
 * NOT disallowed, and therefore what the design uses: Store-FinderMap,
 * Store-FinderMore (including with ?q=), and the sitemap robots.txt itself
 * advertises.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = path.join(ROOT, 'scripts', 'scrape-gyms.js');
const source = fs.readFileSync(SHELL, 'utf8');

/**
 * Strips comments so a route named in a docblock is not read as a call.
 *
 * KNOWN LIMITATION, stated rather than hidden: this is a naive lexer, not a
 * parser. A `/*` sequence inside a string or regex literal would make it
 * delete real code from the scan — a FALSE NEGATIVE in what is a security
 * tripwire, which is the dangerous direction for this class of test. No such
 * literal exists in the shell today. If one ever appears, replace this with a
 * real tokenizer rather than trusting the result; the assertions below are
 * only as good as this stripping.
 */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/**
 * Extracts every `${prefix}...)` call from `text`, matching the closing
 * paren by depth rather than by the first `)` encountered — so a nested
 * call (e.g. `JSON.stringify(buildIndex(x), null, 2)`) is captured whole,
 * not truncated at its inner argument's closing paren.
 *
 * KNOWN LIMITATION, stated rather than hidden (Bagnik's cycle-9 re-gate
 * finding): this is a naive char scanner, not a parser — a literal `)`
 * inside a string argument (e.g. `JSON.stringify(")" , null, 2)`) would
 * miscount depth and truncate early. Unreachable from `scrape-gyms.js`
 * today (no `JSON.stringify` call there takes a string literal containing
 * a paren); if one ever does, this needs a real tokenizer.
 *
 * @param {string} text
 * @param {string} prefix - e.g. 'JSON.stringify(' — must end in '('
 * @returns {string[]}
 */
function extractCalls(text, prefix) {
  const calls = [];
  let idx = text.indexOf(prefix);
  while (idx !== -1) {
    let depth = 1;
    let i = idx + prefix.length;
    while (i < text.length && depth > 0) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') depth -= 1;
      i += 1;
    }
    calls.push(text.slice(idx, i));
    idx = text.indexOf(prefix, i);
  }
  return calls;
}

describe('robots.txt compliance (§0.12) — enforced where URLs are built', () => {
  it.each([
    ['StoreID', /StoreID/i],
    ['Store-FindStores', /Store-FindStores/i],
    ['Store-Landing', /Store-Landing/i],
  ])('never references the disallowed route %s', (_name, pattern) => {
    // These three are absent outright: nothing in the design has any reason to
    // name them, not even to exclude them. Search-ShowContent is different and
    // is asserted separately below.
    expect(code).not.toMatch(pattern);
  });

  /**
   * There is deliberately NO assertion here counting axios call sites.
   *
   * Cycle 4 added one, pinning the count at 3 to argue that driving three
   * fetchers was equivalent to driving every request. Gate cycle 5 measured
   * that a shell funnelling its three identical calls through a single
   * `request()` helper — which is what R1.7's shared User-Agent and politeness
   * delay actively push toward, and which is BETTER for robots auditability —
   * has ONE call site and was rejected by the pin. Another assertion failing a
   * more-correct implementation.
   *
   * The completeness argument it carried was invalid anyway: counting call
   * sites in text establishes nothing about whether those sites are reachable
   * from the exported fetchers. It was removed rather than repaired, because
   * there is no threshold that makes a text count answer a reachability
   * question.
   */

  it('uses only the two permitted storefront endpoints', () => {
    const endpoints = [...code.matchAll(/Store-[A-Za-z]+/g)].map((m) => m[0]);
    const permitted = new Set(['Store-FinderMap', 'Store-FinderMore']);
    expect([...new Set(endpoints)].filter((e) => !permitted.has(e))).toEqual([]);
  });

  it('talks to the storefront over https only', () => {
    /**
     * Same class as the two gate blockers, caught by the sweep rather than by
     * Bagnik: a bare `not.toMatch(/http:\/\//)` fails a CORRECT implementation
     * the moment the shell parses sitemap XML, because the sitemap's own
     * namespace is `http://www.sitemaps.org/schemas/sitemap/0.9` — a URI used
     * as an identifier and never dereferenced. D17 phase 3 makes that parser
     * likely, so this would have blocked Cmok for doing the right thing.
     *
     * Assert the property that matters — no REQUEST goes over cleartext —
     * by excluding well-known XML namespace URIs first.
     */
    const withoutXmlNamespaces = code.replace(/http:\/\/(www\.)?(sitemaps\.org|w3\.org)\/[^\s'"`)]*/g, '');
    expect(withoutXmlNamespaces).not.toMatch(/http:\/\//);
    expect(code).toMatch(/https:\/\/(www\.)?basic-fit\.com/);
  });
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS SUITE IS BEHAVIOURAL AND THE CYCLE-3 STATIC TEST WAS WRONG
 *
 * Cycle 3 replaced a blanket `not.toMatch(/Search-ShowContent/i)` with a
 * line-scoped rule: keep the lines that name the route, fail any that also
 * look like a request. Bagnik ran four violating shells through it at gate
 * cycle 4 and only the single-line form was caught:
 *
 *   await axios.get(BASE + '/Search-ShowContent?fdid=' + id)      → caught
 *   const route = '…Search-ShowContent…';  await axios.get(route) → MISSED
 *   sitemap.find(e => e.includes('Search-ShowContent'))           → MISSED
 *     then await axios.get(target)
 *   ROUTES.showContent interpolated into a get                    → MISSED
 *
 * The third is the NATURAL implementation of D17 phase 3 — the very feature
 * the test was written for. Bagnik then built the obvious repair (invert the
 * polarity: demand an exclusion idiom on every mention line) and it rejected a
 * legitimate compliant form. That negative result is the whole finding:
 *
 *   Whether the route is NAMED is a text property — a regex decides it.
 *   Whether a request ever CARRIES it is a data-flow property — no regex
 *   decides it, in either direction.
 *
 * Static denial stays sound for the three routes that must be ABSENT (above);
 * absence is a text property. It is unsound for the one route that must be
 * PRESENT-BUT-NOT-FETCHED, because being present is exactly what compliance
 * looks like here: D17 phase 3 must read the sitemap, and the sitemap lists
 * `Search-ShowContent?fdid=…` entries that robots.txt forbids FOLLOWING.
 *
 * So this suite asserts over the URLs the shell actually hands to its HTTP
 * client, through an injected spy.
 *
 * SCOPE, stated rather than implied: this proves no FETCHER builds a
 * disallowed URL. It does not prove the fanout never passes one in as an
 * argument — that would need a full `scrapeAll()` drive, six countries and
 * R1.7's politeness delays. The core-side half of that is covered by
 * `gym-scrape-core.test.js`'s term-provenance assertion, which pins where
 * query terms may come from. The residual is recorded as a known gap; cycle 4
 * claimed a static call-site count closed it, and gate cycle 5 showed that
 * count both rejected a compliant implementation and established nothing
 * about reachability. A smaller honest claim beats a larger unsound one.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('robots.txt compliance (§0.12) — behavioural, over the injected fetchers', () => {
  // Same shape as the core's fixture: real sitemap entries, including the
  // Search-ShowContent one that must be read past but never requested.
  const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.basic-fit.com/es-es/gimnasios/madrid</loc></url>
  <url><loc>https://www.basic-fit.com/on/demandware.store/Sites-BFE-Site/es_ES/Search-ShowContent?fdid=vilagarc%c3%ada</loc></url>
  <url><loc>https://www.basic-fit.com/es-es/clubs/basic-fit-malaga-alameda-1ec43550fd654c7d8e23bc6c96cd2ff0.html</loc></url>
</urlset>`;

  let urls;

  /**
   * The spy client. This IS the seam — an object with `.get`, which is all the
   * shell needs from axios. No module registry, no interop, nothing to mock.
   */
  function spyHttp() {
    return {
      get: async (url) => {
        urls.push(url);
        return {
          status: 200,
          data: /sitemap/i.test(url) ? SITEMAP_XML : { clusters: { features: [] }, stores: [] },
        };
      },
    };
  }

  beforeEach(() => {
    urls = [];
  });

  /**
   * D17c — `makeFetchers(http = axios)` takes the HTTP client as a PARAMETER.
   *
   * The cycle-4 version exported a `__fetchers` object and mocked axios. It
   * failed for a reason no amount of care with the assertions could have
   * fixed: the shell is CommonJS and `require`s axios, while `vi.mock`
   * rewrites only this file's ESM import. The shell kept the real client
   * (measured: `SHELL-side axios === real axios`), `urls` stayed empty, and
   * the two compliance assertions passed VACUOUSLY on an empty array while
   * the non-vacuity one failed forever. It also reached the live storefront.
   *
   * Injection dissolves that instead of working around it: no module-registry
   * interception to get wrong, no ESM/CJS boundary to bridge. It is also the
   * seam D5 already demands of the core — which this very file asserts as
   * "injects both fetchers rather than letting the core do I/O". The shell was
   * the last place still reaching for a module-scope client.
   *
   * The default parameter (`= axios`) keeps production callers unchanged, so
   * this is not an API widened for the test's benefit.
   */
  async function fetchers() {
    const shell = await import('./scrape-gyms.js');
    const make = shell.makeFetchers ?? shell.default?.makeFetchers;
    if (!make) throw new Error('scrape-gyms.js does not export makeFetchers(http) (D17c)');
    return make(spyHttp());
  }

  it('uses the injected client — the precondition for everything below', async () => {
    /**
     * Asserted first and on its own, because cycle 4's suite could not tell
     * "no disallowed URL was requested" from "no URL was requested at all".
     * If `makeFetchers` ignores its argument and closes over a module-scope
     * client, this fails here in one line instead of quietly turning the
     * compliance assertions into vacuous truths about an empty array.
     */
    const { fetchMap } = await fetchers();
    await fetchMap('es_ES');

    expect(urls).toHaveLength(1);
  });

  it('reads the sitemap — without which the skip below would be vacuous', async () => {
    // A shell that never fetches the sitemap trivially satisfies "never
    // requests Search-ShowContent" while failing D17 phase 3 outright.
    const { fetchSitemap } = await fetchers();
    await fetchSitemap('es_ES');

    expect(urls.filter((u) => /sitemap/i.test(u))).not.toHaveLength(0);
  });

  it('never hands a Search-ShowContent URL to the client, from any fetcher', async () => {
    const { fetchMap, makeFetchPage, fetchSitemap } = await fetchers();

    await fetchSitemap('es_ES');
    await fetchMap('es_ES');
    await makeFetchPage('es_ES')({ start: 0, sz: 300 });

    // Catches every violating form, because it does not care HOW the URL was
    // built — only that it reached the client.
    expect(urls.filter((u) => /Search-ShowContent/i.test(String(u)))).toEqual([]);
    expect(urls).not.toHaveLength(0); // never vacuous, whatever the shell does
  });

  it('never hands a StoreID-bearing URL to the client either (§0.12)', async () => {
    // The static denylist catches the literal; this catches the constructed one.
    const { fetchMap, makeFetchPage, fetchSitemap } = await fetchers();

    await fetchSitemap('es_ES');
    await fetchMap('es_ES');
    await makeFetchPage('es_ES')({ start: 0, sz: 300 });

    expect(urls.filter((u) => /StoreID=/i.test(String(u)))).toEqual([]);
    expect(urls).not.toHaveLength(0);
  });
});

describe('politeness (R1.7)', () => {
  it('sends an identifying User-Agent with a contact route', () => {
    expect(code).toMatch(/User-Agent/);
    expect(source).toMatch(/basicfit-rutina-scraper/);
    // A UA with no way to reach the operator is not an identifying UA.
    expect(source).toMatch(/contact|github\.com|\+https/i);
  });

  it('keeps a delay between sequential requests', () => {
    expect(code).toMatch(/REQUEST_DELAY_MS|sleep\s*\(/);
  });

  it('does not lower the politeness delay below 250 ms', () => {
    // The fanout multiplies France's request count by ~400 (D17). A shorter
    // delay would turn a considerate monthly job into a burst.
    const declared = source.match(/REQUEST_DELAY_MS\s*=\s*(\d+)/);
    expect(declared).not.toBeNull();
    expect(Number(declared[1])).toBeGreaterThanOrEqual(250);
  });
});

describe('the shell is wired to the pure core (D5, D17a)', () => {
  it('imports collectTiles, and no longer imports the removed paginate', () => {
    // Scoped to the IMPORT list rather than the whole file. The module-wide
    // form would fail a correct implementation that happened to name a local
    // helper or a loop variable `paginate` — the export is what D17a removes,
    // not the word.
    const importBlock = (code.match(/require\(['"]\.\/lib\/gym-scrape-core\.js['"]\)/)
      ? code.slice(0, code.indexOf('gym-scrape-core.js'))
      : code
    ).slice(-600);

    expect(code).toMatch(/collectTiles/);
    expect(importBlock).not.toMatch(/\bpaginate\b/);
  });

  it('injects both fetchers rather than letting the core do I/O', () => {
    // The core must stay isomorphic (no fs/path/process) so the app can
    // import its siblings. If the shell stopped injecting, the core would
    // have to own axios and that boundary would collapse.
    expect(code).toMatch(/fetchTiles/);
    expect(code).toMatch(/fetchSitemap/);
  });

  it('passes the map ids to collectTiles as the completeness oracle', () => {
    expect(code).toMatch(/mapIds/);
  });

  it('never requests a page size above the core\'s MAX_PAGE_SIZE', () => {
    // sz >= 350 is HTTP 500 (§0.6). The cap belongs to the core; the shell
    // must defer to it rather than hardcoding its own number.
    expect(code).toMatch(/MAX_PAGE_SIZE/);
  });
});

describe('fail-loud two-phase write (D6, AC6)', () => {
  it('still guards against a >20% country count drop', () => {
    expect(code).toMatch(/countryCountDropExceeded/);
  });

  it('writes only after every country has been collected', () => {
    // D6: "scrape all six into memory, validate the whole set, THEN write".
    // A write inside the per-country loop would leave data/gyms/ half-updated
    // when a later country throws — which is what AC6 forbids.
    //
    // KNOWN LIMITATION: this compares TEXT POSITIONS as a proxy for control
    // flow. It catches the obvious reordering, not a write reachable through
    // a branch that appears later in the file but executes earlier. The real
    // guarantee lives in `gym-scrape-core`'s tested functions plus the
    // integration behaviour; this is a cheap tripwire on the untested shell,
    // not a proof.
    const firstWrite = code.search(/writeFileSync/);
    const validation = code.search(/countryCountDropExceeded/);
    expect(firstWrite).toBeGreaterThan(-1);
    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(firstWrite);
  });
});

describe('payload size budget (AC4, D6a — cycle-9 correction)', () => {
  // Bagnik's cycle-8 code QA (handoff-log.md 04:15) measured the shipped
  // data/gyms/ (pretty-printed, `JSON.stringify(x, null, 2)`) at 604.9KB
  // against AC4's ≤300KB raw cap — 2x over. Dropping `coordinates` and
  // `cityKey` from club records (verified in gym-scrape-core.test.js) is
  // necessary but not sufficient on its own: the same shape pretty-printed
  // still lands well over 300KB (measured ~408KB). Shipping the written
  // files minified — no indentation whitespace — is what closes the
  // remaining gap (verified: 214.0KB club files + 62.6KB index = 276.6KB,
  // 23.4KB of headroom). "Raw" in AC4 means uncompressed/un-gzipped, not
  // human-indented — X7's own projection never assumed pretty-printing.
  it('writes index.json and the country files without pretty-print indentation', () => {
    // A regex like /JSON\.stringify\([^;]*?\)/ stops at the FIRST ")" it
    // meets, so a nested call — JSON.stringify(buildIndex(x), null, 2) — gets
    // truncated to `JSON.stringify(buildIndex(x)` and the pretty-print check
    // silently passes a violation (Bagnik's cycle-9 test-gate finding). This
    // scans for the matching closing paren by depth instead, robust to
    // nesting regardless of how the call site is written.
    const writes = extractCalls(code, 'JSON.stringify(');
    expect(writes.length).toBeGreaterThan(0);
    for (const call of writes) {
      expect(call).not.toMatch(/,\s*null\s*,\s*2\s*\)\s*$/);
    }
  });
});

describe('network guard (§0.12) — the transport-level tripwire actually held', () => {
  it('the interception is actually installed, not merely believed to be', () => {
    /**
     * Gate cycle 7: `opened zero sockets` below detects injection regressing
     * WHILE the guard holds (an empty array because nothing got past it). It
     * cannot detect the guard itself being absent or neutered — an empty
     * array also results if `beforeAll` above silently no-ops, and Bagnik
     * measured exactly that: guard surgically removed, `opened zero sockets`
     * PASSED, four live TLS connections reached basic-fit.com. This
     * assertion is what closes that gap — it checks the currently-bound
     * functions ARE the guard's, not the originals, so a skipped or
     * neutered `beforeAll` fails here instead of the run going green.
     */
    // Checked by content, not by reference against the saved original: a
    // reference check against `__realTransport` would be vacuous if
    // `beforeAll` above never ran, because the saved-original slot would
    // then be `undefined` too and "not equal to undefined" trivially holds
    // for the untouched native function. Matching the guard's own error text
    // in the currently-bound function's source has no such blind spot — an
    // unpatched native function's source cannot contain it.
    for (const [name, fn] of [
      ['http.request', http.request],
      ['http.get', http.get],
      ['https.request', https.request],
      ['https.get', https.get],
    ]) {
      expect(String(fn), `${name} does not carry the guard`).toMatch(/network access is forbidden/);
    }
  });

  it('opened zero sockets across the whole file', () => {
    // Detects injection regressing while the guard holds: if a fetcher
    // reaches for the real client instead of the injected one, the attempt
    // lands here with the URL(s) instead of the run merely showing red
    // elsewhere. Does NOT by itself prove the guard is installed — the test
    // above is what makes that claim true; the two are deliberately separate
    // assertions rather than one, so each failure names its own cause.
    expect(__networkAttempts).toEqual([]);
  });
});
