/**
 * design-system-sync-fixes AC3 — bundle-freshness check, PURE core (no fs).
 *
 * The scripts/ds-bundle-freshness.js shell globs
 * design-system/components/ ** /*.{jsx,d.ts} + design-system/tokens/*.css,
 * stat()s them and _ds_bundle.js, then calls this and process.exit(1) if the
 * result is non-empty.
 */

/**
 * @param {number} bundleMtimeMs  mtime of design-system/_ds_bundle.js
 * @param {{path: string, mtimeMs: number}[]} sources
 * @returns {string[]} paths of sources strictly newer than the bundle, in input order
 */
export function staleSources(bundleMtimeMs, sources) {
  const stale = [];
  for (const source of sources) {
    if (source.mtimeMs > bundleMtimeMs) stale.push(source.path);
  }
  return stale;
}
