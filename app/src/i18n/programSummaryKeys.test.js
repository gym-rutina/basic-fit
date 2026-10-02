import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_LOCALES, CATALOGS } from './index.js';

/**
 * program-remove-weekly-summary spec.md AC5 — the i18n key removal.
 *
 * catalogs.test.js already enforces that all six catalogs carry an identical
 * key set, so a key dropped from only some locales fails there. What parity
 * cannot see: a key dropped from NONE of them (dead copy nobody renders), and
 * a key dropped everywhere while a call site still asks for it (t() would
 * then return the raw key on screen). Both are pinned here.
 *
 * Q1 (answered at planning time): a grep over app/, scripts/, docs and wiki
 * found no consumer of these keys outside ProgramScreen.jsx and the six
 * catalogs, so removal is safe. The consumer scan below keeps it that way.
 */

const REMOVED_KEYS = [
  'program.weeklySummaryTitle',
  'program.colDay',
  'program.colFocus',
  'program.colExercises',
];

// Every other Program-overview key must survive the removal.
const KEPT_KEYS = [
  'program.phaseObjectivesTitle',
  'program.warmupTitle',
  'program.trainingDaysTitle',
  'program.exerciseAbbrev',
  'program.cooldownTitle',
  'program.rulesTitle',
  'program.notesTitle',
  'program.libraryAction',
];

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function nonTestSources() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
  })(SRC_DIR);
  return out.filter((f) => !path.relative(SRC_DIR, f).replace(/\\/g, '/').startsWith('i18n/'));
}

describe('program-remove-weekly-summary i18n keys', () => {
  it.each(REMOVED_KEYS)('%s is gone from every locale', (key) => {
    for (const locale of UI_LOCALES) {
      expect({ key, locale, present: key in CATALOGS[locale] }).toEqual({ key, locale, present: false });
    }
  });

  it.each(KEPT_KEYS)('%s is kept — the Program overview still renders it', (key) => {
    for (const locale of UI_LOCALES) {
      expect({ key, locale, present: typeof CATALOGS[locale][key] === 'string' }).toEqual({
        key,
        locale,
        present: true,
      });
    }
  });

  it('no non-test source outside the catalogs still asks for a removed key', () => {
    const stillUsed = [];
    for (const file of nonTestSources()) {
      const source = fs.readFileSync(file, 'utf8');
      for (const key of REMOVED_KEYS) {
        if (source.includes(key)) stillUsed.push(`${path.relative(SRC_DIR, file).replace(/\\/g, '/')}: ${key}`);
      }
    }
    expect(stillUsed).toEqual([]);
  });
});
