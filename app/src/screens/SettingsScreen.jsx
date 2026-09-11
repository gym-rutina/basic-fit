import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { BackupSection } from '../components/BackupSection.jsx';
import { ClubAccessSection } from '../components/ClubAccessSection.jsx';
import { SelectField } from '../../../design-system/components/primitives/SelectField.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { useI18n, UI_LOCALES, LOCALE_AUTONYMS } from '../i18n/index.js';

/**
 * pwa-ui-language AC11/AC12 (tech-plan.md D10) — the new `/settings` route,
 * reached only via ScreenHeader's brand-row affordance. `leading` uses the
 * same `navigate(-1)` pattern ProgramScreen's day-detail already uses, so no
 * "came from" screen needs to be tracked explicitly. Does not pass its own
 * `onSettings` to `ScreenHeader` — Settings does not offer a way into itself.
 *
 * Switching is synchronous and in-place (AC12): changing the select updates
 * the shared i18n context via `setLocale`, which is what re-renders the tab
 * bar and every other mounted screen without a navigation or reload. The
 * contract lives in setLocale, not in the control (pill-overflow-ux D-C:
 * the pill radiogroup became a SelectField; option labels ARE the autonyms,
 * so Rev5's no-2-letter-code rule survives verbatim).
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
        {/* pill-overflow-ux S3 (D-C): the pill radiogroup is now a SelectField.
            The `<label for>` binding replaces the radiogroup's aria-label; a
            native select exposes value + option-list semantics to AT, which
            AC8 sanctions as the dropdown-appropriate equivalent of the old
            role="radio"/aria-checked pair. */}
        <SelectField
          id="settings-ui-language"
          label={t('settings.uiLanguageLabel')}
          value={locale}
          options={UI_LOCALES.map((l) => ({ value: l, label: LOCALE_AUTONYMS[l] }))}
          onChange={setLocale}
        />

        <hr aria-hidden="true" style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: 'var(--space-8) 0 0' }} />

        {/* full-data-backup S1 (tech-plan.md §1): Idioma → Copia de seguridad
            → Acceso al club. Each section is self-contained and owns its own
            trailing separator. */}
        <BackupSection />

        {/* club-invite-link (D-H): the section owns everything below the
            language block, including its own trailing separator. */}
        <ClubAccessSection />
      </div>
    </div>
  );
}
