/**
 * The prompt's inlined, club-scoped equipment table (spec.md R6.2/R6.5/R6.6,
 * AC40/AC42/AC43, tech-plan.md D12).
 *
 * Replaces the old instruction to fetch equipment.json and filter it by a
 * `gyms` array (deleted from the catalog in Build A) with a literal-text
 * table embedded directly in the prompt: `id, modelCode, name(output
 * language), category, muscleGroup`, minus the user's exclusions.
 *
 * Pure module — zero React imports. The fixed prompt copy below (heading,
 * notes) is looked up via `tFor(lang)` from the `promptEquipment.*` catalog
 * keys (i18n/{es,en,be}.js) rather than inlined per-locale objects, matching
 * every other pure lib module's convention (i18n/index.js D4 — a non-React
 * module takes/derives a translator instead of hand-rolling its own
 * per-locale table). AC9's stray-Spanish-literal sweep is what caught the
 * inlined version this file shipped with first.
 */
import { tFor } from '../i18n/index.js';

/**
 * Byte length via `TextEncoder`, never `String.length` — the table carries
 * Spanish and Belarusian names where e.g. 'ж'.length === 1 but its UTF-8
 * encoding is 2 bytes. Measuring in UTF-16 code units would under-report
 * the `be` table's real size by roughly 40%.
 *
 * @param {string} str
 * @returns {number}
 */
export function equipmentTableBytes(str) {
  if (!str) return 0;
  return new TextEncoder().encode(str).length;
}

function resolveExcludedSet(excludedIds) {
  if (excludedIds instanceof Set) return excludedIds;
  if (Array.isArray(excludedIds)) return new Set(excludedIds);
  return new Set();
}

function resolveName(item, lang) {
  const names = item && item.names;
  if (!names) return '';
  return names[lang] || names.es || names.en || '';
}

function resolveMuscleGroupSummary(item) {
  const primary = (item && item.muscleGroup && item.muscleGroup.primary) || [];
  return primary.join('/');
}

/**
 * Builds the inlined equipment table as literal text — one row per
 * non-excluded entry, `|`-delimited: `id | modelCode | name | category |
 * muscleGroup`.
 *
 * `excludedIds` accepts a `Set` (the shape `useClubExclusions` — D21 —
 * holds) or an array; `null`/`undefined` means "nothing excluded", never a
 * crash (the hook's tri-state has `excludedIds === null` while IndexedDB
 * has not answered yet).
 *
 * @param {Array} equipment
 * @param {{lang?: string, excludedIds?: Set<string>|string[]|null}} [opts]
 * @returns {string}
 */
export function buildEquipmentTable(equipment, { lang = 'es', excludedIds } = {}) {
  const excluded = resolveExcludedSet(excludedIds);
  const rows = (Array.isArray(equipment) ? equipment : [])
    .filter((item) => item && !excluded.has(item.id))
    .map((item) =>
      [item.id, item.modelCode, resolveName(item, lang), item.category, resolveMuscleGroupSummary(item)].join(' | ')
    );
  return rows.join('\n');
}

/**
 * Builds the field-6 club line plus the inlined equipment table plus the
 * extraEquipment/equipmentId authoring notes — the single merged rewrite of
 * the prompt's equipment section (R6.1-R6.6).
 *
 * `club` is optional (R5.6 — the flow must never be blocked by an
 * unresolved club): when absent, field 6 renders a placeholder rather than
 * throwing.
 *
 * @param {{equipment: Array, lang?: string, excludedIds?: Set<string>|string[]|null, club?: {clubId?: string, name?: string, city?: string, address?: string}|null}} args
 * @returns {string}
 */
export function buildPrompt({ equipment, lang = 'es', excludedIds, club }) {
  const t = tFor(lang);
  const table = buildEquipmentTable(equipment, { lang, excludedIds });
  const clubLine =
    club && club.name ? `${club.name}, ${club.city}, ${club.address} (${club.clubId})` : t('promptEquipment.noClubSelected');

  return [
    `${t('promptEquipment.clubHeading')}:`,
    clubLine,
    '',
    `${t('promptEquipment.tableHeading')}:`,
    table,
    '',
    t('promptEquipment.equipmentIdNote'),
    t('promptEquipment.exceptionNote'),
  ].join('\n');
}
