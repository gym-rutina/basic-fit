/**
 * The app's single directory module (tech-plan.md D1/D2, tech-plan-build-b.md D18).
 *
 * `GYM_INDEX` mirrors `data/gyms/index.json` (a static import — country and
 * city dropdowns need no country file at all, so the picker's first two
 * fields have no loading state, ux-design.md §2). Country files are loaded
 * through `import.meta.glob` (lazy, one Vite chunk per country) — every
 * chunk is still emitted by Vite and therefore precached (D1/X6, asserted by
 * `scripts/precache-manifest.test.js`), unlike the `postbuild` copy path.
 */
import indexData from '../../../data/gyms/index.json';

export const GYM_INDEX = indexData;
export const COUNTRIES = GYM_INDEX.countries;
export const TOTAL_CLUBS = GYM_INDEX.metadata.totalClubs; // AC45 — the Catálogo StatCard reads this, never GYMS.length or COUNTRIES.length

// One Vite chunk per `data/gyms/<CC>.json` file. `??` matches exactly the
// two-uppercase-letter country codes (NL/BE/FR/LU/ES/DE) — `index.json`
// does NOT match this pattern, so the index (already a static import above)
// is never double-loaded through the glob.
const countryModules = import.meta.glob('../../../data/gyms/??.json');

const countryFileCache = new Map();

function findCountry(countryCode) {
  return COUNTRIES.find((c) => c.code === countryCode);
}

/**
 * @param {string} countryCode
 * @returns {Array<{key: string, name: string, clubCount: number}>}
 */
export function citiesFor(countryCode) {
  const country = findCountry(countryCode);
  return country ? country.cities : [];
}

/**
 * Resolves the lazy country chunk and returns its `clubs[]` array.
 * Resolves to `[]` for an unknown country rather than rejecting — a missing
 * chunk must never take down the picker.
 *
 * @param {string} countryCode
 * @returns {Promise<Array>}
 */
export async function loadClubs(countryCode) {
  const country = findCountry(countryCode);
  if (!country) return [];

  if (countryFileCache.has(countryCode)) return countryFileCache.get(countryCode);

  const key = Object.keys(countryModules).find((k) => k.endsWith(`/${country.file}`));
  if (!key) return [];

  const loadPromise = countryModules[key]()
    .then((mod) => (mod && mod.default && Array.isArray(mod.default.clubs) ? mod.default.clubs : []))
    .catch(() => []);

  countryFileCache.set(countryCode, loadPromise);
  return loadPromise;
}

/**
 * @param {string} countryCode
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function findClubById(countryCode, id) {
  const clubs = await loadClubs(countryCode);
  return clubs.find((c) => c.id === id) ?? null;
}

/**
 * Resolves a legacy numeric gym id (1..7, the original hand-entered Málaga
 * gyms) to its club record (tech-plan.md D8, AC33). `legacyId` is a field on
 * the CLUB RECORD itself (stamped by `buildCountryFile` from
 * `gym-scrape-core.js`'s frozen `LEGACY_CLUBS` table at scrape time) —
 * every legacy club is in Spain, so only the ES chunk needs loading.
 *
 * @param {number|string} legacyId
 * @returns {Promise<object|null>}
 */
export async function resolveLegacyGymId(legacyId) {
  const n = Number(legacyId);
  if (!Number.isInteger(n) || n < 1 || n > 7) return null;

  const clubs = await loadClubs('ES');
  return clubs.find((c) => c.legacyId === n) ?? null;
}
