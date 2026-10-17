// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CONTRACT_DIR, read, exists, loadOpenApi } from './helpers.js';

/**
 * backend-bootstrap AC1 / AC8 / AC9 (tech-plan.md §2 D1–D3).
 * The contract is a set of documents in the PUBLIC repo that the private
 * backend vendors by `git subtree`. These tests pin that it exists, carries the
 * right version and rules, and no longer contains the two wrong names / the
 * stale webhook route that the grounding drafts had.
 */

describe('contract/ exists with its five documents (AC1)', () => {
  it.each(['openapi.yaml', 'errors.md', 'types.d.ts', 'CHANGELOG.md', 'README.md'])('contract/%s', (f) => {
    expect(exists('contract', f)).toBe(true);
  });

  it('openapi.yaml declares info.version 0.3.0', () => {
    expect(loadOpenApi().info.version).toBe('0.3.0');
  });

  it('the CHANGELOG has a 0.3.0 entry covering every change from 0.2.0', () => {
    const log = read('contract', 'CHANGELOG.md');
    expect(log).toMatch(/0\.3\.0/);
    for (const topic of [/signal/i, /method/i, /note/i, /subscription/i, /stripe/i, /withdraw/i, /not_implemented/i, /plus_required/i, /consent_required/i, /fingerprint|IP address/i]) {
      expect(log, String(topic)).toMatch(topic);
    }
  });

  it('js-yaml is a DECLARED devDependency (the tests must not lean on a transitive one)', () => {
    const pkg = JSON.parse(read('package.json'));
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).toHaveProperty('js-yaml');
  });
});

describe('contract/README.md states the cross-repo protocol (AC8)', () => {
  it('names SemVer, X-Contract-Version, contract_version_unsupported and the subtree procedure', () => {
    const md = read('contract', 'README.md');
    expect(md).toMatch(/semver/i);
    expect(md).toContain('X-Contract-Version');
    expect(md).toContain('contract_version_unsupported');
    expect(md).toMatch(/git subtree/);
    expect(md).toContain('contract-dist'); // the split branch — a plain `subtree add` would vendor the whole client
  });

  it('states the order of a cross-cutting change: public repo first, then the backend pull', () => {
    const md = read('contract', 'README.md');
    expect(md).toMatch(/public/i);
    expect(md).toMatch(/subtree pull/);
  });

  it('documents how contract/rutina-core is generated', () => {
    expect(read('contract', 'README.md')).toMatch(/rutina-core/);
    expect(read('contract', 'README.md')).toMatch(/build:contract/);
  });
});

describe('no wrong names, no stale route (AC9, spec D2)', () => {
  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else out.push(full);
    }
    return out;
  }

  it('no path in openapi.yaml mentions lemonsqueezy', () => {
    const paths = Object.keys(loadOpenApi().paths);
    expect(paths.filter((p) => /lemonsqueezy/i.test(p))).toEqual([]);
  });

  it('no file under contract/ uses the wrong repo names', () => {
    const offenders = [];
    for (const file of walk(CONTRACT_DIR)) {
      const text = fs.readFileSync(file, 'utf8');
      if (/gym-rutina-backend/.test(text)) offenders.push(`${path.relative(ROOT, file)}: gym-rutina-backend`);
      if (/gym-rutina\/basicfit-rutina/.test(text)) offenders.push(`${path.relative(ROOT, file)}: gym-rutina/basicfit-rutina`);
    }
    expect(offenders).toEqual([]);
  });
});
