/**
 * full-data-backup — the localStorage ALLOWLIST for backups (tech-plan.md AD-3).
 *
 * Design: an ALLOWLIST, importing the KEY constants from each storage module
 * (the F8 tech-debt-audit convention — every storage module already exports
 * its key for exactly this). A key that is not listed is never backed up,
 * which is how session tokens / the club-equipment outbox stay out of a
 * backup file (spec AC14, cloud AC7) by construction.
 *
 * The KEY constants are read through `keyFrom()` rather than plain named
 * imports so a test that PARTIALLY mocks one of these storage modules
 * (ImportScreen.test.jsx mocks onboardingStorage.js with only its two
 * functions) does not blow up this module's import graph: a missing constant
 * degrades to "not in the allowlist" instead of throwing at import time.
 *
 * Values are stored and restored as RAW localStorage strings — no parse, no
 * serialise, lossless round-trip (AD-3). Neither function ever throws: a
 * storage-disabled / private-mode device loses the affected setting silently,
 * exactly as it would in normal app use.
 */

import * as onboardingStorage from './onboardingStorage.js';
import * as uiLangStorage from './uiLangStorage.js';
import * as inviteStorage from './inviteStorage.js';
import * as clubStorage from './clubStorage.js';
import * as libraryNoticeStorage from './libraryNoticeStorage.js';
import * as promptRequestStorage from './promptRequestStorage.js';

/** Reads one exported KEY constant defensively (see the module docblock). */
function keyFrom(mod, name) {
  try {
    const value = mod[name];
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * The complete set of localStorage keys that belong in a backup. Every entry
 * is imported, never a string literal. NEW persisted settings get added here
 * or they are silently absent from backups.
 * @type {string[]}
 */
export const BACKUP_SETTINGS_KEYS = [
  keyFrom(onboardingStorage, 'ONBOARDING_SEEN_KEY'),
  keyFrom(uiLangStorage, 'UI_LANG_KEY'),
  keyFrom(inviteStorage, 'INVITE_KEY'),
  keyFrom(clubStorage, 'CLUB_KEY'),
  keyFrom(libraryNoticeStorage, 'LIBRARY_NOTICE_KEY'),
  keyFrom(promptRequestStorage, 'PROMPT_REQUEST_KEY'),
].filter(Boolean);

const ALLOWED = new Set(BACKUP_SETTINGS_KEYS);

/**
 * Raw string value of every allowlisted key currently present in localStorage.
 * Absent keys are omitted. Never throws (storage disabled / private mode).
 * @returns {Record<string,string>}
 */
export function readAllSettings() {
  const out = {};
  for (const key of BACKUP_SETTINGS_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (typeof value === 'string') out[key] = value;
    } catch {
      // Storage disabled — skip this key, keep going for the rest.
    }
  }
  return out;
}

/**
 * Writes back every key from `settings` that is on the allowlist, verbatim.
 * Keys not on the allowlist are ignored (spec AC10 unknown-fields-ignored).
 * Never throws: a per-key persistence failure loses that one setting silently
 * (AD-9 — the DB restore is the load-bearing part; a swallowed setting must
 * not block it).
 * @param {Record<string,string>} settings
 */
export function writeAllSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  for (const [key, value] of Object.entries(settings)) {
    if (!ALLOWED.has(key)) continue;
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Quota exceeded / storage disabled — lose this one key, never throw.
    }
  }
}
