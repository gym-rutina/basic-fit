/**
 * Real backend adapter: every method's HTTP shape matches contract/openapi.yaml.
 * Nothing constructs it until a valid VITE_BACKEND_URL is set (createBackend()).
 *
 * Three responsibilities live HERE and nowhere else:
 *  - attach the tenant, contract-version and bearer headers on every request;
 *  - translate HTTP into BackendError via toBackendError(), so screens never
 *    see a status code and a raw fetch error never escapes;
 *  - on a 401 to an authenticated request: clear the stored session and surface
 *    `session_expired` (a DEGRADE_SILENTLY code, so the caller reverts to
 *    offline).
 *
 * It has NO club-equipment method: anonymous reports travel through the shipped
 * reportOutbox / reportFlush, the one queue and the one transport.
 */

import { toBackendError, BackendError } from './errors.js';
import { readSession, writeSession, clearSession } from './sessionStorage.js';

/** The contract MAJOR sent as X-Contract-Version. Bump with openapi.yaml info.version's major. */
export const CONTRACT_MAJOR = '0';

/** @typedef {import('./types').BackendClient} BackendClient */

/** @implements {BackendClient} */
export class HttpBackend {
  /**
   * @param {{ baseUrl: string, tenantId: string, fetchImpl?: typeof fetch }} config
   *   baseUrl and tenantId come from resolveCollectorConfig() via createBackend().
   */
  constructor({ baseUrl, tenantId, fetchImpl }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.tenantId = tenantId;
    this._fetch = fetchImpl || ((...args) => globalThis.fetch(...args));
    this._session = readSession();
  }

  get isRemote() {
    return true;
  }

  getSession() {
    return this._session;
  }

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown, auth?: boolean, headers?: Record<string,string>, query?: Record<string,string|undefined> }} [opts]
   *   auth: false for the requests that precede a session (sign-in, sign-up, public reads).
   */
  async _req(path, opts = {}) {
    const { method = 'GET', body, auth = true, headers = {}, query } = opts;

    let url = `${this.baseUrl}${path}`;
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined) search.set(k, v);
    if ([...search].length > 0) url += `?${search}`;

    let res;
    try {
      res = await this._fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Contract-Version': CONTRACT_MAJOR,
          'X-Tenant-Id': this.tenantId,
          ...(auth && this._session ? { Authorization: `Bearer ${this._session.token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw toBackendError(null, undefined);
    }

    if (res.status === 204) return undefined;

    let payload;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }

    if (!res.ok) {
      const err = toBackendError(res.status, payload);
      // A 401 to an authenticated request means the session is gone. An
      // unauthenticated 401 (a wrong password) keeps its own contract code.
      if (res.status === 401 && auth) {
        this._session = null;
        clearSession();
        if (err.code !== 'session_expired') {
          throw new BackendError('session_expired', err.message, { cause: err });
        }
      }
      throw err;
    }
    return payload;
  }

  _setSession(session) {
    this._session = session;
    writeSession(session);
    return session;
  }

  _dropSession() {
    this._session = null;
    clearSession();
  }

  // ── account ───────────────────────────────────────────────────────────
  async signUp(input) {
    return this._setSession(await this._req('/v1/account', { method: 'POST', body: input, auth: false }));
  }
  async signIn(input) {
    return this._setSession(await this._req('/v1/account/session', { method: 'POST', body: input, auth: false }));
  }
  async signOut() {
    try {
      await this._req('/v1/account/session', { method: 'DELETE' });
    } finally {
      this._dropSession();
    }
  }
  getAccount() {
    return this._req('/v1/account');
  }
  async deleteAccount() {
    try {
      return await this._req('/v1/account', { method: 'DELETE' });
    } finally {
      this._dropSession();
    }
  }

  // ── credits ───────────────────────────────────────────────────────────
  getCreditPacks(locale) {
    return this._req('/v1/credits/packs', { auth: false, query: { locale } });
  }
  getCreditBalance() {
    return this._req('/v1/credits');
  }
  startCheckout(input) {
    return this._req('/v1/credits/checkout', { method: 'POST', body: input });
  }

  // ── subscription ──────────────────────────────────────────────────────
  getSubscription() {
    return this._req('/v1/subscription');
  }
  startSubscriptionCheckout(input) {
    return this._req('/v1/subscription/checkout', { method: 'POST', body: input });
  }
  openSubscriptionPortal() {
    return this._req('/v1/subscription/portal', { method: 'POST' });
  }

  // ── withdrawals ───────────────────────────────────────────────────────
  submitWithdrawal(input) {
    return this._req('/v1/withdrawals', { method: 'POST', body: input });
  }

  // ── generation ────────────────────────────────────────────────────────
  startGeneration(intake) {
    return this._req('/v1/generations', { method: 'POST', body: intake });
  }
  getGeneration(jobId) {
    return this._req(`/v1/generations/${encodeURIComponent(jobId)}`);
  }

  // ── sync ──────────────────────────────────────────────────────────────
  setSyncEnabled(enabled) {
    return this._req('/v1/sync/enabled', { method: 'PUT', body: { enabled } });
  }
  fetchSnapshot() {
    return this._req('/v1/sync');
  }
  pushSnapshot(envelope, ifMatch) {
    return this._req('/v1/sync', { method: 'PUT', body: envelope, headers: { 'If-Match': ifMatch } });
  }
}
