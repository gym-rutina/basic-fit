import React, { useRef } from 'react';
import { SheetShell, SheetCloseButton } from './sheet/SheetShell.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { useI18n } from '../i18n/index.js';

/**
 * Bottom-sheet overlay showing equipment reference detail.
 * Props: { name, imageUrl, steps, videoHref, videoLabel, reporting, onClose }
 * Reuses ConfirmSheet positioning + GuideOverlay dialog/Escape patterns.
 * Sections (image, Técnica, video) are omitted when their prop is absent/empty.
 *
 * exercise-level-tracking AC18′ (UAT decision A2): the sheet renders exactly
 * ONE video link — the exercise tutorial the caller composed with
 * buildVideoQuery. The catalog machine video is no longer offered here (it
 * stays reachable in the Catálogo tab). The sheet's title is the MACHINE (it
 * must match the row that opened it), so `videoLabel` is what tells the user
 * the link is scoped to a specific exercise on that machine.
 *
 * club-equipment-reporting S1 (revised 2026-10-06 UAT): the optional
 * `reporting` prop = { equipmentId, canReport, reported, onNotHere } puts the
 * club-absence report in here instead of on the exercise row. It renders while
 * `canReport` is true and no report has been made this visit; after the tap it
 * is replaced by the polite-live-region confirmation (one-tap finality —
 * corrections live in Catálogo → Mi club). The sheet's title already names the
 * machine, so the button needs no machine-specific accessible name. The caller
 * computes all of it — this sheet holds no club state of its own. When the
 * prop is absent (CatalogScreen callers never report from here) nothing renders.
 */
export function EquipmentReferenceSheet({ name, imageUrl, steps, videoHref, videoLabel, reporting, onClose }) {
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
          style={{
            // Never upscale beyond the source image's natural size: on wide
            // (desktop) sheets width:100% blew the photo up past 100%. The
            // image renders at its natural size, shrinks to fit on narrow
            // screens, and centers when narrower than the sheet.
            width: 'auto',
            maxWidth: '100%',
            marginInline: 'auto',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
            display: 'block',
          }}
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

      {/* club-equipment-reporting S1: the club-absence report action and its
          one-tap finality confirmation. The sheet's title already names the
          machine, so the label can say plainly what the report claims. The
          status region is mounted while the action is offered (empty), so the
          confirmation is ANNOUNCED when its text arrives rather than appearing
          together with its own live region. */}
      {reporting && (reporting.canReport || reporting.reported) && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {reporting.canReport && !reporting.reported && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => reporting.onNotHere(reporting.equipmentId)}
                style={{ minHeight: 44, padding: '0 10px' }}
              >
                <Icon name="alert-triangle" size={14} style={{ color: 'var(--bf-danger)' }} /> {t('session.notHereAction')}
              </Button>
            )}
          </div>
          <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {reporting.reported && (
              <>
                <Icon name="check-circle" size={16} style={{ color: 'var(--bf-success)', marginTop: 2 }} />
                <span dir="auto" style={{ font: 'var(--text-caption)', color: 'var(--text-muted)' }}>
                  {t('session.reportedBody')}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </SheetShell>
  );
}
