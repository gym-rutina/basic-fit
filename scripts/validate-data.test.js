// @vitest-environment node
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import {
  validateSchema,
  validateGyms,
  validateGymsSize,
  REQUIRED_FIELDS,
  VALID_CATEGORIES,
  VALID_KINDS,
} from './validate-data.js';
import equipmentSchema from '../data/schema/equipment.schema.json';

/**
 * spec.md S2 R2.5 + AC14, AC35, AC44c — the data gate itself.
 *
 * A note on why this file exists at all, from tech-plan.md D13: today
 * `validate-data.js` READS `data/schema/equipment.schema.json` (:144-153)
 * and then never uses it — `validateSchema(data, schema)` ignores its second
 * argument and validates against a hardcoded field list, a hardcoded enum
 * and hardcoded per-field rules. Schema and script are two independent
 * sources of truth. That is exactly why R2.5 is a four-site edit, and it is
 * why the `drift` block below is not busywork: without it, a future
 * contributor extends one site, the other silently disagrees, and nothing
 * fails until bad data ships.
 */

// A structurally valid post-migration entry. Individual tests break exactly
// one thing, so a failure names the rule that broke rather than "invalid".
function equipmentItem(overrides = {}) {
  const trilingual = (s) => ({ en: s, es: s, be: s });
  return {
    id: 'g3-s10',
    modelCode: 'G3-S10',
    series: 'Aura',
    category: 'chest',
    kind: 'machine',
    verifiedAt: [],
    muscleGroup: { primary: ['pectoralis-major'], secondary: ['triceps'] },
    names: trilingual('Chest Press'),
    descriptions: trilingual('Seated chest press machine.'),
    images: [{ url: 'https://images.jhtassets.com/abc/transformed/w_300', source: 'Hero', isMain: true }],
    videos: {
      en: [{ url: 'https://www.youtube.com/results?search_query=x', type: 'instruction', title: 'How to' }],
      es: [{ url: 'https://www.youtube.com/results?search_query=x', type: 'instruction', title: 'Cómo' }],
      be: [{ url: 'https://www.youtube.com/results?search_query=x', type: 'instruction', title: 'Як' }],
    },
    manuals: [],
    instructions: trilingual('Sit down. Push.'),
    specifications: {},
    ...overrides,
  };
}

function catalog(items) {
  return {
    metadata: {
      lastUpdated: '2026-08-15',
      source: 'test',
      languages: ['en', 'es', 'be'],
      totalEquipment: items.length,
    },
    equipment: items,
  };
}

const errorsFor = (items) => validateSchema(catalog(items), equipmentSchema);

describe('category enum (R2.5, AC14)', () => {
  it('accepts the two new categories', () => {
    expect(errorsFor([equipmentItem({ category: 'free-weights' })])).toEqual([]);
    expect(errorsFor([equipmentItem({ category: 'accessories' })])).toEqual([]);
  });

  it('still accepts the original six', () => {
    for (const category of ['chest', 'shoulders', 'back', 'arms', 'core', 'legs']) {
      expect(errorsFor([equipmentItem({ category })])).toEqual([]);
    }
  });

  it('rejects an unknown category (AC35)', () => {
    const errors = errorsFor([equipmentItem({ category: 'cardio' })]);
    expect(errors.join('\n')).toMatch(/category/i);
  });
});

describe('gyms → verifiedAt migration (R2.1, R2.2, R2.5, AC15, AC16)', () => {
  it('no longer requires the gyms field', () => {
    // The bug this defends: left as-is, validate-data.js:44's required list
    // rejects EVERY entry the moment `gyms` is renamed.
    expect(REQUIRED_FIELDS).not.toContain('gyms');
    expect(errorsFor([equipmentItem()])).toEqual([]);
  });

  it('does not require verifiedAt either — it is optional (M2/M15)', () => {
    const item = equipmentItem();
    delete item.verifiedAt;
    expect(errorsFor([item])).toEqual([]);
  });

  it('accepts an empty verifiedAt and a populated one of 32-hex GUIDs', () => {
    expect(errorsFor([equipmentItem({ verifiedAt: [] })])).toEqual([]);
    expect(
      errorsFor([equipmentItem({ verifiedAt: ['1ec43550fd654c7d8e23bc6c96cd2ff0'] })])
    ).toEqual([]);
  });

  it('rejects the OLD positive-integer gym ids in verifiedAt', () => {
    // The `gyms` check at :113-118 becomes a GUID-shape check. If it is left
    // pointing at `gyms`, it silently validates nothing after the rename.
    const errors = errorsFor([equipmentItem({ verifiedAt: [1, 2, 3] })]);
    expect(errors.join('\n')).toMatch(/verifiedAt/i);
  });

  it('rejects a malformed GUID in verifiedAt', () => {
    const errors = errorsFor([equipmentItem({ verifiedAt: ['not-a-guid'] })]);
    expect(errors.join('\n')).toMatch(/verifiedAt/i);
  });

  it('rejects a surviving gymZone (AC15, AC35)', () => {
    const errors = errorsFor([equipmentItem({ gymZone: 'strength' })]);
    expect(errors.join('\n')).toMatch(/gymZone/i);
  });
});

describe('kind (M11, R2.5, AC44c)', () => {
  it('accepts the three catalog kinds', () => {
    for (const kind of ['machine', 'free-weight', 'accessory']) {
      expect(errorsFor([equipmentItem({ kind })])).toEqual([]);
    }
  });

  it('rejects kind: "gear" in the catalog — gear exists only in extraEquipment', () => {
    const errors = errorsFor([equipmentItem({ kind: 'gear' })]);
    expect(errors.join('\n')).toMatch(/kind/i);
    expect(VALID_KINDS).toEqual(['machine', 'free-weight', 'accessory']);
  });

  it('rejects any other kind value', () => {
    expect(errorsFor([equipmentItem({ kind: 'bench' })]).join('\n')).toMatch(/kind/i);
  });
});

describe('equipment.schema.json itself (AC14, AC44c)', () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(equipmentSchema);
  const ok = (item) => validate(catalog([item]));

  it('accepts the two new categories', () => {
    expect(ok(equipmentItem({ category: 'free-weights' }))).toBe(true);
    expect(ok(equipmentItem({ category: 'accessories' }))).toBe(true);
  });

  it('rejects kind: "gear" (AC44c)', () => {
    // Differential, not absolute: today this item fails the schema anyway
    // because `gyms` is still required, so asserting only `false` would pass
    // without `kind` ever being declared. The `machine` control is what makes
    // the pair discriminating.
    expect(ok(equipmentItem({ kind: 'machine' }))).toBe(true);
    expect(ok(equipmentItem({ kind: 'gear' }))).toBe(false);
  });

  it('no longer declares gymZone or a required gyms field', () => {
    const itemSchema = equipmentSchema.properties.equipment.items;
    expect(itemSchema.properties).not.toHaveProperty('gymZone');
    expect(itemSchema.required).not.toContain('gyms');
    expect(itemSchema.properties).not.toHaveProperty('gyms');
  });

  it('declares verifiedAt as an optional array of 32-hex strings', () => {
    const itemSchema = equipmentSchema.properties.equipment.items;
    expect(itemSchema.required).not.toContain('verifiedAt');
    expect(itemSchema.properties.verifiedAt.type).toBe('array');
    expect(itemSchema.properties.verifiedAt.items.pattern).toBe('^[0-9a-f]{32}$');
  });
});

describe('drift between validate-data.js and equipment.schema.json (tech-plan D13)', () => {
  const itemSchema = () => equipmentSchema.properties.equipment.items;

  it('keeps the script\'s required-field list in step with the schema\'s', () => {
    expect([...REQUIRED_FIELDS].sort()).toEqual([...itemSchema().required].sort());
  });

  it('keeps the script\'s category enum in step with the schema\'s', () => {
    expect([...VALID_CATEGORIES].sort()).toEqual([...itemSchema().properties.category.enum].sort());
  });

  it('keeps the script\'s kind enum in step with the schema\'s', () => {
    expect([...VALID_KINDS].sort()).toEqual([...itemSchema().properties.kind.enum].sort());
  });
});

describe('validateGyms (R1.9, AC1, AC5, AC35, D6a — cycle-9 correction)', () => {
  // Cycle-9 (tech-plan-build-b.md D6a): club records no longer carry
  // `cityKey` or `coordinates` — both dropped to bring the real shipped
  // payload under AC4's ≤300KB cap (measured 604.9KB with both present,
  // 2x over). City matching now joins on `city` (display name) against the
  // index's `cities[].name`.
  const CLUB = {
    id: '1ec43550fd654c7d8e23bc6c96cd2ff0',
    name: 'Centro Comercial Alameda',
    city: 'Málaga',
    address: 'Avda. Andalucía s/n',
  };
  const OTHER = {
    ...CLUB,
    id: '2a1b3c4d5e6f70819a2b3c4d5e6f7081',
    name: 'Conangla',
    city: 'Madrid',
    address: 'Calle Alcalde Conangla 9',
  };

  const index = (cities) => ({
    metadata: { lastUpdated: '2026-08-15', source: 'club-finder', totalClubs: 2 },
    countries: [
      {
        code: 'ES',
        names: { en: 'Spain', es: 'España', be: 'Іспанія' },
        locale: 'es_ES',
        clubCount: 2,
        file: 'ES.json',
        cities: cities ?? [
          { key: 'malaga', name: 'Málaga', clubCount: 1 },
          { key: 'madrid', name: 'Madrid', clubCount: 1 },
        ],
      },
    ],
  });

  const files = (clubs) => ({ ES: { country: 'ES', clubs: clubs ?? [CLUB, OTHER] } });

  it('passes a well-formed directory', () => {
    expect(validateGyms(index(), files())).toEqual([]);
  });

  it('fails on a duplicate club id (AC35)', () => {
    const errors = validateGyms(index(), files([CLUB, { ...OTHER, id: CLUB.id }]));
    expect(errors.join('\n')).toMatch(/duplicate/i);
  });

  it('fails on a city absent from the index (AC35)', () => {
    const errors = validateGyms(index(), files([CLUB, { ...OTHER, city: 'Atlantis' }]));
    expect(errors.join('\n')).toMatch(/atlantis/i);
  });

  it('fails when a club record carries coordinates (banned, D6a/AC4)', () => {
    const errors = validateGyms(
      index(),
      files([CLUB, { ...OTHER, coordinates: { lat: 40.4168, lng: -3.7038 } }])
    );
    expect(errors.join('\n')).toMatch(/coordinates/i);
  });

  it('fails when a club record carries cityKey (banned, D6a/AC4)', () => {
    const errors = validateGyms(index(), files([CLUB, { ...OTHER, cityKey: 'madrid' }]));
    expect(errors.join('\n')).toMatch(/cityKey/i);
  });

  it('fails on an empty name or address', () => {
    expect(validateGyms(index(), files([CLUB, { ...OTHER, name: '' }])).length).toBeGreaterThan(0);
    expect(validateGyms(index(), files([CLUB, { ...OTHER, address: '' }])).length).toBeGreaterThan(0);
  });

  it('fails when an index city count disagrees with the country file (AC5)', () => {
    const errors = validateGyms(
      index([
        { key: 'malaga', name: 'Málaga', clubCount: 5 },
        { key: 'madrid', name: 'Madrid', clubCount: 1 },
      ]),
      files()
    );
    expect(errors.join('\n')).toMatch(/m[áa]laga/i);
  });

  it('fails when a club record carries hours or url (AC4)', () => {
    const errors = validateGyms(index(), files([CLUB, { ...OTHER, hours: 'Mo-Su 06:00-23:00' }]));
    expect(errors.join('\n')).toMatch(/hours/i);
  });
});

describe('validateGymsSize (AC4, D6a — cycle-9 addition)', () => {
  // Nothing asserted the ≤300KB cap before cycle 9 — that is exactly how
  // the directory shipped at 604.9KB, 2x over budget, with a fully green
  // test suite (Bagnik, handoff-log.md 04:15).
  it('passes a directory at or under the 300KB cap', () => {
    expect(validateGymsSize({ 'index.json': 100 * 1024, 'ES.json': 199 * 1024 })).toEqual([]);
    expect(validateGymsSize({ 'index.json': 150 * 1024, 'ES.json': 150 * 1024 })).toEqual([]);
  });

  it('fails a directory over the 300KB cap, naming the total and the breakdown', () => {
    const errors = validateGymsSize({ 'index.json': 123 * 1024, 'FR.json': 260 * 1024 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/300KB/);
    expect(errors[0]).toMatch(/index\.json/);
    expect(errors[0]).toMatch(/FR\.json/);
  });

  it('passes an empty directory', () => {
    expect(validateGymsSize({})).toEqual([]);
  });
});
