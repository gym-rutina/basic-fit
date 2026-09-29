import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

// onboarding-screens (AC1, AC2): pending Cmok implementation — see
// tech-plan.md. Failures here are expected until Cmok wires
// hasSeenOnboarding()/OnboardingOverlay into Shell. HomeScreen is stubbed so
// this file stays scoped to Shell's gating logic, not HomeScreen's own
// rendering/fixture needs (out of scope for this feature).

vi.mock('./lib/db.js', () => ({
  getActiveRutina: vi.fn(),
  saveActiveRutina: vi.fn(),
  getActiveSession: vi.fn().mockResolvedValue(null),
  listSessions: vi.fn().mockResolvedValue([]),
  // multi-rutina-library — ImportScreen now imports the library API directly,
  // so the factory must name these too or module init throws on access.
  listRutinas: vi.fn().mockResolvedValue([]),
  saveRutinaEntry: vi.fn(),
  activateRutina: vi.fn(),
}));

vi.mock('./lib/onboardingStorage.js', () => ({
  hasSeenOnboarding: vi.fn(),
  markOnboardingSeen: vi.fn(),
}));

vi.mock('./screens/HomeScreen.jsx', () => ({
  HomeScreen: () => <div>Home stub</div>,
}));

import { getActiveRutina, getActiveSession, listSessions, listRutinas } from './lib/db.js';
import { hasSeenOnboarding } from './lib/onboardingStorage.js';

describe('App / Shell — onboarding gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    // session-discard-and-history-delete: Shell now mounts useActiveSession()
    // unconditionally (spec.md AC15), so every test here needs a resolved
    // read regardless of route/onboarding state. restoreAllMocks() in
    // afterEach wipes the factory's default mockResolvedValue, so it must be
    // re-set per test rather than relying on the vi.mock() factory alone.
    getActiveSession.mockResolvedValue(null);
    listSessions.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the onboarding overlay when there is no active rutina and onboarding has not been seen (AC1)', async () => {
    getActiveRutina.mockResolvedValue(null);
    hasSeenOnboarding.mockReturnValue(false);

    render(<App />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('does not show onboarding — lands on the import FORK — when onboarding has already been seen (AC2, import-flow AC1)', async () => {
    getActiveRutina.mockResolvedValue(null);
    hasSeenOnboarding.mockReturnValue(true);

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: /crea tu rutina/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/rutina\.json/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show onboarding when a rutina already exists, even if onboarding has not been seen', async () => {
    getActiveRutina.mockResolvedValue({ rutina: { days: [] } });
    hasSeenOnboarding.mockReturnValue(false);

    render(<App />);

    await screen.findByText(/home stub/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismissing onboarding (Saltar) closes it and reveals the import fork underneath', async () => {
    getActiveRutina.mockResolvedValue(null);
    hasSeenOnboarding.mockReturnValue(false);
    const user = userEvent.setup();

    render(<App />);

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /saltar/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 1, name: /crea tu rutina/i })).toBeInTheDocument();
  });
});

// import-flow-guided-first (spec D2, AC1/AC5/AC7/AC8/AC13, tech-plan AD-2) —
// RED until Cmok adds the /import/* routes to App.jsx.
describe('App / Shell — import flow routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    getActiveSession.mockResolvedValue(null);
    listSessions.mockResolvedValue([]);
    listRutinas.mockResolvedValue([]);
    getActiveRutina.mockResolvedValue(null);
    hasSeenOnboarding.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fork "Importar" goes to the JSON screen (AC5)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /ya tengo un rutina\.json/i }));
    expect(await screen.findByLabelText(/rutina\.json/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/import/json');
  });

  it('fork "Preparar prompt" → step 1 → Siguiente → step 2 → "Ya tengo el JSON" → JSON screen (AC3-AC5)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /prepara un prompt/i }));
    expect(await screen.findByText(/paso 1 de 2/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/import/prompt');

    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(await screen.findByText(/paso 2 de 2/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/import/prompt/copy');

    await user.click(screen.getByRole('button', { name: /ya tengo el json/i }));
    expect(await screen.findByLabelText(/rutina\.json/i)).toBeInTheDocument();
  });

  it('"Atrás" from step 2 returns to step 1 (AC7)', async () => {
    window.location.hash = '#/import/prompt';
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /siguiente/i }));
    expect(await screen.findByText(/paso 2 de 2/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(await screen.findByText(/paso 1 de 2/i)).toBeInTheDocument();
  });

  it('W1 "Atrás" returns to the fork (AC7)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /prepara un prompt/i }));
    await screen.findByText(/paso 1 de 2/i);
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /crea tu rutina/i })).toBeInTheDocument();
  });

  it('JSON screen "Atrás" returns to the fork when it was opened from the fork (AC7)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /ya tengo un rutina\.json/i }));
    await screen.findByLabelText(/rutina\.json/i);
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /crea tu rutina/i })).toBeInTheDocument();
  });

  it('JSON screen "Atrás" returns to wizard step 2 when it was opened from there (AC7)', async () => {
    window.location.hash = '#/import/prompt';
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /siguiente/i }));
    await user.click(await screen.findByRole('button', { name: /ya tengo el json/i }));
    await screen.findByLabelText(/rutina\.json/i);
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(await screen.findByText(/paso 2 de 2/i)).toBeInTheDocument();
  });

  it('JSON screen "Atrás" on a deep link (no history to pop) falls back to /import (AD-2)', async () => {
    window.location.hash = '#/import/json';
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText(/rutina\.json/i);
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(await screen.findByRole('heading', { level: 1, name: /crea tu rutina/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/import');
  });

  it('going Atrás from step 2 to step 1 keeps what the user typed (AC7 "back keeps draft")', async () => {
    window.location.hash = '#/import/prompt';
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText(/^objetivo/i), 'Marcador-draft-qwe');
    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    await screen.findByText(/paso 2 de 2/i);
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(await screen.findByText(/marcador-draft-qwe/i)).toBeInTheDocument();
  });

  it('non-empty library: /import skips the fork and lands on the JSON screen (D2, AC8)', async () => {
    listRutinas.mockResolvedValue([{ id: 'r1' }]);
    window.location.hash = '#/import';
    render(<App />);
    expect(await screen.findByLabelText(/rutina\.json/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /crea tu rutina/i })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/import/json');
  });

  it('hides the bottom tab bar on every /import/* screen, not only /import', async () => {
    window.location.hash = '#/import/prompt';
    render(<App />);
    await screen.findByText(/paso 1 de 2/i);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('the old GuideOverlay link is gone from the whole import flow (AC10)', async () => {
    window.location.hash = '#/import/json';
    render(<App />);
    await screen.findByLabelText(/rutina\.json/i);
    expect(screen.queryByRole('link', { name: /gu[ií]a de creaci[oó]n|llm creation guide/i })).not.toBeInTheDocument();
  });
});
