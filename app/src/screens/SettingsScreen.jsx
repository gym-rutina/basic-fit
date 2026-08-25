import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { ClubAccessSection } from '../components/ClubAccessSection.jsx';
import { FilterPill } from '../../../design-system/components/primitives/FilterPill.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { useI18n, UI_LOCALES, LOCALE_AUTONYMS } from '../i18n/index.js';

/**
 * pwa-ui-language AC11/AC12 (tech-plan.md D10) — the new `/settings` route,
 * reached only via ScreenHeader's brand-row affordance. `leading` uses the
 * same `navigate(-1)` pattern ProgramScreen's day-detail already uses, so no
 * "came from" screen needs to be tracked explicitly. Does not pass its own
 * `onSettings` to `ScreenHeader` — Settings does not offer a way into itself.
 *
 * Switching is synchronous and in-place (AC12): tapping a pill updates the
 * shared i18n context, which is what re-renders the tab bar and every other
 * mounted screen without a navigation or reload.
 */
export function SettingsScreen() {
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
      <ScreenHeader
        title={t('settings.title')}
        leading={
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-muted)',
              font: 'var(--text-body-sm)',
              marginBottom: 10,
              minHeight: 44,
            }}
          >
            <Icon name="chevron-left" size={16} /> {t('common.back')}
          </button>
        }
      />

      <div style={{ maxWidth: 480, margin: '0 auto', paddingInline: 'var(--page-pad-x)', paddingTop: 'var(--space-6)' }}>
        <span
          style={{
            font: 'var(--text-label)',
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {t('settings.languageHeading')}
        </span>

        <div
          role="radiogroup"
          aria-label={t('settings.languageHeading')}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}
        >
          {UI_LOCALES.map((l) => (
            <FilterPill key={l} active={locale === l} onClick={() => setLocale(l)} role="radio" aria-checked={locale === l}>
              {LOCALE_AUTONYMS[l]}
            </FilterPill>
          ))}
        </div>

        <hr aria-hidden="true" style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: 'var(--space-8) 0 0' }} />

        {/* club-invite-link (D-H): the section owns everything below the
            language block, including its own trailing separator. */}
        <ClubAccessSection />
      </div>
    </div>
  );
}
