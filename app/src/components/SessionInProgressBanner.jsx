import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { useI18n } from '../i18n/index.js';

// Routes where the indicator would either point at the current screen or is
// redundant with a fuller resume affordance already on screen (spec.md
// AC14, ux-design.md Open Q2 / Screen G').
const HIDDEN_ROUTES = new Set(['/session', '/import', '/']);

/**
 * Global in-progress indicator (spec.md AC14-AC16). In-flow banner in the
 * shell's flex column, directly below InstallBanner — NOT a fixed overlay
 * and NOT a BottomTabBar marker (a single NavLink cannot navigate to both
 * "/" and "/session"). Being in normal flow is what makes AC16 (tab bar
 * layout contract) structural rather than incidental: this component adds,
 * removes, and resizes no `[data-testid="tab-item"]`.
 *
 * Fail-closed (ux-design.md): hidden whenever the active-session read is
 * still loading or has failed, so it never shows a stale or guessed state.
 * Inicio is where a failed read is surfaced (AC13) — this component would
 * only ever repeat that, on every other screen, as noise.
 */
export function SessionInProgressBanner({ status, session }) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  if (status !== 'ready' || !session) return null;
  if (HIDDEN_ROUTES.has(location.pathname)) return null;

  const total = session.exercises.length;
  const done = session.exercises.filter((e) => e.completedAt).length;
  const accessibleName = t('session.inProgressAria', { label: session.dayLabel, done, total });

  return (
    <button
      type="button"
      aria-label={accessibleName}
      onClick={() => navigate('/session')}
      style={{
        all: 'unset',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        minHeight: 44,
        paddingBlock: 'var(--space-4)',
        paddingInline: 'var(--page-pad-x)',
        background: 'var(--bf-purple)',
        color: 'var(--bf-white)',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        className="bf-pulse-dot"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--bf-white)',
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: '700 14px/1.3 var(--font-sans)' }}>
        {t('session.inProgressLabel')} · <span dir="auto">{session.dayLabel}</span>
      </span>
      <span style={{ flexShrink: 0, font: '700 13px/1 var(--font-sans)' }}>
        {done}/{total}
      </span>
      <Icon name="chevron-right" size={16} style={{ flexShrink: 0, color: 'var(--bf-white)' }} />
    </button>
  );
}
