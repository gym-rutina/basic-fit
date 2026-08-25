import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import esCatalog from './es.js';
import enCatalog from './en.js';
import beCatalog from './be.js';
import frCatalog from './fr.js';
import nlCatalog from './nl.js';
import deCatalog from './de.js';
import { readUiLocale, writeUiLocale } from '../lib/uiLangStorage.js';

/**
 * pwa-ui-language — the single source of truth for "which language is this
 * app in?" (tech-plan.md D3/D5/D6/D7). Everything else — `guideLocale.js`'s
 * `detectGuideLocale`, every screen, every lib default — is a CONSUMER of
 * this module, never a second implementation of the same rule (DEC-2).
 *
 * `i18n/` imports nothing from the rest of the app (dependency direction is
 * one-way, tech-plan.md's architecture note) and adds no runtime dependency
 * (AC4) — this whole module plus three catalogs is in-house.
 */

// Naming convention (onboarding-request-fields Rev5-D3): language codes are
// lowercase ISO 639-1 (`es`, `en`, `be`); country codes elsewhere in the app
// (data/gyms/index.json's `code` field, e.g. `BE` for Belgium) are UPPERCASE
// ISO 3166-1 alpha-2. The two sets share letters for several languages (`be`
// language vs `BE` country, later `nl`/`fr`/`de` vs `NL`/`FR`/`DE`) — casing
// is the ONLY thing that disambiguates them, so never uppercase a language
// code for display (SettingsScreen.jsx used to via `l.toUpperCase()`, which
// made Belarusian's `be` pill read as Belgium's `BE` — fixed by rendering
// `LOCALE_AUTONYMS[l]` instead) and never add a language code that collides
// case-sensitively with an existing country code.

// AC1 — the only locale list in app/src. DEC-1: matches equipment.json's
// metadata.languages SET (the two lists' orders have different jobs — es
// leads here as authoring locale, en leads there by data convention).
// docs/llm-rutina-prompt.{es,en,be}.md deliberately stays a 3-article set:
// guide articles are a separate axis; GuideOverlay falls back to its en
// article for fr/nl/de. DEC-6: `es` is the authoring locale, so it leads.
export const UI_LOCALES = ['es', 'en', 'be', 'fr', 'nl', 'de'];

export const DEFAULT_LOCALE = 'es';

// A language's own name does not translate — not a catalog entry.
export const LOCALE_AUTONYMS = {
  es: 'Español',
  en: 'English',
  be: 'Беларуская',
  fr: 'Français',
  nl: 'Nederlands',
  de: 'Deutsch',
};

export const CATALOGS = {
  es: esCatalog,
  en: enCatalog,
  be: beCatalog,
  fr: frCatalog,
  nl: nlCatalog,
  de: deCatalog,
};

/**
 * AC2 — resolution order: a known stored value wins; otherwise
 * `navigator.language`'s 2-letter prefix maps es→es, be→be and — since
 * expand-ui-locales (D4) — fr→fr, nl→nl, de→de; everything else→en (DEC-2,
 * deliberate: an it/ru/pt browser saw Spanish before pwa-ui-language and
 * still sees English). Absent/empty/corrupt/unknown stored values are all
 * treated as "nothing stored" from this ONE place — storage itself
 * (`uiLangStorage.js`) does no validation. Never throws on hostile input
 * from either source.
 *
 * @param {unknown} stored
 * @param {unknown} navLang
 * @returns {'es'|'en'|'be'|'fr'|'nl'|'de'}
 */
export function resolveUiLocale(stored, navLang) {
  if (typeof stored === 'string' && UI_LOCALES.includes(stored)) {
    return stored;
  }
  const code = typeof navLang === 'string' ? navLang.trim().slice(0, 2).toLowerCase() : '';
  if (code === 'es') return 'es';
  if (code === 'be') return 'be';
  if (code === 'fr') return 'fr';
  if (code === 'nl') return 'nl';
  if (code === 'de') return 'de';
  return 'en';
}

/**
 * AC4 — lookup with interpolation. Resolution order: the requested locale's
 * catalog, then the `es` catalog (DEC-6 — fallback is Spanish, not English),
 * then the key itself, then a guaranteed non-empty marker for the
 * degenerate case of an empty/falsy key. Never returns `undefined`, `null`
 * or `''`.
 *
 * @param {string} locale
 * @returns {(key: unknown, params?: Record<string, unknown>) => string}
 */
export function tFor(locale) {
  const catalog = CATALOGS[locale] || CATALOGS[DEFAULT_LOCALE];
  return function t(key, params) {
    const k = typeof key === 'string' ? key : String(key);
    let value = catalog[k];
    if (typeof value !== 'string' || value === '') value = CATALOGS[DEFAULT_LOCALE][k];
    if (typeof value !== 'string' || value === '') value = k;
    if (typeof value !== 'string' || value === '') value = '·'; // guaranteed non-empty (AC4)
    if (params) {
      value = value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
    }
    return value;
  };
}

// D4 — every non-React module that produces user-visible copy takes an
// optional trailing `t`, defaulting to this es-pinned translator. That is
// what keeps AC22's ~124 existing Spanish-literal assertions passing
// untouched: every old call site, at its old arity, still gets Spanish.
export const defaultT = tFor(DEFAULT_LOCALE);

// D5 — seeded with a fully functional es-pinned value, not null, so a
// component rendered without a provider renders Spanish instead of
// throwing. 14 existing test files render screens/components directly,
// never through <App/>, and none of them were touched for this feature.
const I18nContext = createContext({ locale: DEFAULT_LOCALE, setLocale: () => {}, t: defaultT });

/**
 * @param {{children: React.ReactNode, initialLocale?: string}} props
 */
export function I18nProvider({ children, initialLocale }) {
  // AC3 — read synchronously in the lazy useState initializer, exactly as
  // App.jsx already does for hasSeenOnboarding(): the resolved locale is
  // present on the very first render, never a second paint.
  const [locale, setLocaleState] = useState(() => {
    if (initialLocale && UI_LOCALES.includes(initialLocale)) return initialLocale;
    const navLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
    return resolveUiLocale(readUiLocale(), navLang);
  });

  // AC5 — useLayoutEffect, not useEffect, so documentElement.lang is
  // correct BEFORE paint; the app is a client-only SPA (HashRouter, vite
  // build), so the usual SSR warning against useLayoutEffect does not
  // apply. Deliberately does NOT write to storage on mount — only an
  // explicit setLocale persists (CatalogScreen.test.jsx:80 depends on this:
  // localStorage.length === 0 after a Catálogo-only override).
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  function setLocale(next) {
    if (!UI_LOCALES.includes(next)) return; // ignores an unshipped locale rather than throwing
    setLocaleState(next);
    writeUiLocale(next); // swallows storage failures itself (ux-design.md Error row)
  }

  const t = tFor(locale);

  return React.createElement(I18nContext.Provider, { value: { locale, setLocale, t } }, children);
}

/** @returns {{locale: string, setLocale: (next: string) => void, t: (key: unknown, params?: object) => string}} */
export function useI18n() {
  return useContext(I18nContext);
}
