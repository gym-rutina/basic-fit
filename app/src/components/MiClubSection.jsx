import React, { useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { EQUIPMENT } from '../data/equipment.js';
import { readClub } from '../lib/clubStorage.js';
import { useClubExclusions } from '../lib/useClubExclusions.js';
import { ClubPickerSheet } from './ClubPickerSheet.jsx';
import { EquipmentOverlaySheet } from './EquipmentOverlaySheet.jsx';
import { useI18n } from '../i18n/index.js';

/**
 * move-club-picker-to-settings S1 (ux-design.md §2, tech-plan.md D2/D4/D5/D6)
 * — the /settings "Mi club" section. Self-contained like ClubAccessSection:
 * heading, identity, change action, equipment entry row, both sheet hosts and
 * its own trailing `<hr>`, so SettingsScreen's edit stays a single render line
 * and the section can be absorbed into a future Club grouping (DD-001) as a
 * wrap, not a move.
 *
 * States (ux-design.md §2 matrix):
 * - unset  — `readClub()` is null: prompt + "Elegir club", NO equipment row
 *            (nothing to edit without a club).
 * - set    — name + address (painted on the FIRST frame: `readClub()` is
 *            synchronous, AC1) + "Cambiar club" + the equipment entry row.
 * - picker — ClubPickerSheet, unchanged; it persists via `writeClub` itself
 *            (AC2 "no second copy of picker logic"), this section only takes
 *            the returned record into state so it updates in place.
 * - overlay — EquipmentOverlaySheet, unchanged (AC3); it owns its own
 *            `useClubExclusions` instance. The IndexedDB store keyed by
 *            `clubId` is the single truth, hooks are views over it.
 *
 * Count hint (OQ-4, D4): `EquipmentCountHint` owns a read-only
 * `useClubExclusions` view. There is no refetch API on that hook (it is the
 * frozen single write path), so the hint is REMOUNTED — `key` carries the
 * overlay-close count — and re-reads the store. IDB orders the overlay's last
 * put before the remount's get (same store, creation order), so the hint
 * shows the post-close value. Only the hint remounts, never the row's
 * `<button>`: SheetShell restores focus to the element focused before the
 * sheet opened, and that element must survive the close.
 *
 * This section never calls `setClubExclusions` / `writeClub` itself (AC10).
 */
function EquipmentCountHint({ clubId }) {
  const { t } = useI18n();
  const { excludedIds } = useClubExclusions(clubId);
  const total = EQUIPMENT.length;
  // Tri-state: null = not answered yet → "{total} equipos" only, never a flash
  // of "0 marcados como ausentes" (ux-design §2 count-loading).
  const text = excludedIds
    ? t('settings.miClub.equipmentCountHint', { total, excluded: excludedIds.size })
    : t('settings.miClub.equipmentCountHintLoading', { total });
  return (
    <span style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--text-muted)', marginTop: 2 }}>{text}</span>
  );
}

export function MiClubSection() {
  const { t } = useI18n();
  const [club, setClub] = useState(() => readClub());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [closeCount, setCloseCount] = useState(0);

  function handleSelected(selected) {
    setClub(selected);
    setPickerOpen(false);
  }

  function handleOverlayClose() {
    setOverlayOpen(false);
    setCloseCount((n) => n + 1);
  }

  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      <span
        style={{
          font: 'var(--text-label)',
          letterSpacing: 'var(--tracking-label)',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {t('settings.miClub.sectionTitle')}
      </span>

      {club ? (
        <div style={{ marginTop: 'var(--space-3)', minWidth: 0 }}>
          <div style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{club.name}</div>
          <div style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', marginTop: 2 }}>{club.address}</div>
        </div>
      ) : (
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: 'var(--space-3) 0 0' }}>
          {t('settings.miClub.emptyPrompt')}
        </p>
      )}

      {/* One Button in both states (only its label differs) so the element —
          and the focus SheetShell returns to it — survives unset → set. */}
      <Button
        variant="outline"
        style={{ width: '100%', minHeight: 44, marginTop: 'var(--space-4)' }}
        onClick={() => setPickerOpen(true)}
      >
        {club ? t('club.changeButton') : t('settings.miClub.selectAction')}
      </Button>

      {club && (
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          style={{
            // Explicit reset, not `all: unset` — that would also strip the
            // browser focus ring from a keyboard-reachable row.
            appearance: 'none',
            background: 'none',
            border: 'none',
            borderRadius: 'var(--radius-control)',
            color: 'inherit',
            font: 'inherit',
            textAlign: 'left',
            boxSizing: 'border-box',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            width: '100%',
            minHeight: 44,
            marginTop: 'var(--space-4)',
            padding: '6px 0',
          }}
        >
          {/* D5: the accessible name IS this visible content (label + hint). */}
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', font: '500 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
              {t('settings.miClub.equipmentEntryLabel')}
            </span>
            <EquipmentCountHint key={`${club.clubId}:${closeCount}`} clubId={club.clubId} />
          </span>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'inline-flex' }}>
            <Icon name="chevron-right" size={16} />
          </span>
        </button>
      )}

      <hr aria-hidden="true" style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: 'var(--space-8) 0 0' }} />

      {pickerOpen && <ClubPickerSheet onSelect={handleSelected} onClose={() => setPickerOpen(false)} />}
      {overlayOpen && club && (
        <EquipmentOverlaySheet
          club={{ clubId: club.clubId, name: club.name, city: club.city, address: club.address }}
          onClose={handleOverlayClose}
        />
      )}
    </section>
  );
}
