import { describe, it, expect } from 'vitest';
import { GUIDE_PROMPT } from './guideContent.js';

/**
 * onboarding-request-fields R6.4, R6.5, R7.1 (tech-plan.md §2.5, AC33, AC36).
 *
 * Pending Cmok implementation — see tech-plan.md. Failures here are expected
 * until Cmok edits docs/llm-rutina-prompt-template.txt (REQUEST removed,
 * DATA SOURCES narrowed, SCHEMA section added) and re-runs
 * `npm run build-guide` to regenerate this file's GUIDE_PROMPT export.
 *
 * This asserts against the REAL generated GUIDE_PROMPT (no mock), the same
 * way guideLocale.test.js and guideConsumer.test.jsx already exercise real
 * generated exports directly — GuideOverlay.test.jsx mocks this module so it
 * can pin component behaviour independent of the prompt's exact wording;
 * this file is where the template's own content is the thing under test.
 */

describe('GUIDE_PROMPT — REQUEST block moved to runtime composition', () => {
  it('no longer contains a REQUEST heading — that is composeRequestBlock\'s job now', () => {
    expect(GUIDE_PROMPT).not.toContain('### REQUEST');
  });

  it('still contains ROLE, DATA SOURCES, SCHEMA, CONSTRAINTS and OUTPUT sections', () => {
    for (const heading of ['### ROLE', '### DATA SOURCES', '### SCHEMA', '### CONSTRAINTS', '### OUTPUT']) {
      expect(GUIDE_PROMPT).toContain(heading);
    }
  });
});

describe('GUIDE_PROMPT — DATA SOURCES narrowed to a single fallback entry (R7.1, AC36)', () => {
  it('contains exactly one jsDelivr data URL — the schema', () => {
    const urls = GUIDE_PROMPT.match(/https:\/\/cdn\.jsdelivr\.net\/gh\/gym-rutina\/basic-fit@main\/data\/\S+/g) || [];
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('rutina.schema.json');
  });

  it('is labelled as a fallback for a truncated paste, not a prerequisite', () => {
    const section = GUIDE_PROMPT.slice(GUIDE_PROMPT.indexOf('### DATA SOURCES'), GUIDE_PROMPT.indexOf('### SCHEMA'));
    expect(section).toMatch(/truncat/i);
  });
});

describe('GUIDE_PROMPT — no equipment/gyms/example fetch instructions remain (R6.5, AC33)', () => {
  it('contains no jsDelivr URL for equipment.json, gyms.json or phase1-monday.json', () => {
    expect(GUIDE_PROMPT).not.toMatch(/data\/equipment\.json/);
    expect(GUIDE_PROMPT).not.toMatch(/data\/gyms\.json/);
    expect(GUIDE_PROMPT).not.toMatch(/phase1-monday\.json/);
  });

  it('does not instruct attaching a zip of data files as a prerequisite', () => {
    expect(GUIDE_PROMPT).not.toMatch(/rutina-data-files\.zip/);
    expect(GUIDE_PROMPT).not.toMatch(/attach the zip archive/i);
  });
});

describe('GUIDE_PROMPT — ROLE repoints at the inlined SCHEMA (R6.4)', () => {
  it('the ROLE section references SCHEMA, not "DATA SOURCES", for the schema contract', () => {
    const roleSection = GUIDE_PROMPT.slice(GUIDE_PROMPT.indexOf('### ROLE'), GUIDE_PROMPT.indexOf('### DATA SOURCES'));
    expect(roleSection).toMatch(/SCHEMA/);
  });
});

describe('GUIDE_PROMPT — inlined SCHEMA section (R5.1, R5.2, AC24)', () => {
  it('the SCHEMA section body parses as JSON with no description key at any depth', () => {
    const start = GUIDE_PROMPT.indexOf('### SCHEMA') + '### SCHEMA'.length;
    const end = GUIDE_PROMPT.indexOf('### CONSTRAINTS');
    const body = GUIDE_PROMPT.slice(start, end).trim();
    const parsed = JSON.parse(body);
    expect(parsed).not.toHaveProperty('$schema');
    expect(parsed).not.toHaveProperty('title');
    expect(JSON.stringify(parsed)).not.toContain('"description"');
  });
});
