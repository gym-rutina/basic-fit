import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UI_LANG_KEY, readUiLocale, writeUiLocale } from './uiLangStorage.js';

/**
 * pwa-ui-language AC3 (tech-plan.md D6).
 *
 * Deliberately modelled on `onboardingStorage.js`: plain localStorage, read
 * synchronously in the same tick as component init, and defensive to the
 * point of never throwing — a private-browsing device must lose its language
 * preference, not fail to boot.
 *
 * This module does NOT validate. AC2 requires absent / empty / corrupt /
 * unknown to be handled identically, from one place, and that place is
 * `resolveUiLocale`.
 */

describe('uiLangStorage (AC3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('uses a namespaced key, consistent with rutina:onboardingSeen', () => {
    expect(UI_LANG_KEY).toBe('rutina:uiLang');
  });

  it('round-trips a locale', () => {
    writeUiLocale('be');
    expect(readUiLocale()).toBe('be');
    expect(localStorage.getItem(UI_LANG_KEY)).toBe('be');
  });

  it('returns null when nothing has been stored', () => {
    expect(readUiLocale()).toBeNull();
  });

  it('returns whatever is stored verbatim — validation belongs to resolveUiLocale', () => {
    localStorage.setItem(UI_LANG_KEY, 'klingon');
    expect(readUiLocale()).toBe('klingon');
  });

  it('returns null, and does not throw, when getItem throws (private browsing)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied');
    });
    expect(() => readUiLocale()).not.toThrow();
    expect(readUiLocale()).toBeNull();
  });

  it('does not throw when setItem throws — the switch must still apply in-session', () => {
    // ux-design.md's Error row: keep the previous locale active, swallow the
    // failure, surface nothing. Same call this app already makes for
    // markOnboardingSeen().
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded');
    });
    expect(() => writeUiLocale('en')).not.toThrow();
  });
});
