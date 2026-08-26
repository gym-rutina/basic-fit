import React, { useRef } from 'react';
import { SheetShell, SheetCloseButton } from './sheet/SheetShell.jsx';
import { useI18n } from '../i18n/index.js';

/**
 * Bottom-sheet overlay showing equipment reference detail.
 * Props: { name, imageUrl, steps, videoHref, videoLabel, onClose }
 * Reuses ConfirmSheet positioning + GuideOverlay dialog/Escape patterns.
 * Sections (image, Técnica, video) are omitted when their prop is absent/empty.
 *
 * exercise-level-tracking AC18′ (UAT decision A2): the sheet renders exactly
 * ONE video link — the exercise tutorial the caller composed with
 * buildVideoQuery. The catalog machine video is no longer offered here (it
 * stays reachable in the Catálogo tab). The sheet's title is the MACHINE (it
 * must match the row that opened it), so `videoLabel` is what tells the user
 * the link is scoped to a specific exercise on that machine.
 */
export function EquipmentReferenceSheet({ name, imageUrl, steps, videoHref, videoLabel, onClose }) {
  const { t } = useI18n();
  const resolvedVideoLabel = videoLabel ?? t('equipment.watchTutorial');
  // Shared with SheetShell: the shell autofocuses the ✕ on mount (and now
  // also restores focus on unmount — the pre-shell version dumped focus).
  const closeRef = useRef(null);

  return (
    <SheetShell onClose={onClose} labelledBy="equipment-sheet-title" initialFocusRef={closeRef} maxHeight="80vh">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <h2 id="equipment-sheet-title" style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: 0, flex: 1, minWidth: 0 }}>
          {name}
        </h2>
        <SheetCloseButton ref={closeRef} onClick={onClose} />
      </div>

      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: 16, display: 'block', objectFit: 'cover' }}
        />
      )}

      {steps && steps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ font: 'var(--text-h4)', color: 'var(--bf-ink)', margin: '0 0 8px' }}>{t('common.technique')}</h3>
          <ol style={{ paddingLeft: 20, margin: 0, display: 'grid', gap: 6 }}>
            {steps.map((step, i) => (
              <li key={i} dir="auto" style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink)' }}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {videoHref && (
        <a
          href={videoHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            font: '600 14px/1.2 var(--font-sans)',
            color: 'var(--bf-purple)',
            textDecoration: 'none',
            minHeight: 44,
          }}
        >
          {resolvedVideoLabel}
          <span className="sr-only"> {t('common.opensNewTab')}</span>
        </a>
      )}
    </SheetShell>
  );
}
