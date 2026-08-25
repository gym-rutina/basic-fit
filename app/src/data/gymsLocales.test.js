import { describe, it, expect } from 'vitest';
import gymsIndex from '../../../data/gyms/index.json';

/**
 * expand-ui-locales AC6 — gym-directory country names gain fr/nl/de.
 *
 * data/gyms/index.json has no JSON-schema gate (data/schema/ only covers
 * equipment and rutina), so this file IS the automated check for the six
 * country `names` objects. Kept shape-shaped rather than value-specific:
 * the test asserts presence/non-emptiness per locale, never a hardcoded
 * translation — the words themselves are hand-authored content (spec D2),
 * reviewed at QA, not pinned here.
 *
 * The fixed 6-country list is asserted too: a new country landing in the
 * directory without its locale columns should fail loudly here, not
 * silently render es fallbacks in three UI locales.
 */

const REQUIRED_LOCALES = ['en', 'es', 'be', 'fr', 'nl', 'de'];

describe('gyms/index.json country names (AC6)', () => {
  const countries = gymsIndex.countries;

  it('still exposes exactly the 6 network countries', () => {
    expect(countries.map((c) => c.code).sort()).toEqual(['BE', 'DE', 'ES', 'FR', 'LU', 'NL']);
  });

  it('every country carries non-empty names in every supported locale', () => {
    for (const country of countries) {
      for (const lang of REQUIRED_LOCALES) {
        const name = country.names && country.names[lang];
        expect(name, `${country.code}.names.${lang}`).toBeTruthy();
        expect(typeof name, `${country.code}.names.${lang} is a string`).toBe('string');
        expect(name.trim().length, `${country.code}.names.${lang} non-blank`).toBeGreaterThan(0);
      }
    }
  });
});
