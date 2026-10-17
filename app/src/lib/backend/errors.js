/**
 * One error type for the whole backend seam. Screens catch BackendError and
 * branch on `.code` (the stable contract enum) — never on HTTP status, never
 * on message text. `contract/errors.md` is the authority for the code set.
 *
 * Design rule: a missing/expired session or a network loss is NOT an error
 * screen. Callers treat `backend_unavailable` / `session_expired` as "fall back
 * to signed-out, offline behaviour" — the app must never be less usable than if
 * the account never existed.
 */

/** @typedef {import('../../../../contract/types').ContractErrorCode} ContractErrorCode */

export class BackendError extends Error {
  /**
   * @param {ContractErrorCode} code
   * @param {string} message
   * @param {{ retryable?: boolean, details?: Record<string, unknown>, cause?: unknown }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.details = opts.details;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

/**
 * Codes that mean "act as a signed-out, offline app" rather than "show a
 * problem" (contract/errors.md, rule 1). `unknown_tenant` is a build-config bug:
 * degrade, but also log loudly at the call site.
 */
export const DEGRADE_SILENTLY = new Set([
  'backend_unavailable',
  'session_expired',
  'unauthorized',
  'provider_unavailable',
  'unknown_tenant',
  'not_implemented',
  'plus_required',
]);

/**
 * Only a BackendError can degrade: a stray TypeError is a bug and must surface.
 * @param {unknown} err
 * @returns {boolean}
 */
export function shouldDegradeSilently(err) {
  return err instanceof BackendError && DEGRADE_SILENTLY.has(err.code);
}

/**
 * Map a contract error body (or a transport failure) to a BackendError. The
 * code comes from the body, never from the HTTP status.
 * @param {number | null} httpStatus  null means a transport/network failure
 * @param {any} body  parsed JSON body, or undefined
 * @returns {BackendError}
 */
export function toBackendError(httpStatus, body) {
  if (httpStatus === null) {
    return new BackendError('backend_unavailable', 'No connection to the backend.', { retryable: true });
  }
  const code = body && typeof body.code === 'string' ? body.code : 'internal';
  const message = body && typeof body.message === 'string' ? body.message : `HTTP ${httpStatus}`;
  return new BackendError(/** @type {ContractErrorCode} */ (code), message, {
    retryable: Boolean(body && body.retryable),
    details: body ? body.details : undefined,
  });
}
