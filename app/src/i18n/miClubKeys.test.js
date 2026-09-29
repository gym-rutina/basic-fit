import { describe, it, expect } from 'vitest';
import { UI_LOCALES, CATALOGS } from './index.js';

/**
 * move-club-picker-to-settings ux-design.md §8 — the key moves.
 *
 * catalogs.test.js already enforces parity/non-empty/token-match across all
 * six catalogs for every key. This file adds what parity cannot: the keys
 * EXIST (a missing one fails parity only if es has it and another does not —
 * all six missing is silent), the removed keys are GONE (a dead key nothing
 * renders is exactly how the Catálogo club row would survive as ghost copy),
 * the es/en wording is the approved wording, and the hand-authored locales
 * are not copies of es (be/fr/nl/de are never machine-translated or pasted).
 */

const ANCHORS = {
  'settings.miClub.sectionTitle': { es: 'Mi club', en: 'My club' },
  'settings.miClub.emptyPrompt': { es: 'Aún no has elegido tu club.', en: "You haven't chosen your club yet." },
  'settings.miClub.selectAction': { es: 'Elegir club', en: 'Choose club' },
  'settings.miClub.equipmentEntryLabel': { es: 'Equipo del club', en: 'Club equipment' },
  'settings.miClub.equipmentCountHint': {
    es: '{total} equipos · {excluded} marcados como ausentes',
    en: '{total} items · {excluded} marked as absent',
  },
  'settings.miClub.equipmentCountHintLoading': { es: '{total} equipos', en: '{total} items' },
  'catalog.card.inClub': { es: 'En mi club', en: 'In my club' },
  'catalog.card.notInClub': { es: 'Fuera de mi club', en: 'Not in my club' },
  'catalog.card.removeFromClub': { es: 'Quitar {name} de mi club', en: 'Remove {name} from my club' },
  'catalog.card.addToClub': { es: 'Añadir {name} a mi club', en: 'Add {name} to my club' },
};

const NEW_KEYS = [...Object.keys(ANCHORS), 'catalog.clubFilterEmpty'];
const REMOVED_KEYS = ['catalog.clubRowEmptyHint', 'catalog.clubRowButton'];
const KEPT_KEYS = ['catalog.onlyMyClubPill', 'club.changeButton', 'overlay.writeFailedNote'];

describe('move-club-picker-to-settings i18n keys', () => {
  it.each(NEW_KEYS)('%s exists in every locale', (key) => {
    for (const locale of UI_LOCALES) {
      expect({ key, locale, present: typeof CATALOGS[locale][key] === 'string' }).toEqual({ key, locale, present: true });
    }
  });

  it.each(Object.entries(ANCHORS))('%s carries the approved es/en wording', (key, expected) => {
    expect(CATALOGS.es[key]).toBe(expected.es);
    expect(CATALOGS.en[key]).toBe(expected.en);
  });

  it('carries the dedicated empty-state copy naming both ways out (OQ-2)', () => {
    expect(CATALOGS.es['catalog.clubFilterEmpty']).toBe(
      'Has marcado todo el equipo como ausente de tu club. Desactiva «Solo mi club» para ver el catálogo completo, o edita las exclusiones en Ajustes.'
    );
  });

  it.each(REMOVED_KEYS)('%s is gone from every locale (the Catálogo club row is deleted)', (key) => {
    for (const locale of UI_LOCALES) {
      expect({ key, locale, present: key in CATALOGS[locale] }).toEqual({ key, locale, present: false });
    }
  });

  it.each(KEPT_KEYS)('%s is kept — it still has a consumer', (key) => {
    for (const locale of UI_LOCALES) {
      expect(typeof CATALOGS[locale][key]).toBe('string');
    }
  });

  it('hand-authors en/be/fr/nl/de — no value is a verbatim copy of the es string', () => {
    for (const key of NEW_KEYS) {
      for (const locale of UI_LOCALES.filter((l) => l !== 'es')) {
        expect({ key, locale, copiedFromEs: CATALOGS[locale][key] === CATALOGS.es[key] }).toEqual({
          key,
          locale,
          copiedFromEs: false,
        });
      }
    }
  });

  it('interpolates {name} in the chip action strings and {total}/{excluded} in the count hint', () => {
    for (const locale of UI_LOCALES) {
      expect(CATALOGS[locale]['catalog.card.removeFromClub']).toContain('{name}');
      expect(CATALOGS[locale]['catalog.card.addToClub']).toContain('{name}');
      expect(CATALOGS[locale]['settings.miClub.equipmentCountHint']).toContain('{total}');
      expect(CATALOGS[locale]['settings.miClub.equipmentCountHint']).toContain('{excluded}');
      expect(CATALOGS[locale]['settings.miClub.equipmentCountHintLoading']).toContain('{total}');
    }
  });
});
