import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackend } from './index.js';
import { LocalBackend } from './LocalBackend.js';
import { HttpBackend } from './HttpBackend.js';

/**
 * backend-bootstrap AC12 (tech-plan.md §2 D5) — build-time selection of the
 * backend. Unset/invalid VITE_BACKEND_URL ⇒ LocalBackend (today's app). The
 * URL rule is the SHIPPED resolveCollectorConfig (https or localhost) — reused,
 * not re-implemented.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('createBackend({ env })', () => {
  it('returns LocalBackend with no configuration', () => {
    const b = createBackend({ env: {} });
    expect(b).toBeInstanceOf(LocalBackend);
    expect(b.isRemote).toBe(false);
  });

  it('returns LocalBackend under the real test env (VITE_BACKEND_URL is unset)', () => {
    expect(createBackend()).toBeInstanceOf(LocalBackend);
  });

  it('returns HttpBackend for an https URL, tenant defaulting to basicfit', () => {
    const b = createBackend({ env: { VITE_BACKEND_URL: 'https://api.example.com/' } });
    expect(b).toBeInstanceOf(HttpBackend);
    expect(b.isRemote).toBe(true);
    expect(b.tenantId).toBe('basicfit');
    expect(b.baseUrl).toBe('https://api.example.com');
  });

  it('honours VITE_TENANT_ID', () => {
    expect(createBackend({ env: { VITE_BACKEND_URL: 'https://api.example.com', VITE_TENANT_ID: 'acme' } }).tenantId).toBe('acme');
  });

  it('accepts http only for localhost (dev)', () => {
    expect(createBackend({ env: { VITE_BACKEND_URL: 'http://localhost:54321' } })).toBeInstanceOf(HttpBackend);
    expect(createBackend({ env: { VITE_BACKEND_URL: 'http://api.example.com' } })).toBeInstanceOf(LocalBackend);
  });

  it.each(['javascript:alert(1)', 'not a url', '   ', 'ftp://api.example.com'])('falls back to LocalBackend for %j', (bad) => {
    expect(createBackend({ env: { VITE_BACKEND_URL: bad } })).toBeInstanceOf(LocalBackend);
  });
});

describe('reuse, not re-implementation (AC12)', () => {
  const src = fs
    .readFileSync(path.join(HERE, 'index.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('index.js imports resolveCollectorConfig from the shipped reportFlush module', () => {
    expect(src).toMatch(/resolveCollectorConfig/);
    expect(src).toMatch(/from '\.\.\/reportFlush\.js'/);
  });

  it('index.js carries no URL/scheme logic of its own', () => {
    expect(src).not.toMatch(/new URL\(/);
    expect(src).not.toMatch(/startsWith\(['"]https?/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});
