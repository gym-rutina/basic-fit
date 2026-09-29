import { listReports, deleteReports } from './db.js';
import { toWire } from './equipmentReports.js';

/**
 * club-equipment-reporting — flushing the outbox to the collector (spec
 * AC7/AC9, tech-plan.md D1/D2/D6/D14).
 *
 * The collector is the grounded `club-equipment` Edge function:
 * `POST {VITE_BACKEND_URL}/v1/club-equipment/reports`, ANONYMOUS, with exactly
 * two headers — `Content-Type` and `X-Tenant-Id` — and `credentials: 'omit'`.
 * There is no credential of any kind in this module or in the bundle (AC9): the
 * collector accepts unauthenticated, write-only submissions.
 *
 * While `VITE_BACKEND_URL` is unset (today) everything here is INERT: no
 * timer, no listener, no network — the outbox simply holds. Going live is a
 * configuration change, not a code change (DD-005 covers the backend side).
 *
 * Nothing in this module ever throws into the caller (AC7): a flush failure
 * leaves the report queued for the next attempt.
 */

const REPORTS_PATH = '/v1/club-equipment/reports';
const DEFAULT_TENANT = 'basicfit';
const FLUSH_DELAY_MS = 2000;

const ACCEPTED = [200, 202, 204];
const REJECTED = [400, 409, 422];

/**
 * Reads the collector configuration from a Vite-style env object. `null` means
 * "not configured" and every caller treats it as inert. A plain-http URL is
 * refused except for localhost — a report is never sent in clear over the
 * internet.
 *
 * @param {Record<string, string|undefined>|undefined} env
 * @returns {{baseUrl: string, tenantId: string}|null}
 */
export function resolveCollectorConfig(env) {
  const raw = env && typeof env.VITE_BACKEND_URL === 'string' ? env.VITE_BACKEND_URL.trim() : '';
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const secure = url.protocol === 'https:';
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (!secure && !local) return null;

  const tenant = typeof env.VITE_TENANT_ID === 'string' ? env.VITE_TENANT_ID.trim() : '';
  return {
    baseUrl: raw.replace(/\/+$/, ''),
    tenantId: tenant || DEFAULT_TENANT,
  };
}

/**
 * @param {{baseUrl: string, tenantId: string, fetchImpl?: typeof fetch}} config
 * @returns {(report: object) => Promise<'accepted'|'rejected'>}
 *   Resolves 'accepted' (drop from the queue) or 'rejected' (unfixable — drop
 *   it too); REJECTS for anything worth retrying (429, 5xx, network).
 */
export function createCollectorTransport({ baseUrl, tenantId, fetchImpl }) {
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));
  return async function send(report) {
    const response = await doFetch(`${baseUrl}${REPORTS_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
      // toWire again on purpose: whatever a caller hands over, only the six
      // wire fields can leave the device (AC6/AC18).
      body: JSON.stringify(toWire(report)),
      credentials: 'omit',
    });
    if (ACCEPTED.includes(response.status)) return 'accepted';
    if (REJECTED.includes(response.status)) return 'rejected';
    throw new Error(`collector responded ${response.status}`);
  };
}

let flushing = false;

/**
 * Sends every pending report oldest first. Single-flight (a second call while
 * one is running is a no-op) and NEVER throws. A retryable failure stops the
 * run and keeps the failed and the untried reports queued; an unfixable one is
 * dropped and the run continues. Deletes are id-guarded (D6): a report the user
 * replaced while its send was in flight survives.
 *
 * @param {{send?: ((report: object) => Promise<string>)|null, db?: {listReports: Function, deleteReports: Function}}} [args]
 * @returns {Promise<{sent: number, dropped: number, remaining: number, skipped: boolean}>}
 */
export async function flushOutbox({ send, db } = {}) {
  const result = { sent: 0, dropped: 0, remaining: 0, skipped: false };
  if (typeof send !== 'function' || flushing) {
    return { ...result, skipped: true };
  }

  flushing = true;
  try {
    const store = db || { listReports, deleteReports };
    const pending = await store.listReports();
    const queue = Array.isArray(pending) ? pending : [];
    result.remaining = queue.length;

    for (const record of queue) {
      let outcome;
      try {
        outcome = await send(toWire(record));
      } catch {
        break; // offline / collector down — keep this and every later report
      }
      await store.deleteReports([record]);
      if (outcome === 'rejected') result.dropped += 1;
      else result.sent += 1;
      result.remaining -= 1;
    }
  } catch {
    // Storage failure: nothing was lost, the next flush retries.
  } finally {
    flushing = false;
  }
  return result;
}

function currentConfig() {
  try {
    return resolveCollectorConfig(import.meta.env);
  } catch {
    return null;
  }
}

function runFlush(config) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushOutbox({ send: createCollectorTransport(config) }).catch(() => {});
}

let scheduled = null;

/**
 * Coalescing flush request, called after each enqueue: the first call arms a
 * ~2 s timer, calls that arrive while it is armed join it. A no-op — no timer,
 * no network — when no collector is configured.
 */
export function scheduleFlush() {
  const config = currentConfig();
  if (!config || scheduled !== null) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    runFlush(config);
  }, FLUSH_DELAY_MS);
}

/**
 * App-mount hook: flush once now and again whenever the browser comes back
 * online. Inert (no listener, no fetch) when no collector is configured.
 *
 * @returns {() => void} cleanup
 */
export function startOpportunisticFlush() {
  const config = currentConfig();
  if (!config || typeof window === 'undefined') return () => {};
  const flushNow = () => runFlush(config);
  flushNow();
  window.addEventListener('online', flushNow);
  return () => window.removeEventListener('online', flushNow);
}
