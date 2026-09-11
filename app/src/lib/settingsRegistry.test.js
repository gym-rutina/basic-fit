import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BACKUP_SETTINGS_KEYS,
  readAllSettings,
  writeAllSettings,
} from './settingsRegistry.js';
import { ONBOARDING_SEEN_KEY } from './onboardingStorage.js';
import { UI_LANG_KEY } from './uiLangStorage.js';
import { INVITE_KEY } from './inviteStorage.js';
import { CLUB_KEY } from './clubStorage.js';
import { LIBRARY_NOTICE_KEY } from './libraryNoticeStorage.js';
import { PROMPT_REQUEST_KEY } from './promptRequestStorage.js';

/**
 * full-data-backup — the localStorage allowlist (tech-plan.md AD-3). The
 * registry imports the KEY constants from each storage module (the F8
 * tech-debt-audit convention) rather than hardcoding strings. It is an
 * ALLOWLIST: a key that is not listed is simply never backed up, which is
 * how session tokens / the club-equipment outbox stay out of a backup file
 * (spec AC14, cloud AC7) by construction.
 *
 * Red-first: fails until Cmok writes app/src/lib/settingsRegistry.js.
 */

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('settingsRegistry — the allowlist (AC14)', () => {
  it('contains exactly the six known persisted keys', () => {
    expect(new Set(BACKUP_SETTINGS_KEYS)).toEqual(new Set([
      ONBOARDING_SEEN_KEY,
      UI_LANG_KEY,
      INVITE_KEY,
      CLUB_KEY,
      LIBRARY_NOTICE_KEY,
      PROMPT_REQUEST_KEY,
    ]));
  });

  it('does NOT contain a session token key or the club-equipment outbox key', () => {
    expect(BACKUP_SETTINGS_KEYS).not.toContain('rutina:session');
    expect(BACKUP_SETTINGS_KEYS).not.toContain('rutina:clubEquipmentOutbox');
    // and nothing that looks like a credential
    expect(BACKUP_SETTINGS_KEYS.some((k) => /token|session|auth|credential/i.test(k))).toBe(false);
  });
});

describe('settingsRegistry.readAllSettings', () => {
  it('returns raw string values for present keys and omits absent ones', () => {
    localStorage.setItem(UI_LANG_KEY, 'en');
    localStorage.setItem(CLUB_KEY, '{"clubId":"abc","name":"Málaga Centro"}');
    // ONBOARDING_SEEN_KEY, INVITE_KEY, LIBRARY_NOTICE_KEY, PROMPT_REQUEST_KEY absent

    const out = readAllSettings();
    expect(out).toEqual({
      [UI_LANG_KEY]: 'en',
      [CLUB_KEY]: '{"clubId":"abc","name":"Málaga Centro"}',
    });
  });

  it('never throws when getItem throws — returns {}', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => readAllSettings()).not.toThrow();
    expect(readAllSettings()).toEqual({});
  });
});

describe('settingsRegistry.writeAllSettings', () => {
  it('writes each allowlisted key it is given', () => {
    writeAllSettings({ [UI_LANG_KEY]: 'be', [ONBOARDING_SEEN_KEY]: 'true' });
    expect(localStorage.getItem(UI_LANG_KEY)).toBe('be');
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('true');
  });

  it('ignores keys that are not on the allowlist (AC10 unknown-fields-ignored)', () => {
    writeAllSettings({ 'rutina:session': 'stolen-token', 'rutina:somethingNew': 'x', [UI_LANG_KEY]: 'nl' });
    expect(localStorage.getItem('rutina:session')).toBeNull();
    expect(localStorage.getItem('rutina:somethingNew')).toBeNull();
    expect(localStorage.getItem(UI_LANG_KEY)).toBe('nl');
  });

  it('never throws when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => writeAllSettings({ [UI_LANG_KEY]: 'de' })).not.toThrow();
  });

  it('round-trips: seed → readAll → clear → writeAll → same values for allowlisted keys', () => {
    localStorage.setItem(UI_LANG_KEY, 'fr');
    localStorage.setItem(INVITE_KEY, 'https://invite.basic-fit.com/xKb92a1c');
    localStorage.setItem(PROMPT_REQUEST_KEY, '{"field1":"hi"}');
    const captured = readAllSettings();

    localStorage.clear();
    writeAllSettings(captured);

    expect(localStorage.getItem(UI_LANG_KEY)).toBe('fr');
    expect(localStorage.getItem(INVITE_KEY)).toBe('https://invite.basic-fit.com/xKb92a1c');
    expect(localStorage.getItem(PROMPT_REQUEST_KEY)).toBe('{"field1":"hi"}');
  });
});
