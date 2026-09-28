#!/usr/bin/env node
/**
 * design-system-sync-fixes AC3 — bundle-freshness check, the I/O SHELL.
 *
 * Globs the bundle's real sources under <root>/design-system/:
 *   components/ ** /*.jsx  and  components/ ** /*.d.ts   (NOT *.test.jsx / *.test.js — those are NOT sources)
 *   tokens/*.css
 * stat()s each + <root>/design-system/_ds_bundle.js, calls
 * lib/dsBundleFreshness.staleSources(), prints every offender, exits non-zero
 * if the list is non-empty (AC3 "exit non-zero, or a clear printed warning").
 *
 * `--root <dir>` (default process.cwd()) is the test seam — the integration
 * test builds a tmp design-system/ tree and points --root at it.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { staleSources } from './lib/dsBundleFreshness.js';

/** Recursively lists every file under `dir` (no symlink following needed here). */
function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * A bundle source is a `.jsx` or `.d.ts` file that is NOT a test file.
 * Real repo decoys this guards against: `EquipmentCard.muscles.test.jsx`,
 * `SelectField.test.jsx` — the naive `components/ ** /*.jsx` glob matches
 * them, but they are never bundled.
 */
function isComponentSource(filePath) {
  const base = filePath.split(/[\\/]/).pop() || '';
  if (/\.test\.jsx$/.test(base) || /\.test\.js$/.test(base)) return false;
  return /\.jsx$/.test(base) || /\.d\.ts$/.test(base);
}

/**
 * @param {{ root?: string }} [opts]
 * @returns {{ stale: string[], exitCode: 0|1 }}
 */
export function run(opts = {}) {
  const root = opts.root || process.cwd();
  const dsRoot = join(root, 'design-system');
  const componentsDir = join(dsRoot, 'components');
  const tokensDir = join(dsRoot, 'tokens');
  const bundlePath = join(dsRoot, '_ds_bundle.js');

  const bundleMtimeMs = statSync(bundlePath).mtimeMs;

  const componentFiles = walkFiles(componentsDir).filter(isComponentSource);
  const tokenFiles = existsSync(tokensDir)
    ? readdirSync(tokensDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
        .map((entry) => join(tokensDir, entry.name))
    : [];

  const sources = [...componentFiles, ...tokenFiles].map((absPath) => ({
    path: relative(root, absPath),
    mtimeMs: statSync(absPath).mtimeMs,
  }));

  const stale = staleSources(bundleMtimeMs, sources);
  return { stale, exitCode: stale.length ? 1 : 0 };
}

// CLI: node scripts/ds-bundle-freshness.js [--root <dir>]
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('ds-bundle-freshness.js')) {
  const i = process.argv.indexOf('--root');
  const root = i > -1 ? process.argv[i + 1] : process.cwd();
  try {
    const { stale, exitCode } = run({ root });
    if (stale.length) {
      console.error(`design-system bundle is STALE — rebuild _ds_bundle.js. Newer than the bundle:`);
      for (const p of stale) console.error(`  ${p}`);
    } else {
      console.log('design-system bundle is fresh.');
    }
    process.exit(exitCode);
  } catch (err) {
    console.error(String(err && err.message ? err.message : err));
    process.exit(2);
  }
}
