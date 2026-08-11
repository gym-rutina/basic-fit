import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useI18n, DEFAULT_LOCALE } from './index.js';
import { UI_LANG_KEY } from '../lib/uiLangStorage.js';

/**
 * pwa-ui-language AC22 (tech-plan.md D5).
 *
 * The bound on this feature's diff. ~124 Spanish-literal assertions live
 * across 14 existing test files; rewriting them into dictionary lookups would
 * roughly double the change and make the review useless (DD-3 defers that).
 * Instead the test environment is pinned to `es`, by two mechanisms that cover
 * two different situations — this file exists so that a later change to
 * either one fails loudly here rather than as 124 mystery failures elsewhere.
 */

function Probe() {
  const { locale, t } = useI18n();
  return <span data-testid="probe">{`${locale}|${t('tab.home')}`}</span>;
}

describe('the test environment is pinned to es (AC22)', () => {
  it('has the stored preference set before every test — for anything that mounts the real provider', () => {
    // App.test.jsx renders <App/>, which mounts I18nProvider for real. jsdom
    // reports navigator.language === 'en-US', which AC2 resolves to `en` —
    // that would break four Spanish assertions in that file alone.
    expect(localStorage.getItem(UI_LANG_KEY)).toBe('es');
  });

  it('renders Spanish for a component mounted with no provider at all', () => {
    // The other 13 files render screens and components directly. The context
    // default has to be a working es-pinned value.
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent(`${DEFAULT_LOCALE}|Inicio`);
  });

  it('restores the pin even after a test clears storage', () => {
    // onboardingStorage.test.js calls localStorage.clear() in its own
    // beforeEach; the global pin must be re-applied per test, not once.
    localStorage.clear();
    expect(localStorage.getItem(UI_LANG_KEY)).toBeNull();
    // …and the next test in this file proves it comes back.
  });

  it('is back for the following test', () => {
    expect(localStorage.getItem(UI_LANG_KEY)).toBe('es');
  });
});
