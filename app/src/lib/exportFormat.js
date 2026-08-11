import { difficultyLabel } from './difficulty.js';
import { exerciseKey } from './exerciseKey.js';
import { defaultT, DEFAULT_LOCALE } from '../i18n/index.js';

/**
 * Export formatter — turns session history into the two portable artifacts
 * spec.md's Export ACs ask for: a JSON payload keyed by exercise, and a
 * Markdown summary written to be pasted into an LLM chat.
 *
 * Both outputs are derived from the SAME per-exercise chronological
 * grouping so they can never drift apart from each other.
 *
 * pwa-ui-language AC19/AC20 (tech-plan.md D15/D16): the Markdown SCAFFOLDING
 * (headings, the abandoned-session marker, the empty state, the difficulty
 * word) is chrome and follows the UI locale; the JSON payload's keys, the
 * difficulty enum tokens, and every axis-3 value are a frozen data contract
 * (docs/export-format.md) and never move. Collation (AC19) is applied ONLY
 * to the order the markdown groups are emitted in — `json.exercises`/
 * `json.exerciseNames` keep the pre-existing Map insertion order, which is a
 * tested contract (exportFormat.test.js's `Object.keys(json.exercises)`
 * assertions).
 */

/**
 * Groups every *logged* exercise (completedAt set) across sessions by
 * exercise key, chronological ascending (exercise-level-tracking AC13/AC14).
 * An exercise whose key is `null` (not trackable) contributes nothing, same
 * as an abandoned/skipped/never-reached exercise.
 */
function groupByExercise(sessions) {
  const groups = new Map(); // exerciseKey -> { name, equipmentId, entries: [{date, weightUsed, difficulty}] }

  for (const session of sessions) {
    for (const ex of session.exercises || []) {
      if (ex.completedAt == null) continue; // abandoned/skipped/never-reached — contributes nothing (spec.md Export AC)
      const key = exerciseKey(ex);
      if (key == null) continue;
      if (!groups.has(key)) {
        groups.set(key, { name: ex.name, equipmentId: ex.equipmentId, entries: [] });
      }
      groups.get(key).entries.push({
        date: ex.completedAt.slice(0, 10),
        weightUsed: ex.weightUsed,
        difficulty: ex.difficulty,
      });
    }
  }

  for (const group of groups.values()) {
    group.entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  return groups;
}

function inRange(dateStr, from, to) {
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function formatEntryLine(entry, t) {
  return `${entry.weightUsed}kg / ${difficultyLabel(entry.difficulty, t).toLowerCase()}`;
}

/**
 * @param {Array} sessions - full session history (any status)
 * @param {{from?: string, to?: string}} range - inclusive YYYY-MM-DD bounds, both optional
 * @param {{t?: (key: string, params?: object) => string, locale?: string}} chrome - D4/AC20: defaults keep every existing call site's Spanish output byte-identical
 * @returns {{json: {exercises: Record<string, Array<{date:string, weightUsed:number, difficulty:string}>>, exerciseNames: Record<string,string>}, markdown: string}}
 */
export function buildExportPayload(sessions = [], { from, to } = {}, { t = defaultT, locale = DEFAULT_LOCALE } = {}) {
  const groups = groupByExercise(sessions);

  const json = { exercises: {}, exerciseNames: {} };
  const included = []; // { key, group, entries } — kept separate from json so markdown can sort without touching json's insertion order

  for (const [key, group] of groups) {
    const entries = group.entries.filter((e) => inRange(e.date, from, to));
    if (entries.length === 0) continue;

    json.exercises[key] = entries.map(({ date, weightUsed, difficulty }) => ({ date, weightUsed, difficulty }));
    json.exerciseNames[key] = group.name;
    included.push({ group, entries });
  }

  // AC19 — collation: markdown groups are ordered by localeCompare under the
  // active locale, not Map insertion order, so two exports of the same
  // history are byte-identical regardless of the order sessions were
  // logged. `json.exercises`/`json.exerciseNames` above are NOT re-sorted —
  // that key order is a tested contract (exportFormat.test.js).
  const sortedForMarkdown = [...included].sort((a, b) => a.group.name.localeCompare(b.group.name, locale));

  const lines = [];
  for (const { group, entries } of sortedForMarkdown) {
    lines.push(group.equipmentId ? `${group.name} (${group.equipmentId})` : group.name);
    entries.forEach((e) => lines.push(`  · ${formatEntryLine(e, t)}`));
    lines.push('');
  }

  const abandonedSessions = sessions.filter(
    (s) => s.status === 'abandoned' && inRange((s.startedAt || '').slice(0, 10), from, to)
  );
  if (abandonedSessions.length > 0) {
    lines.push(`${t('export.unfinishedSessions')}`);
    abandonedSessions.forEach((s) =>
      lines.push(`  · ${s.dayLabel} — ${(s.startedAt || '').slice(0, 10)} (${t('export.abandonedMarker')})`)
    );
    lines.push('');
  }

  const markdown = lines.length > 0 ? lines.join('\n').trimEnd() : t('export.empty');

  return { json, markdown };
}
