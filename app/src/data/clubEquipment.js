// The client's window onto data/club-equipment.json — the TEAM-MERGED per-club
// default overlay (club-equipment-reporting AC10/AC12, tech-plan.md D9/D12).
// Bundled at build time like data/equipment.json (the app never fetches it at
// runtime). Ships empty in v1; `npm run validate-data` guarantees the shape of
// the real file, but this module is still defensive by construction: the file
// is data, and a malformed or missing entry degrades to "no default" — never to
// a crash on club selection.
import clubEquipmentData from '../../../data/club-equipment.json';

function idList(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : null;
}

/**
 * @param {*} data - a parsed club-equipment.json (or anything at all)
 * @returns {(clubId: string|null|undefined) => {absent: string[], present: string[]}|null}
 *   The lookup hands out COPIES, so a caller mutating a result cannot corrupt
 *   the shipped data.
 */
export function createDefaultsLookup(data) {
  const clubs = data && typeof data === 'object' && data.clubs && typeof data.clubs === 'object' && !Array.isArray(data.clubs) ? data.clubs : null;

  return function lookup(clubId) {
    if (!clubs || typeof clubId !== 'string' || !Object.prototype.hasOwnProperty.call(clubs, clubId)) return null;
    const entry = clubs[clubId];
    if (!entry || typeof entry !== 'object') return null;
    // Both lists are optional in the file; a list that IS there but is not an
    // array means the entry is malformed → no default at all.
    const absent = entry.absent === undefined ? [] : idList(entry.absent);
    const present = entry.present === undefined ? [] : idList(entry.present);
    if (!absent || !present) return null;
    return { absent, present };
  };
}

/** The shipped default for a club, or `null` when the team has merged none. */
export const shippedDefaultFor = createDefaultsLookup(clubEquipmentData);
