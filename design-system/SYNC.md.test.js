// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * design-system-sync-fixes AC2 — the durable, checked-in conventions record.
 * Lives at design-system/SYNC.md (NOT .design-sync/CONVENTIONS.md — that dir is
 * git-ignored; tech-plan.md §"The finding"). Must cover the seven points from
 * tech-plan.md §3, each tracing to a .design-sync/NOTES.md finding.
 *
 * These assertions check each point is PRESENT (by keyword/heading), not that
 * the prose is good — that's a review judgement. One `it` per point so a
 * missing section names itself (Bagnik A2).
 *
 * Red-first: fails until Cmok authors design-system/SYNC.md.
 */
const path = fileURLToPath(new URL('./SYNC.md', import.meta.url));
const md = () => (existsSync(path) ? readFileSync(path, 'utf8') : '');
const low = () => md().toLowerCase();

describe('design-system/SYNC.md (AC2)', () => {
  it('exists', () => {
    expect(existsSync(path)).toBe(true);
  });

  it('point 1 — flat layout is deliberate + a converter warning', () => {
    expect(low()).toMatch(/flat/);
    expect(low()).toMatch(/do not run|don.t run|never run/);
    expect(low()).toMatch(/converter/);
  });

  it('point 2 — rebuild trigger on components/**/*.jsx or tokens/*.css', () => {
    expect(low()).toMatch(/rebuild/);
    expect(low()).toMatch(/tokens\//);
    expect(low()).toMatch(/_ds_bundle\.js/);
  });

  it('point 3 — the two post-process fixes (globalName underscore + sourcePath)', () => {
    expect(low()).toMatch(/globalname|underscore|basicfitdesignsystem_1cb8a2/);
    expect(low()).toMatch(/sourcepath|sourcehashes/);
  });

  it('point 4 — _ds_manifest.json is server-regenerated / excluded from uploads', () => {
    expect(low()).toMatch(/_ds_manifest\.json/);
    expect(low()).toMatch(/exclud|regenerat/);
  });

  it('point 5 — no _ds_sync.json anchor, and that is expected', () => {
    expect(low()).toMatch(/_ds_sync\.json/);
  });

  it('point 6 — mandatory manual visual check in the DS pane', () => {
    expect(low()).toMatch(/design system pane|ds pane|visual/);
    expect(low()).toMatch(/vm\b|sanity check|does not (catch|prove)/);
  });

  it('point 7 — pointer to _ds_bundle.test.js', () => {
    expect(low()).toMatch(/_ds_bundle\.test\.js/);
  });
});
