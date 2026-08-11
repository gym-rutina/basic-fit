import React from 'react';
import { Badge } from '../../../design-system/components/primitives/Badge.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { useI18n } from '../i18n/index.js';

/**
 * Shared chrome for main tab screens (Inicio / Programa / Catálogo / Historial /
 * Progreso). Keeps Basic-Fit wordmark, title scale, and gutters identical so
 * switching tabs does not resize or drop the brand.
 */
const BRAND_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 'var(--space-4)',
};

const BRAND_TEXT_STYLE = {
  font: '800 15px/1 var(--font-display)',
  color: 'var(--bf-orange)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const SETTINGS_BUTTON_STYLE = {
  all: 'unset',
  boxSizing: 'border-box',
  cursor: 'pointer',
  minWidth: 44,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '0 8px',
  color: 'var(--bf-ink-2)',
  font: '700 12px/1 var(--font-sans)',
  letterSpacing: '0.02em',
  borderRadius: 'var(--radius-control)',
  flexShrink: 0,
};

const TITLE_STYLE = {
  font: 'var(--text-h2)',
  textTransform: 'uppercase',
  color: 'var(--bf-ink)',
  letterSpacing: 'var(--tracking-heading)',
  margin: 0,
  minWidth: 0,
  flex: '1 1 12rem',
  overflowWrap: 'anywhere',
};

/**
 * `onSettings` — pwa-ui-language AC11/Q3 (tech-plan.md D9/D10). The brand
 * row used to be a single `aria-hidden="true"` div; appending a control to
 * it would have hidden the button from every assistive technology, so the
 * row is restructured into its OWN slot instead — `leading`/`trailing` are
 * untouched, so HomeScreen's phase Badge and HistoryScreen's
 * Seleccionar/Cancelar controls (both use `trailing`) never collide with it.
 * Rendered only when a call site supplies `onSettings` — exactly the 5
 * tab-root screens do (Q3).
 */
export function ScreenHeader({ title, subtitle, badge, badgeTone = 'brand', leading, trailing, onSettings, children, style }) {
  const { locale, t } = useI18n();
  return (
    <header
      style={{
        background: 'var(--bf-white)',
        borderBottom: '1px solid var(--border-default)',
        paddingBlock: 'var(--space-6) var(--space-5)',
        paddingInline: 'var(--page-pad-x)',
        ...style,
      }}
    >
      <div style={BRAND_ROW_STYLE}>
        <span style={BRAND_TEXT_STYLE} aria-hidden="true">Basic-Fit</span>
        {onSettings && (
          <button
            type="button"
            onClick={onSettings}
            aria-label={t('settings.open')}
            style={SETTINGS_BUTTON_STYLE}
          >
            <Icon name="sliders" size={16} />
            <span>{locale.toUpperCase()}</span>
          </button>
        )}
      </div>
      {leading}
      {(title != null || trailing) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {title != null && <h1 style={TITLE_STYLE}>{title}</h1>}
          {trailing}
        </div>
      )}
      {subtitle && (
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '8px 0 0', maxWidth: 640 }}>
          {subtitle}
        </p>
      )}
      {badge != null && badge !== false && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          {typeof badge === 'string' || typeof badge === 'number' ? (
            <Badge tone={badgeTone}>{badge}</Badge>
          ) : (
            badge
          )}
        </div>
      )}
      {children}
    </header>
  );
}
