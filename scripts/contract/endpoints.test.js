// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { read, loadOpenApi, collectRefs, resolvePointer, errorsMdCodes, typesErrorCodes } from './helpers.js';

/**
 * backend-bootstrap AC4 / AC5 / AC6 / AC7 (tech-plan.md §2 D3). Endpoint and
 * error-taxonomy shape of contract v0.3.0. The subscription/withdrawal BODIES
 * are drafts (OQ-1): only what the cloud spec already fixes is pinned — the
 * `plan` selector, the consent record, the returned URL — everything else is
 * left to the Section C feature.
 */

const doc = () => loadOpenApi();
const op = (path, method) => doc().paths?.[path]?.[method];
const CLIENT_ONLY = new Set(['backend_unavailable']);

describe('endpoints (AC4)', () => {
  it.each([
    ['/v1/subscription', 'get'],
    ['/v1/subscription/checkout', 'post'],
    ['/v1/subscription/portal', 'post'],
    ['/v1/credits/checkout', 'post'],
    ['/v1/webhooks/stripe', 'post'],
    ['/v1/withdrawals', 'post'],
    ['/v1/club-equipment/reports', 'post'],
    ['/v1/health', 'get'],
    ['/v1/tenant/config', 'get'],
  ])('%s %s is defined', (path, method) => {
    expect(op(path, method), `${method.toUpperCase()} ${path}`).toBeDefined();
  });

  it.each([
    ['/v1/subscription', 'get'],
    ['/v1/subscription/checkout', 'post'],
    ['/v1/subscription/portal', 'post'],
    ['/v1/webhooks/stripe', 'post'],
    ['/v1/withdrawals', 'post'],
  ])('%s %s is marked x-status: draft and lists a success and an error response', (path, method) => {
    const o = op(path, method);
    expect(o['x-status']).toBe('draft');
    const codes = Object.keys(o.responses);
    expect(codes.some((c) => /^2/.test(c))).toBe(true);
    expect(codes.some((c) => /^[45]/.test(c))).toBe(true);
  });

  it('subscription checkout selects plus|pack, carries locale and the consent record, and returns a URL', () => {
    const o = op('/v1/subscription/checkout', 'post');
    const req = o.requestBody.content['application/json'].schema;
    const resolved = req.$ref ? resolvePointer(doc(), req.$ref) : req;
    expect(resolved.required).toEqual(expect.arrayContaining(['plan', 'locale', 'consent']));
    expect([...resolved.properties.plan.enum].sort()).toEqual(['pack', 'plus']);
    const consent = resolved.properties.consent.$ref ? resolvePointer(doc(), resolved.properties.consent.$ref) : resolved.properties.consent;
    expect(consent.required).toEqual(expect.arrayContaining(['version', 'accepted']));
    const res = Object.entries(o.responses).find(([c]) => /^2/.test(c))[1];
    const body = res.content['application/json'].schema;
    const rb = body.$ref ? resolvePointer(doc(), body.$ref) : body;
    expect(rb.properties).toHaveProperty('url');
  });

  it('the portal returns a URL', () => {
    const res = Object.entries(op('/v1/subscription/portal', 'post').responses).find(([c]) => /^2/.test(c))[1];
    const body = res.content['application/json'].schema;
    const rb = body.$ref ? resolvePointer(doc(), body.$ref) : body;
    expect(rb.properties).toHaveProperty('url');
  });

  it('there is no lemonsqueezy path (Stripe direct is decided)', () => {
    expect(Object.keys(doc().paths).filter((p) => /lemonsqueezy/i.test(p))).toEqual([]);
  });
});

describe('error taxonomy (AC5)', () => {
  it.each([
    ['not_implemented', '501'],
    ['consent_required', '400'],
    ['plus_required', '402'],
  ])('errors.md lists %s with HTTP %s', (code, http) => {
    const rows = errorsMdCodes();
    expect(rows.has(code), code).toBe(true);
    expect(rows.get(code)).toContain(http);
  });

  it('types.d.ts and the OpenAPI Error.code enum include all three', () => {
    for (const code of ['not_implemented', 'consent_required', 'plus_required']) {
      expect(typesErrorCodes().has(code), `types.d.ts ${code}`).toBe(true);
      expect(doc().components.schemas.Error.properties.code.enum, `openapi ${code}`).toContain(code);
    }
  });

  it('errors.md says not_implemented and plus_required degrade silently (never an error screen)', () => {
    const md = read('contract', 'errors.md');
    const rules = md.slice(md.indexOf('## Rules'));
    expect(rules).toContain('not_implemented');
    expect(rules).toContain('plus_required');
  });
});

describe('privacy statement on the collector (AC6, spec D6)', () => {
  it('the club-equipment description says no IP, user agent or fingerprint is persisted and limiting is in-memory', () => {
    const o = op('/v1/club-equipment/reports', 'post');
    const text = `${o.summary ?? ''} ${o.description ?? ''}`;
    expect(text).toMatch(/IP address/i);
    expect(text).toMatch(/user[- ]agent/i);
    expect(text).toMatch(/fingerprint/i);
    expect(text).toMatch(/in[- ]memory/i);
    expect(text).toMatch(/persist|stor/i);
  });
});

describe('contract lint (AC7)', () => {
  it('every local $ref resolves', () => {
    const d = doc();
    const unresolved = collectRefs(d).filter((r) => r.startsWith('#/') && resolvePointer(d, r) === undefined);
    expect(unresolved).toEqual([]);
  });

  it('errors.md, types.d.ts and the OpenAPI Error.code enum name the SAME codes (client-only codes excepted from the wire enum)', () => {
    const md = new Set(errorsMdCodes().keys());
    const ts = typesErrorCodes();
    const wire = new Set(doc().components.schemas.Error.properties.code.enum);
    const withClientOnly = new Set([...wire, ...CLIENT_ONLY]);
    expect([...md].sort()).toEqual([...withClientOnly].sort());
    expect([...ts].sort()).toEqual([...withClientOnly].sort());
  });

  it('every error code a response names in a comment-free way exists in the wire enum', () => {
    const wire = new Set(doc().components.schemas.Error.properties.code.enum);
    for (const code of ['invalid_request', 'unknown_tenant', 'unauthorized', 'rate_limited', 'internal']) {
      expect(wire.has(code), code).toBe(true);
    }
  });

  it('the document declares an OpenAPI 3.x version and non-empty paths', () => {
    const d = doc();
    expect(String(d.openapi)).toMatch(/^3\./);
    expect(Object.keys(d.paths).length).toBeGreaterThan(10);
  });
});
