import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByRole('button', { name: /Prensa de Pecho/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Jalón al Pecho/i })).toHaveAttribute('aria-pressed', 'false');

    // Distinct from History — no Historial chrome.
    expect(screen.queryByRole('heading', { name: /^Historial$/i })).toBeNull();
  });

  it('switching the exercise pill updates the selected chart (AC2)', async () => {
    const user = userEvent.setup();
    db.listSessions.mockResolvedValue(PAST_SESSIONS);
    renderProgress();

    await screen.findByRole('button', { name: /Prensa de Pecho/i });
    await user.click(screen.getByRole('button', { name: /Jalón al Pecho/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Jalón al Pecho/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /Prensa de Pecho/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

/**
 * exercise-level-tracking (spec.md AC10; ux-design.md S5).
 *
 * The picker selects by exercise key, so two exercises on one machine are two
 * pills. Where two exercises share a NAME (different machines), the pill label
 * gets a model-code suffix — that suffix is real text inside the button, so it
 * lands in the accessible name for free.
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

describe('ProgressScreen — exercise-level picker (AC10)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows two pills for two exercises on the same machine', async () => {
    db.listSessions.mockResolvedValue(TWO_ON_ONE_MACHINE);
    renderProgress();

    expect(await screen.findByRole('button', { name: /Prensa de Pecho/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Press de Hombro/i })).toBeInTheDocument();
  });

  it('selects each exercise independently, not the machine they share', async () => {
    const user = userEvent.setup();
    db.listSessions.mockResolvedValue(TWO_ON_ONE_MACHINE);
    renderProgress();

    const chest = await screen.findByRole('button', { name: /Prensa de Pecho/i });
    expect(chest).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Press de Hombro/i })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /Press de Hombro/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Press de Hombro/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /Prensa de Pecho/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('disambiguates two exercises that share a name with their model code', async () => {
    db.listSessions.mockResolvedValue([
      {
        ...TWO_ON_ONE_MACHINE[0],
        exercises: [
          {
            equipmentId: 'g3-s40',
            name: 'Remo',
            weightUsed: 40,
            difficulty: 'normal',
            completedAt: '2026-07-06T09:10:00.000Z',
          },
          {
            equipmentId: 'g3-s60',
            name: 'Remo',
            weightUsed: 50,
            difficulty: 'normal',
            completedAt: '2026-07-06T09:20:00.000Z',
          },
        ],
      },
    ]);
    renderProgress();

    // Two same-named exercises on different machines must not render two
    // indistinguishable pills.
    const pills = await screen.findAllByRole('button', { name: /Remo/i });
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).not.toBe(pills[1].textContent);
    expect(pills.map((p) => p.textContent).join(' ')).toMatch(/G3-S40/i);
    expect(pills.map((p) => p.textContent).join(' ')).toMatch(/G3-S60/i);
  });

  it('leaves labels unsuffixed when there is no name collision', async () => {
    db.listSessions.mockResolvedValue(TWO_ON_ONE_MACHINE);
    renderProgress();

    const chest = await screen.findByRole('button', { name: /Prensa de Pecho/i });
    expect(chest.textContent.trim()).toBe('Prensa de Pecho');
  });
});
