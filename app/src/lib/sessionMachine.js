/**
 * Session lifecycle: pure reducer, no I/O. lib/db.js persists whatever this
 * returns; the caller (screens/ActiveSessionScreen.jsx via App.jsx) owns the
 * "at most one active session" business rule (tech-plan.md) — this module
 * has no opinion on that, it only executes the action it's given.
 *
 * Actions: START is not a reducer action — starting a session means calling
 * createSession() directly (it returns a full new session object) and
 * persisting it; the reducer only handles transitions on an existing session:
 * COMPLETE_EXERCISE, UNDO_EXERCISE, FINISH, ABANDON, RESUME.
 *
 * Exercise identity inside a session is the **index** in that day's exercise
 * list (parallel to rutina.days[dayIndex].exercises). Matching by equipmentId
 * alone is wrong when a day repeats a machine or when the active rutina grew
 * after the session was created — both caused "Marcar completado" to no-op
 * or crash on the second+ card.
 */

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without the Web Crypto API (older Node in CI).
  // Not cryptographically random — fine for a local, non-security-sensitive
  // client-side record id.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Starts a new active session for a day. `exercises` is that day's
 * exercises (rutina.days[dayIndex].exercises).
 *
 * multi-rutina-library D-C — two things are now SNAPSHOTTED at creation:
 *
 * 1. `attribution` (optional 5th param): { rutinaId, rutinaName, phaseName,
 *    phaseNumber } stamped top-level on the session. AC12: the rutinaId never
 *    changes afterwards — activating or deleting library entries never
 *    touches it; Historial resolves deleted origins from the denormalised
 *    display fields (OQ-6). Legacy call sites without the param still work —
 *    the fields simply stay undefined (the v3→v4 migration backfilled all
 *    pre-feature rows, so undefined can only mean "created by a caller that
 *    chose not to attribute").
 * 2. Per-exercise planned volume: `sets`/`reps` are copied onto each tracking
 *    record UNCONDITIONALLY (even when attribution is absent). This is the C2
 *    root-cause fix: buildSessionVolumes previously had to join against the
 *    ACTIVE rutina to know a historical session's sets×reps, which zeroed out
 *    every cross-rutina bar. rest/technique stay join-at-render — only the
 *    numbers progress charts need travel with the record.
 */
export function createSession(dayLabel, dayIndex, exercises, now, attribution) {
  const a = attribution || {};
  return {
    id: generateId(),
    dayLabel,
    dayIndex,
    status: 'active',
    startedAt: now,
    endedAt: null,
    rutinaId: a.rutinaId,
    rutinaName: a.rutinaName,
    phaseName: a.phaseName,
    phaseNumber: a.phaseNumber,
    exercises: exercises.map((ex) => ({
      equipmentId: ex.equipmentId,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weightUsed: null,
      difficulty: null,
      completedAt: null,
    })),
  };
}

/** club-equipment-reporting D11 — a note is kept only when non-empty after trim. */
export const MAX_NOTES_LENGTH = 200;

function normalizeNotes(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, MAX_NOTES_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

function patchExerciseAt(session, exerciseIndex, patch, identity) {
  if (exerciseIndex < 0) return session;
  const exercises = session.exercises.slice();
  while (exercises.length <= exerciseIndex) {
    exercises.push({
      equipmentId: null,
      name: null,
      weightUsed: null,
      difficulty: null,
      completedAt: null,
    });
  }
  const prev = exercises[exerciseIndex] || {};
  exercises[exerciseIndex] = {
    ...prev,
    equipmentId: identity?.equipmentId ?? prev.equipmentId,
    name: identity?.name ?? prev.name,
    ...patch,
  };
  return { ...session, exercises };
}

export function sessionReducer(session, action) {
  switch (action.type) {
    case 'RESUME':
      // Hydrate from a persisted record — round-trips unchanged.
      return action.session;

    case 'COMPLETE_EXERCISE': {
      const next = patchExerciseAt(
        session,
        action.exerciseIndex,
        {
          weightUsed: action.weightUsed,
          difficulty: action.difficulty,
          completedAt: action.now,
        },
        { equipmentId: action.equipmentId, name: action.name }
      );
      // club-equipment-reporting AC16/D11: the textarea is authoritative on
      // completion — a real note is stored, an empty one REMOVES any note kept
      // from an undone earlier completion, and the key never exists otherwise
      // (so every existing record shape stays byte-identical). patchExerciseAt
      // hands back a fresh exercise object, so this never mutates the input.
      const done = next !== session ? next.exercises[action.exerciseIndex] : null;
      if (done) {
        const notes = normalizeNotes(action.notes);
        if (notes) done.notes = notes;
        else delete done.notes;
      }
      return next;
    }

    case 'UNDO_EXERCISE':
      // `notes` is deliberately NOT cleared: reopening the card re-fills the
      // textarea, exactly like weight and difficulty (ux-design S2 "restored").
      return patchExerciseAt(session, action.exerciseIndex, {
        weightUsed: null,
        difficulty: null,
        completedAt: null,
      });

    case 'FINISH':
      // Allowed with exercises still pending — "user ends early" (spec.md).
      return { ...session, status: 'completed', endedAt: action.now };

    case 'ABANDON':
      return { ...session, status: 'abandoned', endedAt: action.now };

    default:
      return session;
  }
}
