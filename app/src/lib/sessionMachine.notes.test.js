import { describe, it, expect } from 'vitest';
import { createSession, sessionReducer } from './sessionMachine.js';

/**
 * club-equipment-reporting AC16 (tech-plan.md §2 D11) — an optional, private,
 * free-text `notes` field on a logged exercise, persisted beside
 * weightUsed/difficulty. Only a real note is stored: an exercise completed
 * WITHOUT one carries no `notes` key at all, so every existing record shape
 * (and every existing toEqual assertion on it) is byte-identical.
 */

const NOW = '2026-09-29T10:00:00.000Z';
const EXERCISES = [
  { equipmentId: 'g3-s10', name: 'Prensa', sets: 3, reps: 10 },
  { equipmentId: 'g3-s30', name: 'Remo', sets: 3, reps: 12 },
];

function fresh() {
  return createSession('Lunes', 0, EXERCISES, NOW);
}

function complete(session, extra = {}, index = 0) {
  return sessionReducer(session, {
    type: 'COMPLETE_EXERCISE',
    exerciseIndex: index,
    equipmentId: EXERCISES[index].equipmentId,
    name: EXERCISES[index].name,
    weightUsed: 40,
    difficulty: 'normal',
    now: NOW,
    ...extra,
  });
}

describe('COMPLETE_EXERCISE with notes (AC16)', () => {
  it('stores the note beside weight/difficulty', () => {
    const next = complete(fresh(), { notes: 'sin polea, usé el agarre largo' });
    expect(next.exercises[0]).toMatchObject({ weightUsed: 40, difficulty: 'normal', notes: 'sin polea, usé el agarre largo' });
  });

  it('trims surrounding whitespace', () => {
    expect(complete(fresh(), { notes: '  agarre largo \n' }).exercises[0].notes).toBe('agarre largo');
  });

  it('truncates to 200 characters (onboarding-fields convention)', () => {
    expect(complete(fresh(), { notes: 'x'.repeat(250) }).exercises[0].notes).toHaveLength(200);
  });

  it.each([undefined, null, '', '   \n '])('stores NO `notes` key for %j — the record shape is unchanged', (notes) => {
    const ex = complete(fresh(), { notes }).exercises[0];
    expect(ex).not.toHaveProperty('notes');
  });

  it('leaves the other exercises untouched', () => {
    const next = complete(fresh(), { notes: 'a' });
    expect(next.exercises[1]).not.toHaveProperty('notes');
  });

  it('does not mutate the previous session object', () => {
    const before = fresh();
    complete(before, { notes: 'a' });
    expect(before.exercises[0]).not.toHaveProperty('notes');
  });
});

describe('UNDO_EXERCISE keeps the note so a reopened card re-fills (ux-design S2 "restored")', () => {
  it('clears weight/difficulty/completedAt but NOT notes', () => {
    const undone = sessionReducer(complete(fresh(), { notes: 'agarre largo' }), { type: 'UNDO_EXERCISE', exerciseIndex: 0 });
    expect(undone.exercises[0]).toMatchObject({ weightUsed: null, difficulty: null, completedAt: null, notes: 'agarre largo' });
  });

  it('re-completing with an empty note CLEARS the previously stored one (the textarea is authoritative)', () => {
    const undone = sessionReducer(complete(fresh(), { notes: 'agarre largo' }), { type: 'UNDO_EXERCISE', exerciseIndex: 0 });
    const again = complete(undone, { notes: '' });
    expect(again.exercises[0].notes ?? null).toBeNull();
  });

  it('re-completing with a new note replaces it', () => {
    const undone = sessionReducer(complete(fresh(), { notes: 'viejo' }), { type: 'UNDO_EXERCISE', exerciseIndex: 0 });
    expect(complete(undone, { notes: 'nuevo' }).exercises[0].notes).toBe('nuevo');
  });
});
