import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { I18nProvider, useI18n, DEFAULT_LOCALE } from './index.js';
import { UI_LANG_KEY } from '../lib/uiLangStorage.js';

/**
 * pwa-ui-language AC3 (no flash), AC5 (documentElement.lang), AC12
 * (immediate, lossless switch) — tech-plan.md D5, D6, D7.
 */

function Probe({ renders }) {
  const { locale, setLocale, t } = useI18n();
  renders.push(locale);
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="copy">{t('tab.home')}</span>
      <button type="button" onClick={() => setLocale('be')}>
        to-be
      </button>
    </div>
  );
}

function setNavigatorLanguage(value) {
  Object.defineProperty(window.navigator, 'language', { value, configurable: true });
}

describe('I18nProvider (AC3) — synchronous first render, no flash', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'es';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the STORED locale on the very first render, never a second paint', () => {
    // The whole reason AC3 rejects IndexedDB. If the stored value arrived a
    // tick later, `renders[0]` would be the detected locale and the user
    // would see one language repaint into another.
    localStorage.setItem(UI_LANG_KEY, 'be');
    setNavigatorLanguage('es-ES');
    const renders = [];

    render(
      <I18nProvider>
        <Probe renders={renders} />
      </I18nProvider>
    );

    expect(renders[0]).toBe('be');
    expect(screen.getByTestId('copy')).toHaveTextContent('Галоўная');
  });

  it('resolves from navigator.language on a first run with nothing stored', () => {
    setNavigatorLanguage('be-BY');
    const renders = [];

    render(
      <I18nProvider>
        <Probe renders={renders} />
      </I18nProvider>
    );

    expect(renders[0]).toBe('be');
  });

  it('accepts an explicit initialLocale, which wins over storage and detection', () => {
    // Lets tests and future deep-links pin a locale without touching storage.
    localStorage.setItem(UI_LANG_KEY, 'be');
    setNavigatorLanguage('be-BY');
    const renders = [];

    render(
      <I18nProvider initialLocale="en">
        <Probe renders={renders} />
      </I18nProvider>
    );

    expect(renders[0]).toBe('en');
  });

  it('persists the choice so the next boot starts there', async () => {
    setNavigatorLanguage('es-ES');
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe renders={[]} />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: 'to-be' }));

    expect(localStorage.getItem(UI_LANG_KEY)).toBe('be');
  });

  it('keeps the switch applied in-session even when persistence fails', async () => {
    // Private browsing / quota. ux-design.md's Error row: swallow, do not toast.
    setNavigatorLanguage('es-ES');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded');
    });
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe renders={[]} />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: 'to-be' }));

    expect(screen.getByTestId('locale')).toHaveTextContent('be');
  });

  it('ignores a request to switch to a locale it does not ship', async () => {
    setNavigatorLanguage('es-ES');
    let setLocaleRef;
    function Grab() {
      setLocaleRef = useI18n().setLocale;
      return null;
    }
    render(
      <I18nProvider>
        <Probe renders={[]} />
        <Grab />
      </I18nProvider>
    );

    act(() => setLocaleRef('klingon'));

    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });
});

describe('documentElement.lang (AC5)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'es';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('is set from the resolved locale at mount, overriding index.html s static lang="es"', () => {
    setNavigatorLanguage('en-GB');
    render(
      <I18nProvider>
        <Probe renders={[]} />
      </I18nProvider>
    );
    expect(document.documentElement.lang).toBe('en');
  });

  it('is updated on every switch', async () => {
    setNavigatorLanguage('es-ES');
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe renders={[]} />
      </I18nProvider>
    );
    expect(document.documentElement.lang).toBe('es');

    await user.click(screen.getByRole('button', { name: 'to-be' }));

    expect(document.documentElement.lang).toBe('be');
  });
});

describe('useI18n without a provider (AC22, tech-plan.md D5)', () => {
  it('renders Spanish instead of throwing', () => {
    // 14 existing test files render screens and components directly, never
    // through <App/>. None of them will be touched (AC22), so the context
    // default has to be a working es-pinned value, not null.
    expect(() => render(<Probe renders={[]} />)).not.toThrow();
    expect(screen.getByTestId('locale')).toHaveTextContent(DEFAULT_LOCALE);
    expect(screen.getByTestId('copy')).toHaveTextContent('Inicio');
  });
});
