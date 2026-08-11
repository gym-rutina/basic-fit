import { tFor, DEFAULT_LOCALE } from '../i18n/index.js';

/**
 * "hoy" / "ayer" / "hace N días" — cosmetic day-granularity relative label
 * shared by Home and History.
 *
 * pwa-ui-language AC10 (tech-plan.md D8): `Intl.RelativeTimeFormat(locale,
 * {numeric:'auto'})` returns "anteayer" for -2 days in Spanish — shipping
 * that would silently rewrite copy that was already UAT-approved. So hoy/ayer
 * stay catalog literals, and only n>=2 goes through Intl, with
 * `numeric:'always'` — which reproduces today's Spanish byte-for-byte and
 * gets Belarusian's three plural forms (дні/дзён/дзень) for free.
 *
 * `Intl.RelativeTimeFormat.prototype.format(NaN)` throws a RangeError, where
 * the old `` `hace ${diffDays} días` `` template just rendered "hace NaN
 * días" — an unparseable date is handled BEFORE it reaches Intl, so this
 * degrades exactly as before instead of newly throwing.
 */
export function formatRelativeDays(dateStr, now = new Date(), { locale = DEFAULT_LOCALE, t = tFor(locale) } = {}) {
  const then = new Date(dateStr);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);

  if (Number.isNaN(diffDays)) return t('time.daysAgo', { n: diffDays });
  if (diffDays <= 0) return t('time.today');
  if (diffDays === 1) return t('time.yesterday');

  if (typeof Intl.RelativeTimeFormat === 'function') {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(-diffDays, 'day');
  }
  return t('time.daysAgo', { n: diffDays }); // old WebView degrades to the catalog template instead of throwing
}
