/**
 * Persisted UI-language preference (pwa-ui-language feature, tech-plan.md D6),
 * modelled directly on `onboardingStorage.js`: plain localStorage, read
 * synchronously in the same tick as component init, and defensive to the
 * point of never throwing — a private-browsing device must lose its language
 * preference, not fail to boot.
 *
 * This module does NOT validate. AC2 requires absent / empty / corrupt /
 * unknown to be handled identically, from one place, and that place is
 * `resolveUiLocale` (app/src/i18n/index.js) — never here.
 */

export const UI_LANG_KEY = 'rutina:uiLang';

/** @returns {string|null} whatever is stored, verbatim — or null if absent/unreadable. */
export function readUiLocale() {
  try {
    return localStorage.getItem(UI_LANG_KEY);
  } catch {
    // Storage disabled (e.g. private browsing) — degrade to "nothing stored."
    return null;
  }
}

/** Persists the preference. Never throws: a quota/private-mode failure must
 * keep the switch applied in-session (ux-design.md's Error row) rather than
 * break the caller. */
export function writeUiLocale(locale) {
  try {
    localStorage.setItem(UI_LANG_KEY, locale);
  } catch {
    // Swallow — same convention as onboardingStorage.js's markOnboardingSeen().
  }
}
