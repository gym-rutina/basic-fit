import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCollectorConfig, createCollectorTransport, flushOutbox, scheduleFlush, startOpportunisticFlush } from './reportFlush.js';

/**
 * club-equipment-reporting AC7/AC9 + DD-001 resolution (tech-plan.md §2 D1/D2).
 *
 * The collector is the backend-integration-grounding `club-equipment`
 * function: POST {VITE_BACKEND_URL}/v1/club-equipment/reports, anonymous,
 * X-Tenant-Id only. While VITE_BACKEND_URL is unset (today) the flush is
 * INERT and the outbox simply holds — the feature is complete and safe with
 * zero live infra. Nothing here may carry a credential (AC9).
 */

const WIRE = {
  reportId: 'rid-1',
  clubId: 'a'.repeat(32),
  equipmentId: 'g3-s10',
  signal: 'absent',
  method: 'session',
  reportedAt: '2026-09-29T10:00:00.000Z',
};
const stored = (over = {}) => ({ key: `${WIRE.clubId}|${over.equipmentId ?? WIRE.equipmentId}`, origin: 'explicit', ...WIRE, ...over });

describe('resolveCollectorConfig', () => {
  it('is null (inert) when no backend URL is configured', () => {
    expect(resolveCollectorConfig({})).toBeNull();
    expect(resolveCollectorConfig({ VITE_BACKEND_URL: '   ' })).toBeNull();
  });

  it('reads the https URL, strips a trailing slash, and defaults the tenant to basicfit', () => {
    expect(resolveCollectorConfig({ VITE_BACKEND_URL: 'https://api.example.com/' })).toEqual({
      baseUrl: 'https://api.example.com',
      tenantId: 'basicfit',
    });
    expect(resolveCollectorConfig({ VITE_BACKEND_URL: 'https://api.example.com', VITE_TENANT_ID: 'acme' })).toEqual({
      baseUrl: 'https://api.example.com',
      tenantId: 'acme',
    });
  });

  it('refuses a plain-http URL except localhost — never send reports in clear over the internet', () => {
    expect(resolveCollectorConfig({ VITE_BACKEND_URL: 'http://api.example.com' })).toBeNull();
    expect(resolveCollectorConfig({ VITE_BACKEND_URL: 'http://localhost:54321' })).toEqual({
      baseUrl: 'http://localhost:54321',
      tenantId: 'basicfit',
    });
  });

  it('refuses a non-URL value', () => {
    expect(resolveCollectorConfig({ VITE_BACKEND_URL: 'javascript:alert(1)' })).toBeNull();
    expect(resolveCollectorConfig({ VITE_BACKEND_URL: 'not a url' })).toBeNull();
  });
});

describe('createCollectorTransport (AC9 — anonymous, write-only)', () => {
  const cfg = { baseUrl: 'https://api.example.com', tenantId: 'basicfit' };

  it('POSTs the six wire fields as JSON to /v1/club-equipment/reports with only Content-Type + X-Tenant-Id', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const send = createCollectorTransport({ ...cfg, fetchImpl });

    await send(WIRE);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/club-equipment/reports');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(WIRE);
    const headerNames = Object.keys(init.headers).map((h) => h.toLowerCase()).sort();
    expect(headerNames).toEqual(['content-type', 'x-tenant-id']);
    expect(init.headers['X-Tenant-Id']).toBe('basicfit');
    expect(init.credentials).toBe('omit');
  });

  it('never forwards fields that are not in the wire contract, even if handed an outbox record', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const send = createCollectorTransport({ ...cfg, fetchImpl });
    await send({ ...WIRE, key: 'k', origin: 'explicit', notes: 'x' });
    expect(Object.keys(JSON.parse(fetchImpl.mock.calls[0][1].body)).sort()).toEqual(Object.keys(WIRE).sort());
  });

  it.each([200, 202, 204])('treats HTTP %i as accepted', async (status) => {
    const send = createCollectorTransport({ ...cfg, fetchImpl: async () => new Response(null, { status }) });
    await expect(send(WIRE)).resolves.toBe('accepted');
  });

  it.each([400, 409, 422])('treats HTTP %i as permanently rejected (drop it — retrying cannot fix it)', async (status) => {
    const send = createCollectorTransport({ ...cfg, fetchImpl: async () => new Response(null, { status }) });
    await expect(send(WIRE)).resolves.toBe('rejected');
  });

  it.each([429, 500, 503])('rejects (retry later) on HTTP %i', async (status) => {
    const send = createCollectorTransport({ ...cfg, fetchImpl: async () => new Response(null, { status }) });
    await expect(send(WIRE)).rejects.toBeTruthy();
  });

  it('rejects (retry later) on a network failure', async () => {
    const send = createCollectorTransport({
      ...cfg,
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(send(WIRE)).rejects.toBeTruthy();
  });
});

describe('flushOutbox (AC7 — never throws, drains on success)', () => {
  function fakeDb(records) {
    const list = [...records];
    return {
      list,
      listReports: vi.fn(async () => [...list]),
      deleteReports: vi.fn(async (rs) => {
        for (const r of rs) {
          const i = list.findIndex((x) => x.key === r.key && x.reportId === r.reportId);
          if (i >= 0) list.splice(i, 1);
        }
      }),
    };
  }

  it('sends every pending report oldest first and drains the queue', async () => {
    const db = fakeDb([stored({ equipmentId: 'a', reportId: 'r-a' }), stored({ equipmentId: 'b', reportId: 'r-b' })]);
    const send = vi.fn(async () => 'accepted');

    const result = await flushOutbox({ send, db });

    expect(send.mock.calls.map((c) => c[0].reportId)).toEqual(['r-a', 'r-b']);
    expect(db.list).toEqual([]);
    expect(result).toMatchObject({ sent: 2, remaining: 0 });
  });

  it('hands the transport the WIRE shape only (no key/origin)', async () => {
    const db = fakeDb([stored()]);
    const send = vi.fn(async () => 'accepted');
    await flushOutbox({ send, db });
    expect(Object.keys(send.mock.calls[0][0]).sort()).toEqual(Object.keys(WIRE).sort());
  });

  it('on a retryable failure stops, keeps the failed AND the untried reports queued, and does not throw', async () => {
    const db = fakeDb([stored({ equipmentId: 'a', reportId: 'r-a' }), stored({ equipmentId: 'b', reportId: 'r-b' })]);
    const send = vi.fn().mockRejectedValueOnce(new Error('offline'));

    const result = await flushOutbox({ send, db });

    expect(send).toHaveBeenCalledTimes(1);
    expect(db.list.map((r) => r.reportId)).toEqual(['r-a', 'r-b']);
    expect(result).toMatchObject({ sent: 0, remaining: 2 });
  });

  it('drops a permanently rejected report and continues with the next', async () => {
    const db = fakeDb([stored({ equipmentId: 'a', reportId: 'r-a' }), stored({ equipmentId: 'b', reportId: 'r-b' })]);
    const send = vi.fn().mockResolvedValueOnce('rejected').mockResolvedValueOnce('accepted');
    const result = await flushOutbox({ send, db });
    expect(db.list).toEqual([]);
    expect(result).toMatchObject({ sent: 1, dropped: 1, remaining: 0 });
  });

  it('a report replaced while its send is in flight is NOT deleted (id-guarded delete)', async () => {
    const db = fakeDb([stored({ reportId: 'old' })]);
    const send = vi.fn(async () => {
      // user flips the signal mid-flight: same key, new reportId
      db.list[0] = stored({ reportId: 'newer', signal: 'present' });
      return 'accepted';
    });
    await flushOutbox({ send, db });
    expect(db.list.map((r) => r.reportId)).toEqual(['newer']);
  });

  it('never throws even when the database itself fails', async () => {
    const db = { listReports: async () => Promise.reject(new Error('IDB')), deleteReports: async () => Promise.reject(new Error('IDB')) };
    await expect(flushOutbox({ send: async () => 'accepted', db })).resolves.toBeTruthy();
  });

  it('is single-flight: a second call while one is running does not double-send', async () => {
    const db = fakeDb([stored()]);
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const send = vi.fn(async () => {
      await gate;
      return 'accepted';
    });
    const first = flushOutbox({ send, db });
    const second = flushOutbox({ send, db });
    release();
    await Promise.all([first, second]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('with no transport configured it is a no-op and the outbox holds', async () => {
    const db = fakeDb([stored()]);
    const result = await flushOutbox({ send: null, db });
    expect(db.list).toHaveLength(1);
    expect(db.listReports).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, skipped: true });
  });
});

describe('scheduleFlush while unconfigured (today’s reality)', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('touches neither the network nor timers when VITE_BACKEND_URL is unset', () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    scheduleFlush();
    vi.advanceTimersByTime(60_000);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('startOpportunisticFlush (App.jsx mount hook)', () => {
  it('returns a cleanup function and is inert (no listener, no fetch) when unconfigured', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const add = vi.spyOn(window, 'addEventListener');
    const stop = startOpportunisticFlush();
    expect(typeof stop).toBe('function');
    expect(add.mock.calls.filter(([type]) => type === 'online')).toHaveLength(0);
    expect(() => stop()).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    add.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('no credential can ship in the bundle (AC9 — static source scan)', () => {
  it('reportFlush.js carries no key / token / service secret / Authorization header', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = fs
      .readFileSync(path.join(here, 'reportFlush.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/authorization|bearer|apikey|api[-_]key|service[_-]?role|secret|token/i);
  });
});
