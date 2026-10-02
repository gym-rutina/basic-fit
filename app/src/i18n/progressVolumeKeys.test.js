import { describe, it, expect } from 'vitest';
import { UI_LOCALES, CATALOGS } from './index.js';

/**
 * progress-volume-fix spec.md AC9 — the one-line caption under the Volume title.
 *
 * catalogs.test.js already enforces parity / non-empty / token-match for every
 * key. What it cannot see: a key missing from ALL six catalogs (nothing to
 * compare), and a locale that quietly got the Spanish string pasted in (be, fr,
 * nl and de are always hand-authored, never machine-translated or copied —
 * .tlk/PROJECT.md). Same split as miClubKeys.test.js.
 *
 * The caption is the only place that says what the number IS: PLANNED sets x
 * reps (actual reps per set are not logged) times the weight the user logged,
 * in kg. Without it a bar reads as "tonnage lifted", which it is not (P3).
 */

const KEY = 'progress.volumeCaption';

// Approved wording for the two authoring locales (tech-plan.md D4).
const ANCHORS = {
  es: 'Series × repeticiones planificadas × peso registrado, por sesión (kg).',
  en: 'Planned sets × reps × logged weight, per session (kg).',
};

describe('progress.volumeCaption i18n key (AC9)', () => {
  it.each(UI_LOCALES)('%s carries the caption as a non-empty single-line string', (locale) => {
    const value = CATALOGS[locale][KEY];
    expect({ locale, isString: typeof value === 'string' }).toEqual({ locale, isString: true });
    expect(value.trim().length).toBeGreaterThan(0);
    expect(value).not.toContain('\n');
  });

  it('carries the approved es and en wording', () => {
    expect(CATALOGS.es[KEY]).toBe(ANCHORS.es);
    expect(CATALOGS.en[KEY]).toBe(ANCHORS.en);
  });

  it('hand-authors en/be/fr/nl/de — no value is a verbatim copy of the es string', () => {
    for (const locale of UI_LOCALES.filter((l) => l !== 'es')) {
      expect({ locale, copiedFromEs: CATALOGS[locale][KEY] === CATALOGS.es[KEY] }).toEqual({
        locale,
        copiedFromEs: false,
      });
    }
  });

  it('shows the formula and names the unit in every locale', () => {
    for (const locale of UI_LOCALES) {
      const value = CATALOGS[locale][KEY];
      expect({ locale, formula: value.includes('×') }).toEqual({ locale, formula: true });
      expect({ locale, unit: /kg|кг/.test(value) }).toEqual({ locale, unit: true });
    }
  });

  it('takes no parameters — the screen renders it with a bare t() call', () => {
    for (const locale of UI_LOCALES) {
      expect({ locale, tokens: CATALOGS[locale][KEY].match(/\{\w+\}/g) }).toEqual({ locale, tokens: null });
    }
  });

  it('keeps the existing Volume keys the section still renders', () => {
    for (const locale of UI_LOCALES) {
      expect(typeof CATALOGS[locale]['progress.volumeTitle']).toBe('string');
      expect(typeof CATALOGS[locale]['progress.noVolumeData']).toBe('string');
    }
  });
});
