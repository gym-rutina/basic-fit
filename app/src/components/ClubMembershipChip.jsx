import React from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { useI18n } from '../i18n/index.js';

/**
 * move-club-picker-to-settings S4 (ux-design.md §4, tech-plan.md D1) — the
 * per-card club-membership chip CatalogScreen renders in a strip beneath each
 * EquipmentCard.
 *
 * PRESENTATIONAL ONLY. It owns no hook and no write: CatalogScreen holds the
 * screen's single `useClubExclusions` instance and threads `exclude`/`include`
 * in as `onExclude`/`onInclude` (AC10 — one mutation path, no second write
 * site). The contract is deliberately narrow (D1): under the "Solo mi club"
 * pill every visible card is included, so the chip needs no `pillOn`; the
 * screen closes over the item id; the write-failure note is screen-level (D2).
 *
 * Visible text is the STATE ("En mi club" / "Fuera de mi club"); the
 * accessible name is the ACTION ("Quitar {name} de mi club" / "Añadir {name}
 * a mi club") — the MoreMusclesChip precedent — and `{name}` disambiguates the
 * many chips on one screen. `aria-pressed` carries the state to AT (ux §10).
 *
 * Props:
 *   name: string        — the card's display name (interpolated into the action)
 *   included: boolean   — the item is in the club (not in the exclusions set)
 *   onExclude(): called when an included chip is tapped
 *   onInclude(): called when an excluded chip is tapped
 */
export function ClubMembershipChip({ name, included, onExclude, onInclude }) {
  const { t } = useI18n();
  const action = included
    ? t('catalog.card.removeFromClub', { name })
    : t('catalog.card.addToClub', { name });

  return (
    <button
      type="button"
      aria-pressed={included}
      aria-label={action}
      onClick={included ? onExclude : onInclude}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 44,
        padding: '8px 12px',
        font: '600 13px/1.2 var(--font-sans)',
        borderRadius: 'var(--radius-control)',
        cursor: 'pointer',
        border: `1px solid ${included ? 'var(--bf-purple)' : 'var(--border-control)'}`,
        background: included ? 'var(--bf-purple-tint)' : 'transparent',
        color: included ? 'var(--bf-purple)' : 'var(--text-muted)',
      }}
    >
      <Icon name={included ? 'check' : 'x'} size={16} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {included ? t('catalog.card.inClub') : t('catalog.card.notInClub')}
      </span>
    </button>
  );
}
