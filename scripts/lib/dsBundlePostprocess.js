/**
 * design-system-sync-fixes AC4 — the two converter post-process fixes
 * (.design-sync/NOTES.md step 4) as a PURE function (no fs).
 *
 * Contract (see dsBundlePostprocess.test.js):
 *  (a) global replace of the underscore-less globalName with the underscored
 *      form (var decl + header `namespace` + `window.<NS>=` — NOTES.md: 7×
 *      for this project);
 *  (b) collapse nested `sourcePath`/`sourceHashes` keys
 *      `components/<group>/<Name>/<Name>.<ext>` → `components/<group>/<Name>.<ext>`
 *      — SCOPED TO THE `@ds-bundle:` HEADER COMMENT ONLY, never the module body
 *      (a global text replace would also rewrite path-like strings inside the
 *      compiled bundle — the test guards this);
 *  (c) ensure `"format":4` is the first key of the header object.
 * Idempotent: a second pass returns `{ changed: false }` and identical text.
 *
 * `opts.globalName` / `opts.projectId` come from `.design-sync/config.json`
 * (the SHELL reads it and FAILS CLEARLY if that file is absent — do NOT bake
 * the full project UUID in as a fallback; it lives in no tracked file today,
 * Bagnik A3). `BasicFitDesignSystem_1cb8a2` is committed in the real bundle
 * and is an acceptable last-resort default for `globalName` only.
 */

/** Matches a nested converter-output path segment inside a header string,
 * e.g. `components/primitives/Button/Button.jsx` → `components/primitives/Button.jsx`.
 * Deliberately generic across the extensions the converter emits per component.
 */
const NESTED_PATH_RE = /components\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/\2\.(jsx|d\.ts|prompt\.md|html)/g;

/** The `/* @ds-bundle: ... *\/` header comment — non-greedy, stops at the
 * first closing `*​/` (the header itself contains no nested block comments). */
const HEADER_RE = /\/\* @ds-bundle:[\s\S]*?\*\//;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text  the raw _ds_bundle.js contents
 * @param {{ globalName: string, projectId: string }} opts
 * @returns {{ text: string, changed: boolean, globalNameCount: number }}
 */
export function postProcessBundle(text, opts) {
  const { globalName, projectId } = opts;
  void projectId; // reserved for future use — see .design-sync/config.json contract

  let out = text;

  // (a) globalName underscore restoration — a GLOBAL replace across the whole
  // text (var decl + header `namespace` field + `window.<NS>=` assignment all
  // literally use the bare identifier, unlike fix (b) below which must stay
  // scoped to the header).
  const strippedName = globalName.replace(/[^A-Za-z0-9]/g, '');
  if (strippedName && strippedName !== globalName) {
    out = out.replace(new RegExp(escapeRegExp(strippedName), 'g'), globalName);
  }

  // (b) + (c): header-scoped fixes only — never touch the compiled module body.
  const headerMatch = out.match(HEADER_RE);
  if (headerMatch) {
    const originalHeader = headerMatch[0];
    let header = originalHeader;

    // (b) collapse nested sourcePath/sourceHashes keys to this repo's flat paths.
    header = header.replace(NESTED_PATH_RE, 'components/$1/$2.$3');

    // (c) ensure "format":4 is the first key of the header object.
    if (!/\{"format":4,/.test(header)) {
      header = header.replace(/\{/, '{"format":4,');
    }

    if (header !== originalHeader) {
      out = out.slice(0, headerMatch.index) + header + out.slice(headerMatch.index + originalHeader.length);
    }
  }

  const globalNameCount = (out.match(new RegExp(escapeRegExp(globalName), 'g')) || []).length;
  const changed = out !== text;

  return { text: out, changed, globalNameCount };
}
