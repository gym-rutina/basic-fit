import { describe, it, expect } from 'vitest';
import { ONBOARDING_STEPS } from './onboardingContent.js';

/**
 * onboarding-request-fields R1.1, Rev4-D2/D3, Rev4-SF2/SF3 (tech-plan.md §2.6).
 *
 * Pending Cmok implementation — see tech-plan.md. Failures here are expected
 * until Cmok implements onboardingContent.js with this exact shape.
 *
 * This test deliberately MOVES away from the prior feature's "4 plain info
 * steps" assertion (Rev4-SF2 explicitly calls this out): the step count
 * drops from 4 info steps to 2 (steps 2+3+4 merge into one, tech-plan.md
 * §2.6), and 4 new input steps are appended — 6 steps total, discriminated
 * by a `type` field so OnboardingOverlay can render two kinds of step
 * without a parallel array.
 */
describe('ONBOARDING_STEPS — shape (Rev4-D2, AC1)', () => {
  it('has exactly 6 steps — 2 informational, 4 input', () => {
    expect(Array.isArray(ONBOARDING_STEPS)).toBe(true);
    expect(ONBOARDING_STEPS).toHaveLength(6);
  });

  it('every step has a string icon name, a string title, and a type of "info" or "input"', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof step.icon).toBe('string');
      expect(typeof step.title).toBe('string');
      expect(step.title.length).toBeGreaterThan(0);
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

  it('the first 2 steps are informational, the last 4 are input steps, in that order', () => {
    const types = ONBOARDING_STEPS.map((s) => s.type);
    expect(types).toEqual(['info', 'info', 'input', 'input', 'input', 'input']);
  });
});

describe('ONBOARDING_STEPS — info step 1 (unchanged, Rev4 "UNCHANGED from current implementation")', () => {
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

  it('drops the footnote — Rev4-D3 removes it deliberately', () => {
    expect(step2().footnote).toBeUndefined();
  });
});

describe('ONBOARDING_STEPS — the 4 input steps, in fixed order (R1.2, Rev3, Rev4 "what does NOT change")', () => {
  const inputSteps = () => ONBOARDING_STEPS.slice(2);

  it('orders club → name-goal → schedule → injuries', () => {
    expect(inputSteps().map((s) => s.field)).toEqual(['club', 'name-goal', 'schedule', 'injuries']);
  });

  it('only the last input step (injuries) is marked isLast — it carries the "¡Empezar!" CTA (Rev3-SF1)', () => {
    const flags = inputSteps().map((s) => Boolean(s.isLast));
    expect(flags).toEqual([false, false, false, true]);
  });

  it('every input step has non-empty body copy (what/how/example — R1.1)', () => {
    for (const step of inputSteps()) {
      expect(typeof step.body).toBe('string');
      expect(step.body.length).toBeGreaterThan(0);
    }
  });
});
