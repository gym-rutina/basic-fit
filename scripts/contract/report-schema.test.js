// @vitest-environment node
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { read, loadOpenApi } from './helpers.js';
import { buildReport, toWire } from '../../app/src/lib/equipmentReports.js';

/**
 * backend-bootstrap AC2 / AC3 (tech-plan.md §2 D3 / spec D6) — the wire report is
 * defined ONCE, in contract/openapi.yaml, and the SHIPPED client builder must
 * conform to it. The schema is read from the contract file (never a copy), so
 * a client/contract divergence in either direction fails here.
 */

const SIX = ['clubId', 'equipmentId', 'method', 'reportId', 'reportedAt', 'signal'];
const CLUB = 'a'.repeat(32);

function reportSchema() {
  return loadOpenApi().components.schemas.ClubEquipmentReport;
}
function validator() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  return ajv.compile(reportSchema());
}
const goodReport = () => buildReport({ clubId: CLUB, equipmentId: 'g3-s10', signal: 'absent', method: 'session' });

describe('ClubEquipmentReport in openapi.yaml (AC2)', () => {
  it('requires exactly the six fields and forbids everything else', () => {
    const s = reportSchema();
    expect([...s.required].sort()).toEqual(SIX);
    expect(Object.keys(s.properties).sort()).toEqual(SIX);
    expect(s.additionalProperties).toBe(false);
  });

  it('constrains signal and method to their closed vocabularies', () => {
    const { properties } = reportSchema();
    expect([...properties.signal.enum].sort()).toEqual(['absent', 'present']);
    expect([...properties.method.enum].sort()).toEqual(['catalog', 'session']);
  });

  it.each(['note', 'substituteEquipmentId', 'catalogueVersion'])('has dropped %s (privacy, DD-005)', (field) => {
    expect(reportSchema().properties).not.toHaveProperty(field);
  });

  it('types.d.ts mirrors it field-for-field', () => {
    const ts = read('contract', 'types.d.ts');
    const block = ts.match(/export interface ClubEquipmentReport\s*\{([\s\S]*?)\n\}/);
    expect(block).not.toBeNull();
    const fields = [...block[1].matchAll(/^\s*([a-zA-Z]+)\??\s*:/gm)].map((m) => m[1]).sort();
    expect(fields).toEqual(SIX);
  });
});

describe('the shipped client wire report conforms to the contract (AC3)', () => {
  it('a report from buildReport validates', () => {
    const validate = validator();
    const r = goodReport();
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true);
  });

  it('a report from toWire (outbox record with local-only fields) validates', () => {
    const validate = validator();
    const wire = toWire({ ...goodReport(), key: `${CLUB}|g3-s10`, origin: 'explicit' });
    expect(validate(wire), JSON.stringify(validate.errors)).toBe(true);
  });

  it('the same report with an extra field (note) FAILS', () => {
    const validate = validator();
    expect(validate({ ...goodReport(), note: 'hola' })).toBe(false);
  });

  it.each(SIX)('the same report missing %s FAILS', (field) => {
    const validate = validator();
    const r = { ...goodReport() };
    delete r[field];
    expect(validate(r)).toBe(false);
  });

  it('an out-of-vocabulary signal or method FAILS', () => {
    const validate = validator();
    expect(validate({ ...goodReport(), signal: 'maybe' })).toBe(false);
    expect(validate({ ...goodReport(), method: 'shake' })).toBe(false);
  });

  it('the buildReport output has exactly the contract keys — no drift in either direction', () => {
    expect(Object.keys(goodReport()).sort()).toEqual([...reportSchema().required].sort());
  });
});
