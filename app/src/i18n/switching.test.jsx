import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { I18nProvider, useI18n, UI_LOCALES } from './index.js';
import { BottomTabBar } from '../components/BottomTabBar.jsx';
import { UI_LANG_KEY } from '../lib/uiLangStorage.js';

/**
 * pwa-ui-language AC6 (chrome is migrated), AC7 (accessible names are strings
 * too) and AC12 (the switch is immediate and lossless).
 *
 * AC12's real claim is a negative one: switching must NOT remount the tree.
 * The uncontrolled input below is the instrument — its value only survives if
 * the switch is a re-render rather than a reload, a navigation, or a keyed
 * remount.
 */

function Switcher() {
  const { setLocale } = useI18n();
  return (
    <div>
      {UI_LOCALES.map((l) => (
        <button key={l} type="button" onClick={() => setLocale(l)}>
          {`switch-${l}`}
        </button>
      ))}
    </div>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="pathname">{location.pathname}</span>;
}

function renderShell() {
  return render(
    <I18nProvider initialLocale="es">
      <MemoryRouter initialEntries={['/history']}>
        <LocationProbe />
        <BottomTabBar />
        <Switcher />
        <label htmlFor="scratch">scratch</label>
        <input id="scratch" defaultValue="" />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe('switching the UI locale (AC6)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('re-renders the bottom tab labels in the new language', async () => {
    const user = userEvent.setup();
    renderShell();

    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Historial')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'switch-en' }));

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'switch-be' }));

    expect(screen.getByText('Галоўная')).toBeInTheDocument();
    expect(screen.getByText('Гісторыя')).toBeInTheDocument();
  });
});

describe('accessible names follow the locale (AC7)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('translates the navigation landmark label, not just the visible tab text', async () => {
    // BottomTabBar's aria-label="Navegación principal" is invisible to a
    // sighted user and therefore the easiest string in the app to forget.
    const user = userEvent.setup();
    renderShell();

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'switch-en' }));

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
  });
});

describe('the switch is lossless (AC12)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('keeps the current route', async () => {
    const user = userEvent.setup();
    renderShell();

    expect(screen.getByTestId('pathname')).toHaveTextContent('/history');
    await user.click(screen.getByRole('button', { name: 'switch-be' }));
    expect(screen.getByTestId('pathname')).toHaveTextContent('/history');
  });

  it('keeps uncontrolled form input — the tree re-renders, it does not remount', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.type(screen.getByLabelText('scratch'), 'sesión en curso');
    await user.click(screen.getByRole('button', { name: 'switch-en' }));

    expect(screen.getByLabelText('scratch')).toHaveValue('sesión en curso');
  });

  it('does not add an aria-live announcement for the switch', async () => {
    // ux-design.md: an announcement would fire in whichever language was just
    // left. The surrounding copy changing IS the observable outcome.
    const user = userEvent.setup();
    const { container } = renderShell();

    const before = container.querySelectorAll('[aria-live]').length;
    await user.click(screen.getByRole('button', { name: 'switch-en' }));
    expect(container.querySelectorAll('[aria-live]').length).toBe(before);
  });
});
