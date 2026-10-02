import React, { useEffect, useRef } from 'react';
import { Icon } from '../../../../design-system/components/primitives/Icon.jsx';
import { useI18n } from '../../i18n/index.js';
import { useBackClosesDialog } from '../../lib/useBackClosesDialog.js';

/**
 * Shared bottom-sheet scaffolding (tech-debt audit 2026-08-26 F1).
 *
 * Six sheets previously carried byte-identical scrim/panel markup in their own
 * files, and the behaviour around it had already drifted: ClubPickerSheet
 * tracked the previously focused element, restored focus on unmount, and gave
 * Escape a listbox-collapse nuance; EquipmentOverlaySheet had a bare Escape
 * handler with none of that; ConfirmSheet/LanguageSheet added a Tab trap but
 * skipped scrim-close. This shell is the single canonical implementation,
 * extracted from ClubPickerSheet's contract (the audit's designated reference)
 * and parameterised only where sheets genuinely differ.
 *
 * What the shell owns:
 *   - scrim   — fixed full-viewport dim (`rgba(45,45,45,.5)`, zIndex 300),
 *               bottom-anchored panel, click-to-close (see `scrimCloses`).
 *   - panel   — `role`/`aria-modal`/`aria-labelledby`, white, top-rounded,
 *               safe-area bottom padding; `maxHeight`+`scrollable` for
 *               scrollable variants, `style` escape hatch otherwise.
 *   - ✕       — `<SheetCloseButton>` (below) is the shared close control;
 *               callers place it in their own header row and hand its ref to
 *               `initialFocusRef`.
 *   - focus   — on mount the previously focused element is remembered and
 *               focus moves to `initialFocusRef.current` (sheets with a ✕) or
 *               the first enabled button in the panel (button-only sheets).
 *               On unmount focus returns to `returnFocusTo.current` if given,
 *               else the remembered element. Every sheet restores — including
 *               EquipmentOverlaySheet/EquipmentReferenceSheet, which used to
 *               dump focus on unmount (the drift this extraction exists to
 *               end; no test pinned the old gap).
 *   - Escape  — one document-level keydown listener per open sheet calling
 *               `onEscape` (falling back to `onClose`). Component-specific
 *              nuance stays at the call site via `onEscape`
 *               (ClubPickerSheet collapses an open listbox first;
 *               ConfirmSheet ignores Escape while `busy`).
 *   - Back    — the system Back (Android button / gesture, iOS edge swipe, desktop
 *               browser Back) closes the TOPMOST open dialog instead of leaving the
 *               page, via the shared `useBackClosesDialog` hook (history marker per
 *               dialog, nested dialogs one press each). Back == ✕: `onBack`, falling
 *               back to `onClose`.
 *
 * Opt-outs, each preserving a shipped contract rather than adding one:
 *   - `scrimCloses={false}` — ConfirmSheet and LanguageSheet never closed on
 *     scrim tap; they keep that behaviour so migration changes nothing
 *     observable.
 *   - `trapFocus` — the Tab cycle among the panel's enabled buttons ships
 *     only where it already existed (ConfirmSheet AC26/AC27, LanguageSheet).
 *     Combobox sheets deliberately leave Tab free.
 */
const SCRIM_STYLE = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(45,45,45,.5)',
  zIndex: 300,
  display: 'flex',
  alignItems: 'flex-end',
};

const PANEL_STYLE = {
  background: 'var(--bf-white)',
  width: '100%',
  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
};

// Longhand trio ≡ the shorthand every migrated sheet carried
// ('var(--space-6) var(--page-pad-x) calc(var(--space-6) + env(safe-area-inset-bottom, 0px))').
const SHEET_PADDING = {
  paddingTop: 'var(--space-6)',
  paddingInline: 'var(--page-pad-x)',
  paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
};

export const CLOSE_BUTTON_STYLE = {
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
};

/**
 * The shared ✕ control (`t('common.close')` + x icon). Callers place it in
 * their header row and pass the same ref to both this component and the
 * shell's `initialFocusRef` so the shell can autofocus it on mount.
 */
export const SheetCloseButton = React.forwardRef(function SheetCloseButton({ onClick }, ref) {
  const { t } = useI18n();
  return (
    <button ref={ref} type="button" aria-label={t('common.close')} onClick={onClick} style={CLOSE_BUTTON_STYLE}>
      <Icon name="x" size={20} />
    </button>
  );
});

/**
 * Props:
 *   onClose()        — scrim tap (when `scrimCloses`) and the default Escape action.
 *   onEscape()       — optional Escape override; falls back to `onClose`. Read
 *                      latest state inside it — the listener re-registers per render.
 *   onBack()         — optional system-Back override; falls back to `onClose` (Back == ✕,
 *                      even where Escape has a nuance, e.g. ClubPickerSheet's listbox).
 *                      Return `false` to stay open (Back consumed in place, e.g. ConfirmSheet
 *                      while `busy`).
 *   role             — panel ARIA role; 'dialog' unless the caller says otherwise
 *                      (ConfirmSheet ships 'alertdialog').
 *   labelledBy       — id of the panel's title element (required for a labelled dialog).
 *   scrimCloses      — default true; false preserves ConfirmSheet/LanguageSheet's
 *                      no-scrim-dismiss contract.
 *   trapFocus        — default false; true cycles Tab among the panel's enabled buttons.
 *   padded           — default true (standard sheet padding); false for panels whose
 *                      children carry their own chrome (EquipmentOverlaySheet's
 *                      flex-column header/body/footer).
 *   initialFocusRef  — ref to the element focused on mount (the ✕); defaults to the
 *                      panel's first enabled button.
 *   returnFocusTo    — optional { current: HTMLElement } overriding the restore target.
 *   maxHeight        — e.g. '88vh'; pairs with `scrollable`.
 *   scrollable       — default true; set false when an inner child scrolls instead
 *                      (EquipmentOverlaySheet).
 *   style            — merged over the panel base (flex column, extra overrides).
 */
export function SheetShell({
  onClose,
  onEscape,
  onBack,
  role = 'dialog',
  labelledBy,
  scrimCloses = true,
  trapFocus = false,
  padded = true,
  initialFocusRef,
  returnFocusTo,
  maxHeight,
  scrollable = true,
  style,
  children,
}) {
  useBackClosesDialog(onBack ?? onClose);
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const target =
      (initialFocusRef && initialFocusRef.current) ||
      (panelRef.current ? panelRef.current.querySelector('button:not(:disabled)') : null);
    if (target && typeof target.focus === 'function') target.focus();
    return () => {
      const toRestore = returnFocusTo?.current ?? previouslyFocusedRef.current;
      if (toRestore && typeof toRestore.focus === 'function') toRestore.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only; refs are stable by contract
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'Escape') return;
      const action = onEscape || onClose;
      if (action) action();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onEscape, onClose]);

  function handleTab(e) {
    if (e.key !== 'Tab' || !trapFocus) return;
    const focusables = panelRef.current
      ? Array.from(panelRef.current.querySelectorAll('button:not(:disabled)'))
      : [];
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

  return (
    <div onKeyDown={handleTab} onClick={scrimCloses ? onClose : undefined} style={SCRIM_STYLE}>
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...PANEL_STYLE,
          ...(padded ? SHEET_PADDING : {}),
          ...(maxHeight ? { maxHeight } : {}),
          ...(maxHeight && scrollable ? { overflowY: 'auto' } : {}),
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
