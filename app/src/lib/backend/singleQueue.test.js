import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * backend-bootstrap AC14 / AC9-adjacent (tech-plan.md §2 D4) — ONE queue, ONE
 * transport, ONE URL literal for club-equipment reports. Static tree scans, in
 * the style of club-equipment-reporting's AC10 scan (which still passes
 * untouched: only `useClubExclusions.js` calls `enqueueReport(`, only
 * `ActiveSessionScreen.jsx` calls `enqueueImplicitPresent(`).
 *
 * The seam therefore has NO club-equipment method (tech-plan D4): the grounding
 * drafted `LocalBackend.submitClubEquipmentReport → outbox.js` (a second,
 * localStorage queue) — dropped.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts)$/.test(e.name) && !/\.test\.(js|jsx|ts)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}
const rel = (f) => path.relative(SRC, f).replaceAll('\\', '/');

describe('single queue / single transport / single URL literal (AC14)', () => {
  it('lib/backend/ contains no outbox module and no queue identifiers', () => {
    const files = walk(HERE);
    expect(files.map(rel).filter((f) => /outbox/i.test(f))).toEqual([]);
    const offenders = files.filter((f) => /enqueue|outbox|drainClubEquipment|submitClubEquipmentReport|club-equipment/i.test(strip(fs.readFileSync(f, 'utf8'))));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('the literal `club-equipment/reports` appears in exactly one non-test module: lib/reportFlush.js', () => {
    const holders = walk(SRC)
      .filter((f) => /club-equipment\/reports/.test(strip(fs.readFileSync(f, 'utf8'))))
      .map(rel);
    expect(holders).toEqual(['lib/reportFlush.js']);
  });

  it('the shipped caller guards still hold: enqueueReport( only in useClubExclusions.js, enqueueImplicitPresent( only in ActiveSessionScreen.jsx', () => {
    const callers = { enqueueReport: [], enqueueImplicitPresent: [] };
    for (const f of walk(SRC)) {
      if (f.endsWith(path.join('lib', 'reportOutbox.js'))) continue;
      const s = strip(fs.readFileSync(f, 'utf8'));
      for (const fn of Object.keys(callers)) if (new RegExp(`\\b${fn}\\s*\\(`).test(s)) callers[fn].push(rel(f));
    }
    expect(callers.enqueueReport).toEqual(['lib/useClubExclusions.js']);
    expect(callers.enqueueImplicitPresent).toEqual(['screens/ActiveSessionScreen.jsx']);
  });

  it('App.jsx mounts the BackendProvider', () => {
    const app = strip(fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8'));
    expect(app).toMatch(/BackendProvider/);
    expect(app).toMatch(/<BackendProvider/);
  });

  it('no screen or component imports HttpBackend/LocalBackend directly — only the seam entry and provider (index.js contract)', () => {
    const offenders = walk(SRC)
      .filter((f) => !rel(f).startsWith('lib/backend/'))
      .filter((f) => /from ['"][^'"]*backend\/(HttpBackend|LocalBackend)/.test(strip(fs.readFileSync(f, 'utf8'))))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
