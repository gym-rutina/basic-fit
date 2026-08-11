import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { FilterPill } from '../../../design-system/components/primitives/FilterPill.jsx';
import { StatCard } from '../../../design-system/components/primitives/StatCard.jsx';
import { EquipmentCard } from '../../../design-system/components/composite/EquipmentCard.jsx';
import { EQUIPMENT, EQUIPMENT_METADATA, LANGUAGES, GYMS, mainImageUrl, equipmentDisplayName } from '../data/equipment.js';
import { muscleGroupLabels } from '../lib/muscleGroups.js';
import { useI18n, UI_LOCALES } from '../i18n/index.js';

// Fixed 6-category vocabulary (validate-data.js's own validCategories list)
// — data doesn't carry a display label, so this small map is UI-chrome text,
// not equipment data. "all" is the catalog-only "no filter" pseudo-category.
const CATEGORY_KEYS = {
  all: 'catalog.categoryAll',
  chest: 'catalog.categoryChest',
  back: 'catalog.categoryBack',
  shoulders: 'catalog.categoryShoulders',
  arms: 'catalog.categoryArms',
  core: 'catalog.categoryCore',
  legs: 'catalog.categoryLegs',
};
const CATEGORIES = ['all', ...new Set(EQUIPMENT.map((e) => e.category))];

/**
 * Direct reuse of the mockup's CatalogScreen.jsx structure (ux-design.md:
 * "no new design here"), with its data source swapped from kit-data.js's
 * 6-item invented shape to the real bundled data/equipment.json (27 items) —
 * tech-plan.md's Porting Plan, following the equipment-display-html skill's
 * conventions for card structure / image fallback / bilingual display.
 *
 * pwa-ui-language AC13/AC14 (tech-plan.md D12): equipment text (name,
 * description, video) follows this screen's own `Idioma` pill row, which
 * now DEFAULTS to the active UI locale instead of hardcoding 'es' — and
 * resets to it whenever the screen remounts (tab re-entry), because it is
 * never persisted (`useState`, not storage). Chrome around it — title,
 * category filter, muscle labels — follows the shared UI locale via `t`/
 * `locale` from `useI18n()`, independent of this screen-local override.
 */
export function CatalogScreen() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [lang, setLang] = useState(() => (UI_LOCALES.includes(locale) ? locale : 'es'));
  const [category, setCategory] = useState('all');

  const items = EQUIPMENT.filter((e) => category === 'all' || e.category === category);
  const wrap = { maxWidth: 900, margin: '0 auto', paddingInline: 'var(--page-pad-x)' };

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
      <ScreenHeader title={t('catalog.title')} subtitle={t('catalog.subtitle')} onSettings={() => navigate('/settings')} />

      <div style={{ ...wrap, marginTop: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 96px), 1fr))', gap: 10 }}>
          <StatCard value={String(EQUIPMENT_METADATA.totalEquipment ?? EQUIPMENT.length)} label={t('catalog.statMachines')} />
          <StatCard value={String(GYMS.length)} label={t('catalog.statGyms')} />
          <StatCard value={String(LANGUAGES.length)} label={t('catalog.statLanguages')} />
        </div>
      </div>

      <div style={{ ...wrap, marginTop: 'var(--space-6)' }}>
        <h2 style={{ font: 'var(--text-h4)', color: 'var(--bf-ink)', margin: '0 0 10px' }}>
          {t('catalog.gymsHeading')}
        </h2>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 12px' }}>
          {t('catalog.gymsHintBefore')}
          <strong>id</strong>
          {t('catalog.gymsHintAfter')}
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {GYMS.map((gym) => (
            <div
              key={gym.id}
              style={{
                background: 'var(--bf-white)',
                border: '1px solid var(--border-control)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{
                display: 'inline-block',
                font: '700 11px/1 var(--font-sans)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--bf-white)',
                background: 'var(--bf-purple)',
                borderRadius: 3,
                padding: '3px 7px',
                marginBottom: 6,
              }}>
                {`id ${gym.id}`}
              </div>
              <div style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{gym.name}</div>
              <div style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', marginTop: 4 }}>{gym.address}</div>
              {(gym.city || gym.neighborhood) && (
                <div style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {[gym.city, gym.neighborhood].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...wrap, marginTop: 'var(--space-6)', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('settings.languageHeading')}
          </span>
          {LANGUAGES.map((l) => (
            <FilterPill key={l} active={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </FilterPill>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('catalog.categoryFilterLabel')}
          </span>
          {CATEGORIES.map((c) => (
            <FilterPill key={c} active={category === c} onClick={() => setCategory(c)}>
              {t(CATEGORY_KEYS[c]) || c}
            </FilterPill>
          ))}
        </div>
      </div>

      <div
        style={{
          ...wrap,
          marginTop: 'var(--space-5)',
          paddingBottom: 'var(--space-10)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {items.map((item) => (
          <EquipmentCard
            key={item.id}
            name={equipmentDisplayName(item, lang)}
            modelCode={item.modelCode}
            series={item.series}
            imageUrl={mainImageUrl(item)}
            primaryMuscles={muscleGroupLabels(item.muscleGroup.primary, t)}
            secondaryMuscles={muscleGroupLabels(item.muscleGroup.secondary, t)}
            description={item.descriptions[lang] || item.descriptions.es}
            videoHref={(item.videos[lang] || item.videos.es || [])[0]?.url}
            manualHref={item.manuals?.[0]?.url}
          />
        ))}
        {items.length === 0 && (
          <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('catalog.noResults')}
          </div>
        )}
      </div>
    </div>
  );
}
