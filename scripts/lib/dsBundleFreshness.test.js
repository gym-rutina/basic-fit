// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { staleSources } from './dsBundleFreshness.js';

/**
 * design-system-sync-fixes AC3 — the bundle-freshness check, pure core
 * (tech-plan.md §1). `staleSources(bundleMtimeMs, sources)` returns the paths
 * of every source file newer than the compiled `_ds_bundle.js`. The
 * `scripts/ds-bundle-freshness.js` shell does the glob + `fs.stat` and exits
 * non-zero when this returns a non-empty list.
 *
 * Red-first: fails until Cmok writes scripts/lib/dsBundleFreshness.js.
 */

const BUNDLE = 1_000_000;

describe('staleSources', () => {
  it('returns [] when every source is older than or equal to the bundle', () => {
    const sources = [
      { path: 'design-system/components/primitives/Button.jsx', mtimeMs: 900_000 },
      { path: 'design-system/tokens/colors.css', mtimeMs: 1_000_000 }, // equal — not stale
    ];
    expect(staleSources(BUNDLE, sources)).toEqual([]);
  });

  it('returns the offending paths, in input order, when a source is newer', () => {
    const sources = [
      { path: 'design-system/components/primitives/Button.jsx', mtimeMs: 900_000 },
      { path: 'design-system/components/composite/EquipmentCard.jsx', mtimeMs: 1_500_000 },
      { path: 'design-system/tokens/spacing.css', mtimeMs: 2_000_000 },
    ];
    expect(staleSources(BUNDLE, sources)).toEqual([
      'design-system/components/composite/EquipmentCard.jsx',
      'design-system/tokens/spacing.css',
    ]);
  });

  it('an exactly-equal mtime is not stale (boundary)', () => {
    expect(staleSources(BUNDLE, [{ path: 'x', mtimeMs: BUNDLE }])).toEqual([]);
  });

  it('empty source list → []', () => {
    expect(staleSources(BUNDLE, [])).toEqual([]);
  });
});
