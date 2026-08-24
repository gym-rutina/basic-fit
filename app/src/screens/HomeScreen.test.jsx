import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HomeScreen } from './HomeScreen.jsx';
import * as db from '../lib/db.js';

vi.mock('../lib/db.js');

/**
 * session-discard-and-history-delete — spec.md § C (AC10–AC13) and AC25.
 *
 * The reported bug: Inicio's first paint always offered "Empezar
 * entrenamiento" because `activeSession` started as null and was only filled
 * by an async IndexedDB read (HomeScreen.jsx:14,22). Tapping during that
 * window created a SECOND active session (HomeScreen.jsx:54-64).
 *
 * The fix moves active-session ownership up to the shell (tech-plan.md
 * Decision 3), so HomeScreen now receives it as props and can no longer paint
 * a start CTA before the answer is known:
 *
 *   activeSessionStatus  'loading' | 'ready' | 'error'
 *   activeSession        Session | null
 *   onRetryActiveSession () => void
 */

// Labels deliberately do NOT match Spanish weekday names, so resolveTodayDay()
// falls through to its completedIndexes branch — which is what AC25 exercises.
const RUTINA = {
  schemaVersion: 1,
  program: { name: 'Fuerza', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  days: [
    { label: 'Día 1', intro: 'Pecho y tríceps', exercises: [{ equipmentId: 'g3-s10', name: 'Prensa' }] },
    { label: 'Día 2', intro: 'Espalda', exercises: [{ equipmentId: 'g3-s20', name: 'Remo' }] },
    { label: 'Día 3', intro: 'Pierna', exercises: [{ equipmentId: 'g3-s30', name: 'Sentadilla' }] },
  ],
};

const ACTIVE_SESSION = {
  id: 'sess-active',
  dayLabel: 'Día 1',
  dayIndex: 0,
  status: 'active',
  startedAt: '2026-08-03T09:00:00.000Z',
  endedAt: null,
  exercises: [
    { equipmentId: 'g3-s10', name: 'Prensa', weightUsed: 40, difficulty: 'normal', completedAt: '2026-08-03T09:10:00.000Z' },
    { equipmentId: 'g3-s20', name: 'Remo', weightUsed: null, difficulty: null, completedAt: null },
    { equipmentId: 'g3-s30', name: 'Sentadilla', weightUsed: null, difficulty: null, completedAt: null },
  ],
};

function renderHome(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <HomeScreen
              rutina={RUTINA}
              loadError={false}
              onGoImport={vi.fn()}
              activeSessionStatus="ready"
              activeSession={null}
              onRetryActiveSession={vi.fn()}
              {...props}
            />
          }
        />
        <Route path="/session" element={<div>SESSION SCREEN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  db.listSessions.mockResolvedValue([]);
  db.getActiveSession.mockResolvedValue(null);
  db.saveSession.mockResolvedValue(undefined);
});

describe('HomeScreen — active session accuracy (AC10–AC13)', () => {
  it('renders no start CTA while the active-session lookup is in flight (AC10)', () => {
    renderHome({ activeSessionStatus: 'loading', activeSession: null });

    // No paint, at any point in the load, may offer "start".
    expect(screen.queryByText(/empezar entrenamiento/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reanudar entrenamiento/i)).not.toBeInTheDocument();
  });

  it('marks the loading card as busy without fake text (AC10)', () => {
    const { container } = renderHome({ activeSessionStatus: 'loading', activeSession: null });
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('describes the active session, not resolveTodayDay (AC12)', async () => {
    // resolveTodayDay() would propose "Día 1" here too, so the fixture makes
    // the active session a DIFFERENT day to prove where the label comes from.
    const onDay2 = { ...ACTIVE_SESSION, dayLabel: 'Día 2', dayIndex: 1 };
    renderHome({ activeSession: onDay2 });

    expect(await screen.findByText('Día 2')).toBeInTheDocument();
    expect(screen.getByText(/reanudar entrenamiento/i)).toBeInTheDocument();
    expect(screen.queryByText(/empezar entrenamiento/i)).not.toBeInTheDocument();
  });

  it('shows the active session progress as X / Y completados (AC12)', async () => {
    renderHome({ activeSession: ACTIVE_SESSION });
    expect(await screen.findByText(/1\s*\/\s*3 completados/i)).toBeInTheDocument();
  });

  it('resuming navigates to /session (AC12)', async () => {
    const user = userEvent.setup();
    renderHome({ activeSession: ACTIVE_SESSION });

    await user.click(await screen.findByRole('button', { name: /reanudar entrenamiento/i }));

    expect(await screen.findByText('SESSION SCREEN')).toBeInTheDocument();
    expect(db.saveSession).not.toHaveBeenCalled();
  });

  it('re-checks for an active session before creating one (AC11)', async () => {
    // The render-level guard is racy on its own: props can still say "no
    // active session" at the moment of the tap. This is the data-integrity
    // backstop — the start path must re-read and resume instead of creating.
    db.getActiveSession.mockResolvedValue(ACTIVE_SESSION);
    const user = userEvent.setup();
    renderHome({ activeSessionStatus: 'ready', activeSession: null });

    await user.click(await screen.findByRole('button', { name: /empezar entrenamiento/i }));

    await waitFor(() => expect(screen.getByText('SESSION SCREEN')).toBeInTheDocument());
    expect(db.saveSession).not.toHaveBeenCalled();
  });

  it('creates exactly one session when none is active (AC11)', async () => {
    const user = userEvent.setup();
    renderHome({ activeSessionStatus: 'ready', activeSession: null });

    await user.click(await screen.findByRole('button', { name: /empezar entrenamiento/i }));

    await waitFor(() => expect(db.saveSession).toHaveBeenCalledTimes(1));
    expect(db.saveSession.mock.calls[0][0]).toMatchObject({ status: 'active' });
  });

  it('surfaces a failed active-session read instead of showing start (AC13)', () => {
    renderHome({ activeSessionStatus: 'error', activeSession: null });

    expect(screen.getByText(/no se pudo comprobar si tienes un entrenamiento en curso/i)).toBeInTheDocument();
    expect(screen.queryByText(/empezar entrenamiento/i)).not.toBeInTheDocument();
  });

  it('offers a retry that re-runs the active-session read (AC13)', async () => {
    const onRetryActiveSession = vi.fn();
    const user = userEvent.setup();
    renderHome({ activeSessionStatus: 'error', activeSession: null, onRetryActiveSession });

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(onRetryActiveSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the corrupt-rutina full-screen error as it is today (AC24)', () => {
    renderHome({ loadError: true });
    expect(screen.getByText(/no se pudo leer tu rutina guardada/i)).toBeInTheDocument();
  });
});

describe('HomeScreen — day proposal after deletion (AC25)', () => {
  it('recomputes the proposed day from the surviving sessions (AC25)', async () => {
    // Day 1 completed → Inicio proposes Día 2.
    db.listSessions.mockResolvedValue([
      {
        id: 'a',
        dayLabel: 'Día 1',
        dayIndex: 0,
        status: 'completed',
        startedAt: '2026-08-01T09:00:00.000Z',
        endedAt: '2026-08-01T10:00:00.000Z',
        exercises: [],
      },
    ]);
    renderHome();

    expect(await screen.findByText('Día 2')).toBeInTheDocument();
  });

  it('falls back to the earliest uncompleted day once its session is deleted (AC25)', async () => {
    // Same screen, but the Día 1 session no longer exists — the proposal must
    // move back to Día 1. This is intended behaviour, not a defect, but it
    // must be a CORRECT recomputation rather than a stale one.
    db.listSessions.mockResolvedValue([]);
    renderHome();

    expect(await screen.findByText('Día 1')).toBeInTheDocument();
  });
});

/**
 * home-next-workout-and-picker — spec.md § A–C, ux-design.md D1–D8.
 *
 * The reported bug: after one full cycle through the program, Inicio kept
 * proposing Día 1 forever (today.js's "first day never completed" fallback).
 * The fix: rotation from the most recently COMPLETED session, plus an inline
 * day-picker disclosure and a 2-card recent-sessions list.
 *
 * Status notes per test group:
 * - Rotation tests asserting FINAL behaviour are RED until Cmok swaps in
 *   nextDay.js (the weekday-matching "Hoy" path still exists today, and the
 *   fallback math differs). The AC25 block above keeps passing throughout.
 * - Picker / recent-list tests assert the UAT-approved mockup copy ("Elegir
 *   otro día", "Últimas sesiones") — RED until Cmok lands component + i18n
 *   keys together (t() falls back to the key string, so half-landed states
 *   fail at the right assertion, not with undefined renders).
 */

const TWO_RECENT = [
  {
    id: 'sess-b',
    dayLabel: 'Full B',
    dayIndex: 1,
    status: 'completed',
    startedAt: '2026-08-20T09:00:00.000Z',
    endedAt: '2026-08-20T10:00:00.000Z',
    exercises: [
      { equipmentId: 'g3-s20', name: 'Remo', weightUsed: 30, difficulty: 'normal', completedAt: '2026-08-20T09:30:00.000Z' },
      { equipmentId: 'g3-s30', name: 'Sentadilla', weightUsed: null, difficulty: null, completedAt: null },
    ],
  },
  {
    id: 'sess-a',
    dayLabel: 'Full A',
    dayIndex: 0,
    status: 'abandoned',
    startedAt: '2026-08-18T09:00:00.000Z',
    endedAt: '2026-08-18T09:20:00.000Z',
    exercises: [
      { equipmentId: 'g3-s10', name: 'Prensa', weightUsed: null, difficulty: null, completedAt: null },
      { equipmentId: 'g3-s20', name: 'Remo', weightUsed: null, difficulty: null, completedAt: null },
    ],
  },
];

describe('HomeScreen — next-day rotation (home-next-workout-and-picker §A)', () => {
  it('proposes Día 3 right after Día 2 completes, mid-program (AC1)', async () => {
    db.listSessions.mockResolvedValue([
      { id: 'x', dayLabel: 'Día 2', dayIndex: 1, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
      { id: 'y', dayLabel: 'Día 1', dayIndex: 0, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
    ]);
    renderHome();

    expect(await screen.findByText('Día 3')).toBeInTheDocument();
  });

  it('wraps to Día 1 after completing the last day — on the Nth pass too (AC5)', async () => {
    db.listSessions.mockResolvedValue([
      { id: 'c', dayLabel: 'Día 3', dayIndex: 2, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
      { id: 'b', dayLabel: 'Día 2', dayIndex: 1, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
      { id: 'a', dayLabel: 'Día 1', dayIndex: 0, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
    ]);
    renderHome();

    // The proposal card shows Día 1 as NEXT, not as a calendar-"today" claim.
    const heading = await screen.findByText('Día 1');
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/próximo/i)).toBeInTheDocument();
  });

  it('re-proposes an abandoned day instead of advancing past it (AC6)', async () => {
    // Discriminating fixture: one full cycle exists (every index completed at
    // some point), THEN the user started Día 2 and abandoned it. Old
    // "first-never-completed" semantics collapse to Día 1 here; rotation must
    // continue FROM the last completion (Día 1) → propose Día 2 again.
    // The abandoned session's label is deliberately unique ("Full Z") so the
    // assertion cannot collide with the last-session card below the proposal.
    db.listSessions.mockResolvedValue([
      { id: 'z', dayLabel: 'Full Z', dayIndex: 1, status: 'abandoned', startedAt: '', endedAt: '', exercises: [] },
      { id: 'y', dayLabel: 'Día 1', dayIndex: 0, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
      { id: 'x', dayLabel: 'Día 3', dayIndex: 2, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
      { id: 'w', dayLabel: 'Día 2', dayIndex: 1, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
      { id: 'v', dayLabel: 'Día 1', dayIndex: 0, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
    ]);
    renderHome();

    const proposal = await screen.findByText('Día 2');
    expect(proposal).toBeInTheDocument();
    // No negative "Día 1" assertion here on purpose: post-build, this
    // fixture's completed 'Día 1' sessions legitimately render in the
    // recent-sessions list below the proposal card (Bagnik gate A2).
  });

  it('never claims "Hoy" — weekday-named days are proposed by rotation alone (AC3, AC4)', async () => {
    // Pin the clock to a WEDNESDAY so this discriminates on every run date,
    // not just when CI happens to land midweek: the OLD resolver matched the
    // 'Miércoles' label against the real weekday and showed the eyebrow
    // "Hoy"; the new contract shows "Próximo" no matter what the calendar says.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.setSystemTime(new Date('2026-07-15T09:00:00')); // a Wednesday
      const weekdayRutina = {
        ...RUTINA,
        days: [{ label: 'Miércoles', intro: 'Empuje', exercises: [{ equipmentId: 'g3-s10', name: 'Prensa' }] }],
      };
      db.listSessions.mockResolvedValue([]);
      renderHome({ rutina: weekdayRutina });

      await waitFor(() => expect(screen.getByText('Miércoles')).toBeInTheDocument());
      expect(screen.queryByText(/^hoy$/i)).not.toBeInTheDocument();
      expect(screen.getByText(/próximo/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('HomeScreen — day picker (home-next-workout-and-picker §B)', () => {
  it('renders the collapsed toggle below the start CTA when there are ≥2 days (AC8)', async () => {
    renderHome();

    const toggle = await screen.findByRole('button', { name: /elegir otro día/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides the toggle for a single-day rutina (AC8 amendment, UAT-approved)', async () => {
    const singleDay = {
      ...RUTINA,
      days: [{ label: 'Full Body', intro: 'Todo', exercises: [{ equipmentId: 'g3-s10', name: 'Prensa' }] }],
    };
    renderHome({ rutina: singleDay });

    expect(await screen.findByText('Full Body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /elegir otro día/i })).not.toBeInTheDocument();
  });

  it('does not render the picker while the active-session read is in flight or failed (AC13)', () => {
    const loading = renderHome({ activeSessionStatus: 'loading' });
    expect(screen.queryByRole('button', { name: /elegir otro día/i })).not.toBeInTheDocument();
    loading.unmount();

    // The error branch gets its own mount — a picker leaking into either
    // pre-ready state must fail one of these two assertions.
    renderHome({ activeSessionStatus: 'error' });
    expect(screen.queryByRole('button', { name: /elegir otro día/i })).not.toBeInTheDocument();
  });

  it('expands into all program days in order with exercise counts, and collapses on a second tap (AC9)', async () => {
    const user = userEvent.setup();
    renderHome();

    const toggle = () => screen.getByRole('button', { name: /elegir otro día/i });
    await user.click(await screen.findByRole('button', { name: /elegir otro día/i }));

    // Row accessible names must carry the count copy (es '{n} ej.'; each
    // RUTINA fixture day has exactly 1 exercise) — a row built without
    // t('program.exerciseAbbrev') fails these regexes.
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /día 1 — pecho y tríceps\s*1 ej\./i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /día 2 — espalda\s*1 ej\./i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /día 3 — pierna\s*1 ej\./i })).toBeInTheDocument();

    // Second tap collapses: aria-expanded flips back and the rows unmount —
    // a latch-open toggle cannot satisfy this pair.
    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /día 1 — pecho y tríceps/i })).not.toBeInTheDocument();
  });

  it('marks exactly the auto-proposed row as Próximo inside the list (AC12)', async () => {
    db.listSessions.mockResolvedValue([
      { id: 'x', dayLabel: 'Día 2', dayIndex: 1, status: 'completed', startedAt: '', endedAt: '', exercises: [] },
    ]);
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: /elegir otro día/i }));

    // Proposal = Día 3 → only that row's accessible name carries ", Próximo".
    expect(screen.getByRole('button', { name: /día 3.*próximo/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /día 1.*próximo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /día 2.*próximo/i })).not.toBeInTheDocument();
  });

  it('starts a session for the PICKED day immediately (AC10)', async () => {
    // Empty history → the auto-proposal is Día 1 (bootstrap index 0), so the
    // Día-1 row cannot discriminate parameterization — clicking it would look
    // identical to handleStart(proposedIndex). Clicking DÍA 3 proves the row
    // passes ITS OWN index through: dayIndex 2, not the proposed 0.
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: /elegir otro día/i }));
    await user.click(screen.getByRole('button', { name: /^día 3/i }));

    await waitFor(() => expect(db.saveSession).toHaveBeenCalledTimes(1));
    expect(db.saveSession.mock.calls[0][0]).toMatchObject({ status: 'active', dayIndex: 2, dayLabel: 'Día 3' });
    expect(await screen.findByText('SESSION SCREEN')).toBeInTheDocument();
  });

  it('re-checks for an active session before creating from the picker (AC10, AC11 backstop)', async () => {
    db.getActiveSession.mockResolvedValue(ACTIVE_SESSION);
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: /elegir otro día/i }));
    await user.click(screen.getByRole('button', { name: /^día 3/i }));

    await waitFor(() => expect(screen.getByText('SESSION SCREEN')).toBeInTheDocument());
    expect(db.saveSession).not.toHaveBeenCalled();
  });

  it('disables every picker row while a start is in flight (AC14)', async () => {
    db.saveSession.mockImplementation(() => new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: /elegir otro día/i }));
    await user.click(screen.getByRole('button', { name: /^día 1/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^día 2/i })).toBeDisabled());
    expect(screen.getByRole('button', { name: /^día 1/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^día 3/i })).toBeDisabled();
  });
});

describe('HomeScreen — recent sessions list (home-next-workout-and-picker §C)', () => {
  it('shows up to the 2 newest non-active sessions under a plural heading (AC15, AC17)', async () => {
    db.listSessions.mockResolvedValue(TWO_RECENT);
    renderHome();

    expect(await screen.findByText(/últimas sesiones/i)).toBeInTheDocument();
    expect(screen.getByText('Full B')).toBeInTheDocument();
    expect(screen.getByText('Full A')).toBeInTheDocument();
  });

  it('excludes the active session from the recent list (AC15)', async () => {
    db.listSessions.mockResolvedValue([
      ...TWO_RECENT,
      { id: 'live', dayLabel: 'Full Live', dayIndex: 2, status: 'active', startedAt: '', endedAt: null, exercises: [] },
    ]);
    renderHome();

    await screen.findByText(/últimas sesiones/i);
    expect(screen.queryByText('Full Live')).not.toBeInTheDocument();
  });

  it('renders nothing when history is empty (AC15 zero case)', async () => {
    db.listSessions.mockResolvedValue([]);
    renderHome();

    await screen.findByRole('button', { name: /empezar entrenamiento/i });
    expect(screen.queryByText(/últimas sesiones|última sesión/i)).not.toBeInTheDocument();
  });

  it('keeps the abandoned suffix on non-completed cards (AC16, existing semantics)', async () => {
    db.listSessions.mockResolvedValue([TWO_RECENT[1]]);
    renderHome();

    expect(await screen.findByText(/sin terminar/i)).toBeInTheDocument();
  });
});

