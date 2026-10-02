import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingOverlay } from './OnboardingOverlay.jsx';
import { PROMPT_REQUEST_KEY } from '../lib/promptRequestStorage.js';
import { I18nProvider } from '../i18n/index.js';

/**
 * onboarding-request-fields R1.1-R1.8, R2, D6 (tech-plan.md §2.7).
 *
 * Pending Cmok implementation — see tech-plan.md. Failures here are expected
 * until Cmok implements the 4 new input steps (club/name+goal/schedule/
 * injuries) in OnboardingOverlay.jsx + onboardingContent.js.
 *
 * REPLACES the prior feature's 4-info-step test file wholesale (Rev4-SF2/SF3
 * deliberately moved the step count from 4 info steps to 2 info + 4 input —
 * see onboardingContent.test.js's equivalent note). Label text below is
 * pinned to the copy already shown (and UAT-approved) in mockups.md's
 * wireframes — "Tu gimnasio", "Nombre / programa", "Objetivo principal",
 * "Tu horario" / "Días por semana" / "Duración de la sesión", "Lesiones o
 * movimientos a evitar" — not invented here.
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

const useClubExclusionsMock = vi.hoisted(() =>
  vi.fn(() => ({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false }))
);
vi.mock('../lib/useClubExclusions.js', () => ({ useClubExclusions: useClubExclusionsMock }));

import { markOnboardingSeen } from '../lib/onboardingStorage.js';

const TEST_CLUB = {
  countryCode: 'ES',
  clubId: '1ec43550fd654c7d8e23bc6c96cd2ff0',
  name: 'Alameda',
  address: 'Av. de Andalucía 12',
  city: 'Málaga',
};

// Cmok fix: wrapped in a REAL I18nProvider (initialLocale="es" — deterministic
// regardless of localStorage/navigator.language — matches every other test's
// existing assumption that the overlay starts in Spanish). Without a provider,
// `useI18n()` resolves to the frozen default context value whose `setLocale`
// is a no-op (`() => {}`), which would make the AC42 locale-switch test below
// silently do nothing — LanguageSheet's "select English" click would never
// actually change anything, and the test's own final assertion (an English
// field label) could never pass. `next()` below is loosened to match the
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
  useClubExclusionsMock.mockReturnValue({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false });
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

  it('shows only the "Así funciona" step: no step counter, no language trigger, no Siguiente/Atrás', () => {
    renderGuideOnly();
    expect(screen.getByRole('heading', { name: /así funciona/i })).toBeInTheDocument();
    expect(screen.queryByText(/paso \d de \d/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /idioma|language/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /atrás/i })).not.toBeInTheDocument();
  });

  it.each([
    ['the primary button', async (user) => user.click(screen.getAllByRole('button', { name: /cerrar/i })[1])],
    ['the header button', async (user) => user.click(screen.getAllByRole('button', { name: /cerrar/i })[0])],
  ])('closes via %s without persisting a draft or marking onboarding seen', async (_label, close) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderGuideOnly(onClose);
    await close(user);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(markOnboardingSeen).not.toHaveBeenCalled();
    expect(localStorage.getItem(PROMPT_REQUEST_KEY)).toBeNull();
  });

  it('Escape closes it immediately', () => {
    const onClose = vi.fn();
    renderGuideOnly(onClose);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingOverlay — overall shape (AC1, AC8)', () => {
  it('is a labelled dialog with 6 steps total, announced via the live region', async () => {
    const user = userEvent.setup();
    renderOverlay();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/paso 1 de 6/i)).toBeInTheDocument();

    await next(user, 5);
    expect(screen.getByText(/paso 6 de 6/i)).toBeInTheDocument();
  });

  it('the last step\'s primary button reads Empezar, not Siguiente (Rev3 — injuries is last)', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 5);
    expect(screen.getByRole('button', { name: /empezar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^siguiente$/i })).not.toBeInTheDocument();
  });

  it('Atrás moves back a step from an input step', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2); // now on step 3 — club
    expect(screen.getByText(/tu gimnasio/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /atrás/i }));
    expect(screen.getByText(/paso 2 de 6/i)).toBeInTheDocument();
  });

  it('Escape on an info step (no draft yet) closes immediately, same as before (AC8 a11y contract survives)', () => {
    const onClose = vi.fn();
    renderOverlay(onClose);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(markOnboardingSeen).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('OnboardingOverlay — input steps present purpose/usage/example content (AC1, AC2)', () => {
  it('step 3 is the club step (field 6)', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2);
    expect(screen.getByText(/tu gimnasio/i)).toBeInTheDocument();
  });

  it('step 4 collects fields 1 and 2 with a label, an explanatory hint and an example for each', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 3);
    expect(screen.getByLabelText(/nombre \/ programa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/objetivo principal/i)).toBeInTheDocument();
    // R1.1 — every input step shows an example, not just a bare label.
    expect(screen.getByText(/ej\.?:/i)).toBeInTheDocument();
  });

  it('step 5 collects fields 3 (days, 1-7 pills) and 4 (duration)', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 4);
    expect(screen.getByText(/tu horario/i)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /d[ií]as por semana/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/duraci[oó]n de la sesi[oó]n/i)).toBeInTheDocument();
  });

  it('step 6 (last) collects field 5 (injuries) as a textarea with a "none" placeholder, not a pre-filled value (R8.4, mockups.md open item #2)', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 5);
    expect(screen.getByText(/lesiones o movimientos a evitar/i)).toBeInTheDocument();
    const textarea = screen.getByLabelText(/lesiones o movimientos a evitar/i);
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe('');
    expect(textarea).toHaveAttribute('placeholder', expect.stringMatching(/ninguna/i));
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

  it('shows the stored club\'s name and address once one is already selected', async () => {
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
  it('none of the 4 input steps offer a language selector — field 7 is derived from step 1', async () => {
    const user = userEvent.setup();
    renderOverlay();
    for (let i = 0; i < 4; i++) {
      await next(user, 1);
      expect(screen.queryByRole('radiogroup', { name: /idioma|language/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /idioma|language/i })).not.toBeInTheDocument();
    }
  });
});

describe('OnboardingOverlay — Skip/Next never blocks (R1.5, D6, AC5)', () => {
  it('Siguiente with every field left empty still reaches the end and finishes onboarding', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(onClose);

    await next(user, 5);
    await user.click(screen.getByRole('button', { name: /empezar/i }));

    expect(markOnboardingSeen).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('finishing with every field empty leaves every field empty on the next reopen (Bagnik test-gate F4 — behavioural, not storage-shape)', async () => {
    const user = userEvent.setup();
    const { unmount } = renderOverlay();
    await next(user, 5);
    await user.click(screen.getByRole('button', { name: /empezar/i }));
    unmount();

    const user2 = userEvent.setup();
    renderOverlay();
    await next(user2, 3);
    expect(screen.getByLabelText(/nombre \/ programa/i)).toHaveValue('');
    expect(screen.getByLabelText(/objetivo principal/i)).toHaveValue('');
  });

  it('a filled field persists once Empezar is reached (R1.5 "reaching the end persists whatever was filled")', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 3);
    await user.type(screen.getByLabelText(/nombre \/ programa/i), 'Elena — Fase 2');
    await next(user, 2);
    await user.click(screen.getByRole('button', { name: /empezar/i }));

    const stored = JSON.parse(localStorage.getItem(PROMPT_REQUEST_KEY) || '{}');
    expect(stored.field1).toBe('Elena — Fase 2');
  });
});

describe('OnboardingOverlay — pre-fills from a persisted record (AC6)', () => {
  it('shows the persisted field1/field2 values once step 4 is reached', async () => {
    localStorage.setItem(PROMPT_REQUEST_KEY, JSON.stringify({ field1: 'Elena — Fase 2', field2: 'Hipertrofia' }));
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 3);
    expect(screen.getByLabelText(/nombre \/ programa/i)).toHaveValue('Elena — Fase 2');
    expect(screen.getByLabelText(/objetivo principal/i)).toHaveValue('Hipertrofia');
  });

  it('shows the persisted field3/field4 values once step 5 is reached', async () => {
    localStorage.setItem(PROMPT_REQUEST_KEY, JSON.stringify({ field3: 4, field4: '45-60 min' }));
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 4);
    expect(screen.getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/duraci[oó]n de la sesi[oó]n/i)).toHaveValue('45-60 min');
  });
});

describe('OnboardingOverlay — days-per-week is a 7-pill radiogroup (R1.8, AC7)', () => {
  it('renders exactly 7 selectable options, labelled 1 through 7', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 4);
    const radios = screen.getAllByRole('radio', { name: /^[1-7]$/ });
    expect(radios).toHaveLength(7);
  });

  it('none are checked before the user picks one (unanswered writes nothing, per the rewritten AC7)', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 4);
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(0);
  });

  it('selecting a pill checks exactly that one', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 4);
    await user.click(screen.getByRole('radio', { name: '4' }));
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAccessibleName('4');
  });
});

describe('OnboardingOverlay — focus moves to the first control on an input step (mockups.md open item #3)', () => {
  it('focuses the club trigger button on entering step 3', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 2);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /elegir club/i }));
    });
  });

  it('focuses the first text field on entering step 4', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 3);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/nombre \/ programa/i));
    });
  });

  it('still focuses the step heading on an info step (unchanged behaviour)', () => {
    renderOverlay();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });
});

describe('OnboardingOverlay — header Skip confirmation is conditional on draft content (mockups.md open item #1)', () => {
  it('Saltar exits immediately when no field has been touched (unchanged from before this feature)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(onClose);

    await user.click(screen.getByRole('button', { name: /saltar/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(markOnboardingSeen).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Saltar shows a confirm sheet instead of exiting once a field has a draft value', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(onClose);
    await next(user, 3);
    await user.type(screen.getByLabelText(/nombre \/ programa/i), 'Elena');

    await user.click(screen.getByRole('button', { name: /saltar/i }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirming the sheet persists the draft and exits', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(onClose);
    await next(user, 3);
    await user.type(screen.getByLabelText(/nombre \/ programa/i), 'Elena');
    await user.click(screen.getByRole('button', { name: /saltar/i }));

    const sheet = screen.getByRole('alertdialog');
    await user.click(within(sheet).getByRole('button', { name: /salir/i }));

    expect(markOnboardingSeen).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem(PROMPT_REQUEST_KEY) || '{}');
    expect(stored.field1).toBe('Elena');
  });

  it('cancelling the sheet keeps the user in onboarding with the draft intact', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderOverlay(onClose);
    await next(user, 3);
    await user.type(screen.getByLabelText(/nombre \/ programa/i), 'Elena');
    await user.click(screen.getByRole('button', { name: /saltar/i }));

    const sheet = screen.getByRole('alertdialog');
    await user.click(within(sheet).getByRole('button', { name: /seguir|cancelar/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/nombre \/ programa/i)).toHaveValue('Elena');
  });
});

describe('OnboardingOverlay — switching the UI locale mid-onboarding (AC42)', () => {
  it('re-renders step copy in the new locale, including an input step reached later', async () => {
    const user = userEvent.setup();
    renderOverlay();

    await user.click(screen.getByRole('button', { name: /idioma/i }));
    await user.click(screen.getByRole('radio', { name: /english/i }));

    await next(user, 3);
    expect(screen.getByLabelText(/program name/i)).toBeInTheDocument();
  });
});

describe('OnboardingOverlay — smart hint for field 2 (Rev4-D6, tech-plan.md §2.7 corrected data path)', () => {
  it('falls back to the generic hint when no club is stored', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 3);
    // Generic Rev2 hint mentions categories in the abstract, not concrete club equipment names.
    expect(screen.queryByText(/tienes .* y .* en tu gym/i)).not.toBeInTheDocument();
  });

  it('shows a club-aware hint naming real categories once a club and its equipment are known', async () => {
    localStorage.setItem('rutina:club', JSON.stringify(TEST_CLUB));
    useClubExclusionsMock.mockReturnValue({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false });
    const user = userEvent.setup();
    renderOverlay();
    await next(user, 3);
    expect(screen.getByText(/tienes .* en tu gym/i)).toBeInTheDocument();
  });
});

describe('OnboardingOverlay — defensive rendering when storage throws (AC10)', () => {
  it('still renders and remains usable when promptRequestStorage reads throw', () => {
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
    await next(user, 5);

    await expect(user.click(screen.getByRole('button', { name: /empezar/i }))).resolves.not.toThrow();
    expect(onClose).toHaveBeenCalled();
  });
});
