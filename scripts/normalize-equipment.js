#!/usr/bin/env node

/**
 * data/equipment.json write-back fixup pass (spec.md M12/R8.8, tech-plan.md
 * D9). Extracted out of the deleted scripts/build-catalog.js — this module
 * keeps ONLY the two fixups that actually mutate data (video placeholder
 * resolution, JHT manual URL rewriting); the equipment-catalog.html
 * generation that build-catalog.js also did is gone along with the page.
 *
 * AC50b ("a second run leaves data/equipment.json byte-identical") is NOT
 * satisfiable by a straight port of the old script: build-catalog.js
 * stamped `metadata.lastUpdated` on every run regardless of whether
 * anything changed, so "byte-identical on a second run" held only within
 * one calendar day. `normalizeEquipment` is therefore pure and reports
 * whether anything actually changed; the CLI below writes (and stamps the
 * date) ONLY when it did.
 */

const fs = require('fs');
const path = require('path');

const JHT_MANUALS_BASE = 'https://www.jhtsupport.com/eng/matrix/manuals';
const JHT_MANUALS_PATTERN = /^https?:\/\/(www\.)?jhtsupport\.com\/eng\/matrix\/manuals\/[^/]+/i;

/**
 * Replace a `SEARCH_REQUIRED` video url placeholder with a YouTube search
 * built from the quoted term in `video.note`, falling back to the entry's
 * own name (in that video's language) when the note carries no quoted term.
 */
function resolveVideoPlaceholder(video, entryNames, lang) {
  if (!video || typeof video.url !== 'string' || !video.url.includes('SEARCH_REQUIRED')) {
    return video;
  }
  const match = typeof video.note === 'string' ? video.note.match(/['"]([^'"]+)['"]/) : null;
  const searchQuery = match ? match[1].trim() : (entryNames && entryNames[lang]) || (entryNames && entryNames.en) || '';
  return { ...video, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}` };
}

/** Rewrite a per-product JHT `/manuals/{slug}` url (404s) to the searchable list page. */
function resolveManualUrl(manual, modelCodeOrId) {
  if (!manual || !manual.url || !JHT_MANUALS_PATTERN.test(manual.url)) return manual;
  return { ...manual, url: JHT_MANUALS_BASE, searchTerm: modelCodeOrId || '' };
}

function normalizeEntry(entry) {
  const next = { ...entry };

  if (next.videos) {
    const videos = {};
    for (const lang of Object.keys(next.videos)) {
      videos[lang] = (next.videos[lang] || []).map((video) => resolveVideoPlaceholder(video, next.names, lang));
    }
    next.videos = videos;
  }

  if (Array.isArray(next.manuals)) {
    next.manuals = next.manuals.map((manual) => resolveManualUrl(manual, next.modelCode || next.id || ''));
  }

  return next;
}

/**
 * Pure normalisation pass over a parsed equipment.json document. Does NOT
 * mutate its input. Returns `{ data, changed }` — `data.metadata.lastUpdated`
 * is stamped with today's date ONLY when `changed` is true (D9), which is
 * what makes AC50b hold unconditionally rather than "until midnight".
 *
 * @param {{metadata: object, equipment: Array}} doc
 * @returns {{data: object, changed: boolean}}
 */
function normalizeEquipment(doc) {
  const normalizedEquipment = (doc.equipment || []).map(normalizeEntry);
  const before = JSON.stringify(doc.equipment);
  const after = JSON.stringify(normalizedEquipment);
  const changed = before !== after;

  const data = {
    ...doc,
    metadata: changed ? { ...doc.metadata, lastUpdated: new Date().toISOString().slice(0, 10) } : { ...doc.metadata },
    equipment: normalizedEquipment,
  };

  return { data, changed };
}

function run() {
  const ROOT = path.join(__dirname, '..');
  const equipmentPath = path.join(ROOT, 'data', 'equipment.json');

  const raw = fs.readFileSync(equipmentPath, 'utf8');
  const doc = JSON.parse(raw);

  const { data, changed } = normalizeEquipment(doc);

  if (!changed) {
    console.log('normalize-equipment: no changes — data/equipment.json is already clean.');
    return 0;
  }

  fs.writeFileSync(equipmentPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`normalize-equipment: wrote data/equipment.json (lastUpdated=${data.metadata.lastUpdated}).`);
  return 0;
}

if (require.main === module) {
  process.exit(run());
}

module.exports = { normalizeEquipment, JHT_MANUALS_BASE, JHT_MANUALS_PATTERN };
