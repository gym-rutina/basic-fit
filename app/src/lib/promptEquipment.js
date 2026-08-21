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
import { tFor, LOCALE_AUTONYMS, DEFAULT_LOCALE } from '../i18n/index.js';

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

/**
 * The 8 REQUEST field labels — English scaffolding, hardcoded here rather
 * than looked up via `t()` (onboarding-request-fields DD-001: Q2 deferred,
 * scaffolding stays English regardless of UI locale). This is also byte-for-
 * byte the same wording the old `docs/llm-rutina-prompt-template.txt`
 * `### REQUEST` block carried before this feature moved it to runtime
 * composition (tech-plan.md §2.5), so R6.3's "original placeholder line
 * unchanged" holds by construction for the unanswered case.
 */
const REQUEST_LABELS = {
  1: 'Who is this for / program name',
  2: 'Primary goal this phase',
  3: 'Days per week',
  4: 'Session length budget',
  5: 'Injuries / movements to avoid (write "none"/"ninguna" if none)',
  6: "Target gym (pre-filled by the app's club picker — name, city, address and available equipment ids are listed in the EQUIPMENT section appended below)",
  7: 'Language for the output text',
  8: 'Prior progress export (optional — paste Markdown from Rutina app Export, or leave blank)',
};

function textValue(value) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Formats one numbered REQUEST line. An unanswered field renders its bare
 * `N. Label:` placeholder (R6.3) — never `null`/`undefined`/`NaN` (AC31). A
 * multi-line value (field 5, field 8) has every continuation line indented
 * so the numbered-line scan a consuming LLM (and this module's own tests)
 * performs never mistakes a continuation line for the next field (AC32, R6.6).
 *
 * @param {number} n
 * @param {string|number|undefined} value
 * @returns {string}
 */
function formatRequestField(n, value) {
  const label = REQUEST_LABELS[n];
  if (value === undefined || value === null || value === '') return `${n}. ${label}:`;
  const lines = String(value).split('\n');
  const first = `${n}. ${label}: ${lines[0]}`;
  if (lines.length === 1) return first;
  return [first, ...lines.slice(1).map((line) => `   ${line}`)].join('\n');
}

/**
 * Builds the ### REQUEST block at runtime from the user's persisted answers,
 * the selected club, and the session-history export (onboarding-request-
 * fields R1.7, R1.8, R6.1-R6.6, AC4, AC30-AC32, tech-plan.md §2.2). This is
 * the ONE place the 8-line REQUEST block is produced — the template's own
 * copy of it is deleted (tech-plan.md §2.5).
 *
 * - field 1/2/4: `N. Label: value` or the bare `N. Label:` placeholder.
 * - field 3: the sanitized integer 1-7, or the bare placeholder — this
 *   function re-validates with `Number.isInteger` rather than trusting the
 *   caller, so a non-integer reaching this function some other way than
 *   `promptRequestStorage.js` still degrades to "unanswered" (AC31).
 * - field 5/8: multi-line values get every continuation line indented
 *   (R6.6) so "8." stays the last numbered REQUEST line.
 * - field 6: `club.name, club.city, club.address` when a club is selected —
 *   read from the SAME `club` param the caller already has (GuideOverlay/
 *   OnboardingOverlay pass the same club into `buildPrompt`), never a
 *   second read of club storage from inside this pure module (R1.3).
 * - field 7: `LOCALE_AUTONYMS[locale]` (R1.4) — never blank, since a locale
 *   always resolves to one of the three shipped autonyms.
 * - field 8: `sessionsMarkdown` when `sessionsIncluded` is true, else the
 *   bare placeholder (R4.1-R4.3).
 *
 * @param {{answers?: object, club?: {name?: string, city?: string, address?: string}|null, sessionsMarkdown?: string, sessionsIncluded?: boolean, locale?: string}} args
 * @returns {string}
 */
export function composeRequestBlock({ answers, club, sessionsMarkdown, sessionsIncluded, locale = DEFAULT_LOCALE } = {}) {
  const a = answers || {};
  const field3 = Number.isInteger(a.field3) ? a.field3 : undefined;
  const field6 = club && club.name ? `${club.name}, ${club.city}, ${club.address}` : undefined;
  const field7 = LOCALE_AUTONYMS[locale] || LOCALE_AUTONYMS[DEFAULT_LOCALE];
  const field8 = sessionsIncluded && sessionsMarkdown ? sessionsMarkdown : undefined;

  const lines = [
    formatRequestField(1, textValue(a.field1)),
    formatRequestField(2, textValue(a.field2)),
    formatRequestField(3, field3),
    formatRequestField(4, textValue(a.field4)),
    formatRequestField(5, textValue(a.field5)),
    formatRequestField(6, field6),
    formatRequestField(7, field7),
    formatRequestField(8, field8),
  ];

  return `### REQUEST\n\n${lines.join('\n')}\n`;
}

/**
 * The ONE assembly point for the full composed prompt (R6.1, AC35,
 * tech-plan.md §2.2): `composeRequestBlock(...)` + the build-time-generated
 * `guidePromptText` (ROLE..OUTPUT, SCHEMA already inlined by
 * `scripts/build-guide-content.js`) + the existing `buildPrompt(...)` club +
 * equipment tail.
 *
 * `guidePromptText` is a PARAMETER, never an import of `guideContent.js`
 * from inside this module — that is what keeps this function pure and
 * unit-testable with a fixture string instead of the real generated file.
 * The caller (GuideOverlay) passes the real `GUIDE_PROMPT` import.
 *
 * @param {{answers?: object, equipment: Array, lang?: string, excludedIds?: Set<string>|string[]|null, club?: object|null, sessionsMarkdown?: string, sessionsIncluded?: boolean, guidePromptText: string}} args
 * @returns {string}
 */
export function composePrompt({ answers, equipment, lang = 'es', excludedIds, club, sessionsMarkdown, sessionsIncluded, guidePromptText }) {
  const requestBlock = composeRequestBlock({ answers, club, sessionsMarkdown, sessionsIncluded, locale: lang });
  const equipmentSection = buildPrompt({ equipment, lang, excludedIds, club });
  return `${requestBlock}\n${guidePromptText}\n${equipmentSection}`;
}
