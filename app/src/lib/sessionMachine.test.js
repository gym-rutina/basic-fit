import { describe, it, expect } from 'vitest';
import { createSession, sessionReducer } from './sessionMachine.js';

const DAY_EXERCISES = [
  { equipmentId: 'g3-s10', name: 'Prensa de Pecho' },
  { equipmentId: 'g3-s70', name: 'Prensa de Piernas' },
  { equipmentId: 'g3-s30', name: 'Jalón al Pecho' },
];
const NOW = '2026-07-13T10:00:00.000Z';

describe('createSession', () => {
  it('starts a new active session with every exercise pending', () => {
    const session = createSession('Lunes', 0, DAY_EXERCISES, NOW);
    expect(session.status).toBe('active');
    expect(session.dayLabel).toBe('Lunes');
    expect(session.dayIndex).toBe(0);
    expect(session.startedAt).toBe(NOW);
    expect(session.endedAt).toBeNull();
    expect(session.exercises).toHaveLength(3);
    expect(
      session.exercises.every(
        (e) => e.difficulty === null && e.weightUsed === null && e.completedAt === null
      )
    ).toBe(true);
    expect(session.id).toEqual(expect.any(String));
  });
});

describe('sessionReducer', () => {
  it('COMPLETE_EXERCISE logs weight/difficulty/timestamp for exactly one exercise by index', () => {
    const session = createSession('Lunes', 0, DAY_EXERCISES, NOW);
    const next = sessionReducer(session, {
      type: 'COMPLETE_EXERCISE',
      exerciseIndex: 2,
      equipmentId: 'g3-s30',
      name: 'Jalón al Pecho',
      weightUsed: 45,
      difficulty: 'normal',
      now: '2026-07-13T10:05:00.000Z',
    });
    expect(next.exercises[2]).toMatchObject({
      weightUsed: 45,
      difficulty: 'normal',
      completedAt: '2026-07-13T10:05:00.000Z',
    });
    // other exercises must be untouched
    expect(next.exercises[0].completedAt).toBeNull();
    expect(next.exercises[1].completedAt).toBeNull();
    // completing one exercise never auto-finishes the session
    expect(next.status).toBe('active');
  });

  it('COMPLETE_EXERCISE with duplicate equipmentIds only updates the targeted index', () => {
    const dupDay = [
      { equipmentId: 'g3-s70', name: 'Prensa A' },
      { equipmentId: 'g3-s70', name: 'Prensa B' },
    ];
    let session = createSession('Lunes', 0, dupDay, NOW);
    session = sessionReducer(session, {
      type: 'COMPLETE_EXERCISE',
      exerciseIndex: 0,
      equipmentId: 'g3-s70',
      name: 'Prensa A',
      weightUsed: 40,
      difficulty: 'easy',
      now: NOW,
    });
    expect(session.exercises[0].completedAt).toBe(NOW);
    expect(session.exercises[1].completedAt).toBeNull();
  });

  it('COMPLETE_EXERCISE can extend a short session when the rutina grew after start', () => {
    const session = createSession('Lunes', 0, [DAY_EXERCISES[0]], NOW);
    const next = sessionReducer(session, {
      type: 'COMPLETE_EXERCISE',
      exerciseIndex: 1,
      equipmentId: 'g3-s70',
      name: 'Prensa de Piernas',
      weightUsed: 80,
      difficulty: 'normal',
      now: '2026-07-13T10:05:00.000Z',
    });
    expect(next.exercises).toHaveLength(2);
    expect(next.exercises[1]).toMatchObject({
      equipmentId: 'g3-s70',
      name: 'Prensa de Piernas',
      weightUsed: 80,
      difficulty: 'normal',
      completedAt: '2026-07-13T10:05:00.000Z',
    });
    expect(next.exercises[0].completedAt).toBeNull();
  });

  it('UNDO_EXERCISE clears a logged exercise back to pending for correction', () => {
    let session = createSession('Lunes', 0, DAY_EXERCISES, NOW);
    session = sessionReducer(session, {
      type: 'COMPLETE_EXERCISE',
      exerciseIndex: 0,
      equipmentId: 'g3-s10',
      name: 'Prensa de Pecho',
      weightUsed: 32,
      difficulty: 'hard',
      now: NOW,
    });
    session = sessionReducer(session, { type: 'UNDO_EXERCISE', exerciseIndex: 0 });
    expect(session.exercises[0]).toMatchObject({ weightUsed: null, difficulty: null, completedAt: null });
  });

  it('FINISH marks the session completed even with exercises still pending (user ends early)', () => {
    const session = createSession('Lunes', 0, DAY_EXERCISES, NOW);
    const next = sessionReducer(session, { type: 'FINISH', now: '2026-07-13T10:20:00.000Z' });
    expect(next.status).toBe('completed');
    expect(next.endedAt).toBe('2026-07-13T10:20:00.000Z');
  });

  it('ABANDON marks the session abandoned, distinct from completed', () => {
    const session = createSession('Lunes', 0, DAY_EXERCISES, NOW);
    const next = sessionReducer(session, { type: 'ABANDON', now: '2026-07-13T10:07:00.000Z' });
    expect(next.status).toBe('abandoned');
    expect(next.endedAt).toBe('2026-07-13T10:07:00.000Z');
  });

  it('never mutates the session object passed in (pure function)', () => {
    const session = createSession('Lunes', 0, DAY_EXERCISES, NOW);
    const snapshot = JSON.parse(JSON.stringify(session));
    sessionReducer(session, {
      type: 'COMPLETE_EXERCISE',
      exerciseIndex: 0,
      equipmentId: 'g3-s10',
      name: 'Prensa de Pecho',
      weightUsed: 32,
      difficulty: 'easy',
      now: NOW,
    });
    expect(session).toEqual(snapshot);
  });

  it('RESUME round-trips a persisted session unchanged', () => {
    const session = createSession('Lunes', 0, DAY_EXERCISES, NOW);
    const resumed = sessionReducer(null, { type: 'RESUME', session });
    expect(resumed).toEqual(session);
  });
});

/**
 * multi-rutina-library D-C — createSession stamps immutable attribution
 * (rutinaId + display snapshot) AND a planned sets/reps snapshot per exercise
 * (the C2 root-cause fix: progress no longer needs the active rutina to know
 * a historical session's planned volume). RED until the 5th param lands.
 */
describe('createSession — attribution + planned-volume snapshot (multi-rutina-library)', () => {
  const DAY = [{
    equipmentId: 'g3-s10',
    name: 'Prensa',
    sets: 4,
    reps: 8,
  }];

  it('stamps rutinaId and the display snapshot from the attribution param', () => {
    const s = createSession('Día A', 0, DAY, '2026-03-01T09:00:00.000Z', {
      rutinaId: 'r-1',
      rutinaName: 'Hipertrofia',
      phaseName: 'Fuerza',
      phaseNumber: 2,
    });

    expect(s.rutinaId).toBe('r-1');
    expect(s.rutinaName).toBe('Hipertrofia');
    expect(s.phaseName).toBe('Fuerza');
    expect(s.phaseNumber).toBe(2);
  });

  it('snapshots planned sets/reps onto each logged exercise', () => {
    const s = createSession('Día A', 0, DAY, '2026-03-01T09:00:00.000Z', { rutinaId: 'r-1' });
    expect(s.exercises[0]).toMatchObject({ sets: 4, reps: 8 });
  });

  it('works without the attribution param (legacy call shape keeps compiling)', () => {
    const s = createSession('Día A', 0, DAY, '2026-03-01T09:00:00.000Z');
    expect(s.rutinaId).toBeUndefined();
    expect(s.exercises[0].sets).toBe(4);
  });
});
