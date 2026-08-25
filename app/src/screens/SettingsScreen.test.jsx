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

describe('SettingsScreen — the language picker (AC11, a11y)', () => {
  it('is a radiogroup with one option per shipped locale', () => {
    renderSettings();
    const group = screen.getByRole('radiogroup', { name: /idioma/i });
    expect(within(group).getAllByRole('radio')).toHaveLength(UI_LOCALES.length);
  });

  it('marks exactly the active locale as checked', () => {
    renderSettings({ locale: 'be' });
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent('Беларуская');
  });

  // onboarding-request-fields Rev5 (locale-code / country-code collision fix,
  // tech-plan.md §2.10): pills themselves now render the autonym directly —
  // l.toUpperCase() ('BE') read as Belgium's country code, visually
  // indistinguishable from the Belarusian language pill. The now-redundant
  // muted subtitle line that used to carry this same text a second time is
  // REMOVED (two elements with identical text would break getByText's
  // single-match assumption), so this test moves from asserting the subtitle
  // to asserting the pills' own accessible names directly.
  it('every pill shows its own language autonym as its accessible name, not a 2-letter code (Rev5)', () => {
    renderSettings({ locale: 'en' });
    for (const locale of UI_LOCALES) {
      expect(screen.getByRole('radio', { name: LOCALE_AUTONYMS[locale] })).toBeInTheDocument();
    }
  });

  it('does not render a 2-letter code anywhere in the language picker (Rev5 — the collision this fix removes)', () => {
    renderSettings({ locale: 'en' });
    const group = screen.getByRole('radiogroup', { name: /language/i });
    expect(group.textContent).not.toMatch(/\bBE\b/);
  });

  it('shows one option per shipped locale — never an empty or loading state', () => {
    // UI_LOCALES is a static in-code array (AC1), not fetched data, so the
    // loading/empty/retry states do not exist here. The count is derived,
    // not hardcoded (expand-ui-locales R5.1: six locales now ship).
    renderSettings();
    expect(screen.getAllByRole('radio')).toHaveLength(UI_LOCALES.length);
  });
});

describe('SettingsScreen — switching (AC12)', () => {
  it('re-renders in place, with no navigation', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('radio', { name: /english/i }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('re-renders the chrome outside this screen too', async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(screen.getByText('Inicio')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /english/i }));

    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('persists the choice', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('radio', { name: /беларуская/i }));
    expect(localStorage.getItem(UI_LANG_KEY)).toBe('be');
  });

  it('keeps focus on the option the user tapped', async () => {
    // ux-design.md: switching must not steal or move focus.
    const user = userEvent.setup();
    renderSettings();
    const option = screen.getByRole('radio', { name: /english/i });

    await user.click(option);

    expect(document.activeElement).toBe(screen.getByRole('radio', { name: /english/i }));
  });

  it('keeps the previous locale active, and stays silent, when persistence fails', async () => {
    // ux-design.md's Error row — onboardingStorage.js precedent: swallow.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded');
    });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('radio', { name: /english/i }));

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
    expect(screen.getByRole('radiogroup', { name: /idioma/i })).toBeInTheDocument();
  });
});
