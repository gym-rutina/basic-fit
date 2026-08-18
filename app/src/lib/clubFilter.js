/**
 * Pure club-filtering module (spec.md AC39, tech-plan.md D19).
 *
 * Boundary rule: this module has ZERO React imports (tech-plan-build-b.md
 * §1). `foldForSearch` deliberately does NOT reuse `slugifyExerciseName`
 * (exerciseKey.js) wholesale — that function also collapses runs of
 * separators to a single dash, which would make a multi-word substring like
 * "de andalucia" unmatchable against "av. de andalucía 12". The two folding
 * rules are pinned to agree on diacritic handling by clubFilter.test.js, so
 * they cannot silently diverge without coupling the modules.
 */

const COMBINING_MARKS_RE = /[̀-ͯ]/g;

/**
 * NFD-normalise, strip combining diacritical marks, lowercase. Spaces and
 * punctuation are preserved on purpose — see the module doc comment above.
 * Non-string input degrades to `''` rather than throwing: this runs against
 * user-typed input and persisted club records that may predate a schema
 * change.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function foldForSearch(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFD').replace(COMBINING_MARKS_RE, '').toLowerCase();
}

/**
 * Filters `clubs` to those whose name, address OR city (folded,
 * diacritic-insensitive, substring match) contains the folded query.
 *
 * `city` is part of the match set, not just name and address (tech-plan.md
 * D19, corrected mid-cycle) — a user who types their city into the club box
 * must not get an empty list.
 *
 * An empty (or whitespace-only) query returns the INPUT ARRAY UNCHANGED —
 * not a copy, not reordered — so the picker's "no query yet" state renders
 * the city's clubs in their build-time order (D2).
 *
 * @param {Array<{name?: string, address?: string, city?: string}>} clubs
 * @param {string} query
 * @returns {Array}
 */
export function filterClubs(clubs, query) {
  if (!Array.isArray(clubs)) return [];
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) return clubs;

  const folded = foldForSearch(trimmed);
  return clubs.filter((club) => {
    const haystack = foldForSearch(`${club?.name ?? ''} ${club?.address ?? ''} ${club?.city ?? ''}`);
    return haystack.includes(folded);
  });
}
