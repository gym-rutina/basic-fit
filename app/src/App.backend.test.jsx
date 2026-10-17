import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

/**
 * backend-bootstrap AC16 (tech-plan.md §2 D6) — BEHAVIOUR-NEUTRAL. With
 * VITE_BACKEND_URL unset (the real test env) mounting the whole app performs
 * ZERO network requests, writes nothing the seam owns, and renders nothing new.
 * Harness mirrors App.test.jsx (db/onboarding/Home stubbed) — this file only
 * asserts what the backend seam must NOT do.
 */

vi.mock('./lib/db.js', () => ({
  getActiveRutina: vi.fn(),
  saveActiveRutina: vi.fn(),
  getActiveSession: vi.fn().mockResolvedValue(null),
  listSessions: vi.fn().mockResolvedValue([]),
  listRutinas: vi.fn().mockResolvedValue([]),
  saveRutinaEntry: vi.fn(),
  activateRutina: vi.fn(),
}));
vi.mock('./lib/onboardingStorage.js', () => ({
  hasSeenOnboarding: vi.fn(),
  markOnboardingSeen: vi.fn(),
}));
vi.mock('./screens/HomeScreen.jsx', () => ({ HomeScreen: () => <div>Home stub</div> }));

import { getActiveRutina, getActiveSession, listSessions } from './lib/db.js';
import { hasSeenOnboarding } from './lib/onboardingStorage.js';

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = '';
  getActiveSession.mockResolvedValue(null);
  listSessions.mockResolvedValue([]);
  getActiveRutina.mockResolvedValue(null);
  hasSeenOnboarding.mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('App with no backend configured', () => {
  it('makes ZERO network requests', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network is forbidden in this test')));
    vi.stubGlobal('fetch', fetchSpy);
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /crea tu rutina/i });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('writes no session, tenant or backend key to storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /crea tu rutina/i });
    const keys = setItem.mock.calls.map(([k]) => String(k));
    expect(keys.filter((k) => /session|tenant|backend|token/i.test(k))).toEqual([]);
  });

  it('renders no account / sign-in / subscription surface', async () => {
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /crea tu rutina/i });
    expect(screen.queryByRole('button', { name: /iniciar sesión|registrarse|cuenta|suscrip|plus/i })).not.toBeInTheDocument();
  });
});
