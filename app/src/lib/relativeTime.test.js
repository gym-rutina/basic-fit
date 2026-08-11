import { describe, it, expect, afterEach, vi } from 'vitest';
import { formatRelativeDays } from './relativeTime.js';

/**
 * pwa-ui-language AC10 (tech-plan.md D8).
 *
 * The measured reason this is not a one-liner: `Intl.RelativeTimeFormat`
 * with `numeric:'auto'` returns **"anteayer"** for −2 days in Spanish.
 * Adopting it wholesale would have silently rewritten shipped, UAT-approved
 * copy. So `hoy`/`ayer` come from the catalog and only n>=2 goes through Intl,
 * with `numeric:'always'` — which reproduces today's Spanish byte for byte and
 * still gets Belarusian's three plural forms for free.
 */

const NOW = new Date('2026-07-15T12:00:00');
const daysBefore = (n) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

afterEach(() => vi.restoreAllMocks());

describe('formatRelativeDays — Spanish output is unchanged (AC10, AC22)', () => {
  it('renders today/yesterday exactly as it always has', () => {
    expect(formatRelativeDays(daysBefore(0), NOW)).toBe('hoy');
    expect(formatRelativeDays(daysBefore(1), NOW)).toBe('ayer');
  });

  it('renders n>=2 exactly as it always has', () => {
    expect(formatRelativeDays(daysBefore(2), NOW)).toBe('hace 2 días');
    expect(formatRelativeDays(daysBefore(3), NOW)).toBe('hace 3 días');
    expect(formatRelativeDays(daysBefore(21), NOW)).toBe('hace 21 días');
  });

  it('never says "anteayer" — numeric:"auto" would, and that is a copy change', () => {
    expect(formatRelativeDays(daysBefore(2), NOW)).not.toContain('anteayer');
  });

  it('treats a future date as today, as it always has', () => {
    expect(formatRelativeDays(daysBefore(-3), NOW)).toBe('hoy');
  });

  it('defaults to Spanish when no locale is given (D4 — every existing call site)', () => {
    expect(formatRelativeDays(daysBefore(2), NOW)).toBe('hace 2 días');
  });
});

describe('formatRelativeDays — English (AC10)', () => {
  it('renders the English forms', () => {
    expect(formatRelativeDays(daysBefore(0), NOW, { locale: 'en' })).toBe('today');
    expect(formatRelativeDays(daysBefore(1), NOW, { locale: 'en' })).toBe('yesterday');
    expect(formatRelativeDays(daysBefore(2), NOW, { locale: 'en' })).toBe('2 days ago');
    expect(formatRelativeDays(daysBefore(5), NOW, { locale: 'en' })).toBe('5 days ago');
  });
});

describe('formatRelativeDays — Belarusian plural forms (AC10)', () => {
  it('renders сёння / учора from the catalog', () => {
    expect(formatRelativeDays(daysBefore(0), NOW, { locale: 'be' })).toBe('сёння');
    expect(formatRelativeDays(daysBefore(1), NOW, { locale: 'be' })).toBe('учора');
  });

  it('picks the right plural form for 2-4, 5+ and 21 — which is why Intl does this, not t()', () => {
    expect(formatRelativeDays(daysBefore(3), NOW, { locale: 'be' })).toBe('3 дні таму');
    expect(formatRelativeDays(daysBefore(5), NOW, { locale: 'be' })).toBe('5 дзён таму');
    expect(formatRelativeDays(daysBefore(21), NOW, { locale: 'be' })).toBe('21 дзень таму');
  });
});

describe('formatRelativeDays — degradation', () => {
  it('falls back to the catalog template when Intl.RelativeTimeFormat is missing', () => {
    // Old WebViews. The string is worse, the app still renders.
    const original = Intl.RelativeTimeFormat;
    try {
      // eslint-disable-next-line no-global-assign
      Intl.RelativeTimeFormat = undefined;
      expect(formatRelativeDays(daysBefore(4), NOW)).toBe('hace 4 días');
      expect(() => formatRelativeDays(daysBefore(4), NOW, { locale: 'be' })).not.toThrow();
    } finally {
      Intl.RelativeTimeFormat = original;
    }
  });

  it('does not throw on an unparseable date', () => {
    expect(() => formatRelativeDays('not-a-date', NOW)).not.toThrow();
  });
});
