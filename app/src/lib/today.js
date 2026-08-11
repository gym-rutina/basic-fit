/**
 * "Today" resolution — resolves ux-design.md's flagged spec gap (spec.md
 * doesn't define how a day's free-text `label` maps to a real weekday).
 *
 * Heuristic (confirmed at architecture phase, tech-plan.md): best-effort
 * case/accent-insensitive match of days[].label against the weekday name
 * for `now`; falls back to the first day in days[] with no completed
 * session in pastSessions, else day 0 (schema's minItems:1 floor).
 *
 * pwa-ui-language AC18 (D2): matched against ALL THREE UI locales' weekday
 * names, not just Spanish — axis-3 content language and axis-1 UI language
 * are independent (the whole premise of the three-axis model), so the match
 * does not depend on which UI locale happens to be active. `today.js` keeps
 * its zero-imports, explicit-table boundary rule: an `Intl.DateTimeFormat`
 * lookup would make a pure matching function depend on the host's ICU
 * build, and Belarusian weekday data is exactly what a small-ICU CI image
 * drops.
 */

const WEEKDAY_NAMES = {
  es: ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
  en: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  be: ['нядзеля', 'панядзелак', 'аўторак', 'серада', 'чацвер', 'пятніца', 'субота'],
};

// Explicit map rather than Unicode NFD-decomposition regex stripping — the
// day-label alphabet this heuristic ever needs to fold is a small known set
// (es/en/be weekday names), so an explicit table is both simpler and
// unambiguous to review/maintain than a combining-diacritic regex. Cyrillic
// has no accented forms in this set, so it needs no entries here — only
// case-folding, which toLowerCase() already handles.
const ACCENT_FOLD = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n',
  Á: 'a', É: 'e', Í: 'i', Ó: 'o', Ú: 'u', Ü: 'u', Ñ: 'n',
};

function normalize(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => ACCENT_FOLD[ch] || ch)
    .join('');
}

/**
 * @param {Array<{label: string}>} days - rutina.days
 * @param {Date} now
 * @param {Array<{dayIndex: number, status: string}>} pastSessions
 * @returns {{mode: 'today'|'next', index: number, day: object}}
 */
export function resolveTodayDay(days, now, pastSessions = []) {
  // The set of {es, en, be} names for TODAY's weekday only — no weekday name
  // in one of these three languages equals a weekday name for a different
  // day in another, so this never blurs into "any weekday matches".
  const todayNames = new Set(
    Object.values(WEEKDAY_NAMES).map((names) => normalize(names[now.getDay()]))
  );
  const todayIndex = days.findIndex((d) => todayNames.has(normalize(d.label)));
  if (todayIndex !== -1) {
    return { mode: 'today', index: todayIndex, day: days[todayIndex] };
  }

  const completedIndexes = new Set(
    (pastSessions || []).filter((s) => s.status === 'completed').map((s) => s.dayIndex)
  );
  const nextIndex = days.findIndex((_, i) => !completedIndexes.has(i));
  const index = nextIndex === -1 ? 0 : nextIndex;
  return { mode: 'next', index, day: days[index] };
}
