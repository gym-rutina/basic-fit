import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgramScreen } from './ProgramScreen.jsx';
import * as libraryNotice from '../lib/libraryNoticeStorage.js';

vi.mock('../lib/libraryNoticeStorage.js', () => ({
  hasSeenLibraryNotice: vi.fn(),
  markLibraryNoticeSeen: vi.fn(),
}));

// Minimal rutina fixture satisfying ProgramScreen's destructuring.
// Empty days/rules/notes to avoid exercise-card rendering complexity.
const RUTINA = {
  schemaVersion: 1,
  program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  phaseInfo: { objective: 'Test objective', intensityPercent: '60%', restSeconds: 60, frequencyPerWeek: 3 },
  warmup: { durationMinutes: 5, steps: ['Warm up step'] },
  cooldown: { durationMinutes: 5, steps: ['Cool down step'] },
  days: [{ label: 'Lunes', exercises: [] }],
  rules: [],
  notes: [],
};

/**
 * multi-rutina-library §3 surgery — the four-sheet/action-stack describes are
 * REWRITTEN as Mis-rutinas navigation + notice-once suites: "Reemplazar
 * programa", "Eliminar programa" and their ConfirmSheets are DELETED from the
 * overview (management lives on /library now), so those contracts moved with
 * them (LibraryScreen.test.jsx owns the delete/activate variants).
 */
function renderOverview() {
  return render(
    <MemoryRouter initialEntries={['/program']}>
      <Routes>
        <Route path="/program" element={<ProgramScreen rutina={RUTINA} />} />
        <Route path="/program/:dayIndex" element={<ProgramScreen rutina={RUTINA} />} />
        <Route path="/library" element={<div>LIBRARY SCREEN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProgramScreen — Mis rutinas entry (multi-rutina-library)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryNotice.hasSeenLibraryNotice.mockReturnValue(true); // notice off unless a test asks
  });

  it('renders ONE "Mis rutinas" outline action; Reemplazar/Eliminar are gone', () => {
    renderOverview();

    expect(screen.getByRole('button', { name: /mis rutinas/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reemplazar programa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar programa/i })).not.toBeInTheDocument();
  });

  it('navigates to /library on tap', async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByRole('button', { name: /mis rutinas/i }));

    expect(await screen.findByText('LIBRARY SCREEN')).toBeInTheDocument();
  });

  it('opens no confirm sheet on tap — the overview is no longer destructive (AC22 spirit)', async () => {
    const user = userEvent.setup();
    renderOverview();

    await user.click(screen.getByRole('button', { name: /mis rutinas/i }));
    await screen.findByText('LIBRARY SCREEN');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ProgramScreen — one-shot migration notice (multi-rutina-library D-H)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the notice once when the flag is unset; Entendido hides it and marks seen', async () => {
    libraryNotice.hasSeenLibraryNotice.mockReturnValue(false);
    const user = userEvent.setup();
    renderOverview();

    expect(await screen.findByText(/tu programa ahora vive en mis rutinas\./i)).toBeInTheDocument();
    expect(screen.getByText(/puedes guardar varias rutinas/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /entendido/i }));

    expect(libraryNotice.markLibraryNoticeSeen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/tu programa ahora vive en mis rutinas\./i)).not.toBeInTheDocument();
  });

  it('stays hidden once the flag is set', () => {
    libraryNotice.hasSeenLibraryNotice.mockReturnValue(true);
    renderOverview();

    expect(screen.queryByText(/tu programa ahora vive en mis rutinas\./i)).not.toBeInTheDocument();
    expect(libraryNotice.markLibraryNoticeSeen).not.toHaveBeenCalled();
  });
});

/**
 * exercise-level-tracking (spec.md AC17, AC18′).
 *
 * ProgramScreen used to build its own `youtube.com/results?search_query=…`
 * expression inline — a second implementation that could drift from the one in
 * ActiveSessionScreen. AC17 collapses both onto buildVideoQuery. AC18′ (UAT
 * decision A2) removes the catalog-machine-video fallback that sat behind it.
 */
import { getEquipmentById as getEq, equipmentDisplayName as eqName } from '../data/equipment.js';

const DAY_RUTINA = {
  schemaVersion: 1,
  program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  phaseInfo: { objective: 'Test objective', intensityPercent: '60%', restSeconds: 60, frequencyPerWeek: 3 },
  warmup: { durationMinutes: 5, steps: ['Warm up step'] },
  cooldown: { durationMinutes: 5, steps: ['Cool down step'] },
  days: [
    {
      label: 'Lunes',
      exercises: [
        {
          equipmentId: 'g3-s10',
          name: 'Press de Hombro',
          sets: 4,
          reps: 8,
          restSeconds: 75,
          muscleGroups: ['shoulders'],
        },
      ],
    },
  ],
  rules: [],
  notes: [],
};

function renderDay() {
  return render(
    <MemoryRouter initialEntries={['/program/0']}>
      <Routes>
        <Route
          path="/program/:dayIndex"
          element={<ProgramScreen rutina={DAY_RUTINA} onGoImport={vi.fn()} onRutinaCleared={vi.fn()} />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProgramScreen — day detail tutorial link (AC17, AC18′)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryNotice.hasSeenLibraryNotice.mockReturnValue(true);
  });

  it('links to a query composed from the exercise and its equipment (AC17)', async () => {
    renderDay();

    const link = await screen.findByRole('link', { name: /ver técnica de «Press de Hombro»/i });
    const href = link.getAttribute('href');
    expect(href).toContain('youtube.com/results');
    expect(href).toContain(encodeURIComponent('Press de Hombro'));
    expect(href).toContain(encodeURIComponent(eqName(getEq('g3-s10'))));
  });

  it('does not link to the catalog machine video (AC18′)', async () => {
    renderDay();

    await screen.findByRole('link', { name: /ver técnica/i });
    const catalogVideo = (getEq('g3-s10').videos?.es || getEq('g3-s10').videos?.en || [])[0]?.url;
    expect(catalogVideo).toBeTruthy(); // fixture sanity

    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).not.toContain(catalogVideo);
    expect(screen.queryByRole('link', { name: /vídeo de la máquina/i })).not.toBeInTheDocument();
  });

  it('builds the identical href for the same exercise as /session does (AC17)', async () => {
    // The two screens must not drift: one helper, one query.
    const { buildVideoQuery } = await import('../lib/videoQuery.js');
    const expected = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      buildVideoQuery({ name: 'Press de Hombro', equipmentId: 'g3-s10' }, getEq('g3-s10'))
    )}`;

    renderDay();

    const link = await screen.findByRole('link', { name: /ver técnica/i });
    expect(link).toHaveAttribute('href', expected);
  });
});
