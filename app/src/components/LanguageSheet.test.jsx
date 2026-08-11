import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LanguageSheet } from './LanguageSheet.jsx';
import { OnboardingOverlay } from './OnboardingOverlay.jsx';
import { I18nProvider, useI18n, UI_LOCALES, LOCALE_AUTONYMS } from '../i18n/index.js';
import { UI_LANG_KEY } from '../lib/uiLangStorage.js';

/**
 * pwa-ui-language Q2, resolved in ux-design.md's 2026-08-10 UAT revision
 * (tech-plan.md D11).
 *
 * The control is a compact trigger + bottom sheet rather than a pill row
 * because Basic-Fit adds a language every time it opens in a new country, and
 * a pill row grows one pill per language inside onboarding's tight step-1
 * layout. The sheet reuses `ConfirmSheet.jsx`'s MECHANICS (dim overlay, Tab
 * trap, Escape, focus restore) but not the component itself — that one is
 * role="alertdialog" with a button-only focus set and three shipped call
 * sites.
 */

function Harness({ onClose = vi.fn() }) {
  const { locale } = useI18n();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button type="button">before</button>
      <LanguageSheet onClose={onClose} />
    </div>
  );
}

function renderSheet({ locale = 'es', onClose = vi.fn() } = {}) {
  return {
    onClose,
    ...render(
      <I18nProvider initialLocale={locale}>
        <Harness onClose={onClose} />
      </I18nProvider>
    ),
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('LanguageSheet — semantics (Q2)', () => {
  it('is a modal dialog', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('presents the locales as a radiogroup, not a list of buttons', () => {
    renderSheet();
    const group = screen.getByRole('radiogroup');
    expect(within(group).getAllByRole('radio')).toHaveLength(UI_LOCALES.length);
  });

  it('labels each option with its own autonym, so it is readable from any UI language', () => {
    renderSheet({ locale: 'be' });
    for (const locale of UI_LOCALES) {
      expect(screen.getByRole('radio', { name: new RegExp(LOCALE_AUTONYMS[locale]) })).toBeInTheDocument();
    }
  });

  it('marks exactly the active locale as checked', () => {
    renderSheet({ locale: 'en' });
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAccessibleName(new RegExp(LOCALE_AUTONYMS.en));
  });

  it('ships no disabled "coming soon" rows — the mockup used them illustratively (D11)', () => {
    // A disabled row for a language the app cannot switch to is a promise the
    // code would have to keep.
    renderSheet();
    expect(screen.queryByText(/français/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nederlands/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio', { hidden: true }).filter((r) => r.getAttribute('aria-disabled') === 'true')).toHaveLength(0);
  });
});

describe('LanguageSheet — behaviour (Q2, AC12)', () => {
  it('switches the locale and closes on selection', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet({ locale: 'es' });

    await user.click(screen.getByRole('radio', { name: new RegExp(LOCALE_AUTONYMS.be) }));

    expect(screen.getByTestId('locale')).toHaveTextContent('be');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('persists the choice like any other switch', async () => {
    const user = userEvent.setup();
    renderSheet({ locale: 'es' });
    await user.click(screen.getByRole('radio', { name: new RegExp(LOCALE_AUTONYMS.en) }));
    expect(localStorage.getItem(UI_LANG_KEY)).toBe('en');
  });

  it('closes on Escape without changing anything', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet({ locale: 'es' });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });

  it('closes on Cancelar without changing anything', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet({ locale: 'es' });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('locale')).toHaveTextContent('es');
  });
});

describe('LanguageSheet — focus containment reused from ConfirmSheet (Q2)', () => {
  it('moves focus into the sheet on mount', () => {
    renderSheet();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('restores focus to whatever opened it on unmount', () => {
    // Strengthened per Bagnik's code-QA note (handoff-log.md): the previous
    // version only asserted `document.activeElement` is truthy, which is
    // true of `document.body` too and would pass with no focus-restore at
    // all. A real opener must be focused BEFORE the sheet mounts — Harness
    // mounts both at once, so this uses a toggle to reproduce the real
    // onboarding sequence (focus trigger -> open sheet -> close -> focus
    // returns to the trigger).
    function Toggle() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            before
          </button>
          {open && <LanguageSheet onClose={() => setOpen(false)} />}
        </div>
      );
    }
    render(
      <I18nProvider initialLocale="es">
        <Toggle />
      </I18nProvider>
    );

    const opener = screen.getByRole('button', { name: 'before' });
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.activeElement).not.toBe(opener);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it('traps Tab inside the sheet', async () => {
    const user = userEvent.setup();
    renderSheet();
    const dialog = screen.getByRole('dialog');

    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

describe('onboarding step 1 — trigger + sheet (Q2)', () => {
  it('shows a compact trigger labelled with the current locale autonym', () => {
    render(
      <I18nProvider initialLocale="en">
        <OnboardingOverlay onClose={vi.fn()} />
      </I18nProvider>
    );
    const trigger = screen.getByRole('button', { name: /language/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveTextContent(LOCALE_AUTONYMS.en);
  });

  it('does not gate Siguiente — the language row is a hint, not a step', () => {
    render(
      <I18nProvider initialLocale="es">
        <OnboardingOverlay onClose={vi.fn()} />
      </I18nProvider>
    );
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('re-renders the rest of onboarding in the language just picked', async () => {
    // ux-design.md: seeing onboarding itself change language IS the
    // confirmation — stronger evidence than a checkmark or toast.
    const user = userEvent.setup();
    render(
      <I18nProvider initialLocale="es">
        <OnboardingOverlay onClose={vi.fn()} />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /idioma/i }));
    await user.click(screen.getByRole('radio', { name: new RegExp(LOCALE_AUTONYMS.en) }));

    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('only appears on step 1', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider initialLocale="es">
        <OnboardingOverlay onClose={vi.fn()} />
      </I18nProvider>
    );
    expect(screen.getByRole('button', { name: /idioma/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.queryByRole('button', { name: /idioma/i })).not.toBeInTheDocument();
  });
});
