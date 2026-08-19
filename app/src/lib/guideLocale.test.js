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

  it('returns en for English and other unsupported languages', () => {
    expect(detectGuideLocale('en-US')).toBe('en');
    expect(detectGuideLocale('fr')).toBe('en');
  });

  it('defaults to en when language is missing', () => {
    expect(detectGuideLocale(undefined)).toBe('en');
    expect(detectGuideLocale('')).toBe('en');
  });
});

// llm-guide-zip-download (AC7): pending Cmok implementation — see
// tech-plan.md for the exact GUIDE_DATA_ARCHIVE / GUIDE_DOWNLOAD_ARCHIVE_LABEL
// shape. Replaces the prior feature's GUIDE_DATA_FILES describe block, which
// tested the per-file constants this feature removes.
describe('GUIDE_DATA_ARCHIVE (LLM guide zip-download card)', () => {
  it('has the confirmed zip filename (AC7)', () => {
    expect(guideLocale.GUIDE_DATA_ARCHIVE.filename).toBe('rutina-data-files.zip');
  });

  it('path mirrors where buildDataArchive writes the zip in dist/ (AC2/AC7)', () => {
    expect(guideLocale.GUIDE_DATA_ARCHIVE.path).toBe('data/rutina-data-files.zip');
  });

  it('points at the production GitHub Pages origin, not raw.githubusercontent.com (AC2)', () => {
    expect(guideLocale.GUIDE_DATA_FILES_BASE_URL).toBe(
      'https://gym-rutina.github.io/basic-fit/'
    );
  });

  it('removes the per-file constants entirely — replacement, not addition (AC7)', () => {
    expect(guideLocale.GUIDE_DATA_FILES).toBeUndefined();
    expect(guideLocale.GUIDE_DOWNLOAD_FILE_LABELS).toBeUndefined();
  });
});
