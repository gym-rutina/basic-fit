// @vitest-environment node
import { describe, it, expect } from 'vitest';
import catalog from '../data/equipment.json';

/**
 * spec.md S2 — assertions on the SHIPPED catalog, not on a fixture.
 *
 * `validate-data.test.js` next door tests the validator; this file tests the
 * data. The split matters: a validator can be correct and still be pointed at
 * a file that never got migrated, and every one of X1's counts is checkable
 * rather than assertable-by-eye only because they are written down here.
 */

const ITEMS = catalog.equipment;
const byModelCode = new Map(ITEMS.map((i) => [i.modelCode, i]));

/**
 * The 21 additions, from spec.md's itemised table (X1). Model codes are the
 * authority — `research-brief-equipment.md` §3-§4 verified every one against
 * a manufacturer page, and R2.3 forbids inventing any. Slugs are deliberately
 * NOT asserted: the spec fixes only `g3-ms24` (R2.4), so pinning the other
 * twenty here would invent a contract nothing upstream states.
 */
const NEW_MODEL_CODES = [
  ['G3-MS24', 'free-weights', 'machine'],
  ['MG-PL13', 'free-weights', 'machine'],
  ['ZVO-DBPU-1648', 'free-weights', 'free-weight'],
  ['ZVO-PUTF-3078', 'free-weights', 'free-weight'],
  ['ZVO-BSPU-1619', 'free-weights', 'free-weight'],
  ['ZVO-BCPU-1606', 'free-weights', 'free-weight'],
  ['ZVO-DCPU-1616', 'free-weights', 'free-weight'],
  ['ZMT-CTKB-5626', 'free-weights', 'free-weight'],
  ['ZVO-LBHC-2953', 'free-weights', 'free-weight'],
  ['ZVO-HCOB-2966', 'free-weights', 'free-weight'],
  ['ZFT-HCOB-2965', 'free-weights', 'free-weight'],
  ['ZVO-PBHC-2936', 'free-weights', 'free-weight'],
  ['ZVO-PBHC-2933', 'free-weights', 'free-weight'],
  ['ZEX-ICBP-TP08', 'free-weights', 'free-weight'],
  ['ZEX-XFID-6762', 'free-weights', 'free-weight'],
  ['ZEX-XFLT-6752', 'free-weights', 'free-weight'],
  ['ZSL-TDYM-0250', 'accessories', 'accessory'],
  ['ZVO-SPSB-6882', 'accessories', 'accessory'],
  ['ZVO-SPPB-6387', 'accessories', 'accessory'],
  ['ZMT-GLPY-5671', 'accessories', 'accessory'],
  ['ZVO-BUBL-0564', 'accessories', 'accessory'],
];

/** `category` answers "what do I train?"; `kind` answers "what is it?" (M11). */
const KIND_IMPLIED_BY_CATEGORY = {
  chest: 'machine',
  shoulders: 'machine',
  back: 'machine',
  arms: 'machine',
  core: 'machine',
  legs: 'machine',
  'free-weights': 'free-weight',
  accessories: 'accessory',
};

describe('catalog size (X1, AC11)', () => {
  it('holds exactly 48 entries', () => {
    // 27 + 21. Not 47: the brief's rollups say 47 and its itemised tables
    // say 48 — see spec.md X1 for which one is arithmetic and which is a
    // consistent off-by-one.
    expect(ITEMS).toHaveLength(48);
  });

  it('agrees with metadata.totalEquipment', () => {
    expect(catalog.metadata.totalEquipment).toBe(48);
  });

  it('has no duplicate id and no duplicate modelCode', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(48);
    expect(new Set(ITEMS.map((i) => i.modelCode)).size).toBe(48);
  });
});

describe('the 21 additions (AC12, AC13)', () => {
  it.each(NEW_MODEL_CODES)('carries %s with category %s and kind %s', (code, category, kind) => {
    const item = byModelCode.get(code);
    expect(item, `no catalog entry with modelCode ${code}`).toBeDefined();
    expect(item.category).toBe(category);
    expect(item.kind).toBe(kind);
  });

  it('adds exactly those 21 and nothing else', () => {
    const added = ITEMS.filter((i) => ['free-weights', 'accessories'].includes(i.category));
    expect(added).toHaveLength(21);
  });

  it('does not make ZVO-DBPU-1633 an entry — it is a heavier variant of ZVO-DBPU-1648', () => {
    expect(byModelCode.has('ZVO-DBPU-1633')).toBe(false);
  });

  it('gives every id a kebab-case slug', () => {
    for (const item of ITEMS) {
      expect(item.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});

describe('gymZone / gyms → verifiedAt migration (R2.2, AC15, AC16)', () => {
  it('has deleted gymZone from every entry', () => {
    expect(ITEMS.filter((i) => 'gymZone' in i)).toEqual([]);
  });

  it('has deleted the gyms field from every entry', () => {
    expect(ITEMS.filter((i) => 'gyms' in i)).toEqual([]);
  });

  it('gives every entry verifiedAt, empty (M2/M15)', () => {
    for (const item of ITEMS) {
      expect(item.verifiedAt, `${item.id} is missing verifiedAt`).toEqual([]);
    }
  });
});

describe('kind (M11, AC44 data half, AC44b)', () => {
  it('is present and explicit on all 48 — never left to the schema default', () => {
    // R2.2/R2.3 write it explicitly so the counts below are assertable
    // rather than inferred from an absent field.
    for (const item of ITEMS) {
      expect(item.kind, `${item.id} has no explicit kind`).toBeDefined();
    }
  });

  it('splits 29 machines / 14 free weights / 5 accessories', () => {
    const counts = ITEMS.reduce((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});
    expect(counts).toEqual({ machine: 29, 'free-weight': 14, accessory: 5 });
  });

  it('uses only the three catalog kinds — never "gear" (AC44c)', () => {
    expect([...new Set(ITEMS.map((i) => i.kind))].sort()).toEqual([
      'accessory',
      'free-weight',
      'machine',
    ]);
  });

  it('disagrees with category for exactly two entries, and they are the expected two', () => {
    // This is the entire justification for splitting the two axes (M11). If
    // this count drifts to 0 the axes collapsed; if it drifts above 2 someone
    // reassigned an entry without deciding to.
    const disagreeing = ITEMS.filter((i) => KIND_IMPLIED_BY_CATEGORY[i.category] !== i.kind);

    expect(disagreeing.map((i) => i.modelCode).sort()).toEqual(['G3-MS24', 'MG-PL13']);
    for (const item of disagreeing) {
      expect(item.kind).toBe('machine');
      expect(item.category).toBe('free-weights');
    }
  });

  it('keeps all 27 pre-existing machines at kind: machine', () => {
    const muscleCategories = Object.keys(KIND_IMPLIED_BY_CATEGORY).filter(
      (c) => KIND_IMPLIED_BY_CATEGORY[c] === 'machine'
    );
    const existing = ITEMS.filter((i) => muscleCategories.includes(i.category));

    expect(existing).toHaveLength(27);
    expect(existing.every((i) => i.kind === 'machine')).toBe(true);
  });
});

describe('cable attachments (R2.4, AC13, AC17)', () => {
  const pulley = () => ITEMS.find((i) => i.id === 'g3-ms24');

  it('records them under g3-ms24.specifications.attachments[]', () => {
    const attachments = pulley().specifications.attachments;
    expect(Array.isArray(attachments)).toBe(true);
    // Six §4.3 Performance cable attachments + ZXP-OBCC-0436 clamp collars.
    expect(attachments).toHaveLength(7);
    for (const attachment of attachments) {
      expect(Object.keys(attachment).sort()).toEqual(['modelCode', 'name']);
      expect(attachment.name.length).toBeGreaterThan(0);
      expect(attachment.modelCode.length).toBeGreaterThan(0);
    }
  });

  it('includes the clamp collars, which are an attachment and not an entry (DD-009)', () => {
    expect(pulley().specifications.attachments.map((a) => a.modelCode)).toContain('ZXP-OBCC-0436');
  });

  it('makes none of the attachment model codes a catalog entry', () => {
    for (const attachment of pulley().specifications.attachments) {
      expect(byModelCode.has(attachment.modelCode)).toBe(false);
    }
  });

  it('leaves a Catalog search for "Strap Handle" with nothing to find (AC17)', () => {
    const haystack = ITEMS.flatMap((i) => Object.values(i.names)).join(' | ').toLowerCase();
    expect(haystack).not.toContain('strap handle');
  });
});

describe('trilingual completeness (AC18)', () => {
  it.each(['en', 'es', 'be'])('gives every entry a non-empty %s name', (lang) => {
    const missing = ITEMS.filter((i) => !i.names?.[lang]?.trim()).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it.each(['en', 'es', 'be'])('gives every entry a non-empty %s description', (lang) => {
    const missing = ITEMS.filter((i) => !i.descriptions?.[lang]?.trim()).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it('gives each of the 21 new entries a manufacturer photo (R2.3)', () => {
    // Scoped to the additions on purpose. `g3-s45` has shipped with an empty
    // images[] since before this feature (see the pre-existing-gap test
    // below); widening this assertion to all 48 would quietly turn a known
    // hole into a new requirement R2.3 never made.
    const missing = ITEMS.filter(
      (i) => ['free-weights', 'accessories'].includes(i.category) && !i.images?.[0]?.url
    ).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it('has exactly one pre-existing entry with no image, and it is g3-s45', () => {
    // Not this feature's to fix — but pinning it means the migration cannot
    // silently drop images from other entries while rewriting all 48.
    const imageless = ITEMS.filter((i) => !i.images?.[0]?.url).map((i) => i.id);
    expect(imageless).toEqual(['g3-s45']);
  });

  it('gives every non-machine entry a non-empty muscleGroup.primary', () => {
    // R2.3 asks for "broad and honest" values on non-machines
    // (e.g. `full-body`) rather than a fabricated specific muscle. Honesty
    // is not mechanically checkable; presence is, and an empty array is the
    // failure mode that would break `muscleGroupLabels` in the Catalog card.
    for (const item of ITEMS.filter((i) => i.kind !== 'machine')) {
      expect(Array.isArray(item.muscleGroup.primary), `${item.id}`).toBe(true);
      expect(item.muscleGroup.primary.length, `${item.id}`).toBeGreaterThan(0);
    }
  });
});

describe('image URLs resolve (AC19)', () => {
  // Deliberately out of the default suite: a network call in `npm test` makes
  // the whole suite fail when a CDN hiccups or a laptop is offline. Run with
  // RUN_NETWORK_TESTS=1 when the catalog's images change.
  const run = process.env.RUN_NETWORK_TESTS === '1';

  // Scoped to the 21 additions — which is what spec AC19 actually asks for
  // ("every NEW entry's images[0].url"), and what the sibling test above
  // ("gives each of the 21 new entries a manufacturer photo") already scopes
  // to. Looping over ALL 48 would dereference g3-s45's pre-existing empty
  // images[] (pinned by its own test above) and throw a TypeError the
  // moment this is enabled, leaving AC19 with no working coverage at all.
  const NEW_ITEMS = ITEMS.filter((i) => ['free-weights', 'accessories'].includes(i.category));

  (run ? it : it.skip)('serves every new entry\'s images[0].url as an image', async () => {
    for (const item of NEW_ITEMS) {
      const response = await fetch(item.images[0].url, { redirect: 'follow' });
      expect(response.status, `${item.id}: ${item.images[0].url}`).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/^image\//);
    }
  }, 120_000);
});
