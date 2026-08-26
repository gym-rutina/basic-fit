import React, { useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { SheetShell, SheetCloseButton } from './sheet/SheetShell.jsx';
import { EQUIPMENT } from '../data/equipment.js';
import { KIND_ORDER, groupByKind } from '../lib/equipmentKinds.js';
import { useClubExclusions } from '../lib/useClubExclusions.js';
import { useI18n } from '../i18n/index.js';

/**
 * Equipment overlay — per-club exclusion correction (spec.md R7.1-R7.5,
 * AC44/AC44b, tech-plan.md D11/D21, tech-plan-build-b.md D20).
 *
 * `design-system/ui_kits/rutina/EquipmentOverlaySheet.jsx` is a STRUCTURAL
 * reference only, not a port (D20): it reads browser globals
 * (`window.BF_KIT_DATA`), hardcodes Spanish literals, and uses `item.name.es`
 * / `item.model` where the real catalog has `names` / `modelCode`. This
 * component matches its structure — three static `kind` sections, native
 * checkbox + label at 44px, `role="dialog"`/`aria-modal`/`aria-labelledby`,
 * the `aria-live` excluded-count, the `role="alert"` write-failure note —
 * written fresh against i18n keys and the real data shape.
 *
 * `simulateWriteError` / `onPersistError` are test/demo-only: they bypass
 * `useClubExclusions`'s real IndexedDB write entirely so the write-failure
 * state is reproducible independent of the environment's IndexedDB support
 * (R7.3 — the flow must never be blocked by a persistence failure, in a
 * real quota-exceeded case exactly as in this simulated one).
 *
 * Props:
 *   club: {clubId, name, city, address} | null
 *   onClose(): called on ✕ / Escape / "Listo"
 *   simulateWriteError?: boolean — demo/test-only write-failure simulation
 *   onPersistError?: () => void
 */
export function EquipmentOverlaySheet({ club, onClose, simulateWriteError = false, onPersistError }) {
  const { t } = useI18n();
  const clubId = club?.clubId ?? null;
  const { excludedIds: hookExcludedIds, exclude, include, writeFailed: hookWriteFailed } = useClubExclusions(clubId);
  const [localExcluded, setLocalExcluded] = useState(() => new Set());
  const [localWriteFailed, setLocalWriteFailed] = useState(false);
  // Shared with SheetShell: the shell autofocuses the ✕ on mount (and now
  // also restores focus on unmount — the pre-shell version dumped focus).
  const closeRef = useRef(null);

  const excludedIds = simulateWriteError ? localExcluded : hookExcludedIds || new Set();
  const writeFailed = simulateWriteError ? localWriteFailed : hookWriteFailed;

  function toggle(id) {
    if (simulateWriteError) {
      setLocalExcluded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLocalWriteFailed(true);
      onPersistError && onPersistError();
      return;
    }
    if (excludedIds.has(id)) include(id);
    else exclude(id);
  }

  const sections = KIND_ORDER.map((kind) => ({ kind, items: groupByKind(EQUIPMENT)[kind] }));
  const sectionLabels = {
    machine: t('overlay.sectionMachines'),
    'free-weight': t('overlay.sectionFreeWeight'),
    accessory: t('overlay.sectionAccessory'),
  };

  return (
    <SheetShell
      onClose={onClose}
      labelledBy="equipment-overlay-title"
      initialFocusRef={closeRef}
      padded={false}
      maxHeight="85vh"
      scrollable={false}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flexShrink: 0, padding: 'var(--space-6) var(--page-pad-x) var(--space-4)', borderBottom: '1px solid var(--bf-grey-2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 id="equipment-overlay-title" style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: 0 }}>
              {t('overlay.title')}
            </h3>
            {club && <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '4px 0 0' }}>{club.name}</p>}
          </div>
          <SheetCloseButton ref={closeRef} onClick={onClose} />
        </div>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '10px 0 0' }}>{t('overlay.subtitle')}</p>
        <p style={{ font: '700 13px/1.3 var(--font-sans)', color: 'var(--bf-ink)', margin: '4px 0 0' }} aria-live="polite">
          {excludedIds.size} {t(excludedIds.size === 1 ? 'overlay.excludedCountOne' : 'overlay.excludedCountOther')}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--page-pad-x)' }}>
        {sections.map(({ kind, items }) => {
          const headingId = `equipment-overlay-section-${kind}`;
          return (
            <div key={kind} style={{ marginBottom: 'var(--space-5)' }}>
              <h3
                id={headingId}
                style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}
              >
                {sectionLabels[kind]} ({items.length})
              </h3>
              <div role="group" aria-labelledby={headingId} style={{ display: 'grid', gap: 2 }}>
                {items.map((item) => {
                  const isExcluded = excludedIds.has(item.id);
                  const name = item.names?.es || item.names?.en || item.id;
                  return (
                    <label
                      key={item.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '6px 4px', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => toggle(item.id)}
                        style={{ width: 20, height: 20, accentColor: 'var(--bf-purple)', flexShrink: 0 }}
                      />
                      <span style={{ font: '500 14px/1.3 var(--font-sans)', color: isExcluded ? 'var(--text-muted)' : 'var(--bf-ink)', flex: 1 }}>
                        {item.modelCode} — {name}
                      </span>
                      <span style={{ font: '12px/1 monospace', color: 'var(--text-muted)' }}>{item.id}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, padding: 'var(--space-4) var(--page-pad-x) calc(var(--space-4) + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--bf-grey-2)' }}>
        {writeFailed && (
          <div
            role="alert"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bf-danger-tint)', border: '1px solid var(--bf-danger)', borderRadius: 'var(--radius-md)', padding: '8px 12px', font: 'var(--text-body-sm)', color: 'var(--bf-danger)', marginBottom: 10 }}
          >
            <Icon name="alert-triangle" size={16} style={{ flexShrink: 0 }} />
            {t('overlay.writeFailedNote')}
          </div>
        )}
      <Button variant="primary" style={{ width: '100%' }} onClick={onClose}>
        {t('overlay.done')}
      </Button>
    </div>
    </SheetShell>
  );
}
