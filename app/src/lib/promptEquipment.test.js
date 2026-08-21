import { describe, it, expect } from 'vitest';
import { buildEquipmentTable, equipmentTableBytes, buildPrompt, composeRequestBlock, composePrompt } from './promptEquipment.js';
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

/**
 * onboarding-request-fields R1.4, R6.1-R6.6, AC4, AC30-AC32, AC35 (tech-plan.md §2.2).
 *
 * Pending Cmok implementation — see tech-plan.md. Failures here are expected
 * until Cmok adds composeRequestBlock/composePrompt to promptEquipment.js.
 *
 * composeRequestBlock is the ONE place the 8-line REQUEST block is built at
 * runtime (the template's own copy of it is deleted — tech-plan.md §2.5).
 * These tests pin structure (ordering, placeholder preservation, no
 * null/undefined/NaN, continuation-line indentation) rather than exact
 * label wording, which is Cmok/Mokash's copy to write.
 */
describe('composeRequestBlock — field composition (R1.4, R6.1-R6.6, AC4, AC30-AC32)', () => {
  const BASE = { answers: {}, club: null, sessionsMarkdown: '', sessionsIncluded: false, locale: 'es' };

  it('starts with the ### REQUEST heading', () => {
    expect(composeRequestBlock(BASE)).toMatch(/^### REQUEST\n/);
  });

  it('emits exactly eight numbered REQUEST lines, 1 through 8, in order (AC30)', () => {
    const block = composeRequestBlock(BASE);
    const numbers = [...block.matchAll(/^(\d)\.\s/gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('an unanswered field renders its placeholder line — no null/undefined/NaN anywhere (AC31)', () => {
    const block = composeRequestBlock(BASE);
    expect(block).not.toMatch(/\bnull\b/);
    expect(block).not.toMatch(/\bundefined\b/);
    expect(block).not.toMatch(/\bNaN\b/);
    const field3Line = block.split('\n').find((l) => /^3\./.test(l));
    expect(field3Line.trim()).toMatch(/:$/);
  });

  it('an answered field 1/2/4 appends the value after its label on the same line', () => {
    const block = composeRequestBlock({
      ...BASE,
      answers: { field1: 'Elena — Fase 2', field2: 'Hipertrofia', field4: '45-60 min' },
    });
    expect(block).toMatch(/^1\..*Elena — Fase 2$/m);
    expect(block).toMatch(/^2\..*Hipertrofia$/m);
    expect(block).toMatch(/^4\..*45-60 min$/m);
  });

  it('field 3 renders the integer when answered', () => {
    const block = composeRequestBlock({ ...BASE, answers: { field3: 4 } });
    expect(block).toMatch(/^3\..*\b4\b/m);
  });

  it('field 7 is always the locale autonym — never a question, never blank (AC4)', () => {
    for (const [locale, autonym] of [
      ['es', 'Español'],
      ['en', 'English'],
      ['be', 'Беларуская'],
    ]) {
      const field7Line = composeRequestBlock({ ...BASE, locale })
        .split('\n')
        .find((l) => /^7\./.test(l));
      expect(field7Line).toContain(autonym);
    }
  });

  it('field 6 shows the placeholder when no club is selected (R1.3, R6.3)', () => {
    const field6Line = composeRequestBlock(BASE)
      .split('\n')
      .find((l) => /^6\./.test(l));
    expect(field6Line.trim()).toMatch(/:$/);
  });

  it('field 6 substitutes the resolved club (R1.3)', () => {
    const block = composeRequestBlock({
      ...BASE,
      club: { clubId: '1', name: 'Alameda', city: 'Málaga', address: 'Av. de Andalucía 12' },
    });
    expect(block).toContain('Alameda');
    expect(block).toContain('Málaga');
    expect(block).toContain('Av. de Andalucía 12');
  });

  it('field 8 renders the export markdown only when sessionsIncluded is true (R4.1-R4.3)', () => {
    const markdown = 'Prensa de Pecho (g3-s10)\n  · 32kg / normal';
    expect(composeRequestBlock({ ...BASE, sessionsMarkdown: markdown, sessionsIncluded: true })).toContain('Prensa de Pecho');

    const excluded = composeRequestBlock({ ...BASE, sessionsMarkdown: markdown, sessionsIncluded: false });
    expect(excluded).not.toContain('Prensa de Pecho');
    const field8Line = excluded.split('\n').find((l) => /^8\./.test(l));
    expect(field8Line.trim()).toMatch(/:$/);
  });

  it('indents every continuation line of a multi-line field-5 answer, keeping "8." the last REQUEST line (AC32, R6.6)', () => {
    const block = composeRequestBlock({
      ...BASE,
      answers: { field5: 'Evitar press militar.\nTambién evitar sentadilla profunda.' },
    });
    const lines = block.split('\n');
    const numberedLines = lines.filter((l) => /^\d\.\s/.test(l));
    expect(numberedLines[numberedLines.length - 1]).toMatch(/^8\./);

    const continuationLine = lines.find((l) => l.includes('sentadilla'));
    expect(continuationLine).not.toMatch(/^\d\./);
    expect(continuationLine.startsWith(' ')).toBe(true);
  });

  it('indents every continuation line of a multi-line field-8 export markdown too, keeping "8." last (AC32, R6.6)', () => {
    const block = composeRequestBlock({
      ...BASE,
      sessionsMarkdown: 'Prensa de Pecho (g3-s10)\n  · 32kg / normal\n  · 35kg / fácil',
      sessionsIncluded: true,
    });
    const lines = block.split('\n');
    for (const l of lines.filter((l) => l.includes('kg /'))) {
      expect(l).not.toMatch(/^\d\./);
    }
    const numberedLines = lines.filter((l) => /^\d\.\s/.test(l));
    expect(numberedLines[numberedLines.length - 1]).toMatch(/^8\./);
  });
});

describe('composePrompt — the single assembly point (R6.1, AC35)', () => {
  const guidePromptText =
    '### ROLE\nYou are a coach.\n\n### DATA SOURCES\nschema url\n\n### SCHEMA\n{}\n\n### CONSTRAINTS\n...\n\n### OUTPUT\nReturn JSON.\n';

  function compose(overrides = {}) {
    return composePrompt({
      answers: {},
      equipment: EQUIPMENT,
      lang: 'es',
      excludedIds: [],
      club: null,
      sessionsMarkdown: '',
      sessionsIncluded: false,
      guidePromptText,
      ...overrides,
    });
  }

  it('assembles REQUEST, then the given guidePromptText, then the equipment section, in that order', () => {
    const prompt = compose({ answers: { field1: 'Elena' } });
    const requestIdx = prompt.indexOf('### REQUEST');
    const roleIdx = prompt.indexOf('### ROLE');
    const equipmentIdx = prompt.indexOf('g3-s10');
    expect(requestIdx).toBeGreaterThanOrEqual(0);
    expect(roleIdx).toBeGreaterThan(requestIdx);
    expect(equipmentIdx).toBeGreaterThan(roleIdx);
  });

  it('composes with no club selected without throwing (AC35, R5.6)', () => {
    expect(() => compose()).not.toThrow();
    expect(compose()).not.toMatch(/undefined/);
  });

  it('never contains null/undefined/NaN anywhere in the fully composed prompt', () => {
    const prompt = compose({ answers: { field3: 'not-a-number' } });
    expect(prompt).not.toMatch(/\bnull\b/);
    expect(prompt).not.toMatch(/\bundefined\b/);
    expect(prompt).not.toMatch(/\bNaN\b/);
  });

  it('still embeds the club-scoped equipment table via the existing buildPrompt (AC34, unchanged)', () => {
    expect(compose()).toContain('g3-s10');
  });
});
