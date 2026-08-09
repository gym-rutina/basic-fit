/**
 * Derived exercise identity (spec.md's Data contract, tech-plan.md D1/D2).
 *
 * One machine hosts several exercises, each with its own working weight, so
 * `equipmentId` alone is the wrong tracking key. The exercise key is
 * `${equipmentId}::${slug(name)}`, DERIVED at read time and never stored —
 * session rows keep carrying plain `equipmentId` + `name`, which is what
 * lets existing history split by exercise retroactively (AC7) with no
 * backfill.
 *
 * Boundary rule: this module has ZERO imports. It runs inside screens,
 * aggregators, and IndexedDB transactions alike, so nothing here may pull in
 * React, the catalog, or db.js — everything else may depend on this module,
 * this module depends on nothing.
 */

/**
 * Lowercases, strips diacritics, and collapses every run of non-alphanumeric
 * characters to a single dash (trimmed at both ends). Non-string input
 * degrades to `''` rather than throwing: this runs inside an IndexedDB
 * transaction on user-authored rutina data, and a malformed name must
 * degrade to "not trackable", never abort a session write.
 *
 * @param {unknown} name
 * @returns {string}
 */
export function slugifyExerciseName(name) {
  if (typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Derives the exercise key from `{ equipmentId, name }`. Two documented
 * degenerate forms (tech-plan.md D1):
 *   - no `equipmentId` (bodyweight) → `::${slug}` — the name alone identifies it
 *   - `name` slugs to `''` → the bare `equipmentId`, with NO `::`, so it can
 *     never collide with a composite key
 * Returns `null` when neither an id nor a usable name is present — that
 * means "not trackable": no `lastWeights` write (AC4), excluded from
 * trend/progress/export grouping.
 *
 * @param {{equipmentId?: string|null, name?: string|null}} [exercise]
 * @returns {string|null}
 */
export function exerciseKey({ equipmentId, name } = {}) {
  const id = equipmentId || '';
  const slug = slugifyExerciseName(name);
  if (!id && !slug) return null;
  if (!id) return `::${slug}`;
  if (!slug) return id;
  return `${id}::${slug}`;
}
