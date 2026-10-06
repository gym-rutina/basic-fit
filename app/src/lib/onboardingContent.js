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
 * Shape (onboarding-fork-shortening — 3 steps total, discriminated by `type`
 * so OnboardingOverlay can render two kinds of step without a parallel array):
 *   { type: 'info',  icon, title, body }                       — step 1, unchanged
 *   { type: 'info',  icon, title, preamble, steps, outcomes,
 *                    glosses }                                 — step 2, merged
 *     (`steps`/`outcomes`/`glosses` render ONLY in `guideOnly` mode (the
 *     fork's "How the app works →" revisit); in the first-run carousel the
 *     step shows just title + preamble — onboarding-fork-shortening)
 *   { type: 'input', icon, title, body, field, isLast? }       — step 3, club
 *     (the former name-goal/schedule/injuries input steps were removed — the
 *     fork's "Prepare prompt" wizard collects the five REQUEST fields itself;
 *     the club step is now last and carries `isLast` — the "¡Empezar!" CTA)
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
      glosses: [t('onboarding.step3.glossLlm'), t('onboarding.step3.glossJson')],
    },
    {
      type: 'input',
      field: 'club',
      icon: 'map-pin',
      title: t('onboarding.clubStep.title'),
      body: t('onboarding.clubStep.body'),
      isLast: true,
    },
  ];
}

export const ONBOARDING_STEPS = buildOnboardingSteps();
