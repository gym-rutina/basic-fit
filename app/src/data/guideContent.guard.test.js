import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { GUIDE_HTML } from './guideContent.js';
import { CATALOGS } from '../i18n/index.js';

/**
 * back-closes-dialogs-and-wizard-polish, item D (AC23-AC26, AC28, AC29) — the
 * in-app "Guía completa" is written for a PHONE USER who copies a prompt into
 * an AI chat and pastes the JSON reply back. It must not read like developer
 * documentation and it must describe only the UI that exists.
 *
 * Source of truth: docs/llm-rutina-prompt.{es,en,be}.md -> `npm run build-guide`
 * -> app/src/data/guideContent.js (generated, committed; never hand-edited).
 * RED until Mokash rewrites the three docs and regenerates the file (AC22-AC27);
 * GREEN after — and a tripwire from then on (AC28: "fails the build if
 * reintroduced").
 */

const LOCALES = ['es', 'en', 'be'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const decode = (s) =>
  s
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const textOf = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
/** Tokens are searched in the markup (hrefs, <code>) AND in the visible text. */
const haystack = (locale) => `${decode(GUIDE_HTML[locale])}\n${textOf(GUIDE_HTML[locale])}`;

// AC25 — nothing a phone user cannot act on. Case-insensitive (AC28).
const BANNED = [
  ['npm run …', /npm\s+run/i],
  ['validate-rutina (both occurrences and the CLI result table)', /validate-rutina/i],
  ['the GitHub repository link', /github\.com/i],
  ['the relative link to docs/export-format.md', /export-format/i],
  ['repo path docs/…', /\bdocs\//i],
  ['repo path data/…', /\bdata\//i],
  ['JSON key extraEquipment', /extraEquipment/i],
  ['JSON key substitutions', /substitutions/i],
  ['JSON key equipmentId (also matches substituteEquipmentId)', /equipmentId/i],
  ['JSON key videoQuery', /videoQuery/i],
  ['JSON key kind (as code or a quoted key — the plain word is fine)', /<code>\s*kind\s*<\/code>|["“”]kind["“”]/i],
  ['the word "textarea"', /textarea/i],
  // \b is ASCII-only in JS regexes, so the Cyrillic alternative needs a Unicode lookbehind.
  ['numbered-field vocabulary ("Field 6" / "Campo 6" / "Поле 6")', /(?<![\p{L}\d])(field|campo|поле)\s*\d/iu],
];

describe.each(LOCALES)('GUIDE_HTML.%s — no developer vocabulary (AC25, AC28)', (locale) => {
  it.each(BANNED)('contains no %s', (_label, re) => {
    expect(haystack(locale)).not.toMatch(re);
  });
});

// AC26 — obsolete UI claims (seed list from the currency audit in spec.md; each
// phrase exists in today's stale docs, so this is red until the rewrite).
const STALE_UI_CLAIMS = {
  es: [/parte superior de esta pantalla/i, /arriba de esta pantalla/i, /incluir mi progreso/i],
  en: [/top of this screen/i, /this guide screen/i, /same guide screen/i, /include my progress/i, /next to the button/i],
  be: [/верхняй частцы гэтага экрана/i, /уключыць мой прагрэс/i, /побач з кнопкай/i],
};

describe.each(LOCALES)('GUIDE_HTML.%s — no claims about UI that no longer exists (AC26)', (locale) => {
  it.each(STALE_UI_CLAIMS[locale].map((re) => [String(re), re]))('does not say %s', (_label, re) => {
    expect(haystack(locale)).not.toMatch(re);
  });
});

// AC23/AC24 — the flow that exists now is named by the labels the app really
// shows IN THAT GUIDE'S LANGUAGE: Copy prompt -> I have the JSON -> Import -> (on
// errors) Copy errors. Labels are read from the catalogs, never retyped here.
const FLOW_LABEL_KEYS = ['promptWizard.copyAction', 'promptWizard.haveJson', 'import.importAction', 'import.copyErrors'];
const stripArrow = (label) => label.replace(/\s*→\s*$/, '');

describe.each(LOCALES)('GUIDE_HTML.%s — names the real controls by their live labels (AC23, AC24)', (locale) => {
  it.each(FLOW_LABEL_KEYS)('mentions the label of %s', (key) => {
    const label = stripArrow(CATALOGS[locale][key]);
    expect(label.length).toBeGreaterThan(2);
    expect(textOf(GUIDE_HTML[locale]).toLowerCase()).toContain(label.toLowerCase());
  });
});

// AC24 — the en and be guides used to show the SPANISH control names.
const SPANISH_UI_NAME_KEYS = [
  'program.libraryAction',
  'library.importCta',
  'library.activateAction',
  'common.delete',
  'tab.catalog',
  'tab.program',
  'tab.history',
];

describe.each(['en', 'be'])('GUIDE_HTML.%s — no Spanish control names in a non-Spanish guide (AC24)', (locale) => {
  it.each(SPANISH_UI_NAME_KEYS)('does not show the Spanish label of %s', (key) => {
    const spanish = CATALOGS.es[key];
    const own = CATALOGS[locale][key];
    if (spanish.toLowerCase() === own.toLowerCase()) return; // identical in this locale: nothing to leak
    expect(textOf(GUIDE_HTML[locale]).toLowerCase()).not.toContain(spanish.toLowerCase());
  });
});

// AC29 — "tables that remain must stay readable at 360px". GuideSheet already
// scrolls a table horizontally (asserted in GuideSheet.test.jsx via its CSS); as
// a content-side proxy a remaining table may have at most 3 columns — anything
// wider belongs in a list on a phone.
describe.each(LOCALES)('GUIDE_HTML.%s — tables stay phone-sized (AC29)', (locale) => {
  it('has no table wider than 3 columns', () => {
    const tables = GUIDE_HTML[locale].match(/<table[\s\S]*?<\/table>/g) || [];
    for (const table of tables) {
      const headerRow = (table.match(/<tr>[\s\S]*?<\/tr>/) || [''])[0];
      const columns = (headerRow.match(/<t[hd][\s>]/g) || []).length;
      expect(columns).toBeLessThanOrEqual(3);
    }
  });
});

// The generated file must be the product of the docs it claims to be built from —
// otherwise a docs rewrite that forgot `npm run build-guide` would pass every
// check above against stale HTML.
describe('GUIDE_HTML is regenerated from the docs (npm run build-guide)', () => {
  marked.setOptions({ gfm: true, breaks: false });
  it.each(LOCALES)('%s matches its markdown source in docs/', (locale) => {
    const md = fs.readFileSync(path.join(ROOT, 'docs', `llm-rutina-prompt.${locale}.md`), 'utf8');
    expect(GUIDE_HTML[locale]).toBe(marked.parse(md));
  });
});
