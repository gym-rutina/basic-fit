import { describe, it, expect } from 'vitest';
import { UI_LOCALES, DEFAULT_LOCALE, CATALOGS, tFor, defaultT } from './index.js';

/**
 * pwa-ui-language AC4 (lookup + fallback) and AC21 (catalog parity).
 *
 * AC21 is what keeps AC4's fallback from ever firing in production: if the
 * three catalogs always carry the same keys, a missing-key fallback can only
 * mean a typo at a call site, never a half-translated release.
 *
 * Catalogs are FLAT dotted-key objects on purpose (tech-plan.md D3) — the
 * parity assertion below is then a set comparison that a nested-but-empty
 * object cannot fake.
 */

const ANCHORS = {
  'tab.home': { es: 'Inicio', en: 'Home', be: 'Галоўная' },
  'tab.program': { es: 'Programa', en: 'Program', be: 'Праграма' },
  'tab.catalog': { es: 'Catálogo', en: 'Catalog', be: 'Каталог' },
  'tab.history': { es: 'Historial', en: 'History', be: 'Гісторыя' },
  'tab.progress': { es: 'Progreso', en: 'Progress', be: 'Прагрэс' },
  'settings.title': { es: 'Ajustes', en: 'Settings', be: 'Налады' },
  'settings.languageHeading': { es: 'Idioma', en: 'Language', be: 'Мова' },
  'common.back': { es: 'Volver', en: 'Back', be: 'Назад' },
  'common.cancel': { es: 'Cancelar', en: 'Cancel', be: 'Скасаваць' },
  'time.today': { es: 'hoy', en: 'today', be: 'сёння' },
  'time.yesterday': { es: 'ayer', en: 'yesterday', be: 'учора' },
  'onboarding.skip': { es: 'Saltar', en: 'Skip', be: 'Прапусціць' },
  'onboarding.next': { es: 'Siguiente', en: 'Next', be: 'Далей' },
};

describe('catalog parity (AC21)', () => {
  it('ships one catalog per UI locale and nothing else', () => {
    expect(Object.keys(CATALOGS).sort()).toEqual([...UI_LOCALES].sort());
  });

  it('gives every catalog an identical key set', () => {
    const reference = Object.keys(CATALOGS[DEFAULT_LOCALE]).sort();
    for (const locale of UI_LOCALES) {
      const keys = Object.keys(CATALOGS[locale]).sort();
      const missing = reference.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !reference.includes(k));
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    }
  });

  it('has no empty or whitespace-only value anywhere', () => {
    for (const locale of UI_LOCALES) {
      const blanks = Object.entries(CATALOGS[locale])
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => k);
      expect({ locale, blanks }).toEqual({ locale, blanks: [] });
    }
  });

  it('uses flat dotted keys, never nested objects', () => {
    // A nested catalog would make the parity check above vacuous.
    for (const locale of UI_LOCALES) {
      const nested = Object.entries(CATALOGS[locale])
        .filter(([, v]) => v !== null && typeof v === 'object')
        .map(([k]) => k);
      expect({ locale, nested }).toEqual({ locale, nested: [] });
    }
  });

  it('leaves every interpolation token resolvable in every locale', () => {
    // `hace {n} días` must not become `hace {count} dni` in another catalog.
    const tokensOf = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(CATALOGS[DEFAULT_LOCALE])) {
      const reference = tokensOf(CATALOGS[DEFAULT_LOCALE][key]);
      for (const locale of UI_LOCALES) {
        expect({ key, locale, tokens: tokensOf(CATALOGS[locale][key]) }).toEqual({ key, locale, tokens: reference });
      }
    }
  });
});

describe('anchor copy is a contract (AC6)', () => {
  it.each(Object.entries(ANCHORS))('%s reads the same in every locale as the tech plan says', (key, expected) => {
    for (const locale of UI_LOCALES) {
      expect(tFor(locale)(key)).toBe(expected[locale]);
    }
  });
});

describe('translate (AC4)', () => {
  it('returns the active locale value', () => {
    expect(tFor('en')('tab.home')).toBe('Home');
    expect(tFor('be')('tab.home')).toBe('Галоўная');
  });

  it('falls back to the es catalog, not to en, for a key missing in a locale (DEC-6)', () => {
    // es is the authoring locale: every string was written and UAT'd there
    // first, so it is the only sane fallback.
    const t = tFor('be');
    const probeKey = '__missing_in_be__';
    CATALOGS.es[probeKey] = 'valor español';
    try {
      expect(t(probeKey)).toBe('valor español');
    } finally {
      delete CATALOGS.es[probeKey];
    }
  });

  it('returns the key itself for a key missing everywhere', () => {
    expect(tFor('en')('no.such.key.anywhere')).toBe('no.such.key.anywhere');
  });

  it('never returns undefined, null or an empty string (AC4)', () => {
    for (const locale of UI_LOCALES) {
      for (const key of ['no.such.key', '', null, undefined, 42]) {
        const value = tFor(locale)(key);
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates {token} placeholders', () => {
    CATALOGS.es.__probe__ = 'hace {n} días con {who}';
    try {
      expect(tFor('es')('__probe__', { n: 3, who: 'Ana' })).toBe('hace 3 días con Ana');
    } finally {
      delete CATALOGS.es.__probe__;
    }
  });

  it('leaves an unsupplied placeholder visible rather than rendering "undefined"', () => {
    CATALOGS.es.__probe__ = 'hace {n} días';
    try {
      expect(tFor('es')('__probe__')).not.toContain('undefined');
    } finally {
      delete CATALOGS.es.__probe__;
    }
  });

  it('exposes defaultT as the es-pinned translator every lib default uses (D4)', () => {
    expect(defaultT('tab.home')).toBe(tFor(DEFAULT_LOCALE)('tab.home'));
    expect(defaultT('tab.home')).toBe('Inicio');
  });

  it('falls back to es for an unknown locale rather than throwing', () => {
    expect(tFor('klingon')('tab.home')).toBe('Inicio');
    expect(tFor(undefined)('tab.home')).toBe('Inicio');
  });
});
