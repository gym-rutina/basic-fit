import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { UI_LANG_KEY } from './lib/uiLangStorage.js';

afterEach(cleanup);

// pwa-ui-language AC22 (tech-plan.md D5): pins the UI locale to `es` before
// EVERY test, not once at module load. `App.test.jsx` mounts the real
// I18nProvider, and jsdom reports navigator.language === 'en-US', which AC2
// would resolve to `en` — that would break its four Spanish assertions.
// Must be a beforeEach, not a one-time setItem: onboardingStorage.test.js
// (and others) call localStorage.clear() in their own beforeEach, and this
// pin has to come back for the NEXT test regardless (i18n/testPin.test.jsx
// asserts exactly this).
beforeEach(() => {
  try {
    localStorage.setItem(UI_LANG_KEY, 'es');
  } catch {
    // Storage disabled — nothing to pin; the context default (D5) is also es.
  }
});

// jsdom doesn't implement window.matchMedia. Previously unexercised because
// no test rendered <App/> (which mounts InstallBanner -> useInstallPrompt's
// isAppInstalled(), a pre-existing call unrelated to onboarding-screens) —
// surfaced by App.test.jsx (onboarding-screens feature). Standard jsdom
// polyfill, global so any future component/hook depending on matchMedia
// doesn't hit the same crash.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = function matchMedia(query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated, kept for older API consumers
      removeListener: () => {}, // deprecated, kept for older API consumers
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
}
