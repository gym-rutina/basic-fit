import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgressScreen } from './ProgressScreen.jsx';
import * as db from '../lib/db.js';

vi.mock('../lib/db.js');

const RUTINA = {
  schemaVersion: 1,
  program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  days: [
    {
      label: 'Lunes',
      exercises: [
        { equipmentId: 'g3-s10', name: 'Prensa de Pecho', sets: 3, reps: 10, restSeconds: 75 },
        { equipmentId: 'g3-s20', name: 'Jalón al Pecho', sets: 4, reps: 8, restSeconds: 75 },
      ],
    },
  ],
};

const PAST_SESSIONS = [
  {
    id: 's1',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'completed',
    startedAt: '2026-07-06T09:00:00.000Z',
    endedAt: '2026-07-06T09:50:00.000Z',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 30,
        difficulty: 'normal',
        completedAt: '2026-07-06T09:10:00.000Z',
      },
      {
        equipmentId: 'g3-s20',
        name: 'Jalón al Pecho',
        weightUsed: 40,
        difficulty: 'hard',
        completedAt: '2026-07-06T09:20:00.000Z',
      },
    ],
  },
  {
    id: 's2',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'completed',
    startedAt: '2026-07-20T09:00:00.000Z',
    endedAt: '2026-07-20T09:45:00.000Z',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 35,
        difficulty: 'normal',
        completedAt: '2026-07-20T09:10:00.000Z',
      },
    ],
  },
];

function renderProgress() {
  return render(
    <MemoryRouter initialEntries={['/progress']}>
      <Routes>
        <Route path="/progress" element={<ProgressScreen rutina={RUTINA} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProgressScreen', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders nothing while sessions are loading', () => {
    let resolve;
    db.listSessions.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = renderProgress();
    expect(container.firstChild).toBeNull();
    resolve([]);
  });

  it('shows the full-page empty state when there are no past sessions (AC5)', async () => {
    db.listSessions.mockResolvedValue([]);
    renderProgress();
    expect(await screen.findByRole('heading', { name: /Aún no hay progreso que mostrar/i })).toBeInTheDocument();
    expect(screen.getByText(/Completa tu primer entrenamiento/i)).toBeInTheDocument();
  });

  it('renders the three chart sections and exercise picker on success (AC1–AC4)', async () => {
    db.listSessions.mockResolvedValue(PAST_SESSIONS);
    renderProgress();

    expect(await screen.findByRole('heading', { name: /^Progreso$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Por ejercicio/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Volumen/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Frecuencia/i })).toBeInTheDocument();

    // pill-overflow-ux S4 surgery: the aria-pressed pair this test used to
    // pin belonged to the pill row. The trigger now shows the ACTIVE
    // exercise, and while the sheet is closed no other exercise is offered.
    const trigger = await screen.findByRole('button', { name: /Prensa de Pecho/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Jalón al Pecho/i })).not.toBeInTheDocument();

    // Distinct from History — no Historial chrome.
    expect(screen.queryByRole('heading', { name: /^Historial$/i })).toBeNull();
  });

  it('switching the selected exercise through the sheet updates the chart (AC2)', async () => {
    const user = userEvent.setup();
    db.listSessions.mockResolvedValue(PAST_SESSIONS);
    renderProgress();

    await screen.findByRole('button', { name: /Prensa de Pecho/i });
    // Prensa has two logged points (30/35 kg → a polyline); Jalón one (a
    // single circle + label). The chart's own text is the observable that
    // selection actually moved — the invariant this test has always carried.
    expect(screen.getByText('35 kg')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Prensa de Pecho/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Jalón al Pecho/i }));

    // Sheet closed after picking; trigger and chart both follow the new key.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jalón al Pecho/i })).toBeInTheDocument();
    expect(await screen.findByText('40 kg')).toBeInTheDocument();
    expect(screen.queryByText('30 kg')).not.toBeInTheDocument();
  });
});

/**
 * exercise-level-tracking (spec.md AC10; ux-design.md S5) — pill-overflow-ux
 * S4 surgery: the three surviving invariants of this suite now flow through
 * the picker sheet. The picker selects by exercise KEY, so two exercises on
 * one machine are two sheet rows; where two exercises share a NAME (different
 * machines), ProgressScreen pre-disambiguates their labels with collisionSuffix.
 *
 * The old pill-era "disambiguates two same-named exercises" it was REPLACED
 * by the appended sheet-side test 'shows BOTH same-named machines
 * simultaneously, distinguishable' below (tech-plan §4 step 7) — none of the
 * contract orphaned.
 */
const TWO_ON_ONE_MACHINE = [
  {
    id: 's1',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'completed',
    startedAt: '2026-07-06T09:00:00.000Z',
    endedAt: '2026-07-06T09:50:00.000Z',
    exercises: [
      {
        equipmentId: 'g3-s10',
        name: 'Prensa de Pecho',
        weightUsed: 32,
        difficulty: 'normal',
        completedAt: '2026-07-06T09:10:00.000Z',
      },
      {
        equipmentId: 'g3-s10',
        name: 'Press de Hombro',
        weightUsed: 24,
        difficulty: 'hard',
        completedAt: '2026-07-06T09:20:00.000Z',
      },
    ],
  },
];

describe('ProgressScreen — exercise-level picker through the sheet (AC10 lineage)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists both exercises on the same machine as separate sheet rows', async () => {
    const user = userEvent.setup();
    db.listSessions.mockResolvedValue(TWO_ON_ONE_MACHINE);
    renderProgress();

    await user.click(await screen.findByRole('button', { name: /Prensa de Pecho/i }));
    const dialog = await screen.findByRole('dialog');

    const rows = within(dialog).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // Alphabetical, and each exercise its own row — the shared MACHINE does
    // not merge them into one entry.
    expect(rows.map((r) => r.textContent.trim())).toEqual(['Prensa de Pecho', 'Press de Hombro']);
  });

  it('selects each exercise independently, not the machine they share', async () => {
    const user = userEvent.setup();
    db.listSessions.mockResolvedValue(TWO_ON_ONE_MACHINE);
    renderProgress();

    // Default selection is the first exercise; switch to the second via its
    // sheet row…
    await user.click(await screen.findByRole('button', { name: /Prensa de Pecho/i }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Press de Hombro/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Press de Hombro/i })).toBeInTheDocument();

    // …and back to the first — selection follows the exercise key, so the
    // shared machine never conflates the two.
    await user.click(screen.getByRole('button', { name: /Press de Hombro/i }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Prensa de Pecho/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Prensa de Pecho/i })).toBeInTheDocument();
  });

  it('leaves labels unsuffixed when there is no name collision', async () => {
    const user = userEvent.setup();
    db.listSessions.mockResolvedValue(TWO_ON_ONE_MACHINE);
    renderProgress();

    const trigger = await screen.findByRole('button', { name: /Prensa de Pecho/i });
    expect(trigger.textContent.trim()).toBe('Prensa de Pecho');

    // The sheet row carries the same clean label — suffixes exist ONLY to
    // separate same-named rows.
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    const row = within(dialog).getAllByRole('listitem').map((r) => r.textContent.trim());
    expect(row).toContain('Prensa de Pecho');
    expect(row).toContain('Press de Hombro');
  });
});

/**
 * pill-overflow-ux — S4: the unbounded exercise-pill row becomes a trigger
 * button + searchable ExercisePickerSheet (tech-plan D-D). Data layer
 * (listLoggedExercises/collisionSuffix/selectedId) untouched; only the
 * presentation is replaced. RED until Cmok lands the sheet + trigger.
 *
 * Fixture: TWO machines share the name "Prensa de Pecho" (g3-s10 / g3-s20),
 * so every label must carry collision disambiguation (AC10). The suffix's
 * exact format belongs to shipped machineLabel.js — assertions prove a
 * suffix EXISTS and that the two rows are distinguishable, without pinning
 * its wording.
 */
const COLLIDING_SESSIONS = [
  {
    id: 'c1',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'completed',
    startedAt: '2026-08-01T09:00:00.000Z',
    endedAt: '2026-08-01T10:00:00.000Z',
    exercises: [
      { equipmentId: 'g3-s10', name: 'Prensa de Pecho', weightUsed: 30, difficulty: 'normal', completedAt: '2026-08-01T09:10:00.000Z' },
      { equipmentId: 'g3-s20', name: 'Prensa de Pecho', weightUsed: 32, difficulty: 'normal', completedAt: '2026-08-01T09:20:00.000Z' },
      { equipmentId: 'g3-s30', name: 'Jalón al Pecho', weightUsed: 40, difficulty: 'hard', completedAt: '2026-08-01T09:30:00.000Z' },
    ],
  },
];

describe('ProgressScreen — exercise picker sheet (pill-overflow-ux S4)', () => {
  beforeEach(() => {
    db.listSessions.mockResolvedValue(COLLIDING_SESSIONS);
  });

  it('replaces the pill row with a trigger showing the active exercise incl. collision disambiguation (AC10)', async () => {
    renderProgress();

    const trigger = await screen.findByRole('button', { name: /prensa de pecho/i });
    // A bare name would be ambiguous across the two machines — some suffix
    // must ride along (exact wording owned by machineLabel.js).
    expect(trigger.textContent.trim()).not.toBe('Prensa de Pecho');
    expect(screen.queryByRole('button', { name: /^jalón al pecho$/i })).not.toBeInTheDocument();
  });

  it('opens a dialog sheet listing all logged exercises alphabetically (AC11, AC14)', async () => {
    const user = userEvent.setup();
    renderProgress();

    await user.click(await screen.findByRole('button', { name: /prensa de pecho/i }));

    const dialog = await screen.findByRole('dialog');
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThanOrEqual(2); // both Prensa machines + Jalón
    const labels = rows.map((r) => r.textContent.toLowerCase());
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, 'es'));
    expect(labels).toEqual(sorted);
  });

  it('shows BOTH same-named machines simultaneously, distinguishable (replaces the dying pill-era invariant)', async () => {
    // The old pill row proved two same-named exercises were separately
    // selectable; the sheet must preserve that invariant — both rows visible
    // at once with different labels (suffix disambiguation), not merged.
    const user = userEvent.setup();
    renderProgress();

    await user.click(await screen.findByRole('button', { name: /prensa de pecho/i }));
    const dialog = await screen.findByRole('dialog');

    const prensaRows = within(dialog)
      .getAllByRole('listitem')
      .map((r) => r.textContent)
      .filter((t) => /prensa de pecho/i.test(t));
    expect(prensaRows.length).toBe(2);
    expect(new Set(prensaRows).size).toBe(2); // suffix makes them distinct
  });

  it('sets the selection from a sheet row and closes (AC13)', async () => {
    const user = userEvent.setup();
    renderProgress();

    await user.click(await screen.findByRole('button', { name: /prensa de pecho/i }));
    const dialog = await screen.findByRole('dialog');
    const rows = within(dialog).getAllByRole('listitem');
    const jalonRow = rows.find((r) => /jalón al pecho/i.test(r.textContent));
    await user.click(within(jalonRow).getByRole('button'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /jalón al pecho/i })).toBeInTheDocument();
  });

  it('still functions with exactly one logged exercise (AC15)', async () => {
    const user = userEvent.setup();
    db.listSessions.mockResolvedValue([
      {
        id: 'one',
        dayLabel: 'Lunes',
        dayIndex: 0,
        status: 'completed',
        startedAt: '2026-08-02T09:00:00.000Z',
        endedAt: '2026-08-02T09:30:00.000Z',
        exercises: [
          { equipmentId: 'g3-s10', name: 'Prensa de Pecho', weightUsed: 30, difficulty: 'normal', completedAt: '2026-08-02T09:10:00.000Z' },
        ],
      },
    ]);
    renderProgress();

    const trigger = await screen.findByRole('button', { name: /prensa de pecho/i });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
  });

  it('filters sheet rows by case/accent-insensitive substring from the search input (AC12)', async () => {
    const user = userEvent.setup();
    renderProgress();

    await user.click(await screen.findByRole('button', { name: /prensa de pecho/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/buscar ejercicio/i), 'JALON');

    const visible = within(dialog).getAllByRole('listitem').map((r) => r.textContent.toLowerCase());
    expect(visible.some((t) => t.includes('jalón'))).toBe(true);
    expect(visible.every((t) => !t.includes('prensa'))).toBe(true);
  });
});
