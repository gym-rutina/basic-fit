import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_LOCALES, DEFAULT_LOCALE, LOCALE_AUTONYMS, resolveUiLocale } from './index.js';

/**
 * pwa-ui-language AC1 + AC2 (tech-plan.md D3, D6).
 *
 * `resolveUiLocale` is the ONE place the "which language is this app in?"
 * question is answered. `guideLocale.js`'s `detectGuideLocale` becomes a
 * consumer of it (AC8, D17) rather than a second, forkable copy of the same
 * rule — DEC-2 exists precisely because the rule was already written once.
 */

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
  })(SRC_DIR);
  return out;
}

describe('UI_LOCALES (AC1)', () => {
  it('is exactly es, en, be, fr, nl, de, in authoring-first order', () => {
    // DEC-1 (expand-ui-locales R1.1): matches equipment.json's
    // metadata.languages order. DEC-6: `es` is the authoring locale, so it
    // leads. The three original locales keep their positions; fr/nl/de
    // append in D1's one-pass ship order. NOTE: docs/llm-rutina-prompt.*.md
    // stays a 3-article set (es/en/be) on purpose — guide articles are a
    // separate axis; GuideOverlay falls back to its en article for fr/nl/de.
    expect(UI_LOCALES).toEqual(['es', 'en', 'be', 'fr', 'nl', 'de']);
    expect(DEFAULT_LOCALE).toBe('es');
  });

  it('carries an autonym for every locale, written in that locale', () => {
    // A user who cannot read the current UI language must still recognise
    // their own by its native name (ux-design.md's SettingsScreen bullet;
    // expand-ui-locales R1.2 extends the same undertranslated-by-design rule).
    expect(LOCALE_AUTONYMS).toEqual({
      es: 'Español',
      en: 'English',
      be: 'Беларуская',
      fr: 'Français',
      nl: 'Nederlands',
      de: 'Deutsch',
    });
    expect(Object.keys(LOCALE_AUTONYMS).sort()).toEqual([...UI_LOCALES].sort());
  });

  it('is the only locale list in app/src — no module hardcodes its own', () => {
    // A second list is how `en`/`be` silently diverge from `es` later.
    const localeArray = /\[\s*(['"])(?:es|en|be)\1\s*,\s*(['"])(?:es|en|be)\2\s*,\s*(['"])(?:es|en|be)\3\s*\]/;
    const offenders = sourceFiles()
      .filter((f) => !f.replace(/\\/g, '/').includes('/i18n/'))
      .filter((f) => localeArray.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC_DIR, f));
    expect(offenders).toEqual([]);
  });

  it("never ships 'ru' — PROJECT.md's EN/ES/RU is a known typo for be (AC1)", () => {
    // app/src/data/equipment.js:1-6 already flags it; DD-5 keeps a real `ru`
    // locale deferred because it would need net-new equipment.json data.
    const quotedRu = /(['"])ru\1/;
    const offenders = sourceFiles()
      .filter((f) => quotedRu.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC_DIR, f));
    expect(offenders).toEqual([]);
  });
});

describe('resolveUiLocale (AC2)', () => {
  it('returns the stored preference when it is a known locale', () => {
    expect(resolveUiLocale('en', 'es-ES')).toBe('en');
    expect(resolveUiLocale('be', 'es-ES')).toBe('be');
    expect(resolveUiLocale('es', 'en-US')).toBe('es');
    // expand-ui-locales R1.3: stored fr/nl/de need no special-casing —
    // the UI_LOCALES.includes check already generalizes. Pinned so a future
    // refactor cannot quietly grow a per-locale allowlist.
    expect(resolveUiLocale('fr', 'de-DE')).toBe('fr');
    expect(resolveUiLocale('nl', 'fr-FR')).toBe('nl');
    expect(resolveUiLocale('de', 'nl-NL')).toBe('de');
  });

  it('falls back to navigator.language when nothing is stored', () => {
    expect(resolveUiLocale(null, 'es')).toBe('es');
    expect(resolveUiLocale(null, 'es-ES')).toBe('es');
    expect(resolveUiLocale(null, 'es-419')).toBe('es');
    expect(resolveUiLocale(null, 'be')).toBe('be');
    expect(resolveUiLocale(null, 'be-BY')).toBe('be');
    expect(resolveUiLocale(null, 'en-US')).toBe('en');
    // expand-ui-locales AC3 (R1.3/D4): fr/nl/de join es/be in the
    // prefix-mapped tier.
    expect(resolveUiLocale(null, 'fr-FR')).toBe('fr');
    expect(resolveUiLocale(null, 'fr')).toBe('fr');
    expect(resolveUiLocale(null, 'nl-NL')).toBe('nl');
    expect(resolveUiLocale(null, 'nl-BE')).toBe('nl');
    expect(resolveUiLocale(null, 'de-DE')).toBe('de');
    expect(resolveUiLocale(null, 'de')).toBe('de');
  });

  it('maps every still-unmapped browser language to en (DEC-2 as extended by D4)', () => {
    // pwa-ui-language mapped everything non-es/be to en; expand-ui-locales
    // D4 promotes fr/nl/de out of that tier. it/ru and friends keep the
    // original behaviour — en remains the catch-all, never es.
    expect(resolveUiLocale(null, 'it-IT')).toBe('en');
    expect(resolveUiLocale(null, 'ru-RU')).toBe('en');
    expect(resolveUiLocale(null, 'pt-BR')).toBe('en');
  });

  it('treats an absent, empty, corrupt or unknown stored value as absent', () => {
    expect(resolveUiLocale(undefined, 'be-BY')).toBe('be');
    expect(resolveUiLocale(null, 'be-BY')).toBe('be');
    expect(resolveUiLocale('', 'be-BY')).toBe('be');
    expect(resolveUiLocale('   ', 'be-BY')).toBe('be');
    expect(resolveUiLocale('klingon', 'be-BY')).toBe('be');
    expect(resolveUiLocale('{"lang":"es"}', 'be-BY')).toBe('be');
    expect(resolveUiLocale('ES', 'be-BY')).toBe('be'); // case-sensitive by design: we wrote the value
  });

  it('never throws on hostile input from either source', () => {
    // `stored` comes off localStorage, which any extension or an older build
    // can have written; `navLang` is whatever the host reports.
    for (const stored of [42, {}, [], true, null, undefined]) {
      for (const nav of [undefined, null, '', 42, {}]) {
        expect(() => resolveUiLocale(stored, nav)).not.toThrow();
        expect(UI_LOCALES).toContain(resolveUiLocale(stored, nav));
      }
    }
  });

  it('returns en — not es — when there is nothing to go on at all', () => {
    expect(resolveUiLocale(undefined, undefined)).toBe('en');
  });
});
