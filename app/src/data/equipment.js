// Bundled at build time (same offline-embedding convention as the existing
// static-HTML pipeline — spec.md's Architecture note: "the app does not
// fetch them at runtime"). Real data: 48 items (gym-directory-and-catalog
// expanded the catalog from 27 to 48 — X1), languages en/es/be
// (data/equipment.json's own metadata.languages — spec.md's "EN/ES/RU" is a
// known typo, flagged for eliciting-requirements; the shipped UI must never
// hardcode "RU").
//
// `GYMS` / `data/gyms.json` are GONE from this module (gym-directory-and-
// catalog M7/X8) — the 7 hand-entered Málaga gyms are replaced by the full
// network directory, `app/src/data/gyms.js` (D2). `data/gyms.json` itself
// is deleted in this feature's cleanup slice (S8/R8.2), not here — Build B
// only removes the app's last reader of it (CatalogScreen.jsx).
import equipmentData from '../../../data/equipment.json';

export const EQUIPMENT = equipmentData.equipment;
export const EQUIPMENT_METADATA = equipmentData.metadata;
export const LANGUAGES = equipmentData.metadata.languages; // real data, never hardcoded — see note above

const byId = new Map(EQUIPMENT.map((item) => [item.id, item]));

export function getEquipmentById(id) {
  return byId.get(id) ?? null;
}

/** Main image URL for a catalog/exercise card, with a documented fallback (equipment-display-html skill convention). */
export function mainImageUrl(item) {
  if (!item || !Array.isArray(item.images) || item.images.length === 0) return undefined;
  return (item.images.find((img) => img.isMain) || item.images[0]).url;
}

export function equipmentDisplayName(item, lang = 'es') {
  if (!item) return '';
  return item.names[lang] || item.names.es || item.names.en;
}
