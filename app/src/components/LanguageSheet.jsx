import React, { useEffect, useRef } from 'react';
import { useI18n, UI_LOCALES, LOCALE_AUTONYMS } from '../i18n/index.js';

/**
 * pwa-ui-language Q2 (tech-plan.md D11) — the onboarding step-1 language
 * picker. A NEW component, not a `ConfirmSheet` prop: `ConfirmSheet` is
 * `role="alertdialog"` with a button-only focus set and three shipped call
 * sites; this sheet is `role="dialog"` containing a `role="radiogroup"` of
 * `role="radio"` rows, a different semantic shape. It COPIES `ConfirmSheet`'s
 * mechanics verbatim (fixed dim overlay, `--radius-lg` top corners, Tab-trap,
 * Escape → cancel, focus restore on unmount, safe-area bottom padding) and
 * owns the radiogroup semantics itself.
 *
 * Ships no disabled "coming soon" rows — those were illustrative in the
 * UAT mockup only. The sheet lists `UI_LOCALES` and nothing else; a disabled
 * row for a language the app cannot switch to is a promise the code would
 * have to keep.
 */
export function LanguageSheet({ onClose }) {
  const { locale, setLocale, t } = useI18n();
  const sheetRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const focusables = sheetRef.current
      ? Array.from(sheetRef.current.querySelectorAll('button:not(:disabled)'))
      : [];
    if (focusables[0]) focusables[0].focus();
    return () => {
      const toRestore = previouslyFocusedRef.current;
      if (toRestore && typeof toRestore.focus === 'function') toRestore.focus();
    };
  }, []);

  function focusableButtons() {
    return sheetRef.current ? Array.from(sheetRef.current.querySelectorAll('button:not(:disabled)')) : [];
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      onClose && onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = focusableButtons();
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function handleSelect(next) {
    setLocale(next);
    onClose && onClose();
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,45,.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-sheet-title"
        style={{
          background: 'var(--bf-white)',
          width: '100%',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          paddingTop: 'var(--space-6)',
          paddingInline: 'var(--page-pad-x)',
          paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
        }}
      >
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
      </div>
    </div>
  );
}
