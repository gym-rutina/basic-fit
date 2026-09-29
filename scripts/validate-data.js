#!/usr/bin/env node

/**
 * Validation script for BasicFit Equipment Catalog + gym directory.
 *
 * tech-plan.md D13: this script reads data/schema/equipment.schema.json but
 * (by design, per AC14's "all three hardcoding sites" wording) does NOT
 * delegate to it — it validates against its own hand-rolled required-field
 * list, category enum and kind enum, kept in sync with the schema by the
 * `drift` describe block in validate-data.test.js. Migrating to ajv (the
 * schema-driven, no-drift-possible fix) is DD-011, deferred deliberately.
 */

const fs = require('fs');
const path = require('path');

// Kept in lockstep with data/schema/equipment.schema.json's `required` list
// (minus `gyms`, which the M1/M2 migration renamed to the OPTIONAL
// `verifiedAt`). validate-data.test.js's `drift` block asserts this.
const REQUIRED_FIELDS = [
  'id',
  'modelCode',
  'series',
  'category',
  'muscleGroup',
  'names',
  'descriptions',
  'images',
  'videos',
  'manuals',
  'instructions',
  'specifications',
];

// Kept in lockstep with equipment.schema.json's category.enum (M11: +2).
const VALID_CATEGORIES = [
  'chest',
  'shoulders',
  'back',
  'arms',
  'core',
  'legs',
  'free-weights',
  'accessories',
];

// Kept in lockstep with equipment.schema.json's kind.enum. "gear" is
// deliberately absent — it is valid ONLY in rutina.schema.json's
// extraEquipment[] (M11, AC44c).
const VALID_KINDS = ['machine', 'free-weight', 'accessory'];

const GUID_RE = /^[0-9a-f]{32}$/;

/**
 * Hand-rolled equipment.json validator (D13). `schema` is accepted for
 * signature/documentation parity with equipment.schema.json but is not
 * consulted — see the module doc comment above.
 *
 * @param {*} data
 * @param {*} _schema
 * @returns {string[]}
 */
function validateSchema(data, _schema) {
  const errors = [];

  if (!data.metadata) {
    errors.push('Missing required field: metadata');
    return errors;
  }

  const metadata = data.metadata;
  if (!metadata.lastUpdated) errors.push('metadata.lastUpdated is required');
  if (!metadata.source) errors.push('metadata.source is required');
  if (!Array.isArray(metadata.languages)) errors.push('metadata.languages must be an array');
  if (typeof metadata.totalEquipment !== 'number') {
    errors.push('metadata.totalEquipment must be a number');
  }

  if (!Array.isArray(data.equipment)) {
    errors.push('equipment must be an array');
    return errors;
  }

  data.equipment.forEach((item, index) => {
    const prefix = `equipment[${index}]`;

    REQUIRED_FIELDS.forEach((field) => {
      if (!(field in item)) {
        errors.push(`${prefix}.${field} is required`);
      }
    });

    if ('gymZone' in item) {
      errors.push(`${prefix}.gymZone must not be present — the field was deleted (M1)`);
    }

    if (item.category && !VALID_CATEGORIES.includes(item.category)) {
      errors.push(`${prefix}.category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    if ('kind' in item && !VALID_KINDS.includes(item.kind)) {
      errors.push(`${prefix}.kind must be one of: ${VALID_KINDS.join(', ')} (got "${item.kind}")`);
    }

    if ('verifiedAt' in item) {
      if (!Array.isArray(item.verifiedAt)) {
        errors.push(`${prefix}.verifiedAt must be an array`);
      } else {
        item.verifiedAt.forEach((guid, guidIndex) => {
          if (typeof guid !== 'string' || !GUID_RE.test(guid)) {
            errors.push(`${prefix}.verifiedAt[${guidIndex}] must be a 32-hex club GUID`);
          }
        });
      }
    }

    if (item.names) {
      ['en', 'es', 'be'].forEach((lang) => {
        if (!item.names[lang]) errors.push(`${prefix}.names.${lang} is required`);
      });
    }

    if (item.descriptions) {
      ['en', 'es', 'be'].forEach((lang) => {
        if (!item.descriptions[lang]) errors.push(`${prefix}.descriptions.${lang} is required`);
      });
    }

    if (item.instructions) {
      ['en', 'es', 'be'].forEach((lang) => {
        if (!item.instructions[lang]) errors.push(`${prefix}.instructions.${lang} is required`);
      });
    }

    if (item.muscleGroup) {
      if (!Array.isArray(item.muscleGroup.primary)) {
        errors.push(`${prefix}.muscleGroup.primary must be an array`);
      }
      if (!Array.isArray(item.muscleGroup.secondary)) {
        errors.push(`${prefix}.muscleGroup.secondary must be an array`);
      }
    }

    if (item.images && Array.isArray(item.images)) {
      item.images.forEach((img, imgIndex) => {
        if (!img.url) errors.push(`${prefix}.images[${imgIndex}].url is required`);
        if (!img.source) errors.push(`${prefix}.images[${imgIndex}].source is required`);
        if (typeof img.isMain !== 'boolean') {
          errors.push(`${prefix}.images[${imgIndex}].isMain must be a boolean`);
        }
      });
    }

    if (item.videos) {
      ['en', 'es', 'be'].forEach((lang) => {
        if (!Array.isArray(item.videos[lang])) {
          errors.push(`${prefix}.videos.${lang} must be an array`);
        } else {
          item.videos[lang].forEach((video, vidIndex) => {
            if (!video.url) errors.push(`${prefix}.videos.${lang}[${vidIndex}].url is required`);
            if (!video.type) errors.push(`${prefix}.videos.${lang}[${vidIndex}].type is required`);
            if (!video.title) errors.push(`${prefix}.videos.${lang}[${vidIndex}].title is required`);
          });
        }
      });
    }
  });

  return errors;
}

/**
 * Validate a built gym directory (R1.9): unique club ids across the whole
 * directory, every club's `city` present in the matching country's index
 * entry, non-empty names/addresses, no `hours`/`url`/`coordinates`/`cityKey`
 * field (AC4, D6a), and index city counts agreeing with the actual per-city
 * counts in the country files (AC5).
 *
 * Cycle-9 correction (tech-plan-build-b.md D6a): club records no longer
 * carry `cityKey` or `coordinates` — both were dropped to bring the real
 * shipped payload under AC4's ≤300KB cap (measured at 604.9KB with both
 * present, 2x over budget). City matching therefore joins on `city` (the
 * display name) against the index's `cities[].name`, not on a slug key.
 *
 * @param {{countries: Array<{code:string, cities: Array<{key:string,name:string,clubCount:number}>}>}} index
 * @param {Record<string, {country:string, clubs:Array}>} files - country code -> parsed country file
 * @returns {string[]}
 */
function validateGyms(index, files) {
  const errors = [];
  const countries = (index && Array.isArray(index.countries)) ? index.countries : [];

  const seenIds = new Set();
  for (const country of countries) {
    const file = files[country.code];
    if (!file) {
      errors.push(`no country file found for ${country.code}`);
      continue;
    }
    for (const club of file.clubs || []) {
      if (seenIds.has(club.id)) {
        errors.push(`duplicate club id: ${club.id}`);
      }
      seenIds.add(club.id);
    }
  }

  for (const country of countries) {
    const file = files[country.code];
    if (!file) continue;

    const validCityNames = new Set((country.cities || []).map((c) => c.name));
    const actualCounts = new Map();

    for (const club of file.clubs || []) {
      if (!validCityNames.has(club.city)) {
        errors.push(
          `club ${club.id} (${country.code}) has city "${club.city}" not present in the index`
        );
      }
      if (!club.name || !String(club.name).trim()) {
        errors.push(`club ${club.id} (${country.code}) has an empty name`);
      }
      if (!club.address || !String(club.address).trim()) {
        errors.push(`club ${club.id} (${country.code}) has an empty address`);
      }
      if ('hours' in club) {
        errors.push(`club ${club.id} (${country.code}) carries hours, which must never be stored (D6/AC4)`);
      }
      if ('url' in club) {
        errors.push(`club ${club.id} (${country.code}) carries url, which must never be stored (D6/AC4)`);
      }
      if ('coordinates' in club) {
        errors.push(`club ${club.id} (${country.code}) carries coordinates, which must never be stored (D6a/AC4 — dropped cycle 9 to fit the ≤300KB cap)`);
      }
      if ('cityKey' in club) {
        errors.push(`club ${club.id} (${country.code}) carries cityKey, which must never be stored (D6a/AC4 — dropped cycle 9 to fit the ≤300KB cap)`);
      }

      actualCounts.set(club.city, (actualCounts.get(club.city) || 0) + 1);
    }

    for (const city of country.cities || []) {
      const actual = actualCounts.get(city.name) || 0;
      if (actual !== city.clubCount) {
        errors.push(
          `index city count mismatch for ${city.name} (${country.code}): index says ${city.clubCount}, actual is ${actual}`
        );
      }
    }
  }

  return errors;
}

const MAX_GYMS_DIRECTORY_BYTES = 300 * 1024; // AC4 — ≤300 KB raw, uncompressed, un-gzipped

/**
 * Validates the shipped gym directory's total raw size against AC4's
 * ≤300KB cap (tech-plan-build-b.md D6a). Nothing asserted this before cycle
 * 9 — that is exactly how the directory shipped at 604.9KB, 2x over budget,
 * undetected by a green test suite (Bagnik, handoff-log.md 04:15).
 *
 * Takes byte sizes rather than reading the filesystem itself, so it stays a
 * pure, unit-testable function like `validateGyms` — the caller (`validate()`)
 * is what knows the real file sizes.
 *
 * @param {Record<string, number>} fileSizes - filename -> byte size, e.g. { 'index.json': 123, 'ES.json': 456 }
 * @returns {string[]}
 */
function validateGymsSize(fileSizes) {
  const total = Object.values(fileSizes).reduce((sum, n) => sum + n, 0);
  if (total > MAX_GYMS_DIRECTORY_BYTES) {
    const breakdown = Object.entries(fileSizes)
      .map(([f, n]) => `${f}: ${(n / 1024).toFixed(1)}KB`)
      .join(', ');
    return [
      `data/gyms/ totals ${(total / 1024).toFixed(1)}KB, over AC4's ≤300KB raw cap (${breakdown})`,
    ];
  }
  return [];
}

// club-equipment-reporting D12 — data/club-equipment.json, the team-merged
// per-club defaults. Kept in lockstep with data/schema/club-equipment.schema.json
// by the drift describe in validate-club-equipment.test.js. Every object is
// closed (no free text can hide in it) and ships empty in v1.
const CLUB_EQUIPMENT_SCHEMA_VERSION = 1;
const CLUB_EQUIPMENT_TOP_KEYS = ['schemaVersion', 'clubs'];
const CLUB_EQUIPMENT_ENTRY_KEYS = ['absent', 'present'];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Validates the team-merged per-club defaults file (AC10/AC11, D12). Pure —
 * reads no disk — so it is unit-testable like `validateGyms`; the caller
 * (`validate()`) supplies the real id sets. Accumulates every problem.
 *
 * @param {*} data - parsed data/club-equipment.json
 * @param {{equipmentIds?: Set<string>|null, clubIds?: Set<string>|null}} [ctx]
 *   `clubIds: null` skips ONLY the club-directory check (directory absent);
 *   equipment ids are always checked when `equipmentIds` is supplied.
 * @returns {string[]}
 */
function validateClubEquipment(data, ctx) {
  const errors = [];
  const equipmentIds = ctx && ctx.equipmentIds ? ctx.equipmentIds : null;
  const clubIds = ctx && ctx.clubIds ? ctx.clubIds : null;

  if (!isPlainObject(data)) {
    return ['club-equipment.json must be an object'];
  }

  for (const key of Object.keys(data)) {
    if (!CLUB_EQUIPMENT_TOP_KEYS.includes(key)) {
      errors.push(`club-equipment.json: unknown top-level property "${key}"`);
    }
  }
  if (data.schemaVersion !== CLUB_EQUIPMENT_SCHEMA_VERSION) {
    errors.push(`club-equipment.json: schemaVersion must be ${CLUB_EQUIPMENT_SCHEMA_VERSION}`);
  }
  if (!isPlainObject(data.clubs)) {
    errors.push('club-equipment.json: clubs must be an object keyed by club id');
    return errors;
  }

  for (const [clubId, entry] of Object.entries(data.clubs)) {
    const where = `clubs.${clubId}`;

    if (!GUID_RE.test(clubId)) {
      errors.push(`${where}: club id must be a 32-hex GUID`);
    } else if (clubIds && !clubIds.has(clubId)) {
      errors.push(`${where}: club id ${clubId} is not in the gym directory (data/gyms/)`);
    }

    if (!isPlainObject(entry)) {
      errors.push(`${where}: entry must be an object with absent[] and/or present[]`);
      continue;
    }
    for (const key of Object.keys(entry)) {
      if (!CLUB_EQUIPMENT_ENTRY_KEYS.includes(key)) {
        errors.push(`${where}: unknown property "${key}" (only absent / present are allowed — no free text)`);
      }
    }
    if (!('absent' in entry) && !('present' in entry)) {
      errors.push(`${where}: entry needs absent[] and/or present[]`);
    }

    const lists = {};
    for (const listName of CLUB_EQUIPMENT_ENTRY_KEYS) {
      if (!(listName in entry)) continue;
      const list = entry[listName];
      if (!Array.isArray(list)) {
        errors.push(`${where}.${listName}: must be an array of equipment ids`);
        continue;
      }
      const seen = new Set();
      list.forEach((id, i) => {
        if (typeof id !== 'string' || id.length === 0) {
          errors.push(`${where}.${listName}[${i}]: must be a non-empty equipment id string`);
          return;
        }
        if (seen.has(id)) {
          errors.push(`${where}.${listName}[${i}]: duplicate equipment id "${id}"`);
        }
        seen.add(id);
        if (equipmentIds && !equipmentIds.has(id)) {
          errors.push(`${where}.${listName}[${i}]: unknown equipment id "${id}" (not in equipment.json)`);
        }
      });
      lists[listName] = seen;
    }

    if (lists.absent && lists.present) {
      for (const id of lists.absent) {
        if (lists.present.has(id)) {
          errors.push(`${where}: equipment id "${id}" is listed both absent and present — contradiction the team must resolve`);
        }
      }
    }
  }

  return errors;
}

const MAX_CLUB_EQUIPMENT_BYTES = 256 * 1024; // raw, uncompressed — the file is bundled into the app

/**
 * Size cap for the shipped defaults file (AC11) — byte size in, errors out, so
 * it stays a pure function like `validateGymsSize`.
 *
 * @param {number} bytes
 * @returns {string[]}
 */
function validateClubEquipmentSize(bytes) {
  if (bytes > MAX_CLUB_EQUIPMENT_BYTES) {
    return [
      `data/club-equipment.json is ${(bytes / 1024).toFixed(1)}KB, over the ${MAX_CLUB_EQUIPMENT_BYTES / 1024}KB raw cap`,
    ];
  }
  return [];
}

function validate() {
  const dataPath = path.join(__dirname, '..', 'data', 'equipment.json');
  const schemaPath = path.join(__dirname, '..', 'data', 'schema', 'equipment.schema.json');
  const gymsDir = path.join(__dirname, '..', 'data', 'gyms');

  console.log('Validating BasicFit Equipment Catalog...\n');

  let data;
  try {
    const dataContent = fs.readFileSync(dataPath, 'utf8');
    data = JSON.parse(dataContent);
    console.log(`✓ Read equipment.json (${data.equipment.length} items)`);
  } catch (error) {
    console.error(`✗ Error reading equipment.json: ${error.message}`);
    process.exit(1);
  }

  let schema;
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    schema = JSON.parse(schemaContent);
    console.log('✓ Read equipment.schema.json');
  } catch (error) {
    console.error(`✗ Error reading schema: ${error.message}`);
    process.exit(1);
  }

  console.log('\nValidating equipment data structure...');
  let errors = validateSchema(data, schema);

  // R1.9 — validate the gym directory too, when it exists. Build A does not
  // ship data/gyms/ yet (it is produced by actually running scripts/scrape-gyms.js
  // against the live storefront), so this step degrades gracefully rather
  // than failing when the directory is absent.
  const indexPath = path.join(gymsDir, 'index.json');
  let clubIds = null; // stays null when the directory is absent — club check skipped
  if (fs.existsSync(indexPath)) {
    console.log('\nValidating gym directory...');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const files = {};
    const fileSizes = { 'index.json': fs.statSync(indexPath).size };
    for (const country of index.countries || []) {
      const filePath = path.join(gymsDir, country.file);
      if (fs.existsSync(filePath)) {
        files[country.code] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        fileSizes[country.file] = fs.statSync(filePath).size;
      }
    }
    const gymErrors = validateGyms(index, files).concat(validateGymsSize(fileSizes));
    errors = errors.concat(gymErrors);
    clubIds = new Set();
    for (const countryFile of Object.values(files)) {
      for (const club of countryFile.clubs || []) clubIds.add(club.id);
    }
    console.log(`✓ Read data/gyms/ (${index.countries?.length ?? 0} countries)`);
  } else {
    console.log('\n(data/gyms/ not present — skipping directory validation)');
  }

  // club-equipment-reporting AC10/AC11 — the team-merged per-club defaults.
  const clubEquipmentPath = path.join(__dirname, '..', 'data', 'club-equipment.json');
  console.log('\nValidating club equipment defaults...');
  if (fs.existsSync(clubEquipmentPath)) {
    let clubEquipment;
    try {
      clubEquipment = JSON.parse(fs.readFileSync(clubEquipmentPath, 'utf8'));
    } catch (error) {
      errors.push(`data/club-equipment.json is not valid JSON: ${error.message}`);
    }
    if (clubEquipment !== undefined) {
      const equipmentIds = new Set((data.equipment || []).map((item) => item.id));
      errors = errors
        .concat(validateClubEquipment(clubEquipment, { equipmentIds, clubIds }))
        .concat(validateClubEquipmentSize(fs.statSync(clubEquipmentPath).size));
      const clubCount = Object.keys((clubEquipment && clubEquipment.clubs) || {}).length;
      console.log(`✓ Read data/club-equipment.json (${clubCount} clubs)`);
    }
  } else {
    errors.push('data/club-equipment.json is missing — it ships with the app (an empty file is valid)');
  }

  if (errors.length === 0) {
    console.log('\n✓ All validations passed!\n');
    console.log(`Summary:`);
    console.log(`  - Total equipment: ${data.equipment.length}`);
    console.log(`  - Languages: ${data.metadata.languages.join(', ')}`);
    console.log(`  - Last updated: ${data.metadata.lastUpdated}`);

    const categories = {};
    data.equipment.forEach((item) => {
      categories[item.category] = (categories[item.category] || 0) + 1;
    });
    console.log(`  - Categories:`);
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`    • ${cat}: ${count}`);
    });

    return 0;
  } else {
    console.error(`\n✗ Validation failed with ${errors.length} error(s):\n`);
    errors.forEach((error, index) => {
      console.error(`  ${index + 1}. ${error}`);
    });
    return 1;
  }
}

if (require.main === module) {
  const exitCode = validate();
  process.exit(exitCode);
}

module.exports = {
  validate,
  validateSchema,
  validateGyms,
  validateGymsSize,
  validateClubEquipment,
  validateClubEquipmentSize,
  MAX_CLUB_EQUIPMENT_BYTES,
  REQUIRED_FIELDS,
  VALID_CATEGORIES,
  VALID_KINDS,
};
