import React from 'react';
import { SheetShell } from './sheet/SheetShell.jsx';
import { useI18n, UI_LOCALES, LOCALE_AUTONYMS } from '../i18n/index.js';

/**
 * pwa-ui-language Q2 (tech-plan.md D11) — the onboarding step-1 language
 * picker. A NEW component, not a `ConfirmSheet` prop: `ConfirmSheet` is
 * `role="alertdialog"` with a button-only focus set and three shipped call
 * sites; this sheet is `role="dialog"` containing a `role="radiogroup"` of
 * `role="radio"` rows, a different semantic shape. Both now sit on the shared
 * SheetShell (fixed dim overlay, `--radius-lg` top corners, Tab-trap,
 * Escape → close, focus restore on unmount, safe-area bottom padding); this
 * component owns only the radiogroup semantics. Like ConfirmSheet it keeps
 * its historical no-scrim-dismiss contract (`scrimCloses={false}`).
 *
 * Ships no disabled "coming soon" rows — those were illustrative in the
 * UAT mockup only. The sheet lists `UI_LOCALES` and nothing else; a disabled
 * row for a language the app cannot switch to is a promise the code would
 * have to keep.
 */
export function LanguageSheet({ onClose }) {
  const { locale, setLocale, t } = useI18n();

  function handleSelect(next) {
    setLocale(next);
    onClose && onClose();
  }

  return (
    <SheetShell onClose={onClose} labelledBy="language-sheet-title" scrimCloses={false} trapFocus>
      <h3 id="language-sheet-title" style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 var(--space-4)' }}>
        {t('settings.languageHeading')}
      </h3>

      <div role="radiogroup" aria-labelledby="language-sheet-title" style={{ display: 'grid' }}>
        {UI_LOCALES.map((l) => {
          const checked = locale === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${t('settings.languageHeading')} ${LOCALE_AUTONYMS[l]}`}
              onClick={() => handleSelect(l)}
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                width: '100%',
                minHeight: 44,
                padding: '12px 4px',
                borderTop: '1px solid var(--border-default)',
                font: checked ? '700 15px/1.3 var(--font-sans)' : '600 15px/1.3 var(--font-sans)',
                color: checked ? 'var(--bf-purple)' : 'var(--bf-ink)',
              }}
            >
              <span>{LOCALE_AUTONYMS[l]}</span>
              {checked && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'var(--bf-grey-2)', margin: 'var(--space-3) 0' }} />

      <button
        type="button"
        onClick={() => onClose && onClose()}
        style={{
          all: 'unset',
          boxSizing: 'border-box',
          cursor: 'pointer',
          width: '100%',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '600 15px/1.2 var(--font-sans)',
          color: 'var(--bf-ink-2)',
        }}
      >
        {t('common.cancel')}
      </button>
    </SheetShell>
  );
}
