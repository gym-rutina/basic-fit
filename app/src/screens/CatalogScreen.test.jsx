import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CatalogScreen } from './CatalogScreen.jsx';
import { I18nProvider } from '../i18n/index.js';

/**
 * pwa-ui-language AC13 + AC14 (tech-plan.md D12).
 *
 * DEC-4's shape: one mental model ("the app's language") for 95% of use, plus
 * the ability to look up an English machine name from a Spanish UI. The
 * override is transient — it belongs to this screen, not to the user's
 * preferences, so it is never persisted and it never touches the chrome
 * around it.
 *
 * ux-design.md is explicit that the `Idioma` pill row is unchanged
 * pixel-for-pixel. Only its DEFAULT changes.
 */

const CHEST_PRESS = { es: 'Prensa de Pecho', en: 'Chest Press', be: 'Жым ад грудзей' };

function renderCatalog(locale) {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/catalog']}>
        <CatalogScreen />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('equipment text follows the UI locale app-wide (AC13)', () => {
  it('renders equipment names in the active UI locale, not hardcoded Spanish', () => {
    renderCatalog('en');
    expect(screen.getByText(CHEST_PRESS.en)).toBeInTheDocument();
    expect(screen.queryByText(CHEST_PRESS.es)).not.toBeInTheDocument();
  });

  it('renders Belarusian equipment names when the UI is Belarusian', () => {
    renderCatalog('be');
    expect(screen.getByText(CHEST_PRESS.be)).toBeInTheDocument();
  });
});

describe('the Catálogo override (AC14)', () => {
  it('defaults to the active UI locale instead of hardcoding es', () => {
    // CatalogScreen.jsx:31 used to be useState('es') regardless of anything.
    // Asserted through the rendered equipment text rather than the pill's
    // styling: AC14 keeps FilterPill unchanged, so "which pill is active" has
    // no accessible marker on this screen by design.
    renderCatalog('be');
    expect(screen.getByText(CHEST_PRESS.be)).toBeInTheDocument();
    expect(screen.queryByText(CHEST_PRESS.es)).not.toBeInTheDocument();
  });

  it('changes equipment text only — the chrome around it stays in the UI locale', async () => {
    // This is the whole point of DEC-4: look up an English machine name
    // without your app turning English.
    const user = userEvent.setup();
    renderCatalog('es');
    expect(screen.getByText(CHEST_PRESS.es)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(screen.getByText(CHEST_PRESS.en)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Catálogo de equipamiento' })).toBeInTheDocument();
  });

  it('is not persisted', async () => {
    const user = userEvent.setup();
    renderCatalog('es');

    await user.click(screen.getByRole('button', { name: 'BE' }));

    expect(localStorage.length).toBe(0);
  });

  it('resets to the UI locale when the tab is left and re-entered', async () => {
    const user = userEvent.setup();
    const first = renderCatalog('es');

    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText(CHEST_PRESS.en)).toBeInTheDocument();

    first.unmount();
    renderCatalog('es');

    expect(screen.getByText(CHEST_PRESS.es)).toBeInTheDocument();
  });

  it('keeps the pill row rendering the data languages, in data order', () => {
    // equipment.json's metadata.languages is ['en','es','be']; UI_LOCALES is
    // ['es','en','be']. AC14 keeps the row data-driven, so its visual order
    // does not change.
    renderCatalog('es');
    const labels = screen
      .getAllByRole('button', { name: /^(EN|ES|BE)$/ })
      .map((p) => p.textContent.trim());
    expect(labels).toEqual(['EN', 'ES', 'BE']);
  });
});

describe('Catálogo chrome is migrated (AC6)', () => {
  it('translates the screen title and the category filter labels', () => {
    renderCatalog('en');
    expect(screen.getByRole('heading', { level: 1, name: 'Equipment catalog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Todas' })).not.toBeInTheDocument();
  });
});
