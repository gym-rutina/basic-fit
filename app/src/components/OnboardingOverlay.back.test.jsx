import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { OnboardingOverlay } from './OnboardingOverlay.jsx';
import { I18nProvider } from '../i18n/index.js';
import { pressSystemBack, settleHistory, resetHashTo } from '../test-utils/history.js';

/**
 * back-closes-dialogs-and-wizard-polish AC5 (+ AC3/AC4 for the onboarding
 * carousel) — decision D1: Back = previous step; on step 1 Back = the same as
 * *Skip* (there is no draft confirm anymore — onboarding-fork-shortening
 * removed the input steps, so the carousel collects nothing to lose); the
 * fork's `guideOnly` revisit simply closes. Real jsdom history + a real
 * HashRouter, like sheet/backClosesDialog.test.jsx.
 */

vi.mock('../lib/onboardingStorage.js', () => ({
  hasSeenOnboarding: vi.fn().mockReturnValue(false),
  markOnboardingSeen: vi.fn(),
}));

const gymsFx = vi.hoisted(() => ({
  COUNTRIES: [{ code: 'ES', names: { en: 'Spain', es: 'España', be: 'Іспанія' }, cities: [] }],
}));
vi.mock('../data/gyms.js', () => ({
  GYM_INDEX: { metadata: { totalClubs: 1 }, countries: gymsFx.COUNTRIES },
  COUNTRIES: gymsFx.COUNTRIES,
  TOTAL_CLUBS: 1,
  citiesFor: () => [],
  loadClubs: async () => [],
  findClubById: async () => null,
  resolveLegacyGymId: async () => null,
}));

import { markOnboardingSeen } from '../lib/onboardingStorage.js';

function PathProbe() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}
const currentPath = () => screen.getByTestId('path').textContent;

function Landing() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate('/b')}>go to b</button>;
}

/** /a -> /b, then the overlay (rendered OUTSIDE the routes, like Shell does) is shown. */
function Shellish({ guideOnly = false, onClose }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <PathProbe />
      <Routes>
        <Route path="/a" element={<Landing />} />
        <Route path="/b" element={<button type="button" onClick={() => setShown(true)}>show overlay</button>} />
      </Routes>
      {shown && (
        <OnboardingOverlay
          guideOnly={guideOnly}
          onClose={() => {
            onClose();
            setShown(false);
          }}
        />
      )}
    </>
  );
}

async function mountOverlayAtB({ guideOnly = false } = {}) {
  resetHashTo('#/a');
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <I18nProvider initialLocale="es">
      <HashRouter>
        <Shellish guideOnly={guideOnly} onClose={onClose} />
      </HashRouter>
    </I18nProvider>
  );
  await user.click(screen.getByRole('button', { name: 'go to b' }));
  await settleHistory();
  await user.click(screen.getByRole('button', { name: 'show overlay' }));
  await settleHistory();
  expect(currentPath()).toBe('/b');
  return { user, onClose };
}

async function next(user, times = 1) {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await user.click(screen.getByRole('button', { name: /^siguiente$/i }));
  }
}

const stepText = (n) => screen.getByText(new RegExp(`paso ${n} de 3`, 'i'));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(async () => {
  cleanup();
  await settleHistory();
  localStorage.clear();
});

describe('AC5 — carousel: Back = previous step', () => {
  it('on the club step Back goes to step 2, stays open, and keeps the route', async () => {
    const { user, onClose } = await mountOverlayAtB();
    await next(user, 2); // step 3: club
    expect(stepText(3)).toBeInTheDocument();

    await pressSystemBack();

    expect(stepText(2)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(markOnboardingSeen).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/b');
  }, 15000); // 2 s cold on its own (3 steps): headroom so a loaded full-suite run cannot hit the 5 s default

  it('Back keeps working step after step (armed again each time) all the way down to step 1', async () => {
    const { user, onClose } = await mountOverlayAtB();
    await next(user, 2); // step 3
    await pressSystemBack();
    expect(stepText(2)).toBeInTheDocument();
    await pressSystemBack();
    expect(stepText(1)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/b');
  });

  it('on step 1 Back is Skip: it marks onboarding seen, closes, and the route is untouched', async () => {
    const { user, onClose } = await mountOverlayAtB();
    await next(user, 1);
    await pressSystemBack(); // step 2 -> step 1
    expect(stepText(1)).toBeInTheDocument();

    await pressSystemBack(); // step 1 -> Skip

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(markOnboardingSeen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');

    await pressSystemBack(); // and now Back leaves the page, in one press
    expect(currentPath()).toBe('/a');
  });
});

describe('AC5 — guideOnly (fork "How the app works" revisit): Back just closes', () => {
  it('closes with no seen-flag write, and the next Back leaves the page', async () => {
    const { onClose } = await mountOverlayAtB({ guideOnly: true });
    expect(screen.getByRole('heading', { name: /así funciona/i })).toBeInTheDocument();

    await pressSystemBack();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(markOnboardingSeen).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });
});

describe('AC4 — dialogs opened over the carousel close first, one per Back', () => {
  it('ClubPickerSheet over the club step: Back closes the picker only; the carousel stays on the club step', async () => {
    const { user, onClose } = await mountOverlayAtB();
    await next(user, 2); // club step
    expect(stepText(3)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /elegir club/i }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await pressSystemBack();

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(stepText(3)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/b');

    await pressSystemBack(); // now the carousel's own Back: step 3 -> step 2
    expect(stepText(2)).toBeInTheDocument();
  });

  it('LanguageSheet over step 1: Back closes the sheet only, not the carousel', async () => {
    const { user, onClose } = await mountOverlayAtB();
    await user.click(screen.getByRole('button', { name: /idioma/i }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await pressSystemBack();

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(stepText(1)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(markOnboardingSeen).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/b');
  });

  it("closing the picker with its own ✕ leaves the carousel armed: the next Back is the carousel's Back, not a page exit", async () => {
    const { user } = await mountOverlayAtB();
    await next(user, 2);
    await user.click(screen.getByRole('button', { name: /elegir club/i }));
    const picker = screen.getByRole('dialog', { name: /selecciona tu club/i });
    await user.click(Array.from(picker.querySelectorAll('button')).find((b) => /^cerrar$/i.test(b.getAttribute('aria-label') || '')));
    await settleHistory();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await pressSystemBack();

    expect(stepText(2)).toBeInTheDocument(); // carousel stepped back
    expect(currentPath()).toBe('/b');
  });
});

describe('AC3 — leaving the carousel by its own controls leaves no stale entry', () => {
  it('Saltar (no draft): one Back afterwards reaches the previous page', async () => {
    const { user, onClose } = await mountOverlayAtB();
    await user.click(screen.getByRole('button', { name: /^saltar$/i }));
    await settleHistory();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('Empezar on the last step: one Back afterwards reaches the previous page', async () => {
    const { user, onClose } = await mountOverlayAtB();
    await next(user, 2);
    await user.click(screen.getByRole('button', { name: /^empezar$/i }));
    await settleHistory();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('guideOnly closed with its button: one Back afterwards reaches the previous page', async () => {
    const { user, onClose } = await mountOverlayAtB({ guideOnly: true });
    await user.click(screen.getAllByRole('button', { name: /^cerrar$/i })[1]);
    await settleHistory();
    expect(onClose).toHaveBeenCalledTimes(1);

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });
});
