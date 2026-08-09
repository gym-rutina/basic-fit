import React, { useEffect, useRef } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';

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
export function EquipmentReferenceSheet({ name, imageUrl, steps, videoHref, videoLabel = 'Ver tutorial en YouTube', onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(45,45,45,.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-sheet-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bf-white)',
          width: '100%',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          maxHeight: '80vh',
          overflowY: 'auto',
          paddingTop: 'var(--space-6)',
          paddingInline: 'var(--page-pad-x)',
          paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <h2
            id="equipment-sheet-title"
            style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: 0, flex: 1, minWidth: 0 }}
          >
            {name}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-control)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={20} />
          </button>
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
            <h3 style={{ font: 'var(--text-h4)', color: 'var(--bf-ink)', margin: '0 0 8px' }}>Técnica</h3>
            <ol style={{ paddingLeft: 20, margin: 0, display: 'grid', gap: 6 }}>
              {steps.map((step, i) => (
                <li key={i} style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink)' }}>{step}</li>
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
            {videoLabel}
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        )}
      </div>
    </div>
  );
}
