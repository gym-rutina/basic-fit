import { defaultT } from '../i18n/index.js';

/**
 * Onboarding carousel copy (onboarding-screens feature).
 *
 * pwa-ui-language AC6 reverses this file's earlier "Spanish-only, no locale
 * keys" decision — the copy now flows through the shared catalogs, keyed
 * under `onboarding.*`. `buildOnboardingSteps(t)` is what `OnboardingOverlay`
 * actually renders (recomputed on every locale switch); `ONBOARDING_STEPS`
 * below is `buildOnboardingSteps()` evaluated once with the es-pinned
 * default translator (D4), kept as a plain exported array so
 * `onboardingContent.test.js` — an existing, AC22-protected file that
 * imports `ONBOARDING_STEPS` directly and asserts it is a flat array of
 * plain strings — keeps passing unmodified.
 *
 * Shape: 4 plain objects, {icon, title, body} for steps 1/2/4, and
 * {icon, title, steps, outcomes, footnote} for step 3 (index 2) — the
 * relocated "How it works" flow from GuideOverlay's former "Cómo funciona"
 * section (spec AC4).
 */
export function buildOnboardingSteps(t = defaultT) {
  return [
    {
      icon: 'dumbbell',
      title: t('onboarding.step1.title'),
      body: t('onboarding.step1.body'),
    },
    {
      icon: 'message-square',
      title: t('onboarding.step2.title'),
      body: t('onboarding.step2.body'),
    },
    {
      icon: 'list-checks',
      title: t('onboarding.step3.title'),
      steps: [
        t('onboarding.step3.step1'),
        t('onboarding.step3.step2'),
        t('onboarding.step3.step3'),
        t('onboarding.step3.step4'),
      ],
      outcomes: [t('onboarding.step3.outcome1'), t('onboarding.step3.outcome2')],
      footnote: t('onboarding.step3.footnote'),
    },
    {
      icon: 'check-circle',
      title: t('onboarding.step4.title'),
      body: t('onboarding.step4.body'),
    },
  ];
}

export const ONBOARDING_STEPS = buildOnboardingSteps();
