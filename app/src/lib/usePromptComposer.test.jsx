import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePromptComposer } from './usePromptComposer.js';
import { PROMPT_REQUEST_KEY, readPromptRequest } from './promptRequestStorage.js';
import { writeClub, clearClub } from './clubStorage.js';
import * as db from './db.js';
import { I18nProvider } from '../i18n/index.js';
import { mockClipboard } from '../test-utils/clipboard.js';

// import-flow-guided-first (tech-plan AD-1, §4) — RED until Cmok extracts the
// hook from GuideOverlay.jsx. Migrated coverage: prompt copy, prompt reflects
// club/answers (AC36/40), session history (R4), defensive storage (AC10).

vi.mock('./db.js', () => ({
  listSessions: vi.fn().mockResolvedValue([]),
}));

const CLUB = { countryCode: 'ES', clubId: 'club-1', name: 'Madrid Gran Vía', city: 'Madrid', address: 'Gran Vía 1' };

const wrapper = ({ children }) => <I18nProvider initialLocale="es">{children}</I18nProvider>;

describe('usePromptComposer', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    db.listSessions.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('seeds the draft from the persisted request record (text fields never undefined)', () => {
    localStorage.setItem(PROMPT_REQUEST_KEY, JSON.stringify({ field2: 'Hipertrofia', field3: 4 }));
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    expect(result.current.draft).toMatchObject({ field1: '', field2: 'Hipertrofia', field3: 4, field4: '', field5: '' });
  });

  it('setField persists immediately (not on a later save action)', () => {
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    act(() => result.current.setField('field5', 'rodilla derecha'));
    expect(result.current.draft.field5).toBe('rodilla derecha');
    expect(readPromptRequest().field5).toBe('rodilla derecha');
  });

  it('toggleDay sets the count, and tapping the same value again clears it', () => {
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    act(() => result.current.toggleDay(3));
    expect(result.current.draft.field3).toBe(3);
    expect(readPromptRequest().field3).toBe(3);
    act(() => result.current.toggleDay(3));
    expect(result.current.draft.field3).toBeUndefined();
    expect(readPromptRequest().field3).toBeUndefined();
  });

  it('promptText reflects the answers and the selected club', () => {
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    act(() => result.current.setField('field2', 'Objetivo-marcador-xyz'));
    act(() => result.current.setClub(CLUB));
    expect(result.current.club).toMatchObject({ clubId: 'club-1' });
    expect(result.current.promptText).toContain('Objetivo-marcador-xyz');
    expect(result.current.promptText).toContain('Madrid Gran Vía');
  });

  it('promptText is a non-empty string even with no answers and no club', () => {
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    expect(typeof result.current.promptText).toBe('string');
    expect(result.current.promptText.length).toBeGreaterThan(50);
  });

  it("copy() writes promptText to the clipboard, resolves 'copied', and `copied` resets after 2s", async () => {
    vi.useFakeTimers();
    const writeText = mockClipboard('ok');
    const { result } = renderHook(() => usePromptComposer(), { wrapper });

    let outcome;
    await act(async () => {
      outcome = await result.current.copy();
    });
    expect(outcome).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(result.current.promptText);
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.copied).toBe(false);
  });

  it("copy() resolves 'denied' and leaves `copied` false when the clipboard rejects", async () => {
    mockClipboard('denied');
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    let outcome;
    await act(async () => {
      outcome = await result.current.copy();
    });
    expect(outcome).toBe('denied');
    expect(result.current.copied).toBe(false);
  });

  it('sessionsAvailable is false with no history, and includeSessions defaults to true', async () => {
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    await waitFor(() => expect(db.listSessions).toHaveBeenCalled());
    expect(result.current.sessionsAvailable).toBe(false);
    expect(result.current.includeSessions).toBe(true);
  });

  it('sessionsAvailable becomes true when history exists, and unchecking removes it from the prompt', async () => {
    db.listSessions.mockResolvedValue([
      { id: 's1', dayIndex: 0, startedAt: '2026-09-01T10:00:00Z', endedAt: '2026-09-01T11:00:00Z', exercises: [] },
    ]);
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    await waitFor(() => expect(result.current.sessionsAvailable).toBe(true));
    const withSessions = result.current.promptText;
    act(() => result.current.setIncludeSessions(false));
    expect(result.current.promptText.length).toBeLessThan(withSessions.length);
  });

  it('degrades to an empty draft when localStorage throws (onboarding-request-fields AC10)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    expect(result.current.draft.field2).toBe('');
    expect(() => act(() => result.current.setField('field2', 'x'))).not.toThrow();
  });

  it('writeClub round-trip is visible to a fresh hook mount', () => {
    writeClub(CLUB);
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    expect(result.current.club).toMatchObject({ name: 'Madrid Gran Vía' });
  });
});
