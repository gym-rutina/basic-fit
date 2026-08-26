import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { foldForSearch } from '../lib/clubFilter.js';
import { useI18n } from '../i18n/index.js';

/**
 * pill-overflow-ux S4 (tech-plan.md D-D) — the Progreso exercise picker's
 * searchable sheet, contract-cloned from ClubPickerSheet: bottom sheet,
 * role="dialog"/aria-modal, close-button autofocus on mount, Escape/scrim/✕
 * → onClose, focus restored to `returnFocusTo.ref` on unmount (default: the
 * previously focused element).
 *
 * OQ3 answered by REUSE, not new matching code: both the query and every item
 * label go through lib/clubFilter.js's foldForSearch (NFD strip diacritics +
 * lowercase), so «FRANCÉS» matches «Press francés». Sorting is ascending on
 * the FOLDED label (code-unit order, deliberately not localeCompare — no
 * environment-dependent collator surprises) so Á/A sort together (AC11).
 *
 * The no-results line carries role="status" — announced ONCE when it appears
 * (the one announcement ux §8 left to arch). Intermediate count changes stay
 * silent: focus lives in the input and shrinking rows are visible enough.
 *
 * Props:
 *   items         — [{ key, label }]; labels arrive PRE-DISAMBIGUATED with
 *                   collisionSuffix by ProgressScreen.
 *   selectedKey   — the active exercise key; its row is marked aria-current.
 *   onSelect(key) — called once per row activation, immediately before onClose.
 *   onClose()     — Escape / scrim / ✕ / row activation.
 *   returnFocusTo — optional { current: HTMLElement } focus target restored
 *                   on unmount (ClubPickerSheet's own convention).
 */
export function ExercisePickerSheet({ items = [], selectedKey, onSelect, onClose, returnFocusTo }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const closeRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      const toRestore = returnFocusTo?.current ?? previouslyFocusedRef.current;
      if (toRestore && typeof toRestore.focus === 'function') toRestore.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only, mirroring ClubPickerSheet
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return;
      if (onClose) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const visibleItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const fa = foldForSearch(a.label);
      const fb = foldForSearch(b.label);
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    });
    const folded = foldForSearch(query.trim());
    if (!folded) return sorted;
    return sorted.filter((it) => foldForSearch(it.label).includes(folded));
  }, [items, query]);

  function pick(key) {
    if (onSelect) onSelect(key);
    if (onClose) onClose();
  }

  const rowButtonStyle = (selected) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    minHeight: 44,
    padding: '10px 12px',
    font: '600 14px/1.3 var(--font-sans)',
    color: selected ? 'var(--bf-purple)' : 'var(--bf-ink)',
    background: selected ? 'var(--bf-purple-tint)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-control)',
    cursor: 'pointer',
    textAlign: 'left',
  });

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,45,.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-picker-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bf-white)',
          width: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 'var(--space-6) var(--page-pad-x) calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <h3 id="exercise-picker-title" style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: 0 }}>
            {t('progress.pickerTitle')}
          </h3>
          <button
            ref={closeRef}
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: 'var(--radius-control)', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: '1px solid var(--border-control)',
            borderRadius: 'var(--radius-control)',
            padding: '11px 14px',
            background: 'var(--bf-white)',
            marginTop: 'var(--space-4)',
          }}
        >
          <Icon name="search" size={18} style={{ color: 'var(--bf-purple)' }} />
          {/* Real accessible label via aria-label — a placeholder alone does
              NOT contribute an accessible name (tech-plan §3 gate note). */}
          <input
            id="exercise-picker-search"
            type="text"
            aria-label={t('progress.searchPlaceholder')}
            placeholder={t('progress.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', flex: 1, minWidth: 0, background: 'transparent', font: '400 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}
          />
        </div>

        {visibleItems.length > 0 ? (
          <ul role="list" style={{ listStyle: 'none', margin: 'var(--space-4) 0 0', padding: 0 }}>
            {visibleItems.map((it) => {
              const selected = it.key === selectedKey;
              return (
                <li key={it.key}>
                  <button type="button" aria-current={selected || undefined} onClick={() => pick(it.key)} style={rowButtonStyle(selected)}>
                    <span dir="auto">{it.label}</span>
                    {selected && <Icon name="check" size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-5) 0 0' }}>
            {t('progress.noResults', { query: query.trim() })}
          </p>
        )}
      </div>
    </div>
  );
}
