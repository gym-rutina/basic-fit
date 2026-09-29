import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { FilterPill } from '../../../design-system/components/primitives/FilterPill.jsx';
import { StatCard } from '../../../design-system/components/primitives/StatCard.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { SelectField } from '../../../design-system/components/primitives/SelectField.jsx';
import { EquipmentCard } from '../../../design-system/components/composite/EquipmentCard.jsx';
import { EQUIPMENT, EQUIPMENT_METADATA, LANGUAGES, mainImageUrl, equipmentDisplayName } from '../data/equipment.js';
import { TOTAL_CLUBS } from '../data/gyms.js';
import { muscleGroupLabels } from '../lib/muscleGroups.js';
import { readClub } from '../lib/clubStorage.js';
import { useClubExclusions } from '../lib/useClubExclusions.js';
import { ClubMembershipChip } from '../components/ClubMembershipChip.jsx';
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
 * is 1,727 clubs now, and 1,727 cards is not a page. Once a club is selected
 * an "only my club" filter honours the club's exclusions (R7.6/R7.7). OQ-D:
 * the filter defaults to ON — inert until the user actually excludes
 * something, so a first-time visitor sees no change.
 *
 * move-club-picker-to-settings: club MANAGEMENT (identity row, picker, the
 * equipment overlay) moved to Settings' "Mi club" section — this screen only
 * reads the stored club once (D3: nothing here can change it; the screen
 * re-mounts on tab re-entry). What stays: the "Solo mi club" pill (AC5/AC6 —
 * structurally absent with no club) and, per card, a `ClubMembershipChip`
 * (AC7/AC8) rendered HERE rather than in the design-system EquipmentCard.
 * `useClubExclusions` is called exactly ONCE below and its exclude/include are
 * threaded into every chip (AC10 — a single mutation path, no second write
 * site; a per-chip hook would also break the accumulating-write contract).
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
  const [club] = useState(() => readClub()); // D3 — read once; no setter, nothing here changes the club
  const [onlyMyClub, setOnlyMyClub] = useState(true); // OQ-D — default ON, inert until an exclusion exists

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

  // AC10 — the ONE useClubExclusions call in this screen; every chip below is
  // driven by these four values.
  const { excludedIds, exclude, include, writeFailed } = useClubExclusions(club?.clubId ?? null);

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

  // S5 (ux-design §5, OQ-2) — the grid is empty BECAUSE of the club filter.
  // Categories are derived from EQUIPMENT, so an empty category never occurs
  // and `filterByClub` is the whole discriminator.
  const clubFilterEmpty = items.length === 0 && Boolean(filterByClub);

  // D8 — focus lands on the pill when the club-filter empty state APPEARS from
  // a chip tap (false→true only), so a load that arrives already-empty or a
  // category change never steals focus. FilterPill is a function component
  // (React 18: no ref), so the ref sits on a wrapper and the button is found
  // inside it. Runs after every commit so `chipExcluded` cannot go stale.
  const pillWrapRef = useRef(null);
  const wasClubFilterEmpty = useRef(false);
  const chipExcluded = useRef(false);
  useEffect(() => {
    if (clubFilterEmpty && !wasClubFilterEmpty.current && chipExcluded.current) {
      pillWrapRef.current?.querySelector('button')?.focus();
    }
    wasClubFilterEmpty.current = clubFilterEmpty;
    chipExcluded.current = false;
  });

  function handleChipExclude(id) {
    chipExcluded.current = true;
    exclude(id);
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

      {/* move-club-picker-to-settings AC4/S2: the club identity row, the
          choose/change buttons and the equipment-overlay entry are GONE from
          this screen — unconditionally, in every state. Club management lives
          in Settings' "Mi club" section. */}
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
        {/* S3 (D7): the "Solo mi club" pill, re-homed from the deleted club
            card onto its own line under the category block. AC6 — with no
            club it is structurally ABSENT (nothing rendered), not a disabled
            control. Semantics unchanged: default ON, inert until exclusions
            load non-empty (`filterByClub` above, verbatim). The wrapper div
            carries the ref for the S5 focus hand-off (FilterPill takes none). */}
        {club && (
          <div ref={pillWrapRef}>
            <FilterPill active={onlyMyClub} onClick={() => setOnlyMyClub((v) => !v)}>
              {t('catalog.onlyMyClubPill')}
            </FilterPill>
          </div>
        )}
      </div>

      {/* D2 / R7.3 — ONE screen-level write-failure note. `writeFailed` is a
          single hook-wide flag, so per-chip alerts would all fire together;
          and under pill ON the toggled card leaves the grid on the same
          render, which would take a card-anchored note with it. The toggle
          itself is already applied in memory (never blocked); the note clears
          on the next good write (hook contract). */}
      {club && writeFailed && (
        <div style={{ ...wrap, marginTop: 'var(--space-5)' }}>
          <div
            role="alert"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bf-danger-tint)', border: '1px solid var(--bf-danger)', borderRadius: 'var(--radius-md)', padding: '8px 12px', font: 'var(--text-body-sm)', color: 'var(--bf-danger)' }}
          >
            <Icon name="alert-triangle" size={16} style={{ flexShrink: 0 }} />
            {t('overlay.writeFailedNote')}
          </div>
        </div>
      )}

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
          const displayName = equipmentDisplayName(item, lang);
          // S4 — chips exist only with a club AND loaded exclusions
          // (excludedIds === null ⇒ no strip, grid unfiltered: AC9 tri-state).
          const showChip = Boolean(club) && excludedIds !== null;
          const excluded = showChip && excludedIds.has(item.id);
          return (
            <div key={item.id} style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              {/* An excluded card is dimmed (only reachable with the pill OFF,
                  ux-design §4); the wrapper dims the CARD, not its chip. */}
              <div style={excluded ? { opacity: 0.62 } : undefined}>
                <EquipmentCard
                  name={displayName}
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
              </div>
              {showChip && (
                <ClubMembershipChip
                  name={displayName}
                  included={!excluded}
                  onExclude={() => handleChipExclude(item.id)}
                  onInclude={() => include(item.id)}
                />
              )}
            </div>
          );
        })}
        {items.length === 0 &&
          (clubFilterEmpty ? (
            // S5 — role="status" so the emptying is announced; names both ways
            // out (pill off / Settings). Focus moves to the pill (effect above).
            <div
              role="status"
              style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}
            >
              {t('catalog.clubFilterEmpty')}
            </div>
          ) : (
            <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('catalog.noResults')}
            </div>
          ))}
      </div>
    </div>
  );
}
