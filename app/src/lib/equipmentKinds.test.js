import { describe, it, expect } from 'vitest';
import { KIND_ORDER, groupByKind, kindCounts } from './equipmentKinds.js';
import { EQUIPMENT } from '../data/equipment.js';

/**
 * gym-directory-and-catalog AC44 / AC44b (tech-plan.md D11).
 *
 * The overlay groups by `kind`, NOT by `category`. Those two axes disagree
 * for exactly two entries, and the whole reason D11 exists is that grouping
 * by the wrong one puts the Aura Adjustable Pulley and the Magnum Supine
 * Bench Press under "Peso libre" next to the dumbbells (R7.2).
 *
 * These are assertions on a PURE function against the real shipped catalog,
 * not DOM queries against the sheet. That is deliberate: AC44's counts must
 * survive any later restyling of EquipmentOverlaySheet, and a test that
 * queried rendered section headings would break for reasons that have
 * nothing to do with the criterion.
 */

describe('KIND_ORDER', () => {
  it('is the three kinds in the order the overlay renders them (R7.2)', () => {
    expect(KIND_ORDER).toEqual(['machine', 'free-weight', 'accessory']);
  });

  it('is frozen, so a caller cannot reorder every consumer at once', () => {
    expect(Object.isFrozen(KIND_ORDER)).toBe(true);
  });

  it('does not include "gear" — gear is rutina-side only (AC44c)', () => {
    // equipment.schema.json rejects kind:"gear"; it belongs to a rutina's
    // extraEquipment[], never to the catalog. A KIND_ORDER that listed it
    // would render a permanently empty fourth section in the overlay.
    expect(KIND_ORDER).not.toContain('gear');
  });
});

describe('kindCounts (AC44)', () => {
  it('counts the shipped catalog as 29 machines / 14 free weights / 5 accessories', () => {
    expect(kindCounts(EQUIPMENT)).toEqual({
      machine: 29,
      'free-weight': 14,
      accessory: 5,
    });
  });

  it('accounts for every one of the 48 entries, leaving nothing ungrouped', () => {
    const counts = kindCounts(EQUIPMENT);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(EQUIPMENT.length);
    expect(total).toBe(48);
  });

  it('always reports all three kinds, even for an empty catalog', () => {
    // The overlay renders three static sections (R7.2). A counts object that
    // omitted empty kinds would make the section headings conditional and
    // "Accesorios (0)" would silently disappear instead of reading zero.
    expect(kindCounts([])).toEqual({ machine: 0, 'free-weight': 0, accessory: 0 });
  });

  it('defaults a kind-less entry to "machine" (schema default, R2.1)', () => {
    // Correct even against a pre-migration file — the function must not
    // depend on Build A's migration having run.
    expect(kindCounts([{ id: 'x' }, { id: 'y', kind: 'accessory' }])).toEqual({
      machine: 1,
      'free-weight': 0,
      accessory: 1,
    });
  });
});

describe('groupByKind (AC44)', () => {
  it('returns the three kinds as keys in KIND_ORDER', () => {
    expect(Object.keys(groupByKind(EQUIPMENT))).toEqual([...KIND_ORDER]);
  });

  it('puts every catalog entry in exactly one group', () => {
    const grouped = groupByKind(EQUIPMENT);
    const ids = KIND_ORDER.flatMap((k) => grouped[k].map((e) => e.id));
    expect(ids).toHaveLength(EQUIPMENT.length);
    expect(new Set(ids).size).toBe(EQUIPMENT.length);
  });

  it('preserves catalog order inside each group', () => {
    // The overlay lists items in catalog order within a section; a group
    // that re-sorted would silently reorder the checkbox list on every
    // render of a Set-backed exclusion state.
    const grouped = groupByKind(EQUIPMENT);
    const machinesInCatalogOrder = EQUIPMENT.filter((e) => (e.kind ?? 'machine') === 'machine').map((e) => e.id);
    expect(grouped.machine.map((e) => e.id)).toEqual(machinesInCatalogOrder);
  });

  it('returns all three keys with empty arrays for an empty catalog', () => {
    expect(groupByKind([])).toEqual({ machine: [], 'free-weight': [], accessory: [] });
  });
});

describe('the two-axis disagreement (AC44b, M11)', () => {
  /**
   * This is the criterion that makes D11 load-bearing rather than cosmetic.
   * If the overlay ever grouped by `category`, these two entries would move
   * to "Peso libre" and AC44's counts would read 27 / 16 / 5 — still summing
   * to 48, so a count-only test would NOT catch it. Hence the explicit
   * membership assertion below.
   */
  it('groups G3-MS24 and MG-PL13 under machine despite category free-weights', () => {
    const grouped = groupByKind(EQUIPMENT);
    const machineIds = grouped.machine.map((e) => e.id);

    expect(machineIds).toContain('g3-ms24');
    expect(machineIds).toContain('mg-pl13');

    // …and they really do carry the disagreeing category, so this test is
    // asserting the disagreement rather than a coincidence.
    const byId = new Map(EQUIPMENT.map((e) => [e.id, e]));
    expect(byId.get('g3-ms24').category).toBe('free-weights');
    expect(byId.get('mg-pl13').category).toBe('free-weights');
    expect(byId.get('g3-ms24').modelCode).toBe('G3-MS24');
    expect(byId.get('mg-pl13').modelCode).toBe('MG-PL13');
  });

  it('has exactly these two entries disagreeing between kind and category', () => {
    // Pins the blast radius: a third disagreeing entry appearing later is a
    // data decision someone must make deliberately, not discover in the UI.
    const disagreeing = EQUIPMENT
      .filter((e) => (e.kind ?? 'machine') === 'machine' && e.category === 'free-weights')
      .map((e) => e.id)
      .sort();
    expect(disagreeing).toEqual(['g3-ms24', 'mg-pl13']);
  });

  it('never lets a free-weight-kind entry hide in the machine group', () => {
    const grouped = groupByKind(EQUIPMENT);
    expect(grouped['free-weight'].every((e) => e.kind === 'free-weight')).toBe(true);
    expect(grouped.accessory.every((e) => e.kind === 'accessory')).toBe(true);
  });
});
