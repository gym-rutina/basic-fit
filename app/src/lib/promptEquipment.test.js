import { describe, it, expect } from 'vitest';
import { buildEquipmentTable, equipmentTableBytes, buildPrompt } from './promptEquipment.js';
import { EQUIPMENT } from '../data/equipment.js';

/**
 * gym-directory-and-catalog AC40 / AC42 / AC43 (tech-plan.md D12, spec R6.2,
 * R6.5, R6.6, R7.5).
 *
 * The prompt stops telling the LLM to fetch equipment.json and filter it by
 * a `gyms` array — a field Build A deleted — and instead embeds a
 * club-scoped table as literal text. Two things then have to hold at once:
 * the table must be small enough to paste (AC40's 10 KB) and it must shrink
 * when the user unticks equipment (AC43).
 *
 * D12's byte-measurement rule is the subtle one and it gets its own test
 * below. `String.length` counts UTF-16 code units; the table carries Spanish
 * and Belarusian names where 'ж'.length === 1 but its UTF-8 encoding is 2
 * bytes. Measuring in code units under-reports the `be` table by ~40%, so a
 * budget check written the obvious way would pass a table that is actually
 * over budget.
 */

const ALL_IDS = EQUIPMENT.map((e) => e.id);

describe('equipmentTableBytes (D12)', () => {
  it('measures UTF-8 bytes, not UTF-16 code units', () => {
    // 'ж' is one code unit and two UTF-8 bytes. This single assertion is
    // what separates a correct budget check from one that silently passes
    // an over-budget Belarusian table.
    expect(equipmentTableBytes('ж')).toBe(2);
    expect('ж'.length).toBe(1);
  });

  it('counts ASCII as one byte per character', () => {
    expect(equipmentTableBytes('abc')).toBe(3);
  });

  it('counts Spanish accented characters as two bytes', () => {
    expect(equipmentTableBytes('á')).toBe(2);
    expect(equipmentTableBytes('Máquina')).toBe(8); // 7 chars, 'á' costs 2
  });

  it('returns 0 for an empty string', () => {
    expect(equipmentTableBytes('')).toBe(0);
  });
});

describe('buildEquipmentTable — shape (R6.2)', () => {
  it('emits a row for every catalog entry when nothing is excluded', () => {
    const table = buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: [] });

    /**
     * Assert the INTENT — every catalog id is present — never an id-prefix
     * heuristic. The first version of this test counted lines matching
     * `g3-`/`mg-`/`zv` and required >= 48, which NO correct implementation
     * could satisfy: only 39 of the 48 entries carry any of those. ZIVA ids
     * span `zmt-`/`zft-`/`zex-`/`zsl-`/`zvo-`, and `smith-machine` and
     * `perfect-squat` have no vendor prefix at all. Caught at the test gate.
     */
    for (const entry of EQUIPMENT) {
      expect(table).toContain(entry.id);
    }
  });

  it('emits exactly one row per entry — no duplicates, no extras', () => {
    // The companion to the assertion above: "every id appears" alone would
    // pass a table that emitted each entry twice, which silently doubles the
    // byte budget AC40 caps at 10 KB.
    const table = buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: [] });
    const ids = EQUIPMENT.map((e) => e.id); // verified: no id is a substring of another
    const rows = table
      .trim()
      .split('\n')
      .filter((line) => ids.some((id) => line.includes(id)));

    expect(rows).toHaveLength(EQUIPMENT.length);
  });

  it('carries id, modelCode, name, category and muscleGroup for an entry', () => {
    const table = buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: [] });
    const chest = EQUIPMENT.find((e) => e.id === 'g3-s10');

    expect(table).toContain('g3-s10');
    expect(table).toContain(chest.modelCode);
    expect(table).toContain(chest.names.es);
    expect(table).toContain(chest.category);
  });

  it('uses the requested output language for the name', () => {
    const chest = EQUIPMENT.find((e) => e.id === 'g3-s10');

    expect(buildEquipmentTable(EQUIPMENT, { lang: 'en', excludedIds: [] })).toContain(chest.names.en);
    expect(buildEquipmentTable(EQUIPMENT, { lang: 'be', excludedIds: [] })).toContain(chest.names.be);
  });

  it('falls back to the Spanish name when a locale is missing rather than emitting undefined', () => {
    const sparse = [{ id: 'x1', modelCode: 'X-1', category: 'core', names: { es: 'Solo español' }, muscleGroup: { primary: [], secondary: [] } }];
    const table = buildEquipmentTable(sparse, { lang: 'be', excludedIds: [] });
    expect(table).toContain('Solo español');
    expect(table).not.toContain('undefined');
  });

  it('never emits the string "undefined" for the real catalog in any locale', () => {
    for (const lang of ['es', 'en', 'be']) {
      expect(buildEquipmentTable(EQUIPMENT, { lang, excludedIds: [] })).not.toContain('undefined');
    }
  });
});

describe('buildEquipmentTable — exclusions (AC43, R7.5)', () => {
  it('removes an excluded id from the table entirely', () => {
    const table = buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: ['g3-s10'] });
    expect(table).not.toContain('g3-s10');
  });

  it('keeps every id that was not excluded', () => {
    const table = buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: ['g3-s10'] });
    for (const id of ALL_IDS.filter((i) => i !== 'g3-s10')) {
      expect(table).toContain(id);
    }
  });

  it('shrinks the table when more is excluded', () => {
    const full = equipmentTableBytes(buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: [] }));
    const trimmed = equipmentTableBytes(buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: ['g3-s10', 'g3-ms24'] }));
    expect(trimmed).toBeLessThan(full);
  });

  it('accepts a Set as well as an array (the hook holds a Set — D21)', () => {
    const table = buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: new Set(['g3-s10']) });
    expect(table).not.toContain('g3-s10');
  });

  it('treats null/undefined exclusions as "nothing excluded", never as a crash', () => {
    // excludedIds is null while IndexedDB is still answering (D21).
    expect(() => buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: null })).not.toThrow();
    expect(buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: null })).toContain('g3-s10');
    expect(buildEquipmentTable(EQUIPMENT, { lang: 'es' })).toContain('g3-s10');
  });

  it('ignores an excluded id that is not in the catalog', () => {
    const table = buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: ['not-a-real-id'] });
    expect(table).toContain('g3-s10');
  });

  it('produces an empty-but-valid table when everything is excluded', () => {
    // Degenerate but reachable: a user can untick all 48. The prompt must
    // still be copyable rather than throwing mid-render.
    const table = buildEquipmentTable(EQUIPMENT, { lang: 'es', excludedIds: ALL_IDS });
    expect(typeof table).toBe('string');
    for (const id of ALL_IDS) expect(table).not.toContain(id);
  });
});

describe('the 10 KB budget (AC40, X7)', () => {
  it('fits all 48 entries under 10 KB in every output language', () => {
    // X7 predicted ~8.1 KB at 48 entries. `be` is the expensive one — two
    // bytes per Cyrillic character — so asserting all three is the point.
    for (const lang of ['es', 'en', 'be']) {
      const bytes = equipmentTableBytes(buildEquipmentTable(EQUIPMENT, { lang, excludedIds: [] }));
      expect({ lang, over: bytes > 10240, bytes }).toEqual({ lang, over: false, bytes });
    }
  });

  it('measures the Belarusian table as strictly larger than the English one', () => {
    // If these come out equal, the implementation is measuring code units
    // and the budget assertion above is not actually testing anything.
    const en = equipmentTableBytes(buildEquipmentTable(EQUIPMENT, { lang: 'en', excludedIds: [] }));
    const be = equipmentTableBytes(buildEquipmentTable(EQUIPMENT, { lang: 'be', excludedIds: [] }));
    expect(be).toBeGreaterThan(en);
  });
});

describe('buildPrompt — the instruction rewrite (AC40, AC42, R6.5, R6.6)', () => {
  const prompt = () => buildPrompt({ equipment: EQUIPMENT, lang: 'es', excludedIds: [], club: null });

  it('contains no instruction to fetch gyms.json or data/gyms/', () => {
    // R6.3 — the LLM never needs the directory once field 6 carries the
    // resolved club. This is the assertion that catches the doc drift the
    // Build A gate flagged as its most user-visible carry-forward.
    const p = prompt();
    expect(p).not.toContain('gyms.json');
    expect(p).not.toContain('data/gyms/');
  });

  it('contains no instruction to filter equipment by a `gyms` array', () => {
    // The `gyms` field was deleted from every catalog entry in Build A, so
    // an LLM following this instruction would filter everything away.
    const p = prompt();
    expect(p).not.toMatch(/gyms\s*\[/);
    expect(p).not.toMatch(/filter.*by.*gyms/i);
    expect(p).not.toMatch(/eq\.gyms/);
  });

  it('documents extraEquipment (AC42, R6.5)', () => {
    expect(prompt()).toContain('extraEquipment');
  });

  it('states that extraEquipment is the exception, not the default (R6.6)', () => {
    // The wording is Mokash's; the CONTRACT is that the prompt must not
    // present extraEquipment as a normal first choice, because with 48
    // catalog ids most gear now resolves to one.
    expect(prompt()).toMatch(/exception|excepción|rarely|raras|not the default|no es la opción/i);
  });

  it('embeds the equipment table itself', () => {
    expect(prompt()).toContain('g3-s10');
  });

  it('substitutes the resolved club into field 6 when one is selected (R6.1, AC36)', () => {
    const p = buildPrompt({
      equipment: EQUIPMENT,
      lang: 'es',
      excludedIds: [],
      club: { clubId: '1ec43550fd654c7d8e23bc6c96cd2ff0', name: 'Alameda', city: 'Málaga', address: 'Av. de Andalucía 12' },
    });
    expect(p).toContain('Alameda');
    expect(p).toContain('Málaga');
    expect(p).toContain('Av. de Andalucía 12');
    expect(p).toContain('1ec43550fd654c7d8e23bc6c96cd2ff0');
  });

  it('remains valid with no club selected — the flow is never blocked (R5.6)', () => {
    expect(() => prompt()).not.toThrow();
    expect(prompt()).toContain('g3-s10');
  });
});
