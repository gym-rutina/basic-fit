import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePromptComposer } from './usePromptComposer.js';
import { writeClub, clearClub } from './clubStorage.js';
import { I18nProvider } from '../i18n/index.js';

// import-flow-guided-first tech-plan §4 — assertions migrated from the deleted
// GuideOverlay.test.jsx that the new usePromptComposer.test.jsx does not cover:
// "prompt reflects the selected club and equipment" (R6.1-R6.3, AC36/AC40/AC43)
// and "field 8, session history" (R4, AC19-AC23). Same fixtures/mocks as the
// original: a two-item catalog, a controllable exclusions hook, a controllable
// session list + export builder.

const equipmentFx = vi.hoisted(() => ({
  EQUIPMENT: [
    { id: 'g3-s70', modelCode: 'G3-S70', names: { en: 'Leg Press', es: 'Prensa de piernas' }, category: 'machines', muscleGroup: { primary: ['legs'] } },
    { id: 'mg-pl13', modelCode: 'MG-PL13', names: { en: 'Bench Press', es: 'Press de banca' }, category: 'free-weights', muscleGroup: { primary: ['chest'] } },
  ],
}));
vi.mock('../data/equipment.js', () => ({ EQUIPMENT: equipmentFx.EQUIPMENT }));

const useClubExclusionsMock = vi.hoisted(() =>
  vi.fn(() => ({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false }))
);
vi.mock('./useClubExclusions.js', () => ({ useClubExclusions: useClubExclusionsMock }));

const listSessionsMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('./db.js', () => ({ listSessions: listSessionsMock }));

const buildExportPayloadMock = vi.hoisted(() => vi.fn(() => ({ json: {}, markdown: '' })));
vi.mock('./exportFormat.js', () => ({ buildExportPayload: buildExportPayloadMock }));

const CLUB = { countryCode: 'ES', clubId: 'club-77', name: 'Madrid Gran Vía', city: 'Madrid', address: 'Gran Vía 1' };
const wrapper = ({ children }) => <I18nProvider initialLocale="en">{children}</I18nProvider>;
const SESSION_MD = 'Prensa de Pecho (g3-s10)\n  · 32kg / normal';

describe('usePromptComposer — prompt reflects the selected club and equipment (AC36/AC40/AC43)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    listSessionsMock.mockResolvedValue([]);
    useClubExclusionsMock.mockReturnValue({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false });
  });
  afterEach(() => vi.restoreAllMocks());

  it("fills the prompt with the selected club's name, city, address and id (AC36)", () => {
    writeClub(CLUB);
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    for (const part of [CLUB.name, CLUB.city, CLUB.address, CLUB.clubId]) {
      expect(result.current.promptText).toContain(part);
    }
  });

  it('embeds the club-scoped equipment table, not the old gyms.json-filter instruction (R6.2, R6.3, AC40)', () => {
    writeClub(CLUB);
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    expect(result.current.promptText).toContain('g3-s70');
    expect(result.current.promptText).toContain('mg-pl13');
    expect(result.current.promptText).not.toMatch(/gyms\.json/);
    expect(result.current.promptText).not.toMatch(/\bgyms\s+array\b/i);
  });

  it('shows a placeholder rather than throwing when no club is selected yet (R5.6)', () => {
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    expect(result.current.promptText).not.toMatch(/undefined/);
  });

  it('excludes items already marked out for this club from the prompt (R7.5, AC43)', () => {
    useClubExclusionsMock.mockReturnValue({ excludedIds: new Set(['g3-s70']), exclude: vi.fn(), include: vi.fn(), writeFailed: false });
    writeClub(CLUB);
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    expect(result.current.promptText).not.toContain('g3-s70');
    expect(result.current.promptText).toContain('mg-pl13');
  });
});

describe('usePromptComposer — field 8, session history (R4, AC19-AC23)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    useClubExclusionsMock.mockReturnValue({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false });
    buildExportPayloadMock.mockReturnValue({ json: {}, markdown: SESSION_MD });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    listSessionsMock.mockResolvedValue([]);
    buildExportPayloadMock.mockReturnValue({ json: {}, markdown: '' });
  });

  it('with zero sessions field 8 stays a placeholder and nothing is available to include (AC21)', async () => {
    listSessionsMock.mockResolvedValue([]);
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    await waitFor(() => expect(listSessionsMock).toHaveBeenCalled());
    expect(result.current.sessionsAvailable).toBe(false);
    expect(result.current.promptText).not.toContain('Prensa de Pecho');
  });

  it('with sessions present the prompt carries the export markdown and inclusion defaults to on (AC19)', async () => {
    listSessionsMock.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    await waitFor(() => expect(result.current.sessionsAvailable).toBe(true));
    expect(result.current.includeSessions).toBe(true);
    expect(result.current.promptText).toContain('Prensa de Pecho');
  });

  it('turning inclusion off removes the markdown in the same update (AC20)', async () => {
    listSessionsMock.mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    await waitFor(() => expect(result.current.sessionsAvailable).toBe(true));
    act(() => result.current.setIncludeSessions(false));
    expect(result.current.promptText).not.toContain('Prensa de Pecho');
  });

  it('paints with field 8 empty before listSessions resolves, then fills in without a remount (AC22)', async () => {
    let resolveSessions;
    listSessionsMock.mockReturnValue(new Promise((resolve) => { resolveSessions = resolve; }));
    const { result } = renderHook(() => usePromptComposer(), { wrapper });
    expect(result.current.sessionsAvailable).toBe(false);
    expect(result.current.promptText).not.toContain('Prensa de Pecho');

    await act(async () => resolveSessions([{ id: 1 }]));
    await waitFor(() => expect(result.current.sessionsAvailable).toBe(true));
    expect(result.current.promptText).toContain('Prensa de Pecho');
  });

  it('inclusion is never persisted: a fresh mount is back to on (AC23, R4.4)', async () => {
    listSessionsMock.mockResolvedValue([{ id: 1 }]);
    const first = renderHook(() => usePromptComposer(), { wrapper });
    await waitFor(() => expect(first.result.current.sessionsAvailable).toBe(true));
    act(() => first.result.current.setIncludeSessions(false));
    expect(first.result.current.includeSessions).toBe(false);
    first.unmount();

    const second = renderHook(() => usePromptComposer(), { wrapper });
    await waitFor(() => expect(second.result.current.sessionsAvailable).toBe(true));
    expect(second.result.current.includeSessions).toBe(true);
  });
});
