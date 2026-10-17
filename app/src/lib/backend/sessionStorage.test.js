import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readSession, writeSession, clearSession, SESSION_STORAGE_KEY } from './sessionStorage.js';
import { readAllSettings, BACKUP_SETTINGS_KEYS } from '../settingsRegistry.js';

/**
 * backend-bootstrap AC17 (tech-plan.md §2 D6) — session-token persistence.
 * Its own named key, swallow-failures idiom (like inviteStorage/uiLangStorage),
 * and — the point — EXCLUDED from backup and export by construction (cloud
 * spec AC7 / backup AC14: no credential is ever written into a backup file).
 * No login exists in this feature; the module ships so the exclusion is
 * pinned before anything can write a token.
 */

const future = () => new Date(Date.now() + 3600_000).toISOString();
const past = () => new Date(Date.now() - 3600_000).toISOString();

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('key and round-trip', () => {
  it('exports its key as a named constant, in the rutina: namespace', () => {
    expect(SESSION_STORAGE_KEY).toBe('rutina:session');
  });

  it('round-trips a session', () => {
    expect(writeSession({ token: 't', expiresAt: future() })).toBe(true);
    expect(readSession()).toMatchObject({ token: 't' });
  });

  it('clearSession removes it', () => {
    writeSession({ token: 't', expiresAt: future() });
    clearSession();
    expect(readSession()).toBeNull();
  });
});

describe('defensive reads', () => {
  it('returns null when absent, corrupt, malformed or EXPIRED (expired ⇒ absent, cloud AC6)', () => {
    expect(readSession()).toBeNull();
    localStorage.setItem(SESSION_STORAGE_KEY, '{not json');
    expect(readSession()).toBeNull();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 5 }));
    expect(readSession()).toBeNull();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', expiresAt: past() }));
    expect(readSession()).toBeNull();
  });

  it('write returns false — never throws — when storage refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota');
    });
    expect(writeSession({ token: 't', expiresAt: future() })).toBe(false);
  });

  it('clear never throws when storage refuses', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied');
    });
    expect(() => clearSession()).not.toThrow();
  });
});

describe('never in a backup (cloud spec AC7)', () => {
  it('the backup settings registry does not enumerate the session key', () => {
    expect(BACKUP_SETTINGS_KEYS).not.toContain(SESSION_STORAGE_KEY);
  });

  it('readAllSettings never returns it, even when a session is stored', () => {
    writeSession({ token: 'SECRET-TOKEN', expiresAt: future() });
    const all = readAllSettings();
    expect(Object.keys(all)).not.toContain(SESSION_STORAGE_KEY);
    expect(JSON.stringify(all)).not.toContain('SECRET-TOKEN');
  });
});
