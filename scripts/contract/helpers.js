// Shared, TEST-ONLY helpers for the contract/ suites (backend-bootstrap).
// Not a test file (no `.test.`), so vitest does not collect it.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const ROOT = path.resolve(__dirname, '..', '..');
export const CONTRACT_DIR = path.join(ROOT, 'contract');

export const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
export const exists = (...p) => fs.existsSync(path.join(ROOT, ...p));

/** Parsed contract/openapi.yaml (throws if missing — the red state of most tests). */
export function loadOpenApi() {
  return yaml.load(read('contract', 'openapi.yaml'));
}

/** Every `$ref` string anywhere in a parsed document. */
export function collectRefs(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') out.push(v);
      else collectRefs(v, out);
    }
  }
  return out;
}

/** Resolve a local JSON pointer like `#/components/schemas/Error` against a document. */
export function resolvePointer(doc, ref) {
  if (!ref.startsWith('#/')) return undefined;
  return ref
    .slice(2)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), doc);
}

/** Codes in the errors.md table: `| \`code\` | HTTP | ...`. Returns Map(code -> httpCell). */
export function errorsMdCodes() {
  const md = read('contract', 'errors.md');
  const rows = new Map();
  for (const m of md.matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*([^|]+)\|/gm)) rows.set(m[1], m[2].trim());
  return rows;
}

/** Codes in the `ContractErrorCode` union of contract/types.d.ts. */
export function typesErrorCodes() {
  const ts = read('contract', 'types.d.ts');
  const block = ts.match(/export type ContractErrorCode\s*=([\s\S]*?);/);
  if (!block) return new Set();
  return new Set([...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
}
