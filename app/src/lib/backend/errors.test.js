import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackendError, DEGRADE_SILENTLY, shouldDegradeSilently, toBackendError } from './errors.js';

/**
 * backend-bootstrap AC11 (tech-plan.md §2 D7) — the error taxonomy of the
 * client seam. Screens branch on `.code` only (contract/errors.md rule); a
 * missing/expired session or a network loss is NEVER an error screen (cloud
 * spec AC2/AC6), so the DEGRADE_SILENTLY set is a behavioural contract.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('the seam module set exists (AC11)', () => {
  it.each(['errors.js', 'LocalBackend.js', 'HttpBackend.js', 'index.js', 'BackendProvider.jsx', 'sessionStorage.js'])('%s', (f) => {
    expect(fs.existsSync(path.join(HERE, f)), f).toBe(true);
  });
});

describe('BackendError', () => {
  it('carries code, message, retryable and details', () => {
    const e = new BackendError('rate_limited', 'slow down', { retryable: true, details: { retryAfter: 60 } });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('BackendError');
    expect(e).toMatchObject({ code: 'rate_limited', message: 'slow down', retryable: true, details: { retryAfter: 60 } });
  });

  it('is not retryable by default', () => {
    expect(new BackendError('invalid_request', 'x').retryable).toBe(false);
  });
});

describe('DEGRADE_SILENTLY (AC11, contract errors.md rule 1)', () => {
  it.each(['backend_unavailable', 'session_expired', 'unauthorized', 'provider_unavailable', 'unknown_tenant', 'not_implemented', 'plus_required'])(
    'includes %s',
    (code) => {
      expect(DEGRADE_SILENTLY.has(code)).toBe(true);
      expect(shouldDegradeSilently(new BackendError(code, 'x'))).toBe(true);
    }
  );

  it.each(['no_credits', 'invalid_request', 'generation_failed', 'rate_limited', 'internal', 'consent_required'])(
    'does NOT include %s — those are real, user-visible outcomes',
    (code) => {
      expect(shouldDegradeSilently(new BackendError(code, 'x'))).toBe(false);
    }
  );

  it('only ever degrades a BackendError — a stray TypeError is a bug and must surface', () => {
    expect(shouldDegradeSilently(new TypeError('boom'))).toBe(false);
    expect(shouldDegradeSilently(null)).toBe(false);
    expect(shouldDegradeSilently({ code: 'backend_unavailable' })).toBe(false);
  });
});

describe('toBackendError', () => {
  it('a transport failure (null status) is backend_unavailable and retryable', () => {
    const e = toBackendError(null, undefined);
    expect(e).toBeInstanceOf(BackendError);
    expect(e).toMatchObject({ code: 'backend_unavailable', retryable: true });
  });

  it('maps a contract error body to its code, message, retryable and details', () => {
    const e = toBackendError(429, { code: 'rate_limited', message: 'later', retryable: true, details: { retryAfter: 5 } });
    expect(e).toMatchObject({ code: 'rate_limited', message: 'later', retryable: true, details: { retryAfter: 5 } });
  });

  it('a body without a code becomes `internal`, never a made-up code', () => {
    expect(toBackendError(500, undefined).code).toBe('internal');
    expect(toBackendError(502, { message: 'bad gateway' }).code).toBe('internal');
    expect(toBackendError(500, { code: 42 }).code).toBe('internal');
  });

  it('branches on the body code, not the HTTP status', () => {
    expect(toBackendError(200, { code: 'not_implemented', message: 'x' }).code).toBe('not_implemented');
    expect(toBackendError(418, { code: 'plus_required', message: 'x' }).code).toBe('plus_required');
  });
});
