import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { pressSystemBack, settleHistory } from './test-utils/history.js';
import { mockClipboard } from './test-utils/clipboard.js';
import { clearClub, readClub, writeClub } from './lib/clubStorage.js';
import { UI_LANG_KEY } from './lib/uiLangStorage.js';

/**
 * back-closes-dialogs-and-wizard-polish — the whole App (real HashRouter, real
 * Shell, real jsdom history) for the cross-cutting guarantees that span
 * screens:
 *   A  AC1/AC3/AC5/AC8  system Back closes dialogs; closing by other means leaves
 *                       no stale entry so the in-app "Atrás" (goBack -> navigate(-1))
 *                       still moves exactly one step; onboarding Back = previous step.
 *   B  AC18             club picked on wizard step 1 survives step 2 and Atrás.
 * Unit-level coverage lives in sheet/backClosesDialog*.test.jsx,
 * OnboardingOverlay.back.test.jsx and the two Prompt*Screen suites.
 */

vi.mock('./lib/db.js', () => ({
  getActiveRutina: vi.fn(),
  saveActiveRutina: vi.fn(),
  getActiveSession: vi.fn().mockResolvedValue(null),
  listSessions: vi.fn().mockResolvedValue([]),
  listRutinas: vi.fn().mockResolvedValue([]),
  saveRutinaEntry: vi.fn(),
  activateRutina: vi.fn(),
  getClubExclusions: vi.fn().mockResolvedValue([]),
  setClubExclusions: vi.fn().mockResolvedValue(undefined),
  hasClubExclusionsRecord: vi.fn().mockResolvedValue(false),
}));

vi.mock('./lib/onboardingStorage.js', () => ({
  hasSeenOnboarding: vi.fn(),
  markOnboardingSeen: vi.fn(),
}));

vi.mock('./screens/HomeScreen.jsx', () => ({
  HomeScreen: () => <div>Home stub</div>,
}));

// A stand-in for the real picker (own suite: ClubPickerSheet.test.jsx) that keeps
// what matters here: it is built on SheetShell (so it is a real back-closable
// dialog) and, like the real one, persists the choice with writeClub() before
// calling onSelect.
vi.mock('./components/ClubPickerSheet.jsx', async () => {
  const { SheetShell, SheetCloseButton } = await import('./components/sheet/SheetShell.jsx');
  const { writeClub: write } = await import('./lib/clubStorage.js');
  return {
    ClubPickerSheet: ({ onSelect, onClose, returnFocusTo }) => (
      <SheetShell onClose={onClose} labelledBy="picker-stub-title" returnFocusTo={returnFocusTo}>
        <h3 id="picker-stub-title">picker-stub</h3>
        <SheetCloseButton onClick={onClose} />
        <button
          type="button"
          onClick={() => {
            const record = { countryCode: 'ES', clubId: 'club-2', name: 'Barcelona Sants', city: 'Barcelona', address: 'Sants 2' };
            write(record);
            onSelect(record);
          }}
        >
          pick-stub
        </button>
      </SheetShell>
    ),
  };
});

import { getActiveRutina, getActiveSession, listRutinas, listSessions, getClubExclusions, hasClubExclusionsRecord, setClubExclusions } from './lib/db.js';
import { hasSeenOnboarding } from './lib/onboardingStorage.js';

const hash = () => window.location.hash;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(UI_LANG_KEY, 'es'); // clear() wiped test-setup's locale pin
  clearClub();
  window.location.hash = '';
  // restoreAllMocks() in afterEach wipes the factory defaults, so every mock is re-primed per test.
  getActiveSession.mockResolvedValue(null);
  listSessions.mockResolvedValue([]);
  listRutinas.mockResolvedValue([]);
  getActiveRutina.mockResolvedValue(null);
  getClubExclusions.mockResolvedValue([]);
  hasClubExclusionsRecord.mockResolvedValue(false);
  setClubExclusions.mockResolvedValue(undefined);
  hasSeenOnboarding.mockReturnValue(true);
});

afterEach(async () => {
  cleanup();
  await settleHistory();
  vi.restoreAllMocks();
});

async function openStep2(user) {
  window.location.hash = '#/import/prompt';
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /siguiente/i }));
  await screen.findByText(/paso 2 de 2/i);
  await settleHistory();
}

describe('A — wizard step 2: the "Guía completa" sheet', () => {
  it('system Back closes the sheet and stays on step 2; the next Back goes to step 1', async () => {
    const user = userEvent.setup();
    await openStep2(user);
    await user.click(screen.getByRole('button', { name: /gu[ií]a completa/i }));
    expect(screen.getByRole('dialog', { name: /gu[ií]a completa/i })).toBeInTheDocument();

    await pressSystemBack();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/paso 2 de 2/i)).toBeInTheDocument();
    expect(hash()).toBe('#/import/prompt/copy');

    await pressSystemBack();
    expect(await screen.findByText(/paso 1 de 2/i)).toBeInTheDocument();
    expect(hash()).toBe('#/import/prompt');
  });

  it('closing it with ✕ leaves no stale entry: the in-app "Atrás" moves exactly one step (AC3 + AC8)', async () => {
    const user = userEvent.setup();
    await openStep2(user);
    await user.click(screen.getByRole('button', { name: /gu[ií]a completa/i }));
    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));
    await settleHistory();

    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    await settleHistory();

    expect(await screen.findByText(/paso 1 de 2/i)).toBeInTheDocument();
    expect(hash()).toBe('#/import/prompt');
  });

  it('system Back right after the sheet was closed by Escape also lands on step 1 in one press', async () => {
    const user = userEvent.setup();
    await openStep2(user);
    await user.click(screen.getByRole('button', { name: /gu[ií]a completa/i }));
    await user.keyboard('{Escape}');
    await settleHistory();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await pressSystemBack();
    expect(await screen.findByText(/paso 1 de 2/i)).toBeInTheDocument();
  });
});

describe('A — first-run onboarding carousel (AC5) inside the real Shell', () => {
  beforeEach(() => {
    hasSeenOnboarding.mockReturnValue(false);
  });

  it('Back steps back inside the carousel; on step 1 it skips (closes) and reveals the fork without leaving /import', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('dialog');
    await settleHistory();
    const forkHeading = screen.getByRole('heading', { level: 1, name: /crea tu rutina/i });
    await user.click(screen.getByRole('button', { name: /^siguiente$/i }));
    expect(screen.getByText(/paso 2 de 3/i)).toBeInTheDocument();

    await pressSystemBack();
    expect(screen.getByText(/paso 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await pressSystemBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).toContainElement(forkHeading); // the fork underneath was never left or re-mounted
    expect(hash()).toBe('#/import');
  });

  it('after the carousel is dismissed by Saltar, the wizard "Atrás" still works in one press (no stale entry under the fork)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('dialog');
    await settleHistory();
    await user.click(screen.getByRole('button', { name: /^saltar$/i }));
    await settleHistory();

    await user.click(await screen.findByRole('button', { name: /prepara un prompt/i }));
    await screen.findByText(/paso 1 de 2/i);
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    await settleHistory();

    expect(await screen.findByRole('heading', { level: 1, name: /crea tu rutina/i })).toBeInTheDocument();
    expect(hash()).toBe('#/import');
  });
});

describe('A — fork "How the app works" (guideOnly) revisit', () => {
  it('system Back closes it, the fork stays interactive, nothing is persisted', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/import';
    render(<App />);
    const link = await screen.findByRole('link', { name: /c[oó]mo funciona la app/i });
    const prepare = screen.getByRole('button', { name: /prepara un prompt/i });
    await user.click(link);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await settleHistory();

    await pressSystemBack();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The SAME fork is still on screen: a Back that left the page and was redirected
    // back to /import would have re-mounted it (new elements, same URL).
    expect(document.body).toContainElement(prepare);
    expect(document.body).toContainElement(link);
    expect(hash()).toBe('#/import');
    const { markOnboardingSeen } = await import('./lib/onboardingStorage.js');
    expect(markOnboardingSeen).not.toHaveBeenCalled();
  });
});

describe('B — the club picked on wizard step 1 is what step 2 copies (AC18)', () => {
  it('step 1: pick a club -> Siguiente -> Copiar prompt carries that club; Atrás shows it still chosen', async () => {
    const user = userEvent.setup();
    const writeText = mockClipboard('ok'); // after userEvent.setup(): it overwrites navigator.clipboard
    window.location.hash = '#/import/prompt';
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /elegir club/i }));
    await user.click(screen.getByRole('button', { name: 'pick-stub' }));
    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(readClub()).toMatchObject({ clubId: 'club-2' });
    await screen.findByText(/paso 2 de 2/i);

    await user.click(screen.getByRole('button', { name: /copiar prompt/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('Barcelona Sants');

    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    await settleHistory();
    await screen.findByText(/paso 1 de 2/i);
    expect(screen.getByText(/barcelona sants/i)).toBeInTheDocument();
  });

  it('a club chosen earlier (onboarding/Settings) shows on step 1 and is in the step-2 prompt without touching the picker', async () => {
    writeClub({ countryCode: 'ES', clubId: 'club-1', name: 'Madrid Gran Vía', city: 'Madrid', address: 'Gran Vía 1' });
    const user = userEvent.setup();
    const writeText = mockClipboard('ok');
    window.location.hash = '#/import/prompt';
    render(<App />);
    expect(await screen.findByText(/madrid gran v[ií]a/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    await screen.findByText(/paso 2 de 2/i);
    await user.click(screen.getByRole('button', { name: /copiar prompt/i }));
    expect(writeText.mock.calls[0][0]).toContain('Madrid Gran Vía');
  });
});
