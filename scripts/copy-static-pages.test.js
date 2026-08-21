// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { copyStaticAssets, DATA_FILES } from './copy-static-pages.js';

// Architecture note (llm-guide-file-downloads, AC4): copy-static-pages.js
// currently only copies gyms.html into dist/ (imperative script, no exports).
// This test targets the intended post-Cmok shape: a `copyStaticAssets(root, dist)`
// function exported alongside the existing CLI behavior, extended to also copy
// the DATA SOURCES file(s) into dist/data/... mirroring their source subpaths.
// These tests are expected to fail until Cmok implements the export + the new
// copy loop — see tech-plan.md.
//
// onboarding-request-fields Q1/R7.2/R7.3 (tech-plan.md §2.9): DATA_FILES
// narrows from 4 entries to 1 (the schema only — equipment.json, gyms.json
// and phase1-monday.json are no longer handed out per R7.3/AC38), and the
// hand-rolled ZIP writer (buildDataArchive) is DELETED along with the
// zlib/CRC-32 machinery that existed only to serve it — the whole
// `buildDataArchive` describe block the prior feature added is removed here,
// not merely updated. This is written against Q1's stated assumption (plain
// rutina.schema.json file, no zip); it still needs a user yes/no before Cmok
// builds it — see tech-plan.md Known Gaps.

describe('copyStaticAssets (postbuild static asset copy)', () => {
  let tmpRoot;
  let tmpDist;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rutina-root-'));
    tmpDist = path.join(tmpRoot, 'dist');
    fs.mkdirSync(tmpDist, { recursive: true });

    // Fixture: root-level gyms.html (existing behavior — must not regress).
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

  it('still copies gyms.html into dist/ (no regression)', () => {
    copyStaticAssets(tmpRoot, tmpDist);
    expect(fs.existsSync(path.join(tmpDist, 'gyms.html'))).toBe(true);
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

  it('skips a missing source data file without throwing (defensive, matches existing gyms.html handling)', () => {
    fs.rmSync(path.join(tmpRoot, 'data', 'schema', 'rutina.schema.json'));
    expect(() => copyStaticAssets(tmpRoot, tmpDist)).not.toThrow();
  });
});
