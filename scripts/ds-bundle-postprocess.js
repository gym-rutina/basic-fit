#!/usr/bin/env node
/**
 * design-system-sync-fixes AC4 — bundle post-process, the I/O SHELL.
 *
 * Applies the two `.design-sync/NOTES.md` step-4 fixes (globalName underscore
 * restoration; nested→flat sourcePath/sourceHashes collapse) plus the
 * "format":4 stamp to design-system/_ds_bundle.js, via the pure core in
 * scripts/lib/dsBundlePostprocess.js.
 *
 * `globalName` / `projectId` come from `.design-sync/config.json` (that
 * directory is per-developer, git-ignored scratch state — tech-plan.md AD-1;
 * see design-system/SYNC.md). If the config file is missing this FAILS
 * CLEARLY (exit 2) rather than guessing the project's full UUID, which lives
 * in no tracked file today. `BasicFitDesignSystem_1cb8a2` (committed in the
 * real bundle) is an acceptable last-resort default for `globalName` ONLY —
 * `projectId` has no safe default and is never guessed.
 *
 * Usage: node scripts/ds-bundle-postprocess.js [--root <dir>] [--in <file>] [--out <file>] [--config <file>]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { postProcessBundle } from './lib/dsBundlePostprocess.js';

const DEFAULT_GLOBAL_NAME = 'BasicFitDesignSystem_1cb8a2';

/**
 * @param {{ root?: string, in?: string, out?: string, config?: string }} [opts]
 * @returns {{ changed: boolean, globalNameCount: number, outPath: string }}
 */
export function run(opts = {}) {
  const root = opts.root || process.cwd();
  const inPath = opts.in || join(root, 'design-system', '_ds_bundle.js');
  const outPath = opts.out || inPath;
  const configPath = opts.config || join(root, '.design-sync', 'config.json');

  if (!existsSync(configPath)) {
    throw new Error(
      `${configPath} not found — cannot determine globalName/projectId. ` +
        `.design-sync/ is per-developer, git-ignored scratch state (see design-system/SYNC.md); ` +
        `recreate config.json before running ds:fix-bundle. ` +
        `("${DEFAULT_GLOBAL_NAME}" is an acceptable last-resort globalName default, but projectId has no safe default and is never guessed.)`
    );
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const globalName = config.globalName || DEFAULT_GLOBAL_NAME;
  const projectId = config.projectId;
  if (!projectId) {
    throw new Error(`${configPath} has no "projectId" — refusing to guess it. Add it and re-run.`);
  }

  const text = readFileSync(inPath, 'utf8');
  const result = postProcessBundle(text, { globalName, projectId });

  if (result.changed) {
    writeFileSync(outPath, result.text, 'utf8');
  }

  return { changed: result.changed, globalNameCount: result.globalNameCount, outPath };
}

// CLI: node scripts/ds-bundle-postprocess.js [--root <dir>] [--in <file>] [--out <file>] [--config <file>]
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('ds-bundle-postprocess.js')) {
  const argVal = (flag) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : undefined;
  };
  try {
    const { changed, globalNameCount, outPath } = run({
      root: argVal('--root'),
      in: argVal('--in'),
      out: argVal('--out'),
      config: argVal('--config'),
    });
    if (changed) {
      console.log(`design-system bundle post-processed → ${outPath} (globalName occurrences: ${globalNameCount}).`);
    } else {
      console.log('design-system bundle already post-processed — no changes needed.');
    }
    process.exit(0);
  } catch (err) {
    console.error(String(err && err.message ? err.message : err));
    process.exit(2);
  }
}
