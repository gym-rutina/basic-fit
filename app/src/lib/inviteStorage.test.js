// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { INVITE_KEY, readInviteUrl, writeInviteUrl, clearInviteUrl } from './inviteStorage.js';

// club-invite-link — AC2 (persists across restarts) + the degradation contract.
//
// Deviation from the onboardingStorage/uiLangStorage precedent, deliberate
// (tech-plan.md D-B): writeInviteUrl RETURNS A BOOLEAN instead of swallowing
// silently. A silent write failure would lie to the user at the gym door —
// ux-design frame D requires a renderable "no se pudo guardar" state, and only
// a return value can trigger it. The never-throw posture is unchanged.

describe('inviteStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('exports the canonical key literal (AC15 coordination surface — full-data-backup imports this symbol)', () => {
    expect(INVITE_KEY).toBe('rutina:clubInviteUrl');
  });

  it('round-trips a stored URL across calls (AC2 persistence)', () => {
    expect(readInviteUrl()).toBeNull();

    expect(writeInviteUrl('https://invite.basic-fit.com/xKb92a1c')).toBe(true);
    expect(readInviteUrl()).toBe('https://invite.basic-fit.com/xKb92a1c');
  });

  it('returns null when nothing is stored', () => {
    localStorage.setItem(INVITE_KEY, '');
    // Empty string is falsy-but-present; readInviteUrl returns verbatim-or-null,
    // so an empty value degrades to null exactly like uiLangStorage's contract.
    expect(readInviteUrl()).toBeNull();
  });

  it('returns null without throwing when getItem throws (private browsing / disabled storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => readInviteUrl()).not.toThrow();
    expect(readInviteUrl()).toBeNull();
  });

  it('returns true when the write persists', () => {
    expect(writeInviteUrl('https://invite.basic-fit.com/abc')).toBe(true);
  });

  it('returns FALSE — not throw, not silent success — when setItem throws (D-B degraded signal)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota / private mode');
    });
    let result;
    expect(() => {
      result = writeInviteUrl('https://invite.basic-fit.com/abc');
    }).not.toThrow();
    expect(result).toBe(false);
  });

  it('clear removes the key', () => {
    writeInviteUrl('https://invite.basic-fit.com/abc');
    clearInviteUrl();
    expect(localStorage.getItem(INVITE_KEY)).toBeNull();
    expect(readInviteUrl()).toBeNull();
  });

  it('does not throw when removeItem throws during clear', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => clearInviteUrl()).not.toThrow();
  });
});
