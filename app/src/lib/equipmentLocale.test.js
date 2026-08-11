import { describe, it, expect } from 'vitest';
import { equipmentDisplayName, getEquipmentById } from '../data/equipment.js';
import { machineLabel, collisionSuffix } from './machineLabel.js';
import { buildVideoQuery } from './videoQuery.js';
import { tFor } from '../i18n/index.js';

/**
 * pwa-ui-language AC13 (tech-plan.md D12).
 *
 * Axis 2 — bundled reference data — follows the UI locale app-wide instead of
 * being Spanish everywhere except inside the Catálogo tab.
 *
 * The locale is threaded as an explicit PARAMETER, never a module-level
 * "current locale" global: `data/equipment.js`, `machineLabel.js` and
 * `videoQuery.js` are pure and fixture-testable today, and that is exactly how
 * they are tested here.
 */

// g3-s10 ships all three names and is the fixture the existing suite uses.
const CHEST_PRESS = { es: 'Prensa de Pecho', en: 'Chest Press', be: 'Жым ад грудзей' };

describe('equipmentDisplayName (AC13)', () => {
  it('returns the name for the requested locale', () => {
    const item = getEquipmentById('g3-s10');
    expect(equipmentDisplayName(item, 'es')).toBe(CHEST_PRESS.es);
    expect(equipmentDisplayName(item, 'en')).toBe(CHEST_PRESS.en);
    expect(equipmentDisplayName(item, 'be')).toBe(CHEST_PRESS.be);
  });

  it('still defaults to es, so every untouched call site keeps its output (D4, AC22)', () => {
    expect(equipmentDisplayName(getEquipmentById('g3-s10'))).toBe(CHEST_PRESS.es);
  });

  it('keeps the per-item fallback chain for a locale slot that is empty in the data', () => {
    // AC13 is explicit: the app-wide locale change does NOT replace the
    // existing `|| .es || .en` per-item fallback.
    const partial = { names: { en: 'Only English' } };
    expect(equipmentDisplayName(partial, 'be')).toBe('Only English');
    expect(equipmentDisplayName({ names: { es: 'Solo español', en: 'Only English' } }, 'be')).toBe('Solo español');
  });

  it('returns an empty string for a missing item rather than throwing', () => {
    expect(equipmentDisplayName(null, 'be')).toBe('');
    expect(equipmentDisplayName(undefined)).toBe('');
  });
});

describe('machineLabel (AC13)', () => {
  it('renders the machine name in the requested locale', () => {
    expect(machineLabel('g3-s10', 'Press inclinado', 'es')).toContain(CHEST_PRESS.es);
    expect(machineLabel('g3-s10', 'Press inclinado', 'en')).toContain(CHEST_PRESS.en);
    expect(machineLabel('g3-s10', 'Press inclinado', 'be')).toContain(CHEST_PRESS.be);
  });

  it('always keeps the model code, which is not language at all', () => {
    for (const locale of ['es', 'en', 'be']) {
      expect(machineLabel('g3-s10', 'Press inclinado', locale)).toContain('G3-S10');
    }
  });

  it('defaults to es for callers that have no locale to give (D4)', () => {
    expect(machineLabel('g3-s10', 'Press inclinado')).toContain(CHEST_PRESS.es);
  });

  it('still drops a redundant name, per locale', () => {
    // The name is omitted when it would just repeat the exercise name — that
    // comparison is now made in the locale actually being displayed.
    expect(machineLabel('g3-s10', 'Prensa de Pecho', 'es')).toBe('G3-S10');
    expect(machineLabel('g3-s10', 'Chest Press', 'en')).toBe('G3-S10');
    expect(machineLabel('g3-s10', 'Жым ад грудзей', 'be')).toBe('G3-S10');
  });

  it('no longer collapses two Belarusian names onto the same "redundant" verdict', () => {
    // Before AC17, every Belarusian name slugified to '' and therefore matched
    // every other Belarusian name.
    expect(machineLabel('g3-s10', 'Развядзенне рук', 'be')).toContain(CHEST_PRESS.be);
  });

  it('still returns null for a bodyweight exercise and the raw id for an unknown machine', () => {
    expect(machineLabel(null, 'Plancha', 'en')).toBeNull();
    expect(machineLabel('not-a-machine', 'Plancha', 'en')).toBe('not-a-machine');
  });
});

describe('collisionSuffix (AC13)', () => {
  it('localizes the no-equipment suffix', () => {
    expect(collisionSuffix(null)).toBe(' · sin equipo');
    expect(collisionSuffix(null, tFor('en'))).toBe(' · no equipment');
    expect(collisionSuffix(null, tFor('be'))).toBe(' · без абсталявання');
  });

  it('leaves the model-code form alone — a model code has no language', () => {
    expect(collisionSuffix('g3-s10', tFor('be'))).toBe(' · G3-S10');
  });
});

describe('buildVideoQuery (AC13)', () => {
  it('composes the query from the equipment name in the requested locale', () => {
    const equipment = getEquipmentById('g3-s10');
    expect(buildVideoQuery({ name: 'Press inclinado' }, equipment, 'en')).toContain(CHEST_PRESS.en);
    expect(buildVideoQuery({ name: 'Press inclinado' }, equipment, 'be')).toContain(CHEST_PRESS.be);
  });

  it('still honours an authored videoQuery verbatim — that is axis-3 content', () => {
    expect(buildVideoQuery({ name: 'x', videoQuery: 'мой запыт' }, getEquipmentById('g3-s10'), 'en')).toBe('мой запыт');
  });
});
