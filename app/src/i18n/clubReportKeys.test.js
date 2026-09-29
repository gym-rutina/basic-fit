import { describe, it, expect } from 'vitest';
import { UI_LOCALES, CATALOGS } from './index.js';

/**
 * club-equipment-reporting AC20 / ux-design §9 — the five new user-facing
 * strings ship in every UI locale (spec says es/en/be; this project ships six
 * and catalogs.test.js enforces parity across all of them). Parity cannot
 * catch a key missing from ALL catalogs, and strayLiterals cannot catch a
 * literal that is simply never rendered — so existence and wording are pinned
 * here. Deliberately NOT added: any key for the implicit present-report, the
 * outbox or a sync state (silence is designed — ux-design §0/§8).
 */

const ANCHORS = {
  'session.notHereAction': { es: 'No está', en: 'Not here' },
  'session.notHereAria': { es: 'Reportar {machine} como no disponible en este club', en: 'Report {machine} as not available at this club' },
  'session.reportedBody': {
    es: 'Reportado. Se ha ocultado en el catálogo de este club. Puedes revertirlo desde Catálogo → Mi club.',
    en: 'Reported. It has been hidden in this club’s catalog. You can undo it from Catalog → My club.',
  },
  'session.notesLabel': { es: 'Notas (opcional)', en: 'Notes (optional)' },
  'session.notesPlaceholder': { es: 'p. ej. sin polea, usé el agarre largo', en: 'e.g. no pulley, used the long grip' },
};

describe('club-equipment-reporting i18n keys (AC20)', () => {
  it.each(Object.keys(ANCHORS))('%s exists in every locale', (key) => {
    for (const locale of UI_LOCALES) {
      expect({ key, locale, present: typeof CATALOGS[locale][key] === 'string' }).toEqual({ key, locale, present: true });
    }
  });

  it.each(Object.entries(ANCHORS))('%s carries the approved es/en wording', (key, expected) => {
    expect(CATALOGS.es[key]).toBe(expected.es);
    expect(CATALOGS.en[key]).toBe(expected.en);
  });

  it('hand-authors en/be/fr/nl/de — none is a verbatim copy of es', () => {
    for (const key of Object.keys(ANCHORS)) {
      for (const locale of UI_LOCALES.filter((l) => l !== 'es')) {
        expect({ key, locale, copiedFromEs: CATALOGS[locale][key] === CATALOGS.es[key] }).toEqual({ key, locale, copiedFromEs: false });
      }
    }
  });

  it('keeps the {machine} token in the accessible-name string of every locale', () => {
    for (const locale of UI_LOCALES) {
      expect(CATALOGS[locale]['session.notHereAria']).toContain('{machine}');
    }
  });

  it('the reported confirmation points corrections to the Catálogo → Mi club path in every locale (one-tap finality has an escape hatch)', () => {
    for (const locale of UI_LOCALES) {
      expect(CATALOGS[locale]['session.reportedBody']).toContain('→');
    }
  });

  it('adds NO key for the silent machinery (queue, sync, implicit present)', () => {
    for (const locale of UI_LOCALES) {
      const offenders = Object.keys(CATALOGS[locale]).filter((k) => /^(report|outbox|sync|queue|collector)\./i.test(k) || /presentReport|implicitPresent/i.test(k));
      expect({ locale, offenders }).toEqual({ locale, offenders: [] });
    }
  });
});
