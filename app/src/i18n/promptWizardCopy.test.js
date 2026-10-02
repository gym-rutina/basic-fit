import { describe, it, expect } from 'vitest';
import { UI_LOCALES, CATALOGS, tFor } from './index.js';

/**
 * back-closes-dialogs-and-wizard-polish, item C (AC17, AC19, AC20) — wizard
 * step 2 wording in all six locales.
 *
 *  - AC19/AC20: `promptWizard.step3` used to say "come back here and paste it",
 *    which suggests a paste target on step 2. There is none: the user must tap
 *    "I have the JSON" first and paste on the NEXT screen. The new copy must name
 *    the button by its live label, so the catalog string carries a `{button}`
 *    placeholder that the screen fills from `promptWizard.haveJson` (minus its
 *    trailing arrow) — never a second hard-coded copy of the label.
 *  - AC17: `promptWizard.copyIntro` claimed the prompt "already includes your
 *    club's machines", false when no club is set (and the club now lives on
 *    step 1). It must be reworded in every locale.
 *
 * Wording is pinned structurally (placeholder present, old claim gone, a
 * "next screen" cue present) rather than to exact sentences, so a copy polish
 * does not break the build but a regression to the old meaning does.
 */

const OLD_STEP3 = {
  es: /vuelve aqu[ií]/i,
  en: /come back here/i,
  be: /вярніцеся сюды/i,
  fr: /reviens ici/i,
  nl: /kom hier terug/i,
  de: /komm hierher zur[uü]ck/i,
};

// "…on the next screen" cue per locale.
const NEXT_SCREEN_CUE = {
  es: /siguiente/i,
  en: /next screen/i,
  be: /наступн/i,
  fr: /suivant/i,
  nl: /volgende/i,
  de: /n[aä]chste/i,
};

const OLD_COPY_INTRO = {
  es: /ya incluye las m[aá]quinas de tu club/i,
  en: /already includes your club/i,
  be: /ужо ёсць трэнажоры вашага клуба/i,
  fr: /inclut d[eé]j[aà] les machines de ton club/i,
  nl: /bevat al de toestellen van je club/i,
  de: /enth[aä]lt bereits die ger[aä]te deines studios/i,
};

const stripArrow = (label) => label.replace(/\s*→\s*$/, '');

describe('promptWizard.step3 — names the button, pastes on the NEXT screen (AC19, AC20)', () => {
  it.each(UI_LOCALES)('%s: carries a {button} placeholder instead of a hard-coded label', (locale) => {
    const raw = CATALOGS[locale]['promptWizard.step3'];
    expect(raw).toContain('{button}');
    const label = stripArrow(CATALOGS[locale]['promptWizard.haveJson']);
    expect(raw).not.toContain(label); // derived from haveJson, not duplicated
  });

  it.each(UI_LOCALES)('%s: interpolated with the live haveJson label (no arrow) it names the button exactly', (locale) => {
    const t = tFor(locale);
    const label = stripArrow(t('promptWizard.haveJson'));
    const text = t('promptWizard.step3', { button: label });
    expect(label.length).toBeGreaterThan(2);
    expect(text).toContain(label);
    expect(text).not.toContain('→');
    expect(text).not.toContain('{button}');
  });

  it.each(UI_LOCALES)('%s: no longer says "come back here and paste it"', (locale) => {
    expect(CATALOGS[locale]['promptWizard.step3']).not.toMatch(OLD_STEP3[locale]);
  });

  it.each(UI_LOCALES)('%s: says the pasting happens on the next screen', (locale) => {
    expect(CATALOGS[locale]['promptWizard.step3']).toMatch(NEXT_SCREEN_CUE[locale]);
  });

  it('the button label keeps its trailing arrow in every locale (the screen strips it when naming the button)', () => {
    for (const locale of UI_LOCALES) {
      expect(CATALOGS[locale]['promptWizard.haveJson']).toMatch(/→\s*$/);
    }
  });
});

describe('promptWizard.copyIntro — true with or without a club (AC17)', () => {
  it.each(UI_LOCALES)('%s: reworded — no longer claims the club\'s machines are already included', (locale) => {
    const text = CATALOGS[locale]['promptWizard.copyIntro'];
    expect(typeof text).toBe('string');
    expect(text.trim().length).toBeGreaterThan(20);
    expect(text).not.toMatch(OLD_COPY_INTRO[locale]);
  });

  it.each(UI_LOCALES)('%s: short enough for two lines on a phone (<= 170 chars)', (locale) => {
    expect(CATALOGS[locale]['promptWizard.copyIntro'].length).toBeLessThanOrEqual(170);
  });
});

describe('the club keys stay in the catalogs — they moved to step 1, they were not deleted (AC12/AC14)', () => {
  it.each(UI_LOCALES)('%s', (locale) => {
    for (const key of ['promptWizard.clubRow', 'promptWizard.clubChange', 'promptWizard.clubPick', 'promptWizard.clubWarning']) {
      expect(CATALOGS[locale][key], `${locale} ${key}`).toBeTruthy();
    }
  });
});
