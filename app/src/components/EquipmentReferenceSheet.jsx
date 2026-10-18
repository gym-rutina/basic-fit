import React, { useEffect, useRef, useState } from 'react';
import { SheetShell, SheetCloseButton, CLOSE_BUTTON_STYLE } from './sheet/SheetShell.jsx';
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
 * club-equipment-reporting S1: the optional
 * `reporting` prop = { equipmentId, canReport, reported, onNotHere, onUndo }
 * puts the club-absence report in here instead of on the exercise row. The
 * caller computes all of it — this sheet holds no club state of its own. When
 * the prop is absent (CatalogScreen callers never report from here) nothing
 * renders.
 *
 * Layout (2026-10-17 UAT): the report is a rare, destructive-ish action, so it
 * no longer competes with the tutorial link. The page reads top-down as
 * title · [⋯] · ✕, then the report's own region (confirmation / result), then
 * image, Técnica and — last, as the primary action — the YouTube link.
 *   1. «⋯» in the header opens a one-item menu (the action's full sentence).
 *   2. Picking it opens an inline confirmation (what will happen + where to
 *      undo); only ITS confirm button calls `onNotHere`. It lives inside this
 *      dialog rather than stacking a second one, so Escape / Back / scrim keep
 *      their single-dialog meaning (Escape and Back close an open menu first).
 *   3. After the report, the polite live region confirms it and an «Deshacer»
 *      button calls `onUndo` (the caller restores the machine through the same
 *      exclusions path), which brings the «⋯» back.
 * Focus: the menu item on open; Cancelar on confirmation (the safe default);
 * back to «⋯» after Cancelar or Undo; ✕ after a confirmed report, because the
 * control that had focus just disappeared.
 */
export function EquipmentReferenceSheet({ name, imageUrl, steps, videoHref, videoLabel, reporting, onClose }) {
  const { t } = useI18n();
  const resolvedVideoLabel = videoLabel ?? t('equipment.watchTutorial');
  // Shared with SheetShell: the shell autofocuses the ✕ on mount (and now
  // also restores focus on unmount — the pre-shell version dumped focus).
  const closeRef = useRef(null);
  const menuButtonRef = useRef(null);
  const menuItemRef = useRef(null);
  const menuWrapRef = useRef(null);
  const confirmRef = useRef(null);
  // Where focus goes once the control that held it has been swapped out:
  // 'close' | 'menu' | null. Consumed by the effect below as soon as the
  // target exists (after Undo the «⋯» only re-mounts on the parent's re-render).
  const pendingFocus = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const reported = Boolean(reporting && reporting.reported);
  const offered = Boolean(reporting && reporting.canReport && !reported);
  const showReportRegion = offered || reported;

  useEffect(() => {
    if (menuOpen) menuItemRef.current?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (confirming) confirmRef.current?.querySelector('[data-report-cancel]')?.focus();
  }, [confirming]);

  useEffect(() => {
    const want = pendingFocus.current;
    if (!want) return;
    const el = want === 'close' ? closeRef.current : menuButtonRef.current;
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  });

  // A tap/click outside the menu closes it. (Keyboard Tab out is the onBlur
  // below; the trigger itself is inside the wrapper so it can toggle.)
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(e) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  function closeMenu({ refocus } = {}) {
    setMenuOpen(false);
    if (refocus) menuButtonRef.current?.focus();
  }

  // Escape and system Back peel the topmost thing first: an open menu, then the sheet.
  function handleEscape() {
    if (menuOpen) closeMenu({ refocus: true });
    else onClose();
  }
  function handleBack() {
    if (menuOpen) {
      closeMenu({ refocus: true });
      return false;
    }
    onClose();
    return undefined;
  }

  return (
    <SheetShell
      onClose={onClose}
      onEscape={handleEscape}
      onBack={handleBack}
      labelledBy="equipment-sheet-title"
      initialFocusRef={closeRef}
      maxHeight="80vh"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <h2 id="equipment-sheet-title" style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: 0, flex: 1, minWidth: 0 }}>
          {name}
        </h2>
        {offered && (
          <div
            ref={menuWrapRef}
            style={{ position: 'relative', flexShrink: 0 }}
            onBlur={(e) => {
              // Keyboard Tab (or focus move) to somewhere outside closes the menu;
              // relatedTarget === null is a pointer blur, handled by pointerdown.
              if (menuOpen && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false);
            }}
          >
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={t('equipment.moreActions')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              style={{ ...CLOSE_BUTTON_STYLE, width: 40, height: 40 }}
            >
              <Icon name="more-horizontal" size={20} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  zIndex: 1,
                  width: 'max-content',
                  maxWidth: 'min(280px, 75vw)',
                  padding: 4,
                  background: 'var(--bf-white)',
                  border: '1px solid var(--border-control)',
                  borderRadius: 'var(--radius-control)',
                  boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                }}
              >
                <button
                  ref={menuItemRef}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirming(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxSizing: 'border-box',
                    width: '100%',
                    minHeight: 44,
                    padding: '8px 12px',
                    font: '600 14px/1.25 var(--font-sans)',
                    textAlign: 'left',
                    color: 'var(--bf-ink)',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-control)',
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="alert-triangle" size={16} style={{ color: 'var(--bf-danger)' }} />
                  <span dir="auto">{t('session.notHereAction')}</span>
                </button>
              </div>
            )}
          </div>
        )}
        <SheetCloseButton ref={closeRef} onClick={onClose} />
      </div>

      {/* club-equipment-reporting: the report's confirmation and result. The
          status region is mounted while the action is offered (empty), so the
          result is ANNOUNCED when its text arrives rather than appearing
          together with its own live region. */}
      {showReportRegion && (
        <div style={{ marginBottom: confirming || reported ? 16 : 0 }}>
          {offered && confirming && (
            <div
              ref={confirmRef}
              role="group"
              aria-labelledby="not-here-confirm-title"
              style={{
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
                  onClick={() => {
                    pendingFocus.current = 'menu';
                    setConfirming(false);
                  }}
                  style={{ flex: 1, minHeight: 44 }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    pendingFocus.current = 'close';
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
              {reported && (
                <>
                  <Icon name="check-circle" size={16} style={{ color: 'var(--bf-success)', marginTop: 2 }} />
                  <span dir="auto" style={{ font: 'var(--text-caption)', color: 'var(--text-muted)' }}>
                    {t('session.reportedBody')}
                  </span>
                </>
              )}
            </div>
            {reported && reporting.onUndo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  pendingFocus.current = 'menu';
                  reporting.onUndo(reporting.equipmentId);
                }}
                style={{ minHeight: 44, flexShrink: 0 }}
              >
                {t('common.undo')}
              </Button>
            )}
          </div>
        </div>
      )}

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
    </SheetShell>
  );
}
