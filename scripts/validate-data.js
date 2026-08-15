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
 * directory, every cityKey present in the matching country's index entry,
 * coordinates in range, non-empty names/addresses, no `hours`/`url` field
 * (AC4), and index city counts agreeing with the actual per-city counts in
 * the country files (AC5).
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

    const validCityKeys = new Set((country.cities || []).map((c) => c.key));
    const actualCounts = new Map();

    for (const club of file.clubs || []) {
      if (!validCityKeys.has(club.cityKey)) {
        errors.push(
          `club ${club.id} (${country.code}) has cityKey "${club.cityKey}" not present in the index`
        );
      }
      if (!club.name || !String(club.name).trim()) {
        errors.push(`club ${club.id} (${country.code}) has an empty name`);
      }
      if (!club.address || !String(club.address).trim()) {
        errors.push(`club ${club.id} (${country.code}) has an empty address`);
      }
      if (club.coordinates) {
        const { lat, lng } = club.coordinates;
        if (typeof lat !== 'number' || lat < -90 || lat > 90) {
          errors.push(`club ${club.id} (${country.code}) has an out-of-range coordinate: lat=${lat}`);
        }
        if (typeof lng !== 'number' || lng < -180 || lng > 180) {
          errors.push(`club ${club.id} (${country.code}) has an out-of-range coordinate: lng=${lng}`);
        }
      }
      if ('hours' in club) {
        errors.push(`club ${club.id} (${country.code}) carries hours, which must never be stored (D6/AC4)`);
      }
      if ('url' in club) {
        errors.push(`club ${club.id} (${country.code}) carries url, which must never be stored (D6/AC4)`);
      }

      actualCounts.set(club.cityKey, (actualCounts.get(club.cityKey) || 0) + 1);
    }

    for (const city of country.cities || []) {
      const actual = actualCounts.get(city.key) || 0;
      if (actual !== city.clubCount) {
        errors.push(
          `index city count mismatch for ${city.key} (${country.code}): index says ${city.clubCount}, actual is ${actual}`
        );
      }
    }
  }

  return errors;
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
  if (fs.existsSync(indexPath)) {
    console.log('\nValidating gym directory...');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const files = {};
    for (const country of index.countries || []) {
      const filePath = path.join(gymsDir, country.file);
      if (fs.existsSync(filePath)) {
        files[country.code] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }
    const gymErrors = validateGyms(index, files);
    errors = errors.concat(gymErrors);
    console.log(`✓ Read data/gyms/ (${index.countries?.length ?? 0} countries)`);
  } else {
    console.log('\n(data/gyms/ not present — skipping directory validation)');
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
  REQUIRED_FIELDS,
  VALID_CATEGORIES,
  VALID_KINDS,
};
