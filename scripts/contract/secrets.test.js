// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.js';

/**
 * backend-bootstrap AC34 (public half) — nothing this feature adds to the
 * public repo may contain key material, a production URL or a real Stripe id.
 * Scans exactly the files the feature creates. (Patterns are assembled from
 * split strings so this file does not match itself.)
 */

const TARGETS = ['contract', path.join('app', 'src', 'lib', 'backend'), path.join('scripts', 'contract'), 'scripts/build-contract.js'];

function walk(p, out = []) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) return out;
  const st = fs.statSync(full);
  if (st.isFile()) out.push(full);
  else for (const e of fs.readdirSync(full)) walk(path.join(p, e), out);
  return out;
}

const PATTERNS = [
  ['Stripe secret key', new RegExp('\\bs' + 'k_(live|test)_[A-Za-z0-9]{8,}')],
  ['Stripe restricted key', new RegExp('\\br' + 'k_(live|test)_[A-Za-z0-9]{8,}')],
  ['Stripe webhook secret', new RegExp('\\bwh' + 'sec_[A-Za-z0-9]{8,}')],
  ['real Stripe price id', new RegExp('\\bpr' + 'ice_[A-Za-z0-9]{14,}')],
  ['JWT-shaped token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['private key block', new RegExp('-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----')],
];

describe('public-half secret scan', () => {
  const files = TARGETS.flatMap((t) => walk(t)).filter((f) => !/secrets\.test\.js$/.test(f));

  it('finds files this feature BUILDS (the scan is not vacuous — test files alone do not count)', () => {
    // red until the build creates contract/*, app/src/lib/backend/* and scripts/build-contract.js
    const built = files.filter((f) => !/\.test\.(js|jsx)$/.test(f) && !/helpers\.js$/.test(f));
    expect(built.length).toBeGreaterThanOrEqual(3);
  });

  it.each(PATTERNS)('no %s', (_n, re) => {
    const hits = files.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it('the contract server list holds a placeholder host, not a live one', () => {
    const y = fs.existsSync(path.join(ROOT, 'contract', 'openapi.yaml')) ? fs.readFileSync(path.join(ROOT, 'contract', 'openapi.yaml'), 'utf8') : '';
    expect(y).toMatch(/example|localhost|placeholder/i);
    expect(y).not.toMatch(/supabase\.co/i);
  });
});
