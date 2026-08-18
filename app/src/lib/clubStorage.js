/**
 * Club selection storage (tech-plan.md D3, spec.md R5.5, D16).
 *
 * Selection lives in `localStorage`, NOT IndexedDB — a synchronous read is
 * what lets GuideOverlay's trigger and CatalogScreen's club row render
 * correctly on the FIRST paint for a returning user, with no flash of
 * "Selecciona tu club". Follows the existing `rutina:uiLang` /
 * `rutina:onboardingSeen` namespace convention.
 *
 * `isStale` is D16's separate resolution step: `readClub()` returns the
 * record verbatim (so a vanished club never blanks the trigger — its
 * cached name/address/city still render); comparing it against a freshly
 * loaded club list is a DIFFERENT call, made by whoever has that list.
 */

export const CLUB_KEY = 'rutina:club';

function isValidClubRecord(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.clubId === 'string' &&
    typeof value.name === 'string'
  );
}

/**
 * @returns {{countryCode: string, clubId: string, name: string, city: string, address: string}|null}
 */
export function readClub() {
  try {
    const raw = localStorage.getItem(CLUB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidClubRecord(parsed) ? parsed : null;
  } catch {
    return null; // corrupt JSON, private-browsing storage denial, etc.
  }
}

/**
 * @param {{countryCode: string, clubId: string, name: string, city: string, address: string}} club
 */
export function writeClub(club) {
  try {
    localStorage.setItem(CLUB_KEY, JSON.stringify(club));
  } catch {
    // Quota exceeded / storage disabled — the same defensive convention as
    // uiLangStorage.js / onboardingStorage.js: lose the preference, never
    // fail the flow.
  }
}

export function clearClub() {
  try {
    localStorage.removeItem(CLUB_KEY);
  } catch {
    // ignore
  }
}

/**
 * D16 — a persisted club that no longer appears in a freshly loaded club
 * list has vanished from a later refresh (M13's monthly re-scrape) and must
 * DEGRADE, not crash. `clubs === undefined/null/[]` is treated as
 * INCONCLUSIVE (the country chunk may not have loaded, or loaded partially)
 * — reporting "stale" here would show every returning user a spurious
 * re-select prompt on every cold start, which is worse than staying silent
 * for one extra frame.
 *
 * @param {{clubId: string}|null} club
 * @param {Array<{id: string}>|null|undefined} clubs
 * @returns {boolean}
 */
export function isStale(club, clubs) {
  if (!club) return false;
  if (!Array.isArray(clubs) || clubs.length === 0) return false;
  return !clubs.some((c) => c && c.id === club.clubId);
}
