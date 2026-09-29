// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateRutina } from './rutina-validator.js';

/**
 * club-equipment-reporting AC14 / AC15 / AC19 (tech-plan.md §2 D13).
 *
 * `substitutions` is an OPTIONAL, LLM-authored array recording that a
 * rutina swapped one machine for another (e.g. the expected one is not in the
 * club's filtered table). Both ids resolve against the SAME union the
 * exercises use — catalog ids + this rutina's own extraEquipment ids — by
 * reusing the validator's existing id-union logic, not re-implementing it.
 * Metadata-only in v1: no UI reads it; it just has to round-trip.
 */

const ROOT = path.join(__dirname, '..', '..');
const CATALOG = [
  { id: 'g3-s10', modelCode: 'G3-S10' },
  { id: 'g3-s30', modelCode: 'G3-S30' },
];
const trilingual = (s) => ({ en: s, es: s, be: s });

function rutina(extra = {}) {
  return {
    schemaVersion: 1,
    program: { name: 'P', phaseName: 'F', phaseNumber: 1, gymId: 3, durationWeeks: 4, lastUpdated: '2026-09-29' },
    phaseInfo: { objective: 'o', intensityPercent: '60', restSeconds: '75', frequencyPerWeek: 3 },
    warmup: { durationMinutes: '5', steps: ['a'] },
    cooldown: { durationMinutes: '5', steps: ['a'] },
    days: [{ label: 'D1', exercises: [{ name: 'Prensa', muscleGroups: ['x'], equipmentId: 'g3-s10', sets: 3, reps: '10', restSeconds: 60 }] }],
    rules: [],
    notes: [],
    ...extra,
  };
}

const errorsOf = (data) => validateRutina(data, CATALOG).errors;

describe('substitutions is optional (AC14)', () => {
  it('a rutina without it stays valid — nothing became required', () => {
    expect(validateRutina(rutina(), CATALOG).valid).toBe(true);
  });

  it('an empty array is valid', () => {
    expect(validateRutina(rutina({ substitutions: [] }), CATALOG).valid).toBe(true);
  });
});

describe('substitutions entries (AC14)', () => {
  it('accepts {equipmentId, substituteEquipmentId} between two catalog ids', () => {
    const r = rutina({ substitutions: [{ equipmentId: 'g3-s10', substituteEquipmentId: 'g3-s30' }] });
    expect(validateRutina(r, CATALOG)).toMatchObject({ valid: true, errors: [] });
  });

  it('accepts an optional reason', () => {
    const r = rutina({ substitutions: [{ equipmentId: 'g3-s10', substituteEquipmentId: 'g3-s30', reason: 'Prensa no disponible en este club' }] });
    expect(validateRutina(r, CATALOG).valid).toBe(true);
  });

  it('accepts a substitute that is this rutina\'s own extraEquipment gear (the id union, AC14)', () => {
    const r = rutina({
      extraEquipment: [{ id: 'my-band', kind: 'gear', names: trilingual('Band') }],
      substitutions: [{ equipmentId: 'g3-s10', substituteEquipmentId: 'my-band' }],
    });
    expect(validateRutina(r, CATALOG)).toMatchObject({ valid: true, errors: [] });
  });

  it('rejects an unknown equipmentId with a pasteable, indexed message', () => {
    const errors = errorsOf(rutina({ substitutions: [{ equipmentId: 'nope-1', substituteEquipmentId: 'g3-s30' }] }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('substitutions[0].equipmentId');
    expect(errors[0]).toContain('nope-1');
  });

  it('rejects an unknown substituteEquipmentId with a pasteable, indexed message', () => {
    const errors = errorsOf(rutina({ substitutions: [{ equipmentId: 'g3-s10', substituteEquipmentId: 'nope-2' }, { equipmentId: 'g3-s10', substituteEquipmentId: 'nope-3' }] }));
    expect(errors.some((e) => e.includes('substitutions[0].substituteEquipmentId') && e.includes('nope-2'))).toBe(true);
    expect(errors.some((e) => e.includes('substitutions[1].substituteEquipmentId') && e.includes('nope-3'))).toBe(true);
  });

  it.each([
    ['missing equipmentId', { substituteEquipmentId: 'g3-s30' }],
    ['missing substituteEquipmentId', { equipmentId: 'g3-s10' }],
    ['a non-string reason', { equipmentId: 'g3-s10', substituteEquipmentId: 'g3-s30', reason: 5 }],
    ['an unrecognised property', { equipmentId: 'g3-s10', substituteEquipmentId: 'g3-s30', priority: 1 }],
  ])('rejects an entry with %s', (_label, entry) => {
    expect(validateRutina(rutina({ substitutions: [entry] }), CATALOG).valid).toBe(false);
  });

  it('rejects a non-array', () => {
    expect(validateRutina(rutina({ substitutions: { equipmentId: 'g3-s10' } }), CATALOG).valid).toBe(false);
  });

  it('is null-safe: cross-checking runs even when the rest of the rutina is malformed', () => {
    expect(() => validateRutina({ substitutions: 'garbage' }, CATALOG)).not.toThrow();
    expect(() => validateRutina({ substitutions: [null, 3, {}] }, CATALOG)).not.toThrow();
  });
});

describe('rutina.schema.json wording (AC19)', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schema', 'rutina.schema.json'), 'utf8'));

  it('documents `substitutions` at the same level as notes/rules/extraEquipment', () => {
    expect(schema.properties.substitutions).toBeDefined();
    expect(schema.properties.substitutions.type).toBe('array');
    expect(schema.properties.substitutions.description).toMatch(/LLM/);
  });

  it('extraEquipment no longer claims to be identity-less-only gear; it says full off-catalog equipment is allowed', () => {
    const d = schema.properties.extraEquipment.description;
    expect(d).not.toMatch(/no manufacturer identity/i);
    expect(d).toMatch(/off-catalog|not in data\/equipment\.json|not in the catalog/i);
  });
});

describe('the LLM authoring guide documents the new field and the corrected gear scope (AC15, AC19)', () => {
  const files = [
    'docs/llm-rutina-prompt-template.txt',
    'docs/llm-rutina-prompt.en.md',
    'docs/llm-rutina-prompt.es.md',
    'docs/llm-rutina-prompt.be.md',
  ];

  it.each(files)('%s names `substitutions` and its two id fields', (rel) => {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(text).toContain('substitutions');
    expect(text).toContain('substituteEquipmentId');
  });

  // A full piece of equipment the club has that is not in the catalog. Pinned
  // to fixed phrases for the languages this repo's reviewers read (template +
  // en: "off-catalog", es: "fuera del catálogo"). The be article is checked by
  // Bagnik by eye — a Belarusian phrase cannot be pinned without guessing the
  // translator's wording (tech-plan.md §7 known gap).
  it.each([
    ['docs/llm-rutina-prompt-template.txt', /off-catalog/i],
    ['docs/llm-rutina-prompt.en.md', /off-catalog/i],
    ['docs/llm-rutina-prompt.es.md', /fuera del cat[aá]logo/i],
  ])('%s tells the LLM extraEquipment can hold a full off-catalog machine, not just accessories', (rel, phrase) => {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(text).toMatch(/extraEquipment/);
    expect(text).toMatch(phrase);
  });
});
