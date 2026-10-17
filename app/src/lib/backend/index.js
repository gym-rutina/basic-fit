/**
 * Backend seam entry point. `createBackend()` picks the implementation from
 * build-time config: a real server when VITE_BACKEND_URL is valid, otherwise the
 * offline LocalBackend that ships today. Screens use this module and
 * BackendProvider.jsx, never LocalBackend / HttpBackend directly.
 *
 * The URL rule (https, or http only for localhost) is the SHIPPED
 * resolveCollectorConfig(): the same function that gates the anonymous
 * club-equipment collector. It is reused, not re-implemented, so the two can
 * never disagree about what a valid backend URL is.
 */

import { LocalBackend } from './LocalBackend.js';
import { HttpBackend } from './HttpBackend.js';
import { resolveCollectorConfig } from '../reportFlush.js';

export { BackendError, shouldDegradeSilently, DEGRADE_SILENTLY } from './errors.js';
export { SESSION_STORAGE_KEY } from './sessionStorage.js';

/**
 * @param {{ env?: Record<string, string|undefined>, fetchImpl?: typeof fetch }} [opts]
 *   env defaults to import.meta.env (VITE_BACKEND_URL, VITE_TENANT_ID);
 *   fetchImpl lets a test inject the transport.
 * @returns {import('./types').BackendClient}
 */
export function createBackend({ env = import.meta.env, fetchImpl } = {}) {
  const config = resolveCollectorConfig(env);
  return config ? new HttpBackend({ ...config, fetchImpl }) : new LocalBackend();
}
