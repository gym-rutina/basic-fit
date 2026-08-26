import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { FilterPill } from '../../../design-system/components/primitives/FilterPill.jsx';
import { StatCard } from '../../../design-system/components/primitives/StatCard.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { SelectField } from '../../../design-system/components/primitives/SelectField.jsx';
import { EquipmentCard } from '../../../design-system/components/composite/EquipmentCard.jsx';
import { EQUIPMENT, EQUIPMENT_METADATA, LANGUAGES, mainImageUrl, equipmentDisplayName } from '../data/equipment.js';
import { TOTAL_CLUBS } from '../data/gyms.js';
import { muscleGroupLabels } from '../lib/muscleGroups.js';
import { readClub } from '../lib/clubStorage.js';
import { useClubExclusions } from '../lib/useClubExclusions.js';
import { ClubPickerSheet } from '../components/ClubPickerSheet.jsx';
import { EquipmentOverlaySheet } from '../components/EquipmentOverlaySheet.jsx';
import { useI18n, UI_LOCALES, LOCALE_AUTONYMS } from '../i18n/index.js';

// Fixed 8-category vocabulary (validate-data.js's own VALID_CATEGORIES list,
// gym-directory-and-catalog M11 added free-weights/accessories) — data
// doesn't carry a display label, so this small map is UI-chrome text, not
// equipment data. "all" is the catalog-only "no filter" pseudo-category.
const CATEGORY_KEYS = {
  all: 'catalog.categoryAll',
  chest: 'catalog.categoryChest',
  back: 'catalog.categoryBack',
  shoulders: 'catalog.categoryShoulders',
  arms: 'catalog.categoryArms',
  core: 'catalog.categoryCore',
  legs: 'catalog.categoryLegs',
  'free-weights': 'catalog.categoryFreeWeights',
  accessories: 'catalog.categoryAccessories',
};
const CATEGORIES = ['all', ...new Set(EQUIPMENT.map((e) => e.category))];

/**
 * gym-directory-and-catalog AC20/AC28/AC45, X4/X8, tech-plan.md D14,
 * tech-plan-build-b.md D19/D21/D22, OQ-D.
 *
 * The per-gym card grid and `GYMS.length` stat are GONE (X8): the directory
 * is 1,727 clubs now, and 1,727 cards is not a page. A single club row
 * replaces it — resolve/change the club via the picker, and (once a club is
 * selected) an "only my club" filter honouring the equipment overlay's
 * exclusions (R7.6/R7.7). OQ-D: the filter defaults to ON — inert until the
 * user actually excludes something, so a first-time visitor sees no change.
 *
 * pwa-ui-language AC13/AC14 (tech-plan.md D12): equipment text (name,
 * description, video) follows this screen's own language select (the
 * `catalog-language` SelectField below; pill-overflow-ux S2 replaced the
 * former pill row with it), which DEFAULTS to the active UI locale instead of
 * hardcoding 'es' — and resets to it whenever the screen remounts (tab
 * re-entry), because it is never persisted (`useState`, not storage). Chrome
 * around it — title, category filter, muscle labels — follows the shared UI
 * locale via `t`/`locale` from `useI18n()`, independent of this screen-local
 * override.
 */
export function CatalogScreen() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [lang, setLang] = useState(() => (UI_LOCALES.includes(locale) ? locale : 'es'));
  const [category, setCategory] = useState('all');
  const [club, setClub] = useState(() => readClub());
  const [onlyMyClub, setOnlyMyClub] = useState(true); // OQ-D — default ON, inert until an exclusion exists
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  // pill-overflow-ux D-A — adaptive category collapse. Collapsed count reads
  // the (min-width: 360px) media query: four ES pills physically fit only at
  // ≥360px (FilterPill real metrics, ux-design §0), so below that the row
  // collapses to two. jsdom has NO matchMedia → default TRUE is LOAD-BEARING:
  // unit tests exercise the wide 4-pill path deterministically and must not
  // be "fixed" to false. useState dies on unmount, so the collapse state is
  // screen-local (AC4) and nothing ever re-collapses it on pick (AC5).
  const [catsExpanded, setCatsExpanded] = useState(false);
  const [wide, setWide] = useState(() =>
    typeof window.matchMedia !== 'function' ? true : window.matchMedia('(min-width: 360px)').matches
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(min-width: 360px)');
    const on = (e) => setWide(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  const collapsedCount = wide ? 4 : 2;
  const visibleCategories = catsExpanded ? CATEGORIES : CATEGORIES.slice(0, collapsedCount);

  const { excludedIds } = useClubExclusions(club?.clubId ?? null);

  // D21 — excludedIds === null means "not loaded yet" and must render
  // UNFILTERED, exactly like an empty Set (both are "nothing excluded" from
  // the grid's point of view).
  const filterByClub = Boolean(club) && onlyMyClub && excludedIds && excludedIds.size > 0;
  const items = EQUIPMENT.filter((e) => {
    if (category !== 'all' && e.category !== category) return false;
    if (filterByClub && excludedIds.has(e.id)) return false;
    return true;
  });
  const wrap = { maxWidth: 900, margin: '0 auto', paddingInline: 'var(--page-pad-x)' };
  const cardStyle = {
    background: 'var(--bf-white)',
    border: '1px solid var(--border-control)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 16px',
    boxShadow: 'var(--shadow-card)',
  };

  function handleClubSelected(selected) {
    setClub(selected);
    setPickerOpen(false);
  }

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
      <ScreenHeader title={t('catalog.title')} subtitle={t('catalog.subtitle')} onSettings={() => navigate('/settings')} />

      <div style={{ ...wrap, marginTop: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 96px), 1fr))', gap: 10 }}>
          <StatCard value={String(EQUIPMENT_METADATA.totalEquipment ?? EQUIPMENT.length)} label={t('catalog.statMachines')} />
          <StatCard value={String(TOTAL_CLUBS)} label={t('catalog.statGyms')} />
          <StatCard value={String(LANGUAGES.length)} label={t('catalog.statLanguages')} />
        </div>
      </div>

      <div style={{ ...wrap, marginTop: 'var(--space-6)' }}>
        {!club ? (
          <div style={cardStyle}>
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '0 0 10px' }}>{t('catalog.clubRowEmptyHint')}</p>
            <Button variant="outline" onClick={() => setPickerOpen(true)}>
              {t('catalog.clubRowButton')}
            </Button>
          </div>
        ) : (
          <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{club.name}</div>
              <div style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', marginTop: 2 }}>{club.address}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <FilterPill active={onlyMyClub} onClick={() => setOnlyMyClub((v) => !v)}>
                {t('catalog.onlyMyClubPill')}
              </FilterPill>
              {/* R7.6 (D22a cycle-9): equipment overlay entry point.
                  Same i18n key as GuideOverlay's R7.1 trigger — one string,
                  two entry points — so the overlay is reachable from the
                  Catálogo even without opening the guide. */}
              <button
                type="button"
                onClick={() => setOverlayOpen(true)}
                style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--bf-purple)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px' }}
              >
                {t('club.equipmentOverlayTrigger')}
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                style={{ font: '600 13px/1 var(--font-sans)', color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px' }}
              >
                {t('club.changeButton')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...wrap, marginTop: 'var(--space-6)', display: 'grid', gap: 12 }}>
        {/* pill-overflow-ux S2 (AC7): the ES/EN/BE pill row is now a labelled
            select. Behaviour contract unchanged — `lang` stays screen-local,
            never persisted, and equipment name/description/video follow it
            (pwa-ui-language AC13/AC14). Option labels are autonyms (Rev5:
            an uppercased language code reads as a country code); LANGUAGES
            leads with en by data convention while UI_LOCALES leads with es —
            the option ORDER below follows the data on purpose. */}
        <SelectField
          id="catalog-language"
          label={t('catalog.languageLabel')}
          value={lang}
          options={LANGUAGES.map((l) => ({ value: l, label: LOCALE_AUTONYMS[l] || l.toUpperCase() }))}
          onChange={setLang}
        />
        {/* pill-overflow-ux S1 (AC1–AC5): collapsed-first category row.
            Collapsed shows the first `collapsedCount` of CATEGORIES order and
            bans wraps (the whole point of the collapse); expanded re-flows
            the SAME row with wrap allowed and moves the toggle last. The
            toggle is deliberately a plain button carrying FilterPill's VISUAL
            tokens — NOT FilterPill itself, which would impose aria-pressed
            semantics onto what is semantically aria-expanded/aria-controls
            (tech-plan.md D-A). */}
        <div>
          <span style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('catalog.categoryFilterLabel')}
          </span>
          <div
            id="catalog-category-row"
            style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: catsExpanded ? 'wrap' : 'nowrap' }}
          >
            {visibleCategories.map((c) => (
              <FilterPill key={c} active={category === c} onClick={() => setCategory(c)}>
                {t(CATEGORY_KEYS[c]) || c}
              </FilterPill>
            ))}
            <button
              type="button"
              aria-expanded={catsExpanded}
              aria-controls="catalog-category-row"
              onClick={() => setCatsExpanded((v) => !v)}
              style={{
                padding: '11px 22px',
                font: '600 15px/1.2 var(--font-sans)',
                borderRadius: 'var(--radius-control)',
                cursor: 'pointer',
                border: '1px solid var(--border-control)',
                background: 'var(--bf-white)',
                color: 'var(--bf-ink)',
                whiteSpace: 'nowrap',
              }}
            >
              {catsExpanded
                ? t('catalog.showLessCategories')
                : t('catalog.showMoreCategories', { n: CATEGORIES.length - collapsedCount })}
            </button>
          </div>
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
        {items.map((item) => {
          const primaryLabels = muscleGroupLabels(item.muscleGroup.primary, t);
          const secondaryLabels = muscleGroupLabels(item.muscleGroup.secondary, t);
          return (
            <EquipmentCard
              key={item.id}
              name={equipmentDisplayName(item, lang)}
              modelCode={item.modelCode}
              series={item.series}
              imageUrl={mainImageUrl(item)}
              primaryMuscles={primaryLabels}
              secondaryMuscles={secondaryLabels}
              /* pill-overflow-ux D-E: the design system is i18n-free, so the
                 +N chip's accessible names arrive finished from the caller.
                 Singular/plural is picked HERE by count (fix-cycle #1). */
              secondaryMoreLabel={
                secondaryLabels.length === 1
                  ? t('muscles.showMoreOne', { n: secondaryLabels.length })
                  : t('muscles.showMore', { n: secondaryLabels.length })
              }
              secondaryLessLabel={t('muscles.showLess')}
              description={item.descriptions[lang] || item.descriptions.es}
              videoHref={(item.videos[lang] || item.videos.es || [])[0]?.url}
              manualHref={item.manuals?.[0]?.url}
            />
          );
        })}
        {items.length === 0 && (
          <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('catalog.noResults')}
          </div>
        )}
      </div>

      {pickerOpen && <ClubPickerSheet onSelect={handleClubSelected} onClose={() => setPickerOpen(false)} />}
      {/* R7.6 (D22a cycle-9): overlay alongside the picker. CatalogScreen is
          not itself a dialog so singlar findByRole('dialog') is unambiguous
          when only the overlay is open (ClubPickerSheet gated on pickerOpen,
          which is never set by the R7.6 test — Bagnik confirmed this safe). */}
      {overlayOpen && club && (
        <EquipmentOverlaySheet
          club={{ clubId: club.clubId, name: club.name, city: club.city, address: club.address }}
          onClose={() => setOverlayOpen(false)}
        />
      )}
    </div>
  );
}
