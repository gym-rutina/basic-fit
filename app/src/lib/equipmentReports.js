import { getEquipmentById } from '../data/equipment.js';

/**
 * club-equipment-reporting — the anonymous equipment report (spec AC4/AC6/AC18,
 * tech-plan.md D3). Pure, zero-React, zero-IO.
 *
 * The privacy boundary is STRUCTURAL: `buildReport` reads exactly four fields
 * from its one argument and nothing else. A caller that also holds `notes`,
 * `weightUsed` or `difficulty` can spread them in and they still cannot reach
 * the output — the output object is built field by field, never by spreading
 * the input.
 *
 * The wire shape is `{reportId, clubId, equipmentId, signal, method,
 * reportedAt}`. `reportId` is a random per-report UUID (retry idempotency); it
 * is never derived from a device, a user or a club.
 */

export const SIGNALS = Object.freeze(['present', 'absent']);
export const METHODS = Object.freeze(['session', 'catalog']);

function defaultNewId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function defaultNow() {
  return new Date().toISOString();
}

function nonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

/** The natural outbox key — one pending report per (club, equipment). */
export function reportKey(clubId, equipmentId) {
  return `${clubId}|${equipmentId}`;
}

/**
 * AC4 — a report is only ever made for a selected club and a real
 * `data/equipment.json` catalog id. Gear (`extraEquipment`), unresolved ids and
 * bodyweight (null/undefined) are never reportable.
 *
 * @param {{clubId: string|null|undefined, equipmentId: string|null|undefined}} args
 * @returns {boolean}
 */
export function isReportable({ clubId, equipmentId } = {}) {
  if (!nonEmptyString(clubId)) return false;
  if (!nonEmptyString(equipmentId)) return false;
  return getEquipmentById(equipmentId) !== null;
}

/**
 * @param {{clubId: string, equipmentId: string, signal: 'present'|'absent', method: 'session'|'catalog'}} input
 * @param {{now?: () => string, newId?: () => string}} [deps]
 * @returns {{reportId: string, clubId: string, equipmentId: string, signal: string, method: string, reportedAt: string}|null}
 *   null (never throws) for an unusable input.
 */
export function buildReport(input, { now = defaultNow, newId = defaultNewId } = {}) {
  if (!input || typeof input !== 'object') return null;
  const { clubId, equipmentId, signal, method } = input;
  if (!nonEmptyString(clubId) || !nonEmptyString(equipmentId)) return null;
  if (!SIGNALS.includes(signal) || !METHODS.includes(method)) return null;
  return {
    reportId: newId(),
    clubId,
    equipmentId,
    signal,
    method,
    reportedAt: now(),
  };
}

/**
 * Strips the local-only outbox fields (`key`, `origin`) — exactly the six wire
 * fields leave the device (AC6).
 */
export function toWire(record) {
  const { reportId, clubId, equipmentId, signal, method, reportedAt } = record;
  return { reportId, clubId, equipmentId, signal, method, reportedAt };
}
