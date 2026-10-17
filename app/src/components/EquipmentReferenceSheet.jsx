import React, { useEffect, useRef, useState } from 'react';
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
 *
 * Accidental-tap guard (2026-10-17 UAT): the tutorial link is a bordered,
 * full-width row with a YouTube icon (it used to be bare purple text sitting
 * right above the report action, and the two were easy to confuse). The report
 * is two-step: the action opens an inline confirmation panel (what will happen
 * + where to undo it) and only its confirm button calls `onNotHere`. The panel
 * lives inside this dialog rather than stacking a second one over it, so
 * Escape / Back / scrim keep their single-dialog meaning. Cancel is focused on
 * open (the safe default) and gets focus back the way it came; after a
 * confirmed report focus lands on ✕, because the action just disappeared.
 */
export function EquipmentReferenceSheet({ name, imageUrl, steps, videoHref, videoLabel, reporting, onClose }) {
  const { t } = useI18n();
  const resolvedVideoLabel = videoLabel ?? t('equipment.watchTutorial');
  // Shared with SheetShell: the shell autofocuses the ✕ on mount (and now
  // also restores focus on unmount — the pre-shell version dumped focus).
  const closeRef = useRef(null);
  const reportRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const wasConfirming = useRef(false);
  const reportedNow = useRef(false);

  useEffect(() => {
    if (confirming) {
      reportRef.current?.querySelector('[data-report-cancel]')?.focus();
    } else if (wasConfirming.current) {
      if (reportedNow.current) closeRef.current?.focus();
      else reportRef.current?.querySelector('[data-report-trigger]')?.focus();
    }
    wasConfirming.current = confirming;
  }, [confirming]);

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
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxSizing: 'border-box',
            width: '100%',
            minHeight: 48,
            padding: '10px 14px',
            font: '600 14px/1.25 var(--font-sans)',
            color: 'var(--bf-purple)',
            textDecoration: 'none',
            border: '1px solid var(--bf-purple)',
            background: 'var(--bf-purple-tint)',
            borderRadius: 'var(--radius-control)',
          }}
        >
          <Icon name="youtube" size={22} />
          <span dir="auto" style={{ flex: 1, minWidth: 0 }}>{resolvedVideoLabel}</span>
          <Icon name="external-link" size={16} />
          <span className="sr-only"> {t('common.opensNewTab')}</span>
        </a>
      )}

      {/* club-equipment-reporting S1: the club-absence report action and its
          confirmation. The sheet's title already names the machine, so the
          label can say plainly what the report claims. The status region is
          mounted while the action is offered (empty), so the confirmation is
          ANNOUNCED when its text arrives rather than appearing together with
          its own live region. A hairline + gap keeps the destructive-ish
          action visually apart from the tutorial link above it. */}
      {reporting && (reporting.canReport || reporting.reported) && (
        <div
          ref={reportRef}
          style={{
            marginTop: videoHref ? 20 : 0,
            paddingTop: videoHref ? 8 : 0,
            borderTop: videoHref ? '1px solid var(--border-control)' : 'none',
          }}
        >
          {reporting.canReport && !reporting.reported && !confirming && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-report-trigger
                onClick={() => setConfirming(true)}
                style={{ minHeight: 44, padding: '0 10px' }}
              >
                <Icon name="alert-triangle" size={14} style={{ color: 'var(--bf-danger)' }} /> {t('session.notHereAction')}
              </Button>
            </div>
          )}
          {reporting.canReport && !reporting.reported && confirming && (
            <div
              role="group"
              aria-labelledby="not-here-confirm-title"
              style={{
                marginTop: 8,
                padding: 12,
                display: 'grid',
                gap: 10,
                border: '1px solid var(--border-control)',
                borderRadius: 'var(--radius-control)',
              }}
            >
              <div>
                <p id="not-here-confirm-title" dir="auto" style={{ font: '600 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)', margin: '0 0 4px' }}>
                  {t('session.notHereConfirmTitle')}
                </p>
                <p dir="auto" style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', margin: 0 }}>
                  {t('session.notHereConfirmBody')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-report-cancel
                  onClick={() => setConfirming(false)}
                  style={{ flex: 1, minHeight: 44 }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    reportedNow.current = true;
                    setConfirming(false);
                    reporting.onNotHere(reporting.equipmentId);
                  }}
                  style={{ flex: 1, minHeight: 44 }}
                >
                  {t('session.notHereConfirmAction')}
                </Button>
              </div>
            </div>
          )}
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
