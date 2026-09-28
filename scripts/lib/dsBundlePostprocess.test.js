// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { postProcessBundle } from './dsBundlePostprocess.js';

/**
 * design-system-sync-fixes AC4 — the two post-process fixes the standard
 * converter needs every rebuild (`.design-sync/NOTES.md` step 4), as a pure
 * function: `postProcessBundle(text, { globalName, projectId })`.
 *
 *  (a) restore the underscore in the globalName everywhere it appears
 *      (var decl, header `namespace` field, final `window.<NS>=` assignment) —
 *      NOTES.md counts 7 occurrences for this project;
 *  (b) collapse nested `sourcePath`/`sourceHashes` keys
 *      `components/<group>/<Name>/<Name>.<ext>` → `components/<group>/<Name>.<ext>`;
 *  (c) ensure `"format":4` is present in the header.
 *
 * Red-first: fails until Cmok writes scripts/lib/dsBundlePostprocess.js.
 */

const OPTS = { globalName: 'BasicFitDesignSystem_1cb8a2', projectId: '1cb8a2' };

// a converter-fresh bundle: NO underscore, nested sourcePaths, no "format":4
const RAW = [
  '/* @ds-bundle: {"namespace":"BasicFitDesignSystem1cb8a2","components":[',
  '{"name":"Button","sourcePath":"components/primitives/Button/Button.jsx"},',
  '{"name":"EquipmentCard","sourcePath":"components/composite/EquipmentCard/EquipmentCard.jsx"}],',
  '"sourceHashes":{"components/primitives/Button/Button.jsx":"abc123",',
  '"components/primitives/Button/Button.d.ts":"def456"},"builtBy":"cc-design-sync"} */',
  'var BasicFitDesignSystem1cb8a2 = (() => {',
  '  // ...module body — must never be rewritten...',
  '  var slug = "components/primitives/Button/Button.jsx"; // body string, left ALONE',
  '  return __toCommonJS(stdin_exports);',
  '})();',
  'window.BasicFitDesignSystem1cb8a2 = BasicFitDesignSystem1cb8a2;',
].join('\n');

describe('postProcessBundle', () => {
  it('restores the globalName underscore at every occurrence (var decl, header, window assignment)', () => {
    const { text, globalNameCount } = postProcessBundle(RAW, OPTS);
    expect(text).not.toMatch(/BasicFitDesignSystem1cb8a2/); // the underscore-less form is fully gone
    expect((text.match(/BasicFitDesignSystem_1cb8a2/g) || []).length).toBe(globalNameCount);
    expect(globalNameCount).toBeGreaterThanOrEqual(3); // real bundle = 7; this fixture = 4
    // var decl + header namespace + window.<NS>= assignment (x2 on that line)
    expect(text).toMatch(/var BasicFitDesignSystem_1cb8a2 = \(\(\) => \{/);
    expect(text).toMatch(/"namespace":"BasicFitDesignSystem_1cb8a2"/);
    expect(text).toMatch(/window\.BasicFitDesignSystem_1cb8a2 = BasicFitDesignSystem_1cb8a2;/);
  });

  it('collapses nested sourcePath and sourceHashes keys to flat paths — HEADER ONLY', () => {
    const { text } = postProcessBundle(RAW, OPTS);
    expect(text).toMatch(/"sourcePath":"components\/primitives\/Button\.jsx"/);
    expect(text).toMatch(/"sourcePath":"components\/composite\/EquipmentCard\.jsx"/);
    expect(text).toMatch(/"components\/primitives\/Button\.jsx":"abc123"/);
    expect(text).toMatch(/"components\/primitives\/Button\.d\.ts":"def456"/);
    // The collapse must be scoped to the `@ds-bundle:` header comment — NOT a
    // global text replace (that would also rewrite path-like strings in the
    // module body, next test). Assert "no nested path" against the header only.
    const header = text.match(/\/\* @ds-bundle:[\s\S]*?\*\//)[0];
    expect(header).not.toMatch(/components\/[a-z]+\/[A-Za-z]+\/[A-Za-z]+\.(jsx|d\.ts)/);
  });

  it('ensures "format":4 is present in the header', () => {
    const { text } = postProcessBundle(RAW, OPTS);
    expect(text).toMatch(/@ds-bundle: \{"format":4,/);
  });

  it('never rewrites path-like strings in the module body', () => {
    const { text } = postProcessBundle(RAW, OPTS);
    expect(text).toContain('var slug = "components/primitives/Button/Button.jsx"; // body string, left ALONE');
  });

  it('is a no-op (changed:false) on an already-correct bundle', () => {
    const once = postProcessBundle(RAW, OPTS).text;
    const twice = postProcessBundle(once, OPTS);
    expect(twice.changed).toBe(false);
    expect(twice.text).toBe(once);
  });
});
