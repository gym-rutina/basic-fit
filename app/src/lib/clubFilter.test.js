import { describe, it, expect } from 'vitest';
import { foldForSearch, filterClubs } from './clubFilter.js';
import { slugifyExerciseName } from './exerciseKey.js';

/**
 * gym-directory-and-catalog AC39 (tech-plan.md D19, spec R5.3).
 *
 * "Selecting Madrid lists 37 clubs, each row showing its address; typing a
 * street fragment narrows the list." The street-fragment half is the part a
 * naive implementation gets wrong: X9 records that Basic-Fit club NAMES are
 * frequently just the street ("Rue Jean Mennesson 24/7"), so matching on
 * name alone appears to work in testing and then fails for exactly the
 * clubs whose name is NOT the street.
 *
 * Diacritics matter more here than anywhere else in the app: a Spanish user
 * types "malaga" and "Málaga" must match, and a French user types "chateau"
 * for "Château". These fixtures are real-shaped records — the four fields
 * buildCountryFile emits (gym-scrape-core.js) plus optional legacyId, and
 * nothing else (D6a, cycle-9 correction — was six fields, including
 * cityKey/coordinates, dropped to fit AC4's ≤300KB cap).
 */

const CLUBS = [
  { id: 'a1', name: 'Alameda', city: 'Málaga', address: 'Av. de Andalucía 12' },
  { id: 'a2', name: 'Teatinos', city: 'Málaga', address: 'Calle Villa de Rota 3' },
  { id: 'a3', name: 'Rue Jean Mennesson 24/7', city: 'Abbeville', address: '18 Rue Jean Mennesson' },
  { id: 'a4', name: 'Château Rouge', city: 'Paris', address: '15 Boulevard Barbès' },
  { id: 'a5', name: 'Nord', city: 'Paris', address: "3 Rue de l'Église" },
];

describe('foldForSearch (D19)', () => {
  it('strips diacritics and lowercases', () => {
    expect(foldForSearch('Málaga')).toBe('malaga');
    expect(foldForSearch('Château')).toBe('chateau');
    expect(foldForSearch('ÉGLISE')).toBe('eglise');
  });

  it('preserves spaces and punctuation, unlike slugifyExerciseName', () => {
    // This is the whole reason D19 does not just reuse slugifyExerciseName:
    // that function collapses separators to dashes, which would make the
    // substring "de andalucia" unmatchable against "av. de andalucía 12".
    expect(foldForSearch('Av. de Andalucía 12')).toBe('av. de andalucia 12');
    expect(foldForSearch('Av. de Andalucía 12')).toContain(' ');
  });

  it('agrees with slugifyExerciseName on diacritic folding itself (D19)', () => {
    // Two folding rules that drift apart silently is the failure D19 guards
    // against. They may differ on separators — they must not differ on which
    // letters a diacritic folds to.
    for (const word of ['Málaga', 'Château', 'Ándalucía', 'Nîmes', 'Zaragoza']) {
      expect(foldForSearch(word).replace(/[^a-z0-9]/g, '')).toBe(
        slugifyExerciseName(word).replace(/-/g, '')
      );
    }
  });

  it('degrades non-string input to an empty string rather than throwing', () => {
    // Runs against user-typed input and against persisted club records that
    // may predate a schema change; a throw here would blank the picker.
    expect(foldForSearch(undefined)).toBe('');
    expect(foldForSearch(null)).toBe('');
    expect(foldForSearch(42)).toBe('');
  });
});

describe('filterClubs (AC39)', () => {
  it('returns every club unchanged for an empty query', () => {
    expect(filterClubs(CLUBS, '')).toEqual(CLUBS);
    expect(filterClubs(CLUBS, '   ')).toEqual(CLUBS);
  });

  it('preserves input order for an empty query rather than re-sorting', () => {
    // Ordering is fixed at build time (D2) precisely so the app never sorts.
    expect(filterClubs(CLUBS, '').map((c) => c.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
  });

  it('matches on club name', () => {
    expect(filterClubs(CLUBS, 'Alameda').map((c) => c.id)).toEqual(['a1']);
  });

  it('matches on ADDRESS, not just name (X9 — the criterion that fails naive impls)', () => {
    // "Villa de Rota" appears only in a2's address. A name-only filter
    // returns [] here and the bug is invisible until a user types a street.
    expect(filterClubs(CLUBS, 'Villa de Rota').map((c) => c.id)).toEqual(['a2']);
    expect(filterClubs(CLUBS, 'Barbès').map((c) => c.id)).toEqual(['a4']);
  });

  it('is diacritic-insensitive in both directions', () => {
    expect(filterClubs(CLUBS, 'malaga').map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(filterClubs(CLUBS, 'Málaga').map((c) => c.id)).toEqual(['a1', 'a2']);
    expect(filterClubs(CLUBS, 'chateau').map((c) => c.id)).toEqual(['a4']);
    expect(filterClubs(CLUBS, 'barbes').map((c) => c.id)).toEqual(['a4']);
    expect(filterClubs(CLUBS, 'eglise').map((c) => c.id)).toEqual(['a5']);
  });

  it('is case-insensitive', () => {
    expect(filterClubs(CLUBS, 'ALAMEDA').map((c) => c.id)).toEqual(['a1']);
    expect(filterClubs(CLUBS, 'aLaMeDa').map((c) => c.id)).toEqual(['a1']);
  });

  it('narrows on a street fragment mid-string, not only on a prefix (AC39)', () => {
    expect(filterClubs(CLUBS, 'Mennesson').map((c) => c.id)).toEqual(['a3']);
    expect(filterClubs(CLUBS, 'Jean').map((c) => c.id)).toEqual(['a3']);
  });

  it('matches the city too, so typing the city name never empties the list', () => {
    expect(filterClubs(CLUBS, 'Paris').map((c) => c.id)).toEqual(['a4', 'a5']);
  });

  it('returns [] for a query that matches nothing (the zero-match UX state)', () => {
    // ux-design §2: zero-match shows "No se encontraron clubes" + the
    // manual-edit escape hatch (R5.6). That state needs a real empty array.
    expect(filterClubs(CLUBS, 'zzzznotaclub')).toEqual([]);
  });

  it('trims the query so a trailing space does not empty the list', () => {
    expect(filterClubs(CLUBS, 'Alameda ').map((c) => c.id)).toEqual(['a1']);
    expect(filterClubs(CLUBS, '  Alameda').map((c) => c.id)).toEqual(['a1']);
  });

  it('tolerates a club record missing an optional field', () => {
    // buildCountryFile always emits name/address/city, but a persisted or
    // hand-edited record may not — and a crash here takes out the picker.
    const partial = [{ id: 'p1', name: 'Solo' }, { id: 'p2', address: 'Calle Sin Nombre 1' }];
    expect(filterClubs(partial, 'solo').map((c) => c.id)).toEqual(['p1']);
    expect(filterClubs(partial, 'sin nombre').map((c) => c.id)).toEqual(['p2']);
  });

  it('handles an empty or missing club list without throwing', () => {
    expect(filterClubs([], 'anything')).toEqual([]);
    expect(filterClubs(undefined, 'anything')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [...CLUBS];
    filterClubs(input, 'malaga');
    expect(input).toEqual(CLUBS);
  });
});
