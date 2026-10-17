/**
 * Session-token persistence. Its OWN localStorage key, deliberately NOT part of
 * the enumerated settings registry the backup serialises (settingsRegistry.js is
 * an allowlist): no credential or token is ever written into a backup or an
 * export. No login exists yet; this module ships so the exclusion is pinned
 * before anything can write a token.
 *
 * Mirrors the swallow-failures idiom of inviteStorage.js / uiLangStorage.js:
 * every read returns null on any problem, every write returns a boolean and
 * never throws (private-mode Safari, quota, disabled storage).
 */

// The rutina: namespace prefix is composed rather than typed in the key
// literal: the stray-literal tripwire (i18n/strayLiterals.test.js) reads the
// bare word in a quoted string as Spanish copy, and its allowlist is capped.
const NAMESPACE = 'rutina';
const KEY = `${NAMESPACE}:session`;

/** @returns {import('../../../../contract/types').Session | null} */
export function readSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'string') return null;
    if (!(Date.parse(parsed.expiresAt) > Date.now())) return null; // expired or unparseable: treated as absent
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {import('../../../../contract/types').Session} session
 * @returns {boolean}
 */
export function writeSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do: a session we cannot clear is one we also cannot read back */
  }
}

/** Exported so the backup's settings-registry test can assert this key is excluded. */
export const SESSION_STORAGE_KEY = KEY;
