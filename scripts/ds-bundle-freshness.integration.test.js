// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from './ds-bundle-freshness.js';

/**
 * design-system-sync-fixes AC3 — the SHELL (glob + exit code) is most of AC3:
 * three glob patterns and "exit non-zero" that the pure `staleSources` core
 * never touches. This exercises them against a real tmp design-system/ tree.
 *
 * The decoys are the real bug this guards: `components/ ** /*.jsx` also matches
 * `EquipmentCard.muscles.test.jsx` / `SelectField.test.jsx` in the actual repo,
 * and `*.prompt.md` sits next to every component — neither is a bundle source.
 *
 * Red-first: fails until Cmok implements scripts/ds-bundle-freshness.js.
 */

const SCRIPT = fileURLToPath(new URL('./ds-bundle-freshness.js', import.meta.url));
let root;

function touch(relPath, whenMs) {
  const abs = join(root, relPath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, '// fixture\n');
  const t = whenMs / 1000;
  utimesSync(abs, t, t);
  return relPath;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ds-fresh-'));
  const BASE = 1_000_000_000_000; // fixed ms epoch
  touch('design-system/_ds_bundle.js', BASE);
  touch('design-system/components/primitives/Button.jsx', BASE - 10_000);
  touch('design-system/components/composite/Card.d.ts', BASE - 10_000);
  touch('design-system/tokens/colors.css', BASE - 10_000);
  // decoys — MUST be ignored even when newer than the bundle
  touch('design-system/components/primitives/Button.test.jsx', BASE - 10_000);
  touch('design-system/components/primitives/Button.prompt.md', BASE - 10_000);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const bump = (rel) => utimesSync(join(root, rel), Date.now() / 1000 + 5000, Date.now() / 1000 + 5000);

describe('ds-bundle-freshness shell (AC3)', () => {
  it('bundle newest → fresh, exitCode 0', () => {
    const r = run({ root });
    expect(r.stale).toEqual([]);
    expect(r.exitCode).toBe(0);
  });

  it('a component .jsx newer than the bundle → stale, exitCode 1, names it', () => {
    bump('design-system/components/primitives/Button.jsx');
    const r = run({ root });
    expect(r.exitCode).toBe(1);
    expect(r.stale.join('\n')).toMatch(/components[\\/]primitives[\\/]Button\.jsx/);
  });

  it('a tokens/*.css newer than the bundle → stale (catches a glob that forgot tokens/)', () => {
    bump('design-system/tokens/colors.css');
    const r = run({ root });
    expect(r.exitCode).toBe(1);
    expect(r.stale.join('\n')).toMatch(/tokens[\\/]colors\.css/);
  });

  it('only the decoys (*.test.jsx / *.prompt.md) newer than the bundle → still fresh, exitCode 0', () => {
    bump('design-system/components/primitives/Button.test.jsx');
    bump('design-system/components/primitives/Button.prompt.md');
    const r = run({ root });
    expect(r.stale).toEqual([]);
    expect(r.exitCode).toBe(0);
  });

  it('the CLI actually exits non-zero on a stale bundle (real process exit code)', () => {
    bump('design-system/components/primitives/Button.jsx');
    let code = 0;
    try {
      execFileSync(process.execPath, [SCRIPT, '--root', root], { stdio: 'pipe' });
    } catch (e) {
      code = e.status;
    }
    expect(code).toBe(1);
  });
});
