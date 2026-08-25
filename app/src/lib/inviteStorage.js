/**
 * club-invite-link storage (tech-plan.md D-B) — modelled on uiLangStorage.js /
 * onboardingStorage.js: plain localStorage, read synchronously at component
 * init, defensive to the point of never throwing — a private-browsing device
 * must degrade to "no invite saved", not break app boot.
 *
 * DEVIATION from that precedent, deliberate (D-B): `writeInviteUrl` RETURNS A
 * BOOLEAN instead of swallowing silently. The onboarding/uiLang flags may lose
 * a write unnoticed; here a silent failure would lie to the user at the gym
 * door (they believe the link is saved; it isn't). UX frame D needs an honest
 * degraded line (`access.storageErrorBody`) and only a return value can
 * trigger it. The try/catch posture is identical — only the signal escapes.
 *
 * This module does NOT validate. The single validation choke point for both
 * boundaries (save time in Settings, open time in HomeScreen — tech-plan.md
 * D-C) is `validateInviteUrl` in `inviteUrl.js`, never here.
 */

export const INVITE_KEY = 'rutina:clubInviteUrl';

/** @returns {string|null} whatever is stored, verbatim — or null if absent/unreadable/empty. */
export function readInviteUrl() {
  try {
    return localStorage.getItem(INVITE_KEY) || null;
  } catch {
    // Storage disabled (e.g. private browsing) — degrade to "nothing stored."
    return null;
  }
}

/**
 * Persists the invite URL. Never throws.
 * @returns {boolean} true = persisted; false = write failed (renderable
 *   degraded signal — the caller must show access.storageErrorBody).
 */
export function writeInviteUrl(url) {
  try {
    localStorage.setItem(INVITE_KEY, url);
    return true;
  } catch {
    return false;
  }
}

/** Removes the stored URL. Never throws. */
export function clearInviteUrl() {
  try {
    localStorage.removeItem(INVITE_KEY);
  } catch {
    // Nothing to do — the next read degrades to "nothing stored" anyway.
  }
}
