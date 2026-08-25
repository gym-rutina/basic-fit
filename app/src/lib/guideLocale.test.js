import { describe, it, expect } from 'vitest';
import { detectGuideLocale } from './guideLocale.js';
// Namespace import (not named) so a not-yet-implemented export resolves to
// `undefined` instead of a hard module-resolution error — keeps failures
// clean and pinpointed while these constants are pending (llm-guide-file-downloads).
import * as guideLocale from './guideLocale.js';

describe('detectGuideLocale', () => {
  it('returns es for Spanish browser languages', () => {
    expect(detectGuideLocale('es')).toBe('es');
    expect(detectGuideLocale('es-ES')).toBe('es');
  });

  it('returns be for Belarusian browser languages', () => {
    expect(detectGuideLocale('be')).toBe('be');
    expect(detectGuideLocale('be-BY')).toBe('be');
  });

  it('returns the locale itself for fr/nl/de browser languages', () => {
    // expand-ui-locales D4 promoted these out of the en catch-all. Guide
    // ARTICLES stay a 3-language set (GuideOverlay falls back to its en
    // page), but detection now reports the UI locale itself.
    expect(detectGuideLocale('fr')).toBe('fr');
    expect(detectGuideLocale('nl')).toBe('nl');
    expect(detectGuideLocale('de')).toBe('de');
  });

  it('returns en for English and other unsupported languages', () => {
    expect(detectGuideLocale('en-US')).toBe('en');
    expect(detectGuideLocale('it')).toBe('en');
    expect(detectGuideLocale('ru')).toBe('en');
  });

  it('defaults to en when language is missing', () => {
    expect(detectGuideLocale(undefined)).toBe('en');
    expect(detectGuideLocale('')).toBe('en');
  });
});

// onboarding-request-fields Q1/R7.2 (tech-plan.md §2.9): the zip archive
// (GUIDE_DATA_ARCHIVE) is replaced by GUIDE_SCHEMA_DOWNLOAD, offering the
// repo's own description-bearing rutina.schema.json directly — a one-entry
// zip would just reintroduce the "my chat can't open a zip" failure this
// feature removes. Updated alongside the copy-static-pages.js /
// scripts/lib/stripSchema.js changes even though architecture-planning's
// AC-to-test map did not separately list this file — the rename is required
// by tech-plan.md §2.9 and strayLiterals.test.js's allowlist already assumes it.
describe('GUIDE_SCHEMA_DOWNLOAD (LLM guide fallback download card)', () => {
  it('has the confirmed schema filename (R7.2)', () => {
    expect(guideLocale.GUIDE_SCHEMA_DOWNLOAD.filename).toBe('rutina.schema.json');
  });

  it('path mirrors where copy-static-pages.js copies the schema in dist/ (R7.2)', () => {
    expect(guideLocale.GUIDE_SCHEMA_DOWNLOAD.path).toBe('data/schema/rutina.schema.json');
  });

  it('points at the production GitHub Pages origin, not raw.githubusercontent.com (AC2)', () => {
    expect(guideLocale.GUIDE_DATA_FILES_BASE_URL).toBe(
      'https://gym-rutina.github.io/basic-fit/'
    );
  });

  it('removes the zip archive constant entirely — replacement, not addition (Q1)', () => {
    expect(guideLocale.GUIDE_DATA_ARCHIVE).toBeUndefined();
    expect(guideLocale.GUIDE_DATA_FILES).toBeUndefined();
    expect(guideLocale.GUIDE_DOWNLOAD_FILE_LABELS).toBeUndefined();
  });
});
