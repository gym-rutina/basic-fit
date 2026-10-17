// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, read, exists } from './helpers.js';
import { buildRutinaCore } from '../build-contract.js';

/**
 * backend-bootstrap AC10 (tech-plan.md §2 D2) — the backend imports the
 * SAME validator the client ships (cloud spec D3), as a GENERATED copy under
 * contract/rutina-core/ (the validator lives in scripts/lib/, outside
 * contract/, so a `git subtree split --prefix=contract` would not carry it).
 * A drift test keeps the copy honest. No new dependency: the script uses fs
 * and String.replace only.
 */

const CORE_DIR = path.join(ROOT, 'contract', 'rutina-core');
const req = createRequire(import.meta.url);

describe('buildRutinaCore() — the generator', () => {
  it('returns the validator and the schema, keyed by file name', () => {
    const out = buildRutinaCore();
    expect(Object.keys(out).sort()).toEqual(['rutina-validator.js', 'rutina.schema.json']);
  });

  it('the schema is a byte-for-byte copy of data/schema/rutina.schema.json', () => {
    expect(buildRutinaCore()['rutina.schema.json']).toBe(read('data', 'schema', 'rutina.schema.json'));
  });

  it('the validator differs from scripts/lib/rutina-validator.js ONLY in the schema require path', () => {
    const src = read('scripts', 'lib', 'rutina-validator.js').split('\n');
    const gen = buildRutinaCore()['rutina-validator.js'].split('\n');
    expect(gen.length).toBe(src.length);
    const diffs = src.map((line, i) => [line, gen[i], i]).filter(([a, b]) => a !== b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0][0]).toMatch(/require\('\.\.\/\.\.\/data\/schema\/rutina\.schema\.json'\)/);
    expect(diffs[0][1]).toMatch(/require\('\.\/rutina\.schema\.json'\)/);
  });

  it('is deterministic', () => {
    expect(buildRutinaCore()).toEqual(buildRutinaCore());
  });

  it('is wired as an npm script and adds NO new runtime dependency', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['build:contract']).toMatch(/build-contract/);
    // the runtime dependencies that exist today — the generator must not add to them
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['ajv', 'axios', 'cheerio', 'idb', 'puppeteer', 'react', 'react-dom', 'react-router-dom']);
  });

  it('scripts/build-contract.js requires nothing beyond fs and path (static scan of its imports)', () => {
    const src = read('scripts', 'build-contract.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const mods = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)|from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2]);
    expect(mods.length).toBeGreaterThan(0);
    for (const m of mods) expect(['fs', 'path', 'node:fs', 'node:path'], `unexpected import ${m}`).toContain(m);
  });
});

describe('the committed copy is not stale (drift test)', () => {
  it.each(['rutina-validator.js', 'rutina.schema.json'])('contract/rutina-core/%s equals the freshly generated content', (file) => {
    expect(exists('contract', 'rutina-core', file)).toBe(true);
    expect(fs.readFileSync(path.join(CORE_DIR, file), 'utf8')).toBe(buildRutinaCore()[file]);
  });
});

describe('the generated validator actually runs, and agrees with the original', () => {
  const sample = () => JSON.parse(read('data', 'examples', fs.readdirSync(path.join(ROOT, 'data', 'examples')).find((f) => f.endsWith('.json'))));
  const equipment = () => JSON.parse(read('data', 'equipment.json')).equipment;

  it('exports validateRutina and gives the same verdict as scripts/lib on a shipped example', () => {
    const copy = req(path.join(CORE_DIR, 'rutina-validator.js'));
    const original = req(path.join(ROOT, 'scripts', 'lib', 'rutina-validator.js'));
    expect(typeof copy.validateRutina).toBe('function');
    const a = copy.validateRutina(sample(), equipment());
    const b = original.validateRutina(sample(), equipment());
    expect(a).toEqual(b);
  });

  it('agrees on a broken rutina too (errors identical)', () => {
    const copy = req(path.join(CORE_DIR, 'rutina-validator.js'));
    const original = req(path.join(ROOT, 'scripts', 'lib', 'rutina-validator.js'));
    const broken = { schemaVersion: 1 };
    expect(copy.validateRutina(broken, equipment()).errors).toEqual(original.validateRutina(broken, equipment()).errors);
  });
});
