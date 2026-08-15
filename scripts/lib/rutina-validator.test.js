// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validateRutina, crossCheckEquipmentIds } from './rutina-validator.js';

/**
 * spec.md S3 + S4 — the rutina contract after `extraEquipment[]`, optional
 * `equipmentId` and the widened `gymId`.
 *
 * This module is isomorphic on purpose (no fs/path/process) because
 * `app/src/lib/validateImport.js:7` pulls it straight into the browser
 * bundle. Everything asserted here therefore holds identically for the CLI
 * and for the PWA's Import screen — which is the reason there is one
 * validator and not two.
 */

const CATALOG = [
  { id: 'g3-s10', modelCode: 'G3-S10' },
  { id: 'g3-ms24', modelCode: 'G3-MS24' },
  { id: 'zvo-dbpu-1648', modelCode: 'ZVO-DBPU-1648' },
];

const trilingual = (s) => ({ en: s, es: s, be: s });

function exercise(overrides = {}) {
  return {
    name: 'Prensa de Pecho',
    muscleGroups: ['pectoralis-major'],
    equipmentId: 'g3-s10',
    sets: 3,
    reps: '10-12',
    restSeconds: 75,
    ...overrides,
  };
}

function rutina(overrides = {}) {
  const { program, days, ...rest } = overrides;
  return {
    schemaVersion: 1,
    program: {
      name: 'Alejandro — Fase 1',
      phaseName: 'Adaptación',
      phaseNumber: 1,
      gymId: 3,
      durationWeeks: 6,
      lastUpdated: '2026-08-15',
      ...program,
    },
    phaseInfo: {
      objective: 'Adaptación anatómica',
      intensityPercent: '60-70%',
      restSeconds: '75',
      frequencyPerWeek: 3,
    },
    warmup: { durationMinutes: '10', steps: ['Bicicleta 5 min'] },
    cooldown: { durationMinutes: '5', steps: ['Estiramientos'] },
    days: days ?? [{ label: 'Día 1', exercises: [exercise()] }],
    rules: ['Nunca fallo muscular'],
    notes: [{ title: 'Nota', body: 'Cuerpo' }],
    ...rest,
  };
}

const gear = (id, overrides = {}) => ({
  id,
  kind: 'gear',
  names: trilingual(id),
  ...overrides,
});

const errorsOf = (data) => validateRutina(data, CATALOG).errors;

describe('gymId widening (D3, R3.1, AC33, AC34)', () => {
  it('still accepts the legacy integer id every existing rutina carries', () => {
    expect(validateRutina(rutina({ program: { gymId: 3 } }), CATALOG).valid).toBe(true);
  });

  it('accepts a 32-hex club GUID', () => {
    expect(
      validateRutina(
        rutina({ program: { gymId: '1ec43550fd654c7d8e23bc6c96cd2ff0' } }),
        CATALOG
      ).valid
    ).toBe(true);
  });

  it('rejects a string that is not a 32-hex GUID', () => {
    expect(validateRutina(rutina({ program: { gymId: 'malaga-alameda' } }), CATALOG).valid).toBe(
      false
    );
  });

  it('rejects a non-positive integer', () => {
    expect(validateRutina(rutina({ program: { gymId: 0 } }), CATALOG).valid).toBe(false);
  });
});

describe('optional equipmentId (R3.2, AC26 — tech-plan D10)', () => {
  it('accepts an exercise with no equipmentId at all', () => {
    const bodyweight = exercise({ name: 'Plancha' });
    delete bodyweight.equipmentId;

    expect(validateRutina(rutina({ days: [{ label: 'Día 1', exercises: [bodyweight] }] }), CATALOG).valid).toBe(true);
  });

  it('accepts an explicit null equipmentId', () => {
    // Today `crossCheckEquipmentIds` (rutina-validator.js:90-91) early-returns
    // only on `undefined`; `null` falls through to `validIds.has(null)` and is
    // reported as "not found". That is a live bug the moment R3.2 lands.
    const bodyweight = exercise({ name: 'Plancha', equipmentId: null });

    expect(errorsOf(rutina({ days: [{ label: 'Día 1', exercises: [bodyweight] }] }))).toEqual([]);
  });

  it('still rejects an equipmentId that resolves to nothing (AC22)', () => {
    const errors = errorsOf(
      rutina({ days: [{ label: 'Día 1', exercises: [exercise({ equipmentId: 'g3-xx' })] }] })
    );

    expect(errors.join('\n')).toMatch(/g3-xx/);
  });

  it('rejects an invented catalog-style id (AC24)', () => {
    expect(
      errorsOf(rutina({ days: [{ label: 'Día 1', exercises: [exercise({ equipmentId: 'g3-s99' })] }] }))
        .length
    ).toBeGreaterThan(0);
  });
});

describe('extraEquipment (R3.3, R4.1, AC21, AC23, AC25, AC29)', () => {
  const withGear = (extraEquipment, exercises) =>
    rutina({ extraEquipment, days: [{ label: 'Día 1', exercises }] });

  it('resolves exercise ids against catalog ∪ extraEquipment (AC21)', () => {
    const data = withGear(
      [gear('resistance-band'), gear('foam-roller'), gear('ab-wheel')],
      [
        exercise({ name: 'Band pull-apart', equipmentId: 'resistance-band' }),
        exercise({ name: 'Foam roll', equipmentId: 'foam-roller' }),
        exercise({ name: 'Ab wheel', equipmentId: 'ab-wheel' }),
      ]
    );

    expect(validateRutina(data, CATALOG).valid).toBe(true);
  });

  it('rejects a gear id colliding with a catalog id (AC23)', () => {
    const data = withGear([gear('g3-s10')], [exercise()]);
    const errors = validateRutina(data, CATALOG).errors;

    expect(errors.join('\n')).toMatch(/collide|collision|already/i);
    expect(errors.join('\n')).toMatch(/g3-s10/);
  });

  /**
   * Every rejection below has to be checked against the REASON, not just
   * against `valid === false`. Today the root object is
   * `additionalProperties: false`, so a rutina carrying `extraEquipment` at
   * all fails with "extraEquipment: unrecognized property" — which would let
   * a bare `.valid === false` assertion pass without a single one of these
   * rules ever being implemented.
   */
  const rejectedBecause = (data, pattern) => {
    const { valid, errors } = validateRutina(data, CATALOG);
    expect(valid).toBe(false);
    expect(errors.join('\n')).not.toMatch(/extraEquipment: unrecognized property/);
    expect(errors.join('\n')).toMatch(pattern);
  };

  it.each([['Resistance Band'], ['resistance_band'], ['resistance--band'], ['-band'], ['band-']])(
    'rejects the non-slug gear id %s (AC25)',
    (id) => {
      rejectedBecause(withGear([gear(id)], [exercise()]), /pattern|slug|id/i);
    }
  );

  it('requires all three names on a gear entry (AC25)', () => {
    const incomplete = { id: 'resistance-band', kind: 'gear', names: { en: 'Band', es: 'Banda' } };
    rejectedBecause(withGear([incomplete], [exercise()]), /be/);
  });

  it('rejects a blank name in one language', () => {
    const blank = gear('resistance-band', { names: { en: 'Band', es: 'Banda', be: '' } });
    rejectedBecause(withGear([blank], [exercise()]), /names|be/i);
  });

  it('requires kind to be exactly "gear" (AC44c, rutina half)', () => {
    const noKind = { id: 'resistance-band', names: trilingual('Band') };
    rejectedBecause(withGear([noKind], [exercise()]), /kind/i);
    rejectedBecause(withGear([{ ...noKind, kind: 'accessory' }], [exercise()]), /kind/i);
  });

  it('does not require images, videos or manuals on gear (AC29)', () => {
    const bare = gear('towel');
    expect(Object.keys(bare)).toEqual(['id', 'kind', 'names']);
    expect(validateRutina(withGear([bare], [exercise({ equipmentId: 'towel' })]), CATALOG).valid).toBe(true);
  });

  it('has no maxItems cap (DD-001)', () => {
    const many = Array.from({ length: 40 }, (_, i) => gear(`gear-${i}`));
    expect(validateRutina(withGear(many, [exercise()]), CATALOG).valid).toBe(true);
  });

  it('accepts a rutina with no extraEquipment at all (AC30)', () => {
    // The 48-entry catalog now covers free weights, benches, bars and mats,
    // so extraEquipment is the exception, not the default (R6.6).
    const data = rutina({
      days: [
        {
          label: 'Día 1',
          exercises: [
            exercise({ equipmentId: 'zvo-dbpu-1648', name: 'Curl con mancuernas' }),
            exercise({ equipmentId: 'g3-ms24', name: 'Poleas' }),
          ],
        },
      ],
    });

    expect(validateRutina(data, CATALOG).valid).toBe(true);
  });
});

describe('crossCheckEquipmentIds directly (R4.1, D10)', () => {
  it('takes the rutina\'s own extraEquipment when no third argument is given', () => {
    // This default is what lets app/src/lib/validateImport.js keep calling
    // `validateRutina(parsed, equipment)` with an unchanged signature.
    const data = {
      extraEquipment: [gear('foam-roller')],
      days: [{ exercises: [{ equipmentId: 'foam-roller', name: 'Foam roll' }] }],
    };

    expect(crossCheckEquipmentIds(data, CATALOG)).toEqual([]);
  });

  it('stays null-safe when days or exercises are missing entirely', () => {
    expect(crossCheckEquipmentIds({}, CATALOG)).toEqual([]);
    expect(crossCheckEquipmentIds({ days: 'nope' }, CATALOG)).toEqual([]);
    expect(crossCheckEquipmentIds(null, CATALOG)).toEqual([]);
  });

  it('reports every unresolved id, not just the first', () => {
    const data = {
      days: [{ exercises: [{ equipmentId: 'nope-one' }, { equipmentId: 'nope-two' }] }],
    };

    expect(crossCheckEquipmentIds(data, CATALOG)).toHaveLength(2);
  });
});
