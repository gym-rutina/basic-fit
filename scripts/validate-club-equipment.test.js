// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { validateClubEquipment, validateClubEquipmentSize, MAX_CLUB_EQUIPMENT_BYTES } from './validate-data.js';

/**
 * club-equipment-reporting AC10/AC11/AC13 (tech-plan.md §2 D12) — the
 * team-merged per-club defaults file. Validated by `npm run validate-data`
 * exactly like gyms.json / equipment.json: schema shape, referential
 * integrity against real equipment ids and real club ids, a size cap.
 *
 * `validateClubEquipment` is a pure function (like validateGyms) so it is
 * unit-testable without touching disk; the last describe validates the
 * REAL shipped file against the REAL catalog + directory.
 */

const ROOT = path.join(__dirname, '..');
const CLUB = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);
const EQUIPMENT_IDS = new Set(['g3-s10', 'g3-s30', 'g3-s70']);
const CLUB_IDS = new Set([CLUB, OTHER]);
const ctx = { equipmentIds: EQUIPMENT_IDS, clubIds: CLUB_IDS };

const file = (clubs, over = {}) => ({ schemaVersion: 1, clubs, ...over });

describe('validateClubEquipment — accepts good data (AC10)', () => {
  it('accepts an empty file (how it ships in v1)', () => {
    expect(validateClubEquipment(file({}), ctx)).toEqual([]);
  });

  it('accepts absent-only and absent+present entries', () => {
    expect(validateClubEquipment(file({ [CLUB]: { absent: ['g3-s10'] }, [OTHER]: { absent: ['g3-s30'], present: ['g3-s70'] } }), ctx)).toEqual([]);
  });

  it('accepts an entry with only `present`', () => {
    expect(validateClubEquipment(file({ [CLUB]: { present: ['g3-s10'] } }), ctx)).toEqual([]);
  });
});

describe('validateClubEquipment — referential integrity', () => {
  it('rejects an equipment id that is not in equipment.json, naming the club and list', () => {
    const errors = validateClubEquipment(file({ [CLUB]: { absent: ['g3-s10', 'nope-9000'] } }), ctx);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('nope-9000');
    expect(errors[0]).toContain(CLUB);
    expect(errors[0]).toMatch(/absent/);
  });

  it('checks `present` ids too', () => {
    const errors = validateClubEquipment(file({ [CLUB]: { present: ['nope-9000'] } }), ctx);
    expect(errors[0]).toMatch(/present/);
  });

  it('rejects a club id that is not in the gym directory', () => {
    const errors = validateClubEquipment(file({ ['c'.repeat(32)]: { absent: ['g3-s10'] } }), ctx);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('c'.repeat(32));
  });

  it('skips the club check (only) when no directory is available, but still checks equipment ids', () => {
    const noDir = { equipmentIds: EQUIPMENT_IDS, clubIds: null };
    expect(validateClubEquipment(file({ ['c'.repeat(32)]: { absent: ['g3-s10'] } }), noDir)).toEqual([]);
    expect(validateClubEquipment(file({ ['c'.repeat(32)]: { absent: ['nope'] } }), noDir)).toHaveLength(1);
  });

  it('rejects an id listed both absent and present for the same club (contradiction the team must resolve)', () => {
    const errors = validateClubEquipment(file({ [CLUB]: { absent: ['g3-s10'], present: ['g3-s10'] } }), ctx);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/both|contradict/i);
    expect(errors[0]).toContain('g3-s10');
  });

  it('rejects a duplicate id inside one list', () => {
    const errors = validateClubEquipment(file({ [CLUB]: { absent: ['g3-s10', 'g3-s10'] } }), ctx);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/duplicate/i);
  });

  it('reports every problem in one pass (accumulate-then-report, like validateGyms)', () => {
    const errors = validateClubEquipment(
      file({ [CLUB]: { absent: ['nope-1', 'nope-1'] }, ['c'.repeat(32)]: { absent: ['nope-2'] } }),
      ctx
    );
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateClubEquipment — shape', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['missing clubs', { schemaVersion: 1 }],
    ['clubs as an array', file([])],
    ['entry that is not an object', file({ [CLUB]: 'g3-s10' })],
    ['absent that is not an array', file({ [CLUB]: { absent: 'g3-s10' } })],
    ['a non-string id', file({ [CLUB]: { absent: [42] } })],
    ['an unknown top-level property', file({}, { generatedBy: 'bot' })],
    ['an unknown entry property (no free text may hide here)', file({ [CLUB]: { absent: [], note: 'x' } })],
    ['a wrong schemaVersion', file({}, { schemaVersion: 2 })],
  ])('rejects %s', (_label, data) => {
    expect(validateClubEquipment(data, ctx).length).toBeGreaterThan(0);
  });

  it('never throws on garbage', () => {
    for (const bad of [undefined, 7, 'x', { clubs: null }]) {
      expect(() => validateClubEquipment(bad, ctx)).not.toThrow();
    }
  });
});

describe('the JSON schema file agrees with the validator (drift guard)', () => {
  const schemaPath = path.join(ROOT, 'data', 'schema', 'club-equipment.schema.json');

  it('exists and compiles', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    expect(() => new Ajv({ strict: false, allErrors: true }).compile(schema)).not.toThrow();
  });

  it.each([
    [file({ [CLUB]: { absent: ['g3-s10'], present: ['g3-s30'] } }), true],
    [file({}), true],
    [file({ [CLUB]: { absent: [], note: 'x' } }), false],
    [file({}, { generatedBy: 'bot' }), false],
    [{ clubs: {} }, false],
  ])('schema verdict matches the validator on %j', (data, ok) => {
    const validate = new Ajv({ strict: false, allErrors: true }).compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
    expect(validate(data)).toBe(ok);
    // shape-only agreement: the validator has no MORE-permissive verdict than the schema on shape
    expect(validateClubEquipment(data, { equipmentIds: new Set(['g3-s10', 'g3-s30']), clubIds: null }).length === 0).toBe(ok);
  });
});

describe('size cap (AC11)', () => {
  it('has a documented cap and passes under it', () => {
    expect(MAX_CLUB_EQUIPMENT_BYTES).toBeGreaterThan(0);
    expect(validateClubEquipmentSize(1024)).toEqual([]);
  });

  it('errors, naming the cap, when the file is over it', () => {
    const errors = validateClubEquipmentSize(MAX_CLUB_EQUIPMENT_BYTES + 1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/club-equipment\.json/);
  });
});

describe('the SHIPPED data/club-equipment.json (AC10, AC11)', () => {
  const filePath = path.join(ROOT, 'data', 'club-equipment.json');

  it('exists, parses, and is valid against the real catalog and the real club directory', () => {
    expect(fs.existsSync(filePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const equipmentIds = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'equipment.json'), 'utf8')).equipment.map((e) => e.id));

    let clubIds = null;
    const indexPath = path.join(ROOT, 'data', 'gyms', 'index.json');
    if (fs.existsSync(indexPath)) {
      clubIds = new Set();
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      for (const c of index.countries || []) {
        const f = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'gyms', c.file), 'utf8'));
        for (const club of f.clubs || []) clubIds.add(club.id);
      }
    }
    expect(validateClubEquipment(data, { equipmentIds, clubIds })).toEqual([]);
  });

  it('is under the size cap', () => {
    expect(validateClubEquipmentSize(fs.statSync(filePath).size)).toEqual([]);
  });
});

describe('verifiedAt (AC13) — the existing equipment.json field carries confirmed-present club ids', () => {
  it('equipment.schema.json accepts a club GUID in verifiedAt and rejects a non-GUID', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schema', 'equipment.schema.json'), 'utf8'));
    const verifiedAt = JSON.stringify(schema).match(/"verifiedAt":\{[^}]*"items":\{[^}]*\}/);
    expect(verifiedAt).not.toBeNull();
    expect(verifiedAt[0]).toContain('[0-9a-f]{32}');
  });
});
