// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { copyStaticAssets, PAGES, DATA_FILES } from './copy-static-pages.js';

// retire-static-pages AC3: both static-page families (gyms.html and the
// rutina_*.html set) are retired — generators deleted, root files deleted —
// so PAGES is now an empty list kept only as an extension point, and the
// script's remaining job is deploying DATA_FILES (the LLM guide's
// rutina.schema.json download card) into dist/, mirroring its source subpath.
// The empty-pages contract below asserts the negative too: a stray .html at
// the repo root must NOT be copied into dist/.
//
// onboarding-request-fields Q1/R7.2/R7.3 (tech-plan.md §2.9): DATA_FILES
// stays narrowed to the schema only — equipment.json, gyms.json and
// phase1-monday.json are not handed out (R7.3/AC38).

describe('copyStaticAssets (postbuild static asset copy)', () => {
  let tmpRoot;
  let tmpDist;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rutina-root-'));
    tmpDist = path.join(tmpRoot, 'dist');
    fs.mkdirSync(tmpDist, { recursive: true });

    // Fixture: a stray root-level .html file — with PAGES retired, the copy
    // loop must leave it out of dist/ (the empty-pages contract below).
    fs.writeFileSync(path.join(tmpRoot, 'gyms.html'), '<html>gyms</html>', 'utf8');

    // Fixture: the DATA_FILES source file(s), mirroring real repo subpaths.
    for (const rel of DATA_FILES || []) {
      const src = path.join(tmpRoot, rel);
      fs.mkdirSync(path.dirname(src), { recursive: true });
      fs.writeFileSync(src, JSON.stringify({ fixture: rel }), 'utf8');
    }
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('is exported as a function', () => {
    expect(typeof copyStaticAssets).toBe('function');
  });

  it('exposes only the schema as a DATA_FILES subpath — equipment/gyms/example are no longer handed out (R7.3, AC38)', () => {
    expect(DATA_FILES).toEqual(['data/schema/rutina.schema.json']);
  });

  it('retires the HTML page list — PAGES is empty after retire-static-pages (AC3)', () => {
    expect(PAGES).toEqual([]);
  });

  it('copies no HTML pages into dist/, even when one exists at the root (AC3 empty-pages contract)', () => {
    copyStaticAssets(tmpRoot, tmpDist);
    expect(fs.existsSync(path.join(tmpDist, 'gyms.html'))).toBe(false);
    expect(fs.readdirSync(tmpDist).filter((name) => name.endsWith('.html'))).toEqual([]);
  });

  it('copies the schema data file into dist/, mirroring its source subpath (AC4)', () => {
    copyStaticAssets(tmpRoot, tmpDist);
    for (const rel of DATA_FILES) {
      const dest = path.join(tmpDist, rel);
      expect(fs.existsSync(dest)).toBe(true);
      expect(JSON.parse(fs.readFileSync(dest, 'utf8'))).toEqual({ fixture: rel });
    }
  });

  it('does not throw when dist/ does not exist yet (pre-vite-build case)', () => {
    fs.rmSync(tmpDist, { recursive: true, force: true });
    expect(() => copyStaticAssets(tmpRoot, tmpDist)).not.toThrow();
  });

  it('skips a missing source data file without throwing (defensive, same pattern the retired page copy used)', () => {
    fs.rmSync(path.join(tmpRoot, 'data', 'schema', 'rutina.schema.json'));
    expect(() => copyStaticAssets(tmpRoot, tmpDist)).not.toThrow();
  });
});
