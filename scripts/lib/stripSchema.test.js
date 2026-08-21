// @vitest-environment node
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { stripSchemaAnnotations } from './stripSchema.js';
import realSchema from '../../data/schema/rutina.schema.json';
import phase1Monday from '../../data/examples/phase1-monday.json';

/**
 * onboarding-request-fields R5.1-R5.4, D2, D3 (tech-plan.md §2.3).
 *
 * Pending Cmok implementation — see tech-plan.md. Failures here are expected
 * until Cmok implements scripts/lib/stripSchema.js.
 *
 * The subtle case this file exists to catch: the schema has a PROPERTY
 * literally named "title" (notes[].title, at
 * .properties.notes.items.properties.title) — a generic "delete every key
 * called title/description wherever found" walk would silently delete that
 * property's own definition the instant it strips its `description`, because
 * it cannot tell "a schema node's own annotation keyword" from "the key name
 * of an entry inside a properties map." A correct implementation only ever
 * strips description/title/$schema off a SCHEMA NODE, never off a
 * `properties` map's own keys.
 */

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function collectByKey(schema, targetKey, path = '') {
  const hits = [];
  (function walk(node, p) {
    if (!isPlainObject(node) && !Array.isArray(node)) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === targetKey) hits.push(p ? `${p}.${key}` : key);
      walk(value, p ? `${p}.${key}` : key);
    }
  })(schema, path);
  return hits;
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

describe('stripSchemaAnnotations — shape (R5.1, AC24)', () => {
  it('removes description at every depth', () => {
    const stripped = stripSchemaAnnotations(realSchema);
    expect(collectByKey(stripped, 'description')).toEqual([]);
  });

  it('removes the top-level title and $schema', () => {
    const stripped = stripSchemaAnnotations(realSchema);
    expect(stripped.title).toBeUndefined();
    expect(stripped.$schema).toBeUndefined();
  });

  it('the result still parses as valid JSON (round-trips through stringify/parse)', () => {
    const stripped = stripSchemaAnnotations(realSchema);
    expect(() => JSON.parse(JSON.stringify(stripped))).not.toThrow();
  });

  it('DOES NOT delete a property named "title" that is part of the data contract (notes[].title)', () => {
    // The exact trap this module exists to avoid — see file header.
    const stripped = stripSchemaAnnotations(realSchema);
    expect(stripped.properties.notes.items.properties.title).toBeDefined();
    expect(stripped.properties.notes.items.properties.title.type).toBe('string');
    // Its description is still gone (description is stripped at every depth).
    expect(stripped.properties.notes.items.properties.title.description).toBeUndefined();
  });
});

describe('stripSchemaAnnotations — size budget (R5.1, AC25)', () => {
  it('the stripped real schema is at or under 5 KB', () => {
    const stripped = stripSchemaAnnotations(realSchema);
    expect(jsonBytes(stripped)).toBeLessThanOrEqual(5 * 1024);
  });

  it('is meaningfully smaller than the untouched source (sanity check that stripping did something)', () => {
    const stripped = stripSchemaAnnotations(realSchema);
    expect(jsonBytes(stripped)).toBeLessThan(jsonBytes(realSchema) / 2);
  });
});

describe('stripSchemaAnnotations — purity (D3, AC26)', () => {
  it('does not mutate its input — the source schema object is untouched', () => {
    const frozen = JSON.parse(JSON.stringify(realSchema));
    Object.freeze(frozen); // shallow, but the top-level delete this would catch is exactly the risk
    expect(() => stripSchemaAnnotations(frozen)).not.toThrow();
    expect(frozen.title).toBe(realSchema.title);
    expect(frozen.description).toBe(realSchema.description);
  });

  it('is deterministic — the same input strips to byte-identical output twice (AC29)', () => {
    const first = JSON.stringify(stripSchemaAnnotations(realSchema));
    const second = JSON.stringify(stripSchemaAnnotations(realSchema));
    expect(first).toBe(second);
  });
});

describe('stripSchemaAnnotations — validation keywords survive (R5.3, AC28)', () => {
  const VALIDATION_KEYWORDS = [
    'type',
    'required',
    'properties',
    'items',
    'additionalProperties',
    'minimum',
    'maximum',
    'minItems',
    'minLength',
    'pattern',
    'enum',
    'const',
    'oneOf',
  ];

  it.each(VALIDATION_KEYWORDS)('every occurrence of "%s" in the source exists at the same path in the stripped schema', (keyword) => {
    const beforePaths = collectByKey(realSchema, keyword).sort();
    if (beforePaths.length === 0) return; // keyword not used anywhere in this schema — nothing to assert
    const stripped = stripSchemaAnnotations(realSchema);
    const afterPaths = collectByKey(stripped, keyword).sort();
    expect(afterPaths).toEqual(beforePaths);
  });
});

describe('stripSchemaAnnotations — round-trip validation with ajv (R5.4, AC27)', () => {
  function compile(schema) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    return ajv.compile(schema);
  }

  it('validates the reference example (phase1-monday.json)', () => {
    const stripped = stripSchemaAnnotations(realSchema);
    const validate = compile(stripped);
    const ok = validate(phase1Monday);
    expect({ ok, errors: validate.errors }).toEqual({ ok: true, errors: null });
  });

  it('rejects an object carrying summaryTable, exactly as the unstripped schema does', () => {
    const stripped = stripSchemaAnnotations(realSchema);
    const validate = compile(stripped);
    const bad = { ...phase1Monday, summaryTable: [{ day: 'Monday' }] };
    expect(validate(bad)).toBe(false);
  });

  it('the unstripped source schema rejects the same bad case (proves the fixture is actually invalid, not a vacuous pass)', () => {
    const validate = compile(realSchema);
    const bad = { ...phase1Monday, summaryTable: [{ day: 'Monday' }] };
    expect(validate(bad)).toBe(false);
  });
});
