/**
 * Persisted "has the user seen onboarding" flag (onboarding-screens feature,
 * tech-plan.md Decision 1: plain localStorage boolean, not a new idb store —
 * a single flag with no query/index needs doesn't justify db.js's
 * async-open/upgrade/close overhead, and Shell needs to read it synchronously
 * at mount, in the same tick as component init).
 *
 * Defensive by design: private-browsing / storage-disabled environments must
 * degrade to "always show onboarding" rather than throw and break app boot.
 */

/**
 * Exported like every other storage module's key constant (CLUB_KEY,
 * INVITE_KEY, PROMPT_REQUEST_KEY, UI_LANG_KEY, …) so the future
 * full-data-backup registry can enumerate all persisted keys by import
 * instead of hardcoding strings (tech-debt audit 2026-08-26 F8). Do not make
 * this module-private again.
 */
export const ONBOARDING_SEEN_KEY = 'rutina:onboardingSeen';

/** @returns {boolean} true once the user has skipped or completed onboarding. */
export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
  } catch {
    // Storage disabled (e.g. private browsing) — degrade to "always show."
    return false;
  }
}

/** Marks onboarding as seen. Idempotent; safe to call on every skip/finish/revisit-close. */
export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
  } catch {
    // Storage disabled — nothing persists, onboarding will just show again
    // next boot. Never throw: this must not break the close/skip action.
  }
}
