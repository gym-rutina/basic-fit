import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectGuideLocale } from '../lib/guideLocale.js';
import { resolveUiLocale, UI_LOCALES, CATALOGS, tFor, I18nProvider } from './index.js';
import { GuideOverlay } from '../components/GuideOverlay.jsx';

/**
 * pwa-ui-language AC8 (tech-plan.md D17).
 *
 * `detectGuideLocale` is where DEC-2's resolution rule came from in the first
 * place. Leaving it as a second implementation is how the two silently
 * diverge — a user switches the app to English in Settings and the LLM guide
 * keeps opening in Spanish because it is still reading `navigator.language`.
 */

function setNavigatorLanguage(value) {
  Object.defineProperty(window.navigator, 'language', { value, configurable: true });
}

afterEach(() => vi.restoreAllMocks());

describe('detectGuideLocale is a consumer, not a second source of truth (AC8)', () => {
  it('agrees with resolveUiLocale for every input', () => {
    for (const nav of ['es', 'es-ES', 'be', 'be-BY', 'en-US', 'fr-FR', 'de', 'it', '', undefined, null]) {
      expect(detectGuideLocale(nav)).toBe(resolveUiLocale(null, nav));
    }
  });

  it('still defaults to navigator.language when called with no argument', () => {
    setNavigatorLanguage('be-BY');
    expect(detectGuideLocale()).toBe('be');
  });
});

describe('guide copy moved into the catalogs (AC8, AC6)', () => {
  it('carries the guide strings in every locale', () => {
    for (const locale of UI_LOCALES) {
      for (const key of ['guide.linkText', 'guide.title', 'guide.copy', 'guide.copied', 'guide.promptLabel']) {
        expect(CATALOGS[locale][key], `${locale}:${key}`).toBeTruthy();
      }
    }
  });

  it('no longer exports the per-string maps from guideLocale.js', () => {
    // 15 exported {es,en,be} maps folded into the shared catalogs. What stays
    // in guideLocale.js is the non-copy data: URLs and the archive descriptor.
    const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib/guideLocale.js');
    const source = fs.readFileSync(file, 'utf8');
    expect(source).not.toMatch(/export const GUIDE_LINK_TEXT/);
    expect(source).not.toMatch(/export const GUIDE_TITLE/);
    expect(source).toMatch(/export const GYMS_CATALOG_URL/);
    expect(source).toMatch(/export const GUIDE_SCHEMA_DOWNLOAD/);
  });
});

describe('GuideOverlay follows the active UI locale (AC8)', () => {
  beforeEach(() => setNavigatorLanguage('es-ES'));

  it('keeps honouring an explicit locale prop, with no provider at all (AC22)', () => {
    // GuideOverlay.test.jsx renders <GuideOverlay locale="en" …/> bare and
    // asserts English chrome. So the component must build its OWN translator
    // from the locale it is rendering — tFor(locale ?? uiLocale) — rather
    // than reading `t` off the context, which would be Spanish here.
    render(<GuideOverlay locale="en" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeInTheDocument();
  });

  it('renders English chrome when the UI is English, whatever the browser says', () => {
    render(
      <I18nProvider initialLocale="en">
        <GuideOverlay onClose={vi.fn()} />
      </I18nProvider>
    );
    expect(screen.getByRole('button', { name: tFor('en')('guide.close') })).toBeInTheDocument();
  });

  it('renders Belarusian chrome when the UI is Belarusian', () => {
    render(
      <I18nProvider initialLocale="be">
        <GuideOverlay onClose={vi.fn()} />
      </I18nProvider>
    );
    expect(screen.getByRole('button', { name: tFor('be')('guide.close') })).toBeInTheDocument();
  });
});
