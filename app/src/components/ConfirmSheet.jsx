import React, { useRef } from 'react';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { SheetShell } from './sheet/SheetShell.jsx';
import { useI18n } from '../i18n/index.js';

/**
 * Shared bottom-sheet confirm dialog — same visual pattern as the mockup's
 * ActiveSessionScreen "end session" dialog, factored out so it can also
 * back the Import screen's re-import discard warning (spec.md Render AC)
 * without duplicating the fixed-overlay/sheet markup twice.
 *
 * `destructiveAction` (session-discard-and-history-delete, DD-001) renders
 * an isolated ghost/`--bf-danger` escape hatch BETWEEN the secondary button
 * and Cancelar, fenced by hairlines — absent, the render is unchanged
 * (AC28 back-compat for ConfirmSheet.test.jsx and the Import re-import
 * warning).
 *
 * Focus containment (AC26-AC28) lives in SheetShell so every call site
 * inherits it with no per-caller change: on mount, focus moves into the
 * sheet and the previously focused element is remembered; Tab/Shift+Tab
 * wrap within the sheet's own focusable set (`trapFocus`); Escape triggers
 * `onCancel` UNLESS `busy` (a destructive transaction must never be orphaned
 * mid-write); on unmount, focus returns to the element that opened it.
 * This sheet also keeps its historical contract of NOT dismissing on scrim
 * tap — an accidental backdrop touch must never abandon a confirmation
 * mid-decision — hence `scrimCloses={false}` below.
 */
export function ConfirmSheet({
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  cancelLabel,
  onCancel,
  danger = false,
  destructiveAction,
  busy = false,
  error,
  children,
  // multi-rutina-library — renders the primary present-but-disabled (the
  // successor picker stays untappable until a radio is chosen, AC7). Absent
  // everywhere else, so existing sheets are unchanged.
  primaryDisabled = false,
  // multi-rutina-library: 'alertdialog' (assertive) remains the default and
  // what every pre-existing caller gets. /library passes 'dialog' — its
  // successor-picker sheet is a choice surface, not purely an assertion, and
  // its contract queries role="dialog" explicitly.
  role = 'alertdialog',
}) {
  const { t } = useI18n();
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
  // Read by the Escape handler below — SheetShell re-registers its document
  // keydown listener per render, so the latest `busy` is always what gates it.
  const busyRef = useRef(busy);
  busyRef.current = busy;

  return (
    <SheetShell
      role={role}
      labelledBy="confirm-sheet-title"
      scrimCloses={false}
      trapFocus
      // System Back is Cancel, never the primary action; ignored while `busy`, like Escape.
      onBack={() => {
        if (busyRef.current || !onCancel) return false;
        onCancel();
      }}
      onEscape={() => {
        if (!busyRef.current) onCancel && onCancel();
      }}
    >
      <h3 id="confirm-sheet-title" style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 4px' }}>
        {title}
      </h3>
      {description && <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-5)' }}>{description}</p>}
      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bf-danger-tint)', border: '1px solid var(--bf-danger)', borderRadius: 'var(--radius-md)', padding: '10px 14px', font: 'var(--text-body-sm)', color: 'var(--bf-danger)', marginBottom: 'var(--space-5)' }}>
          <Icon name="alert-triangle" size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}
      {/* multi-rutina-library — optional content slot between description
          and buttons (the successor-picker radiogroup). Absent everywhere
          else, so existing renders are byte-identical. */}
      {children}
      <div style={{ display: 'grid', gap: 10 }}>
        {onPrimary && (
          <Button
            variant="primary"
            disabled={busy || primaryDisabled}
            style={{ width: '100%', ...(danger ? { background: 'var(--bf-danger)', borderColor: 'var(--bf-danger)' } : {}) }}
            onClick={onPrimary}
          >
            {primaryLabel}
          </Button>
        )}
        {onSecondary && (
          <Button variant="outline" disabled={busy} style={{ width: '100%' }} onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
        {destructiveAction && (
          <>
            <div style={{ height: 1, background: 'var(--bf-grey-2)', margin: '2px 0' }} />
            <Button
              variant="ghost"
              disabled={busy}
              style={{ width: '100%', color: 'var(--bf-danger)', minHeight: 44 }}
              onClick={destructiveAction.onClick}
            >
              {destructiveAction.label}
            </Button>
            <div style={{ height: 1, background: 'var(--bf-grey-2)', margin: '2px 0' }} />
          </>
        )}
        {onCancel && (
          <Button variant="ghost" disabled={busy} style={{ width: '100%' }} onClick={onCancel}>
            {resolvedCancelLabel}
          </Button>
        )}
      </div>
    </SheetShell>
  );
}
