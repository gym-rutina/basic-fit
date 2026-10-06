import { describe, it, expect } from 'vitest';
import { ONBOARDING_STEPS } from './onboardingContent.js';

/**
 * onboarding-fork-shortening — the carousel is trimmed to 3 steps so the
 * import fork ("Create your routine") appears after 3 screens instead of 6.
 *
 * The former name-goal/schedule/injuries input steps were removed: the fork's
 * "Prepare prompt" wizard (PromptPreferencesScreen) collects the five REQUEST
 * fields itself, so collecting them twice was redundant. The club step stays
 * (it is a different persistence path — clubStorage, not promptRequest) and
 * is now the last step, so it carries the "¡Empezar!" CTA.
 *
 * Shape is still discriminated by a `type` field so OnboardingOverlay can
 * render two kinds of step without a parallel array.
 */
describe('ONBOARDING_STEPS — shape', () => {
  it('has exactly 3 steps — 2 informational, 1 input', () => {
    expect(ONBOARDING_STEPS).toHaveLength(3);
    expect(ONBOARDING_STEPS.filter((s) => s.type === 'info')).toHaveLength(2);
    expect(ONBOARDING_STEPS.filter((s) => s.type === 'input')).toHaveLength(1);
  });

  it('every step has a string icon name, a string title, and a type of "info" or "input"', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof step.icon).toBe('string');
      expect(typeof step.title).toBe('string');
      expect(['info', 'input']).toContain(step.type);
    }
  });

  it('is Spanish-only — no locale-keyed objects anywhere (AC8-equivalent for this module)', () => {
    for (const step of ONBOARDING_STEPS) {
      for (const key of ['title', 'body', 'footnote', 'preamble', 'field']) {
        if (step[key] !== undefined) {
          expect(typeof step[key]).not.toBe('object');
        }
      }
      if (step.steps !== undefined) {
        expect(Array.isArray(step.steps)).toBe(true);
        for (const line of step.steps) expect(typeof line).toBe('string');
      }
    }
  });

  it('the first 2 steps are informational, the last is the club input step, in that order', () => {
    const types = ONBOARDING_STEPS.map((s) => s.type);
    expect(types).toEqual(['info', 'info', 'input']);
    expect(ONBOARDING_STEPS[2].field).toBe('club');
  });
});

describe('ONBOARDING_STEPS — info step 1 (unchanged)', () => {
  it('keeps the dumbbell icon and its title/body', () => {
    const step1 = ONBOARDING_STEPS[0];
    expect(step1.type).toBe('info');
    expect(step1.icon).toBe('dumbbell');
    expect(typeof step1.body).toBe('string');
    expect(step1.body.length).toBeGreaterThan(0);
  });
});

describe('ONBOARDING_STEPS — info step 2, merged (Rev4-D2, D3, SF3)', () => {
  const step2 = () => ONBOARDING_STEPS[1];

  it('carries a preamble (the old step-2 value-prop sentence) as a string', () => {
    expect(typeof step2().preamble).toBe('string');
    expect(step2().preamble.length).toBeGreaterThan(0);
  });

  it('carries the relocated 4-line "How it works" workflow', () => {
    expect(Array.isArray(step2().steps)).toBe(true);
    expect(step2().steps).toHaveLength(4);
  });

  it('carries the pass/fail outcomes', () => {
    expect(Array.isArray(step2().outcomes)).toBe(true);
    expect(step2().outcomes.length).toBeGreaterThan(0);
  });

  it('carries the LLM/JSON glosses for the guideOnly rendering', () => {
    expect(Array.isArray(step2().glosses)).toBe(true);
    expect(step2().glosses).toHaveLength(2);
  });

  it('drops the footnote — Rev4-D3 removes it deliberately', () => {
    expect(step2().footnote).toBeUndefined();
  });
});

describe('ONBOARDING_STEPS — the club input step (now last)', () => {
  const clubStep = () => ONBOARDING_STEPS[2];

  it('is the club step and is marked isLast — it carries the "¡Empezar!" CTA', () => {
    expect(clubStep().field).toBe('club');
    expect(clubStep().isLast).toBe(true);
  });

  it('has non-empty body copy (what/how/example — R1.1)', () => {
    expect(typeof clubStep().body).toBe('string');
    expect(clubStep().body.length).toBeGreaterThan(0);
  });

  it('no removed input step (name-goal/schedule/injuries) remains', () => {
    const fields = ONBOARDING_STEPS.map((s) => s.field).filter(Boolean);
    expect(fields).toEqual(['club']);
  });
});
