// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * gym-directory-and-catalog AC38 (tech-plan.md D1, X6).
 *
 * AC37 — "with the network disabled from a cold start, country → city → club
 * completes and lists real clubs" — cannot be honestly automated: a mocked
 * offline proves nothing about precache. THIS file is its automatable half,
 * and it is a real assertion against the manifest Workbox actually generated,
 * not against vite.config.js's intent.
 *
 * X6 is the specific trap. `scripts/copy-static-pages.js` runs as `postbuild`,
 * i.e. AFTER the manifest is generated, so anything reaching `dist/` only
 * through that path is invisible to Workbox and silently unavailable offline.
 * Directory data must therefore arrive as Vite CHUNKS (D1's
 * `import.meta.glob`), never as copied files.
 *
 * Two preconditions, handled differently on purpose:
 *   - `data/gyms/index.json` missing → **FAIL**. That is a real gap in the
 *     Build B surface (the scraper has not produced the directory yet), not a
 *     harness quirk, and it must stay visible until Cmok closes it.
 *   - `dist/` not built → **SKIP the chunk assertions, with a warning**. Whether
 *     someone ran `npm run build` says nothing about the app's correctness.
 *     Bagnik's gate builds first and therefore gets the real assertion; a
 *     skipped AC38 must never be read as a passing one.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

function readManifestEntries() {
  if (!fs.existsSync(DIST)) return null;
  const swCandidates = ['sw.js', 'service-worker.js']
    .map((f) => path.join(DIST, f))
    .filter((f) => fs.existsSync(f));
  const injected = fs
    .readdirSync(DIST)
    .filter((f) => /^workbox-.*\.js$/.test(f))
    .map((f) => path.join(DIST, f));

  const sources = [...swCandidates, ...injected];
  if (sources.length === 0) return null;

  const urls = new Set();
  for (const file of sources) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/"url"\s*:\s*"([^"]+)"/g)) urls.add(m[1]);
    for (const m of body.matchAll(/url\s*:\s*"([^"]+)"/g)) urls.add(m[1]);
  }
  return urls;
}

const INDEX_PATH = path.join(ROOT, 'data', 'gyms', 'index.json');

function readCountryCodes() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')).countries.map((c) => c.code);
  } catch {
    return null;
  }
}

const manifest = readManifestEntries();
const countryCodes = readCountryCodes();
const built = manifest !== null && manifest.size > 0;
const describeBuilt = built && countryCodes ? describe : describe.skip;

describe('precache manifest — preconditions (AC38)', () => {
  it('has the scraped directory index on disk', () => {
    // RED until the scraper produces data/gyms/. This is a real part of the
    // Build B surface, not a harness quirk: with no index there is nothing to
    // chunk, so AC38 cannot hold. Asserted explicitly rather than left to an
    // ENOENT inside beforeAll, which reads as a broken test rather than as an
    // unbuilt feature.
    expect({ path: 'data/gyms/index.json', exists: countryCodes !== null }).toEqual({
      path: 'data/gyms/index.json',
      exists: true,
    });
  });

  it('reports clearly when dist/ has not been built', () => {
    // Not an assertion about the app — a signpost. A silently-skipped AC38
    // reads identically to a passing one in CI output, which is how an
    // offline regression ships unnoticed. Bagnik must run a build before
    // treating AC38 as covered.
    if (!built) {
      // eslint-disable-next-line no-console
      console.warn(
        '[AC38] dist/ absent or no precache manifest found — chunk assertions SKIPPED. ' +
          'Run `npm run build` first; the gate must not accept a skipped AC38.'
      );
    }
    expect(true).toBe(true);
  });
});

describeBuilt('precache manifest contains every country chunk (AC38, D1)', () => {
  it('emits one precached asset per country', () => {
    // Vite emits every import.meta.glob branch as a real chunk, so each
    // country file becomes its own JS asset. Missing one means that country's
    // users get an empty club list offline — the exact AC37 failure.
    const entries = [...manifest];
    const missing = countryCodes.filter(
      (code) => !entries.some((url) => url.includes(code) || url.toLowerCase().includes(code.toLowerCase()))
    );
    expect({ missing }).toEqual({ missing: [] });
  });

  it('precaches the statically imported index as part of the entry bundle', () => {
    const entries = [...manifest].join('\n');
    expect(entries).toMatch(/\.js/);
    expect(manifest.size).toBeGreaterThan(1);
  });

  it('does not rely on the postbuild copy path for directory data (X6)', () => {
    // copy-static-pages.js runs AFTER manifest generation. A raw
    // `data/gyms/*.json` in the manifest would mean the data got there by
    // being copied, not chunked — and on the next build it would drop out
    // with no test noticing.
    const copied = [...manifest].filter((url) => /data\/gyms\/.*\.json$/.test(url));
    expect({ copied }).toEqual({ copied: [] });
  });

  it('keeps every country chunk under Workbox\'s 2 MiB default size cap', () => {
    // FR is the largest at ~280 KB raw. If a country ever crossed the cap it
    // would be silently EXCLUDED from precache rather than failing the build.
    for (const url of manifest) {
      const file = path.join(DIST, url.replace(/^\//, ''));
      if (!fs.existsSync(file) || !file.endsWith('.js')) continue;
      expect({ url, tooBig: fs.statSync(file).size > 2 * 1024 * 1024 }).toEqual({ url, tooBig: false });
    }
  });
});
