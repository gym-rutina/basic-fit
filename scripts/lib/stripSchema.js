/**
 * Strips annotation-only keywords from a JSON Schema so it can be inlined
 * into the LLM prompt as literal text (onboarding-request-fields R5.1-R5.4,
 * D2, D3, tech-plan.md §2.3).
 *
 * Pure module — no fs/path/process (the project's scripts/lib purity
 * convention). Never mutates its input; always returns a new object tree.
 *
 * Walks the schema AS A JSON-SCHEMA TREE, not as a generic object: it only
 * recurses into keys that hold structural sub-schemas (`properties`' own
 * VALUES, `patternProperties`' own VALUES, `items`, `additionalProperties`
 * when it is itself a schema object rather than a boolean, and the
 * `oneOf`/`anyOf`/`allOf` schema arrays) and strips `description` at every
 * schema node it visits, plus `title`/`$schema` at the ROOT node only.
 *
 * This is deliberate, not incidental: the schema has a property literally
 * NAMED "title" (`notes[].title`, at
 * `.properties.notes.items.properties.title`). A generic "delete every key
 * called title/description wherever found" walk cannot tell "this is a
 * schema node's own annotation keyword" from "this is the key name of an
 * entry inside a `properties` map" — it would delete that property's
 * definition the moment it also stripped its `description`. Recursing only
 * through the known structural keywords, and treating every value reached
 * that way as a schema node (never a `properties` map's own keys), avoids
 * the trap by construction.
 */

function isSchemaNode(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const PROPERTY_MAP_KEYS = ['properties', 'patternProperties', 'definitions', '$defs'];
const SCHEMA_ARRAY_KEYS = ['oneOf', 'anyOf', 'allOf'];

function stripNode(node, isRoot) {
  if (!isSchemaNode(node)) return node;

  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'description') continue;
    if (isRoot && (key === 'title' || key === '$schema')) continue;

    if (PROPERTY_MAP_KEYS.includes(key)) {
      if (isSchemaNode(value)) {
        const mapped = {};
        for (const [propKey, propSchema] of Object.entries(value)) {
          mapped[propKey] = stripNode(propSchema, false);
        }
        result[key] = mapped;
      } else {
        result[key] = value;
      }
      continue;
    }

    if (key === 'items') {
      if (Array.isArray(value)) {
        result[key] = value.map((item) => stripNode(item, false));
      } else if (isSchemaNode(value)) {
        result[key] = stripNode(value, false);
      } else {
        result[key] = value;
      }
      continue;
    }

    if (key === 'additionalProperties') {
      result[key] = isSchemaNode(value) ? stripNode(value, false) : value;
      continue;
    }

    if (SCHEMA_ARRAY_KEYS.includes(key)) {
      result[key] = Array.isArray(value) ? value.map((item) => stripNode(item, false)) : value;
      continue;
    }

    // Every other key — type, required, minimum, maximum, minItems,
    // minLength, pattern, enum, const, and any property-map entry key that
    // is NOT itself a structural keyword — is copied through verbatim.
    result[key] = value;
  }
  return result;
}

/**
 * @param {object} schema
 * @returns {object} a new object — the input is never mutated
 */
function stripSchemaAnnotations(schema) {
  return stripNode(schema, true);
}

module.exports = { stripSchemaAnnotations };
