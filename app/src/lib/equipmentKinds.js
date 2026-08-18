/**
 * Equipment-overlay grouping by `kind` (spec.md AC44/AC44b, tech-plan.md
 * D11, M11).
 *
 * The overlay groups by `kind` — the physical-type discriminator — NOT by
 * `category`, the Catálogo filter axis. They disagree for exactly two
 * entries (the Aura Adjustable Pulley and the Magnum Supine Bench Press,
 * both `kind: machine` / `category: free-weights`), which is the entire
 * point of splitting the two axes: those two machines belong with the
 * other machines in the overlay, not next to the dumbbells.
 *
 * Pure module — zero React imports (tech-plan-build-b.md §1) — so AC44's
 * counts are data assertions on a function, not DOM queries that would
 * break on any later restyling of EquipmentOverlaySheet.
 */

export const KIND_ORDER = Object.freeze(['machine', 'free-weight', 'accessory']);

/** Defaults a kind-less entry to "machine" — the schema default (R2.1) — so this stays correct even against a pre-migration file. */
function kindOf(item) {
  return (item && item.kind) || 'machine';
}

/**
 * @param {Array} equipment
 * @returns {{machine: Array, 'free-weight': Array, accessory: Array}}
 */
export function groupByKind(equipment) {
  const groups = { machine: [], 'free-weight': [], accessory: [] };
  for (const item of Array.isArray(equipment) ? equipment : []) {
    const kind = kindOf(item);
    if (groups[kind]) groups[kind].push(item);
  }
  return groups;
}

/**
 * @param {Array} equipment
 * @returns {{machine: number, 'free-weight': number, accessory: number}}
 */
export function kindCounts(equipment) {
  const grouped = groupByKind(equipment);
  return {
    machine: grouped.machine.length,
    'free-weight': grouped['free-weight'].length,
    accessory: grouped.accessory.length,
  };
}
