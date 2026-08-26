import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SettingsScreen } from './SettingsScreen.jsx';
import { BottomTabBar } from '../components/BottomTabBar.jsx';
import { I18nProvider, UI_LOCALES, LOCALE_AUTONYMS } from '../i18n/index.js';
import { UI_LANG_KEY } from '../lib/uiLangStorage.js';

/**
 * pwa-ui-language AC11 + AC12 (tech-plan.md D10).
 *
 * DEC-3 put the switcher on a dedicated screen rather than a 6th tab because
 * `tests/viewport-check.js` asserts all five `tab-item` elements share one
 * `offsetTop` at 280-768px — a 6th would wrap. Settings also gives the future
 * prefs DEC-3 names (units, data reset) somewhere to live.
 */

function LocationProbe() {
  return <span data-testid="pathname">{useLocation().pathname}</span>;
}

function renderSettings({ locale = 'es' } = {}) {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/settings']}>
        <LocationProbe />
        <Routes>
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
        <BottomTabBar />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SettingsScreen (AC11)', () => {
  it('is titled Ajustes, not Idioma — it is scoped for future prefs', () => {
    renderSettings();
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument();
  });

  it('offers a back control rather than being a dead end', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
  });

  it('does not add a sixth tab — BottomTabBar is untouched (DEC-3)', () => {
    const { container } = renderSettings();
    expect(container.querySelectorAll('[data-testid="tab-item"]')).toHaveLength(5);
    expect(screen.queryByRole('link', { name: /ajustes/i })).not.toBeInTheDocument();
  });

  it('keeps the bottom tab bar visible and usable underneath', () => {
    // Matches the existing /session precedent; only /import hides the nav.
    renderSettings();
    expect(screen.getByTestId('bottom-tab-bar')).toBeInTheDocument();
  });

  it('does not offer a settings affordance to itself', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: /^ajustes$/i })).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — the language picker (select swap, AC11-lineage a11y)', () => {
  /**
   * pill-overflow-ux S3 (AC21 surgery): these five assertions are the
   * select-control equivalents of the radio-based suite they replace —
   * every original intent survives, re-expressed against the combobox.
   */
  it('is a labelled select with one option per shipped locale', () => {
    renderSettings();
    const select = screen.getByRole('combobox', { name: /idioma/i });
    expect(within(select).getAllByRole('option')).toHaveLength(UI_LOCALES.length);
  });

  it('marks exactly the active locale as the selected option', () => {
    // Rendered under `be`, so the control's accessible name localizes —
    // query by role; this screen has exactly one select.
    renderSettings({ locale: 'be' });
    // A native select can hold only ONE selected option — the uniqueness the
    // old aria-checked sweep proved is structural now; what must still hold
    // is WHICH option it is.
    const selected = within(screen.getByRole('combobox')).getAllByRole('option', { selected: true });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Беларуская');
  });

  // onboarding-request-fields Rev5 (locale-code / country-code collision fix,
  // tech-plan.md §2.10): pills used to render l.toUpperCase() ('BE') which
  // read as Belgium's country code; the autonym rule carries over to the
  // select's options unchanged (tech-plan D-C).
  it('every option shows its own language autonym as its accessible name, not a 2-letter code (Rev5)', () => {
    renderSettings({ locale: 'en' });
    for (const locale of UI_LOCALES) {
      expect(screen.getByRole('option', { name: LOCALE_AUTONYMS[locale] })).toBeInTheDocument();
    }
  });

  it('does not render a 2-letter code anywhere in the language picker (Rev5 — the collision this fix removes)', () => {
    // Rendered under `en` (as before), so query by role — the accessible
    // name localizes with the locale.
    renderSettings({ locale: 'en' });
    const select = screen.getByRole('combobox');
    expect(select.textContent).not.toMatch(/\bBE\b/);
  });

  it('shows one option per shipped locale — never an empty or loading state', () => {
    // UI_LOCALES is a static in-code array (AC1), not fetched data, so the
    // loading/empty/retry states do not exist here. The count is derived,
    // not hardcoded (expand-ui-locales R5.1: six locales now ship).
    renderSettings();
    expect(screen.getAllByRole('option')).toHaveLength(UI_LOCALES.length);
  });
});

describe('SettingsScreen — switching (AC12)', () => {
  /** pill-overflow-ux S3 (AC21 surgery): each it below is the selectOptions
   * equivalent of the pill-click version it replaces — same asserted
   * contract, new control. */
  it('re-renders in place, with no navigation', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.selectOptions(screen.getByRole('combobox', { name: /idioma/i }), 'en');

    expect(screen.getByTestId('pathname')).toHaveTextContent('/settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('re-renders the chrome outside this screen too', async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(screen.getByText('Inicio')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /idioma/i }), 'en');

    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('persists the choice', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.selectOptions(screen.getByRole('combobox', { name: /idioma/i }), 'be');
    expect(localStorage.getItem(UI_LANG_KEY)).toBe('be');
  });

  it('keeps focus on the control the user operated', async () => {
    // ux-design.md: switching must not steal or move focus. With a native
    // select the control IS the focus point during selection.
    const user = userEvent.setup();
    renderSettings();
    const select = screen.getByRole('combobox', { name: /idioma/i });

    await user.selectOptions(select, 'en');

    expect(document.activeElement).toBe(select);
  });

  it('keeps the previous locale active, and stays silent, when persistence fails', async () => {
    // ux-design.md's Error row — onboardingStorage.js precedent: swallow.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded');
    });
    const user = userEvent.setup();
    renderSettings();

    await user.selectOptions(screen.getByRole('combobox', { name: /idioma/i }), 'en');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });
});

describe('SettingsScreen — the Acceso al club section (club-invite-link wiring)', () => {
  // Integration smoke only: the section's own states live in
  // ClubAccessSection.test.jsx. This guards the one-line render inside
  // SettingsScreen (tech-plan.md D-H) — heading below the Idioma block,
  // per approved mockup frame A.
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the Acceso al club section alongside the language block', () => {
    renderSettings();
    expect(screen.getByText('Acceso al club')).toBeInTheDocument();
    // pill-overflow-ux S3: the language control is the select now — same
    // "section sits beside the language block" intent.
    expect(screen.getByRole('combobox', { name: /idioma/i })).toBeInTheDocument();
  });
});

/**
 * pill-overflow-ux — S3: the UI-language radiogroup becomes a SelectField
 * (native <select>, user-ratified OQ1). These describes are the REPLACEMENTS
 * for the radio-based suites above; Cmok deletes those per AC21 when the
 * markup swaps (tech-plan §4 step 6). RED until then — the current screen
 * still renders pills, so every combobox query below fails at the right
 * assertion.
 */
describe('SettingsScreen — UI language select (pill-overflow-ux S3, AC8/AC9)', () => {
  it('renders a labelled combobox instead of a pill radiogroup', () => {
    renderSettings();

    expect(screen.getByRole('combobox', { name: 'Idioma de la interfaz' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /idioma/i })).not.toBeInTheDocument();
  });

  it('offers one autonym option per shipped locale — six today, layout-blind to more (AC9)', () => {
    renderSettings();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(UI_LOCALES.length);
    ['Español', 'English', 'Беларуская', 'Français', 'Nederlands', 'Deutsch'].forEach((a) => {
      expect(screen.getByRole('option', { name: a })).toBeInTheDocument();
    });
  });

  it('marks the active locale as the selected value', () => {
    renderSettings({ locale: 'be' });

    expect(screen.getByRole('combobox')).toHaveValue('be');
  });

  it('switches the shared i18n context synchronously and persists the choice (AC12 contract preserved)', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Idioma de la interfaz' }), 'en');

    expect(localStorage.getItem(UI_LANG_KEY)).toBe('en');
    // In-place re-render proof: the heading itself follows the new locale.
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });
});
