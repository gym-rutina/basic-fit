import { describe, it, expect } from 'vitest';
import { buildReport, toWire, isReportable, reportKey, SIGNALS, METHODS } from './equipmentReports.js';

/**
 * club-equipment-reporting AC4/AC6/AC18 (tech-plan.md §2 D3/D9).
 *
 * The privacy boundary is STRUCTURAL: buildReport takes ONE object and reads
 * exactly four fields from it. A caller that also holds `notes`,
 * `weightUsed` or `difficulty` can spread them in and they still cannot
 * reach the output — asserted by the key-set test below, not by convention.
 */

const CLUB = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const FIXED = { now: () => '2026-09-29T10:00:00.000Z', newId: () => 'rid-1' };

describe('buildReport (AC6, AC18)', () => {
  it('returns exactly {reportId, clubId, equipmentId, signal, method, reportedAt}', () => {
    const r = buildReport({ clubId: CLUB, equipmentId: 'g3-s10', signal: 'absent', method: 'session' }, FIXED);
    expect(r).toEqual({
      reportId: 'rid-1',
      clubId: CLUB,
      equipmentId: 'g3-s10',
      signal: 'absent',
      method: 'session',
      reportedAt: '2026-09-29T10:00:00.000Z',
    });
    expect(Object.keys(r).sort()).toEqual(['clubId', 'equipmentId', 'method', 'reportId', 'reportedAt', 'signal']);
  });

  it('cannot be made to carry notes / weightUsed / difficulty / any extra field (AC18 — structural)', () => {
    const r = buildReport(
      {
        clubId: CLUB,
        equipmentId: 'g3-s10',
        signal: 'present',
        method: 'catalog',
        notes: 'sin polea, usé el agarre largo',
        weightUsed: 42,
        difficulty: 'hard',
        userId: 'u-1',
        deviceId: 'd-1',
      },
      FIXED
    );
    expect(Object.keys(r).sort()).toEqual(['clubId', 'equipmentId', 'method', 'reportId', 'reportedAt', 'signal']);
    expect(JSON.stringify(r)).not.toMatch(/sin polea|\b42\b|hard|\bu-1\b|\bd-1\b/);
  });

  it('defaults to a real ISO timestamp and a fresh random id each call (no device-derived id)', () => {
    const a = buildReport({ clubId: CLUB, equipmentId: 'g3-s10', signal: 'absent', method: 'session' });
    const b = buildReport({ clubId: CLUB, equipmentId: 'g3-s10', signal: 'absent', method: 'session' });
    expect(a.reportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(a.reportId).toEqual(expect.any(String));
    expect(a.reportId.length).toBeGreaterThanOrEqual(8);
    expect(a.reportId).not.toBe(b.reportId);
  });

  it.each([
    ['unknown signal', { signal: 'maybe' }],
    ['unknown method', { method: 'shake' }],
    ['missing clubId', { clubId: '' }],
    ['missing equipmentId', { equipmentId: null }],
    ['non-string clubId', { clubId: 42 }],
  ])('returns null (never throws) for %s', (_label, patch) => {
    const input = { clubId: CLUB, equipmentId: 'g3-s10', signal: 'absent', method: 'session', ...patch };
    expect(() => buildReport(input, FIXED)).not.toThrow();
    expect(buildReport(input, FIXED)).toBeNull();
  });

  it('returns null for a non-object argument', () => {
    expect(buildReport(undefined, FIXED)).toBeNull();
    expect(buildReport(null, FIXED)).toBeNull();
  });

  it('exposes the two closed vocabularies', () => {
    expect([...SIGNALS].sort()).toEqual(['absent', 'present']);
    expect([...METHODS].sort()).toEqual(['catalog', 'session']);
  });
});

describe('toWire — strips local-only outbox fields', () => {
  it('drops key/origin and keeps exactly the six wire fields', () => {
    const wire = toWire({
      key: `${CLUB}|g3-s10`,
      origin: 'explicit',
      reportId: 'rid-1',
      clubId: CLUB,
      equipmentId: 'g3-s10',
      signal: 'absent',
      method: 'catalog',
      reportedAt: '2026-09-29T10:00:00.000Z',
    });
    expect(Object.keys(wire).sort()).toEqual(['clubId', 'equipmentId', 'method', 'reportId', 'reportedAt', 'signal']);
  });
});

describe('isReportable (AC4)', () => {
  it('is true for a selected club + a real catalog equipment id', () => {
    expect(isReportable({ clubId: CLUB, equipmentId: 'g3-s10' })).toBe(true);
  });

  it('is false with no club', () => {
    expect(isReportable({ clubId: null, equipmentId: 'g3-s10' })).toBe(false);
    expect(isReportable({ clubId: '', equipmentId: 'g3-s10' })).toBe(false);
  });

  it('is false for gear / unresolved ids and for bodyweight (null/undefined) — never reportable', () => {
    expect(isReportable({ clubId: CLUB, equipmentId: 'foam-roller' })).toBe(false);
    expect(isReportable({ clubId: CLUB, equipmentId: null })).toBe(false);
    expect(isReportable({ clubId: CLUB, equipmentId: undefined })).toBe(false);
  });
});

describe('reportKey', () => {
  it('is the natural (club, equipment) key that makes the outbox last-write-wins', () => {
    expect(reportKey(CLUB, 'g3-s10')).toBe(reportKey(CLUB, 'g3-s10'));
    expect(reportKey(CLUB, 'g3-s10')).not.toBe(reportKey(CLUB, 'g3-s30'));
    expect(reportKey(CLUB, 'g3-s10')).not.toBe(reportKey('b'.repeat(32), 'g3-s10'));
  });
});
