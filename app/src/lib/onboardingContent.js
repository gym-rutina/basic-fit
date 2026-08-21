import { defaultT } from '../i18n/index.js';

/**
 * Onboarding carousel copy (onboarding-screens feature; extended by
 * onboarding-request-fields Rev4-D2/D3, R1.1-R1.2, tech-plan.md §2.6).
 *
 * pwa-ui-language AC6 flows this copy through the shared catalogs, keyed
 * under `onboarding.*`. `buildOnboardingSteps(t)` is what `OnboardingOverlay`
 * actually renders (recomputed on every locale switch); `ONBOARDING_STEPS`
 * below is `buildOnboardingSteps()` evaluated once with the es-pinned
 * default translator (D4), kept as a plain exported array so
 * `onboardingContent.test.js` can assert its shape directly.
 *
 * Shape (Rev4 — 6 steps total, discriminated by `type` so OnboardingOverlay
 * can render two kinds of step without a parallel array):
 *   { type: 'info',  icon, title, body }                       — step 1, unchanged
 *   { type: 'info',  icon, title, preamble, steps, outcomes }   — step 2, merged
 *     (old steps 2+3+4: old step-2's value-prop sentence becomes `preamble`;
 *     old step-4 "you're all set" is dropped entirely — Rev4-D2/D3)
 *   { type: 'input', icon, title, body, field, isLast? }        — steps 3-6
 *     (club → name-goal → schedule → injuries, Rev3 order preserved; only
 *     the last one, injuries, carries `isLast` — it gets the "¡Empezar!" CTA)
 */
export function buildOnboardingSteps(t = defaultT) {
  return [
    {
      type: 'info',
      icon: 'dumbbell',
      title: t('onboarding.step1.title'),
      body: t('onboarding.step1.body'),
    },
    {
      type: 'info',
      icon: 'list-checks',
      title: t('onboarding.step3.title'),
      preamble: t('onboarding.step2.preamble'),
      steps: [
        t('onboarding.step3.step1'),
        t('onboarding.step3.step2'),
        t('onboarding.step3.step3'),
        t('onboarding.step3.step4'),
      ],
      outcomes: [t('onboarding.step3.outcome1'), t('onboarding.step3.outcome2')],
    },
    {
      type: 'input',
      field: 'club',
      icon: 'map-pin',
      title: t('onboarding.clubStep.title'),
      body: t('onboarding.clubStep.body'),
    },
    {
      type: 'input',
      field: 'name-goal',
      icon: 'target',
      title: t('onboarding.nameGoalStep.title'),
      body: t('onboarding.nameGoalStep.body'),
    },
    {
      type: 'input',
      field: 'schedule',
      icon: 'calendar',
      title: t('onboarding.scheduleStep.title'),
      body: t('onboarding.scheduleStep.body'),
    },
    {
      type: 'input',
      field: 'injuries',
      icon: 'shield',
      title: t('onboarding.injuriesStep.title'),
      body: t('onboarding.injuriesStep.body'),
      isLast: true,
    },
  ];
}

export const ONBOARDING_STEPS = buildOnboardingSteps();
