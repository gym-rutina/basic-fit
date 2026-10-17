import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpBackend } from './HttpBackend.js';
import { BackendError } from './errors.js';
import { SESSION_STORAGE_KEY } from './sessionStorage.js';
import { loadOpenApi } from '../../../../scripts/contract/helpers.js';

/**
 * backend-bootstrap AC15 (tech-plan.md §2 D4/D5/D6) — the real transport adapter,
 * exercised through an INJECTED fetch (no network, no server). It owns three
 * things and nothing else: attach the tenant/contract/bearer headers, turn HTTP
 * into BackendError, and clear the session on 401. It never lets a raw fetch
 * error escape (cloud spec AC6).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://api.example.com';
const future = () => new Date(Date.now() + 3600_000).toISOString();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function make(fetchImpl, over = {}) {
  return new HttpBackend({ baseUrl: BASE, tenantId: 'basicfit', fetchImpl, ...over });
}
const headersOf = (call) => Object.fromEntries(Object.entries(call[1].headers).map(([k, v]) => [k.toLowerCase(), v]));

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('headers', () => {
  it('sends Content-Type, X-Tenant-Id and X-Contract-Version (major "0") on every request', async () => {
    const f = vi.fn(async () => json({ ok: true }));
    await make(f).getCreditBalance().catch(() => {});
    const h = headersOf(f.mock.calls[0]);
    expect(h['content-type']).toBe('application/json');
    expect(h['x-tenant-id']).toBe('basicfit');
    expect(h['x-contract-version']).toBe('0');
  });

  it('uses the configured tenant', async () => {
    const f = vi.fn(async () => json({}));
    await make(f, { tenantId: 'acme' }).getSubscription().catch(() => {});
    expect(headersOf(f.mock.calls[0])['x-tenant-id']).toBe('acme');
  });

  it('attaches the bearer token after sign-in, and NOT on the sign-in/sign-up requests themselves', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ token: 't-1', expiresAt: future() })) // signIn
      .mockResolvedValueOnce(json({ id: 'u1', email: 'a@b.c' })); // getAccount
    const b = make(f);
    await b.signIn({ email: 'a@b.c', password: 'x' });
    await b.getAccount();
    expect(headersOf(f.mock.calls[0]).authorization).toBeUndefined();
    expect(headersOf(f.mock.calls[1]).authorization).toBe('Bearer t-1');
  });

  it('persists the session under the named key and exposes it via getSession()', async () => {
    const f = vi.fn(async () => json({ token: 't-1', expiresAt: future() }));
    const b = make(f);
    await b.signUp({ email: 'a@b.c', password: 'x' });
    expect(b.getSession()).toMatchObject({ token: 't-1' });
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY))).toMatchObject({ token: 't-1' });
  });
});

describe('routes (each must exist in contract/openapi.yaml — see the scan below)', () => {
  const table = [
    ['signUp', [{ email: 'a', password: 'b' }], 'POST', '/v1/account'],
    ['signIn', [{ email: 'a', password: 'b' }], 'POST', '/v1/account/session'],
    ['getAccount', [], 'GET', '/v1/account'],
    ['getCreditBalance', [], 'GET', '/v1/credits'],
    ['startCheckout', [{ packId: 'pack' }], 'POST', '/v1/credits/checkout'],
    ['getSubscription', [], 'GET', '/v1/subscription'],
    ['startSubscriptionCheckout', [{ plan: 'plus', locale: 'es', consent: { version: '1', accepted: true } }], 'POST', '/v1/subscription/checkout'],
    ['openSubscriptionPortal', [], 'POST', '/v1/subscription/portal'],
    ['submitWithdrawal', [{ purchaseRef: 'x' }], 'POST', '/v1/withdrawals'],
    ['startGeneration', [{}], 'POST', '/v1/generations'],
    ['getGeneration', ['job 1'], 'GET', '/v1/generations/job%201'],
    ['setSyncEnabled', [true], 'PUT', '/v1/sync/enabled'],
    ['fetchSnapshot', [], 'GET', '/v1/sync'],
  ];

  it.each(table)('%s → %s %s', async (method, args, verb, route) => {
    const f = vi.fn(async () => json({ token: 't', expiresAt: future() }));
    await make(f)[method](...args).catch(() => {});
    const [url, init] = f.mock.calls[0];
    expect(init.method ?? 'GET').toBe(verb);
    expect(new URL(url).pathname).toBe(route);
    expect(url.startsWith(BASE)).toBe(true);
  });

  it('pushSnapshot is PUT /v1/sync with If-Match', async () => {
    const f = vi.fn(async () => json({}));
    await make(f).pushSnapshot({ formatVersion: 1 }, '"7"').catch(() => {});
    expect(f.mock.calls[0][1].method).toBe('PUT');
    expect(headersOf(f.mock.calls[0])['if-match']).toBe('"7"');
  });

  it('every /v1 route literal in HttpBackend.js exists in contract/openapi.yaml', () => {
    const src = fs.readFileSync(path.join(HERE, 'HttpBackend.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const used = [...src.matchAll(/(\/v1\/[A-Za-z0-9_/${}().,-]*)/g)]
      .map((m) => m[1].replace(/\$\{[^}]*\}/g, '{}').replace(/[)`'"].*$/, '').replace(/\/+$/, ''))
      .filter((p) => p.length > 3);
    const normalise = (p) => p.replace(/\{[^}]*\}/g, '{}');
    const declared = new Set(Object.keys(loadOpenApi().paths).map(normalise));
    const missing = [...new Set(used.map(normalise))].filter((p) => !declared.has(p));
    expect(missing).toEqual([]);
    expect(used.length).toBeGreaterThan(8);
  });
});

describe('errors (AC15)', () => {
  it('maps a contract error body to a typed BackendError', async () => {
    const f = vi.fn(async () => json({ code: 'no_credits', message: 'buy some', retryable: false }, 402));
    const err = await make(f).startGeneration({}).catch((e) => e);
    expect(err).toBeInstanceOf(BackendError);
    expect(err).toMatchObject({ code: 'no_credits', message: 'buy some' });
  });

  it('a non-JSON error body becomes `internal`', async () => {
    const f = vi.fn(async () => new Response('<html>oops</html>', { status: 500 }));
    const err = await make(f).getAccount().catch((e) => e);
    expect(err).toMatchObject({ code: 'internal' });
  });

  it('a network failure is backend_unavailable — never a raw TypeError', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await make(f).getSubscription().catch((e) => e);
    expect(err).toBeInstanceOf(BackendError);
    expect(err).toMatchObject({ code: 'backend_unavailable', retryable: true });
  });

  it('HTTP 401 becomes session_expired AND clears the stored session', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ token: 't-1', expiresAt: future() }))
      .mockResolvedValueOnce(json({ code: 'unauthorized', message: 'no' }, 401));
    const b = make(f);
    await b.signIn({ email: 'a@b.c', password: 'x' });
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    const err = await b.getAccount().catch((e) => e);
    expect(err).toMatchObject({ code: 'session_expired' });
    expect(b.getSession()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('a 204 resolves to undefined', async () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(make(f).setSyncEnabled(false)).resolves.toBeUndefined();
  });

  it('signOut always clears the local session, even when the request fails', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({ token: 't-1', expiresAt: future() }))
      .mockRejectedValueOnce(new TypeError('offline'));
    const b = make(f);
    await b.signIn({ email: 'a@b.c', password: 'x' });
    await b.signOut().catch(() => {});
    expect(b.getSession()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('scope (D4)', () => {
  it('has NO club-equipment method — the report path stays reportOutbox/reportFlush', () => {
    const b = make(vi.fn());
    expect('submitClubEquipmentReport' in b).toBe(false);
    expect('drainClubEquipmentOutbox' in b).toBe(false);
  });

  it('is remote', () => {
    expect(make(vi.fn()).isRemote).toBe(true);
  });
});
