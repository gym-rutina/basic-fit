import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingOverlay } from './OnboardingOverlay.jsx';
import { I18nProvider } from '../i18n/index.js';

/**
 * onboarding-fork-shortening — the carousel is 3 steps (welcome, "Así
 * funciona", club). The former name-goal/schedule/injuries input steps were
 * removed: the fork's "Prepare prompt" wizard (PromptPreferencesScreen)
 * collects the five REQUEST fields itself. These tests keep the surviving
 * contracts: guideOnly revisit, step counting/announcement, club step +
 * ClubPickerSheet wiring, focus management, Skip/Siguiente never blocking,
 * locale switching mid-carousel, and defensive rendering when storage throws.
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

const TEST_CLUB = {
  countryCode: 'ES',
  clubId: '1ec43550fd654c7d8e23bc6c96cd2ff0',
  name: 'Alameda',
  address: 'Av. de Andalucía 12',
  city: 'Málaga',
};

// Wrapped in a REAL I18nProvider (initialLocale="es" — deterministic
// regardless of localStorage/navigator.language — matches every other test's
// existing assumption that the overlay starts in Spanish). Without a provider,
// `useI18n()` resolves to the frozen default context value whose `setLocale`
// is a no-op (`() => {}`), which would make the AC42 locale-switch test below
// silently do nothing — LanguageSheet's "select English" click would never
// actually change anything, and the test's own final assertion (an English
// step copy) could never pass. `next()` below is loosened to match the
// button text in any of the three shipped locales for the same reason: once
// AC42 legitimately switches locale mid-test, "Siguiente" becomes "Next".
function renderOverlay(onClose = () => {}) {
  return render(
    <I18nProvider initialLocale="es">
      <OnboardingOverlay onClose={onClose} />
    </I18nProvider>
  );
}

async function next(user, times = 1) {
  for (let i = 0; i < times; i++) {
    await user.click(screen.getByRole('button', { name: /siguiente|next|далей/i }));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('OnboardingOverlay — guideOnly (fork "How the app works" revisit)', () => {
  function renderGuideOnly(onClose = () => {}) {
    return render(
      <I18nProvider initialLocale="es">
        <OnboardingOverlay guideOnly onClose={onClose} />
      </I18nProvider>
    );
  }

  it('shows only the "Así funciona" step with its numbered workflow: no step counter, no language trigger, no Siguiente/Atrás', () => {
    renderGuideOnly();
    expect(screen.getByRole('heading', { name: /así funciona/i })).toBeInTheDocument();
    expect(screen.getByText(/responde unas preguntas/i)).toBeInTheDocument();
    expect(screen.getByText(/llm es simplemente/i)).toBeInTheDocument();
    expect(screen.getByText(/copiar y pegar/i)).toBeInTheDocument();
    expect(screen.queryByText(/paso \d de \d/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /idioma|language/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /atrás/i })).not.toBeInTheDocument();
  });

  it.each([
    ['the primary button', async (user) => user.click(screen.getAllByRole('button', { name: /cerrar/i })[1])],
    ['the header button', async (user) => user.click(screen.getAllByRole('button', { name: /cerrar/i })[0])],
  ])('closes via %s without marking onboarding seen', async (_label, close) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderGuideOnly(onClose);
    await close(user);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(markOnboardingSeen).not.toHaveBeenCalled();
  });

  it('Escape closes it immediately', () => {
    const onClose = vi.fn();
    renderGuideOnly(onClose);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingOverlay — overall shape (AC1, AC8)', () => {
  it('is a labelled dialog with 3 steps total, announced via the live region', async () => {
    const user = userEvent.setup();
    renderOverlay();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/paso 1 de 3/i)).toBeInTheDocument();

    await next(user, 2);
    expect(screen.getByText(/paso 3 de 3/i)).toBeInTheDocument();
  });

  it("the last step's primary button reads Empezar, not Siguiente (the club step is last)", async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2);
    expect(screen.getByRole('button', { name: /empezar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^siguiente$/i })).not.toBeInTheDocument();
  });

  it('the "Así funciona" step shows only title + preamble in the carousel — the numbered list is guideOnly-only', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 1);
    expect(screen.getByText(/así funciona/i)).toBeInTheDocument();
    expect(screen.getByText(/lo creas con un chat de ia/i)).toBeInTheDocument();
    expect(screen.queryByText(/responde unas preguntas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/llm es simplemente/i)).not.toBeInTheDocument();
  });

  it('Atrás moves back a step from the club step', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2); // now on step 3 — club
    expect(screen.getByText(/tu gimnasio/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /atrás/i }));
    expect(screen.getByText(/paso 2 de 3/i)).toBeInTheDocument();
  });

  it('Escape on an info step closes immediately, same as before (AC8 a11y contract survives)', () => {
    const onClose = vi.fn();
    renderOverlay(onClose);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(markOnboardingSeen).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('OnboardingOverlay — club step opens ClubPickerSheet and reflects the selection (AC3)', () => {
  it('opens ClubPickerSheet when its trigger is clicked', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2);

    await user.click(screen.getByRole('button', { name: /elegir club/i }));

    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.some((d) => d.getAttribute('aria-labelledby') === 'club-picker-title')).toBe(true);
  });

  it("shows the stored club's name and address once one is already selected", async () => {
    localStorage.setItem('rutina:club', JSON.stringify(TEST_CLUB));
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2);

    expect(screen.getByText(/Alameda/)).toBeInTheDocument();
    expect(screen.getByText(/Av\. de Andaluc[íi]a 12/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar club/i })).toBeInTheDocument();
  });
});

describe('OnboardingOverlay — no step asks for the output language (AC4)', () => {
  it('the input step offers no language selector — field 7 is derived from step 1', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2);
    expect(screen.queryByRole('radiogroup', { name: /idioma|language/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /idioma|language/i })).not.toBeInTheDocument();
  });
});

describe('OnboardingOverlay — Skip/Next never blocks (AC5)', () => {
  it('Siguiente with the club left unset still reaches the end and finishes onboarding', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(onClose);

    await next(user, 2);
    await user.click(screen.getByRole('button', { name: /empezar/i }));

    expect(markOnboardingSeen).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('OnboardingOverlay — focus moves to the first control on an input step (mockups.md open item #3)', () => {
  it('focuses the club trigger button on entering the club step', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /elegir club/i }));
    });
  });

  it('still focuses the step heading on an info step (unchanged behaviour)', () => {
    renderOverlay();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });
});

describe('OnboardingOverlay — header Skip exits immediately (no draft is collected anymore)', () => {
  it('Saltar exits immediately without a confirm sheet', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(onClose);

    await user.click(screen.getByRole('button', { name: /saltar/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(markOnboardingSeen).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('OnboardingOverlay — switching the UI locale mid-onboarding (AC42)', () => {
  it('re-renders step copy in the new locale, including the club step reached later', async () => {
    const user = userEvent.setup();
    renderOverlay();

    await user.click(screen.getByRole('button', { name: /idioma/i }));
    await user.click(screen.getByRole('radio', { name: /english/i }));

    await next(user, 2);
    expect(screen.getByText(/your gym/i)).toBeInTheDocument();
  });
});

describe('OnboardingOverlay — defensive rendering when storage throws (AC10)', () => {
  it('still renders and remains usable when localStorage reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => renderOverlay()).not.toThrow();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('finishing onboarding does not throw when the write is rejected (quota)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(onClose);
    await next(user, 2);

    await expect(user.click(screen.getByRole('button', { name: /empezar/i }))).resolves.not.toThrow();
    expect(onClose).toHaveBeenCalled();
  });
});
