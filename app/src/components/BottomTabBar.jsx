import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { useI18n } from '../i18n/index.js';

/**
 * Fixed bottom nav — ux-design.md's deliberate departure from the
 * design-system's top NavMenu anchor-scroll pattern (this is a multi-screen
 * app with persistent state, not one scrolling document). Derives its
 * active tab from useLocation() (via NavLink) rather than being a
 * fully-controlled component, per tech-plan.md.
 *
 * Tabs: Home / Programa / Catálogo / Historial / Progreso (5 total).
 * data-testid="bottom-tab-bar" / "tab-item" are load-bearing: tests/
 * viewport-check.js asserts all tab-item elements share one offsetTop
 * (never wraps to multiple rows) at 280/360/390/412/768px.
 */
const TABS = [
  { id: 'home', labelKey: 'tab.home', icon: 'home', path: '/', end: true },
  { id: 'program', labelKey: 'tab.program', icon: 'dumbbell', path: '/program', end: false },
  { id: 'catalog', labelKey: 'tab.catalog', icon: 'search', path: '/catalog', end: false },
  { id: 'history', labelKey: 'tab.history', icon: 'bar-chart-2', path: '/history', end: false },
  { id: 'progress', labelKey: 'tab.progress', icon: 'trending-up', path: '/progress', end: false },
];

const linkStyle = ({ isActive }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '10px 4px 8px',
  textDecoration: 'none',
  borderTop: isActive ? '3px solid var(--bf-purple-deep)' : '3px solid transparent',
  color: isActive ? 'var(--bf-white)' : 'rgba(255,255,255,.62)',
  font: '600 11px/1.1 var(--font-sans)',
  letterSpacing: '.02em',
  cursor: 'pointer',
  minHeight: 52,
  minWidth: 44,
});

export function BottomTabBar() {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('a11y.mainNav')}
      data-testid="bottom-tab-bar"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        background: 'var(--bf-ink)',
        display: 'flex',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        borderTop: '1px solid rgba(255,255,255,.08)',
        boxShadow: '0 -2px 12px rgba(0,0,0,.18)',
      }}
    >
      {TABS.map((tab) => (
        <NavLink key={tab.id} to={tab.path} end={tab.end} data-testid="tab-item" style={linkStyle}>
          {({ isActive }) => (
            <>
              <Icon name={tab.icon} size={22} strokeWidth={isActive ? 2.4 : 2} />
              {t(tab.labelKey)}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
