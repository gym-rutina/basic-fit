#!/usr/bin/env node
/**
 * Generates contract/rutina-core/ — the rutina validator + its JSON schema,
 * as a copy the private backend can vendor through `git subtree` of the
 * contract/ split branch (backend-bootstrap AC10, tech-plan D2).
 *
 * Why a generated copy: scripts/lib/rutina-validator.js lives outside
 * contract/, so a subtree split would not carry it, and a hand-copied
 * validator would drift. The copy is byte-identical to the original except
 * for the one `require` that points at the schema; a vitest drift test
 * (scripts/contract/rutina-core.test.js) regenerates in memory and fails if
 * the committed files differ. Cloud spec D3: one validator, never a fork.
 *
 * Pure core / I/O shell: buildRutinaCore() only reads its two sources and
 * returns { fileName: content }; writing happens in the CLI block below.
 * No dependency beyond fs and path.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'contract', 'rutina-core');

const VALIDATOR_SRC = ['scripts', 'lib', 'rutina-validator.js'];
const SCHEMA_SRC = ['data', 'schema', 'rutina.schema.json'];

// The ONLY difference between the original validator and the generated one:
// the schema sits next to the validator instead of two directories up. A regex
// (not a string) so the quote style is preserved and the match can be counted.
const SCHEMA_REQUIRE = /require\((['"])\.\.\/\.\.\/data\/schema\/rutina\.schema\.json\1\)/g;
const SCHEMA_REQUIRE_TO = 'require($1./rutina.schema.json$1)';

function buildRutinaCore(root = ROOT) {
  const validator = fs.readFileSync(path.join(root, ...VALIDATOR_SRC), 'utf8');
  const schema = fs.readFileSync(path.join(root, ...SCHEMA_SRC), 'utf8');
  if ((validator.match(SCHEMA_REQUIRE) || []).length !== 1) {
    throw new Error(`build-contract: expected exactly one schema require in ${VALIDATOR_SRC.join('/')}`);
  }
  return {
    'rutina-validator.js': validator.replace(SCHEMA_REQUIRE, SCHEMA_REQUIRE_TO),
    'rutina.schema.json': schema,
  };
}

function writeRutinaCore(root = ROOT, outDir = OUT_DIR) {
  const files = buildRutinaCore(root);
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), content);
  }
  return Object.keys(files);
}

if (require.main === module) {
  const written = writeRutinaCore();
  console.log(`contract/rutina-core: wrote ${written.join(', ')}`);
}

module.exports = { buildRutinaCore, writeRutinaCore };
