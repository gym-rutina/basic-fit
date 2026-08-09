import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ActiveSessionScreen } from './ActiveSessionScreen.jsx';
import * as db from '../lib/db.js';
import { getEquipmentById, equipmentDisplayName } from '../data/equipment.js';

vi.mock('../lib/db.js');

const RICH_ID = 'g3-s70';
const SPARSE_ID = 'g3-s45'; // catalog entry exists but has no images[]
const UNRESOLVED_ID = 'mancuerna-libre-15kg';

const RICH_EQ = getEquipmentById(RICH_ID);
const RICH_NAME = `${RICH_EQ.series ? `Matrix ${RICH_EQ.series} ` : ''}${RICH_EQ.modelCode} — ${equipmentDisplayName(RICH_EQ)}`;

const SPARSE_EQ = getEquipmentById(SPARSE_ID);
const SPARSE_NAME = `${SPARSE_EQ.series ? `Matrix ${SPARSE_EQ.series} ` : ''}${SPARSE_EQ.modelCode} — ${equipmentDisplayName(SPARSE_EQ)}`;

const RUTINA = {
  schemaVersion: 1,
  program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  days: [
    {
      label: 'Lunes',
      exercises: [
        {
          equipmentId: RICH_ID,
          name: 'Prensa',
          sets: 3,
          reps: 10,
          restSeconds: 75,
          intensity: 'RIR 2-3',
          technique: ['Ajusta el asiento', 'Empuja controladamente'],
          videoQuery: 'leg press machine form',
        },
        {
          equipmentId: SPARSE_ID,
          name: 'Sparse machine',
          sets: 3,
          reps: 12,
          restSeconds: 60,
          // no technique, no videoQuery — and catalog has no images
        },
        {
          equipmentId: UNRESOLVED_ID,
          name: 'Curl Bíceps Mancuerna',
          sets: 3,
          reps: 12,
          restSeconds: 60,
        },
      ],
    },
  ],
};

function makeSession(overrides = {}) {
  return {
    id: 'sess-1',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'active',
    startedAt: '2026-08-01T10:00:00.000Z',
    endedAt: null,
    exercises: RUTINA.days[0].exercises.map((ex) => ({
      equipmentId: ex.equipmentId,
      name: ex.name,
      weightUsed: null,
      difficulty: null,
      completedAt: null,
    })),
    ...overrides,
  };
}

function renderSession() {
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <Routes>
        <Route path="/session" element={<ActiveSessionScreen />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ActiveSessionScreen — equipment reference (AC1–AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.getActiveRutina.mockResolvedValue({ rutina: RUTINA, importedAt: '2026-08-01' });
    db.getActiveSession.mockResolvedValue(makeSession());
    db.getLastWeight.mockResolvedValue(null);
    db.saveSession.mockResolvedValue(undefined);
  });

  it('expanded card shows equipment reference button with catalog name (AC1)', async () => {
    renderSession();

    // First pending exercise auto-expands on load.
    const trigger = await screen.findByRole('button', { name: new RegExp(RICH_EQ.modelCode) });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger.textContent).toContain(equipmentDisplayName(RICH_EQ));
    // Thumbnail present for catalog items with images (decorative alt="" — not in a11y tree).
    expect(trigger.querySelector('img')).toBeTruthy();
  });

  it('opens EquipmentReferenceSheet with technique and video on row tap (AC2)', async () => {
    const user = userEvent.setup();
    renderSession();

    const trigger = await screen.findByRole('button', { name: new RegExp(RICH_EQ.modelCode) });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(RICH_NAME)).toBeInTheDocument();
    expect(within(dialog).getByText('Ajusta el asiento')).toBeInTheDocument();
    // Label names the EXERCISE — the sheet's title is the machine, so the link
    // is the only thing that says which of the machine's exercises this is.
    const yt = within(dialog).getByRole('link', { name: /ver técnica de «Prensa»/i });
    expect(yt.getAttribute('href')).toContain(encodeURIComponent('leg press machine form'));
  });

  it('preserves weight and difficulty while sheet is open/closed (AC3)', async () => {
    const user = userEvent.setup();
    renderSession();

    const weightInput = await screen.findByLabelText(/peso usado/i);
    await user.clear(weightInput);
    await user.type(weightInput, '42');
    await user.click(screen.getByRole('radio', { name: /normal/i }));

    const trigger = screen.getByRole('button', { name: new RegExp(RICH_EQ.modelCode) });
    await user.click(trigger);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(screen.getByLabelText(/peso usado/i)).toHaveValue(42);
    expect(screen.getByRole('radio', { name: /normal/i })).toBeChecked();
  });

  it('unresolved equipmentId renders as plain text without dialog trigger (AC4)', async () => {
    const user = userEvent.setup();
    // Expand the unresolved exercise: collapse current, expand target.
    renderSession();
    await screen.findByRole('button', { name: new RegExp(RICH_EQ.modelCode) });

    // Toggle: click the unresolved card's header (exercise name).
    await user.click(screen.getByRole('button', { name: /curl bíceps mancuerna/i }));

    expect(await screen.findByText(UNRESOLVED_ID)).toBeInTheDocument();
    // No dialog-opening equipment button for the unresolved id.
    expect(
      screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-haspopup') === 'dialog')
        .every((b) => !b.textContent?.includes(UNRESOLVED_ID))
    ).toBe(true);
  });

  it('composes a tutorial query instead of falling back to the machine video (AC18′)', async () => {
    // Was: "falls back to catalog equipment video when rutina omits videoQuery".
    // UAT decision A2 removed that fallback — the machine's clip is equipment-
    // level and cannot be the tutorial for whichever exercise is on it today.
    // It stays reachable in the Catálogo tab.
    const user = userEvent.setup();
    renderSession();
    await screen.findByRole('button', { name: new RegExp(RICH_EQ.modelCode) });

    await user.click(screen.getByRole('button', { name: /sparse machine/i }));
    const trigger = await screen.findByRole('button', { name: new RegExp(SPARSE_EQ.modelCode) });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    const catalogVideo = (SPARSE_EQ.videos?.es || SPARSE_EQ.videos?.en || [])[0]?.url;
    expect(catalogVideo).toBeTruthy(); // fixture sanity: the fallback WOULD have had something to use

    const links = within(dialog).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).not.toBe(catalogVideo);
    expect(links[0].getAttribute('href')).toContain('youtube.com/results');
    // Composed from the exercise name plus the equipment's human name.
    expect(links[0].getAttribute('href')).toContain(encodeURIComponent('Sparse machine'));
    expect(links[0].getAttribute('href')).toContain(encodeURIComponent(equipmentDisplayName(SPARSE_EQ)));
  });

  it('collapsed card does not show equipment row (AC5)', async () => {
    renderSession();
    // Rich card is expanded; unresolved + sparse stay collapsed.
    await screen.findByRole('button', { name: new RegExp(RICH_EQ.modelCode) });

    // Collapsed unresolved card header exists, but not the plain-text fallback
    // (that only appears when expanded).
    expect(screen.queryByText(UNRESOLVED_ID)).not.toBeInTheDocument();
    expect(screen.queryByText(SPARSE_NAME)).not.toBeInTheDocument();
  });
});

/**
 * session-discard-and-history-delete — spec.md § A (AC1–AC5).
 *
 * A third way to end a workout that records NOTHING. The end-session sheet
 * keeps its two recording outcomes untouched (AC24) and gains an isolated
 * "Descartar sin guardar" escape hatch (DD-001) which opens a second, danger
 * sheet (AC3). Discard is a hard delete via deleteSessions() — deliberately
 * NOT a sessionMachine transition, because it produces no session object
 * (tech-plan.md Decision 2).
 */
function renderSessionWith(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <Routes>
        <Route path="/session" element={<ActiveSessionScreen onSessionEnded={vi.fn()} {...props} />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function openEndSheet(user) {
  await user.click(await screen.findByRole('button', { name: /terminar sesión/i }));
}

describe('ActiveSessionScreen — discard (AC1–AC5)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.getActiveRutina.mockResolvedValue({ rutina: RUTINA, importedAt: '2026-08-01' });
    db.getActiveSession.mockResolvedValue(makeSession());
    db.getLastWeight.mockResolvedValue(null);
    db.saveSession.mockResolvedValue(undefined);
    db.deleteSessions.mockResolvedValue(undefined);
  });

  it('offers discard with zero exercises completed (AC2)', async () => {
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);

    // The "started by mistake" case — the whole point of the feature.
    expect(screen.getByRole('button', { name: /descartar sin guardar/i })).toBeInTheDocument();
  });

  it('offers discard with some exercises completed (AC2)', async () => {
    const partial = makeSession();
    partial.exercises[0] = {
      ...partial.exercises[0],
      weightUsed: 40,
      difficulty: 'normal',
      completedAt: '2026-08-01T10:15:00.000Z',
    };
    db.getActiveSession.mockResolvedValue(partial);
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);

    expect(screen.getByRole('button', { name: /descartar sin guardar/i })).toBeInTheDocument();
  });

  it('is distinct from the two recording outcomes (AC4)', async () => {
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);

    const discard = screen.getByRole('button', { name: /descartar sin guardar/i });
    const finish = screen.getByRole('button', { name: /finalizar sesión/i });
    const abandon = screen.getByRole('button', { name: /sesión terminada sin completar/i });

    // A user must not be able to confuse "no se guarda" with "sesión sin
    // terminar" — the abandoned outcome DOES record.
    expect(discard.getAttribute('style')).toContain('bf-danger');
    expect(finish.getAttribute('style') ?? '').not.toContain('bf-danger');
    expect(abandon.getAttribute('style') ?? '').not.toContain('bf-danger');
    expect(discard.textContent).not.toMatch(/sin completar/i);
  });

  it('confirms through a danger sheet stating it is not saved and cannot be undone (AC3)', async () => {
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);
    await user.click(screen.getByRole('button', { name: /descartar sin guardar/i }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/¿descartar el entrenamiento\?/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/no se guardará nada/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/no se puede deshacer/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /sí, descartar/i }).getAttribute('style')
    ).toContain('bf-danger');
  });

  it('cancelling the confirm leaves the session active and unchanged (AC3)', async () => {
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);
    await user.click(screen.getByRole('button', { name: /descartar sin guardar/i }));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /volver/i }));

    expect(db.deleteSessions).not.toHaveBeenCalled();
    // Returns to the end sheet, so a mis-tap costs one tap, not the decision.
    expect(await screen.findByRole('button', { name: /finalizar sesión/i })).toBeInTheDocument();
  });

  it('deletes the session record on confirm (AC1)', async () => {
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);
    await user.click(screen.getByRole('button', { name: /descartar sin guardar/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /sí, descartar/i }));

    await waitFor(() => expect(db.deleteSessions).toHaveBeenCalledWith(['sess-1']));
    // Never persisted with a status — no 'discarded' flag exists (DD-003).
    expect(db.saveSession).not.toHaveBeenCalled();
  });

  it('navigates to Inicio after discarding (AC5)', async () => {
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);
    await user.click(screen.getByRole('button', { name: /descartar sin guardar/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /sí, descartar/i }));

    expect(await screen.findByText('Home')).toBeInTheDocument();
  });

  it('refreshes the shell active-session state after discarding (AC15)', async () => {
    const onSessionEnded = vi.fn();
    const user = userEvent.setup();
    renderSessionWith({ onSessionEnded });
    await openEndSheet(user);
    await user.click(screen.getByRole('button', { name: /descartar sin guardar/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /sí, descartar/i }));

    // Inicio and the banner must clear without a manual reload.
    await waitFor(() => expect(onSessionEnded).toHaveBeenCalled());
  });

  it('keeps the sheet open and does not navigate when the delete fails', async () => {
    db.deleteSessions.mockRejectedValue(new Error('IDB unavailable'));
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);
    await user.click(screen.getByRole('button', { name: /descartar sin guardar/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /sí, descartar/i }));

    // The user must never land on Inicio believing the workout was discarded.
    expect(await within(dialog).findByText(/no se pudo descartar/i)).toBeInTheDocument();
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });

  it('still records FINISH and ABANDON as it does today (AC24)', async () => {
    const user = userEvent.setup();
    renderSessionWith();
    await openEndSheet(user);
    await user.click(screen.getByRole('button', { name: /finalizar sesión/i }));

    await waitFor(() => expect(db.saveSession).toHaveBeenCalled());
    expect(db.saveSession.mock.calls.at(-1)[0]).toMatchObject({ status: 'completed' });
    expect(db.deleteSessions).not.toHaveBeenCalled();
  });
});

/**
 * exercise-level-tracking (spec.md AC5, AC16, AC19; ux-design.md S1/S2).
 *
 * Two exercises can share one machine, so "the last weight for this equipment"
 * was always the wrong question. Prefill, the caption that describes it, and
 * the tutorial link all move to the exercise.
 */
const TWO_ON_ONE_MACHINE = {
  schemaVersion: 1,
  program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  days: [
    {
      label: 'Lunes',
      exercises: [
        { equipmentId: RICH_ID, name: 'Prensa de Pecho', sets: 3, reps: 10, restSeconds: 75 },
        { equipmentId: RICH_ID, name: 'Press de Hombro', sets: 4, reps: 8, restSeconds: 75 },
      ],
    },
  ],
};

function sessionFor(rutina, overrides = {}) {
  return {
    id: 'sess-1',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'active',
    startedAt: '2026-08-08T10:00:00.000Z',
    endedAt: null,
    exercises: rutina.days[0].exercises.map((ex) => ({
      equipmentId: ex.equipmentId,
      name: ex.name,
      weightUsed: null,
      difficulty: null,
      completedAt: null,
    })),
    ...overrides,
  };
}

describe('ActiveSessionScreen — exercise-level prefill (AC5, AC19)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.getActiveRutina.mockResolvedValue({ rutina: TWO_ON_ONE_MACHINE, importedAt: '2026-08-08' });
    db.getActiveSession.mockResolvedValue(sessionFor(TWO_ON_ONE_MACHINE));
    db.saveSession.mockResolvedValue(undefined);
  });

  it('looks the prefill up by exercise key, not equipment id (AC5)', async () => {
    db.getLastWeight.mockResolvedValue(null);
    renderSession();

    await screen.findByLabelText(/peso usado/i);
    await waitFor(() => {
      expect(db.getLastWeight).toHaveBeenCalledWith('g3-s70::prensa-de-pecho');
    });
    expect(db.getLastWeight).not.toHaveBeenCalledWith(RICH_ID);
  });

  it('prefills the value stored for THIS exercise (AC5)', async () => {
    db.getLastWeight.mockResolvedValue({ exerciseKey: 'g3-s70::prensa-de-pecho', weight: 32 });
    renderSession();

    await waitFor(() => expect(screen.getByLabelText(/peso usado/i)).toHaveValue(32));
  });

  it('caption names the exercise scope, never the equipment (AC19)', async () => {
    db.getLastWeight.mockResolvedValue({ weight: 32 });
    renderSession();

    expect(await screen.findByText(/Prellenado con tu último peso en este ejercicio/i)).toBeInTheDocument();
    // The old copy claimed machine scope, which is exactly the bug.
    expect(screen.queryByText(/para este equipo/i)).not.toBeInTheDocument();
  });

  it('caption reads "sin registros" when the exercise has never been logged (AC19)', async () => {
    // Also the post-migration state: lastWeights is empty until each exercise
    // is logged once (DD-002). UAT decision B2 made this caption the ONLY
    // explanation the user gets, so it has to carry its weight.
    db.getLastWeight.mockResolvedValue(null);
    renderSession();

    expect(await screen.findByText(/Sin registros de este ejercicio todavía/i)).toBeInTheDocument();
  });

  it('caption does not claim a prefill while the lookup is still in flight (AC19)', async () => {
    db.getLastWeight.mockReturnValue(new Promise(() => {})); // never resolves
    renderSession();

    expect(await screen.findByText(/El peso se guarda por ejercicio/i)).toBeInTheDocument();
    expect(screen.queryByText(/Prellenado con tu último peso/i)).not.toBeInTheDocument();
  });

  it('caption describes a completed exercise as a recorded value (AC19)', async () => {
    const done = sessionFor(TWO_ON_ONE_MACHINE);
    done.exercises[0] = {
      ...done.exercises[0],
      weightUsed: 30,
      difficulty: 'normal',
      completedAt: '2026-08-08T10:10:00.000Z',
    };
    db.getActiveSession.mockResolvedValue(done);
    db.getLastWeight.mockResolvedValue({ weight: 99 });
    renderSession();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /prensa de pecho/i }));

    expect(await screen.findByText(/Peso registrado para este ejercicio/i)).toBeInTheDocument();
    // A done card shows ITS OWN logged value, never the lastWeights prefill.
    expect(screen.getByLabelText(/peso usado/i)).toHaveValue(30);
  });

  it('associates the caption with the weight input for screen readers', async () => {
    db.getLastWeight.mockResolvedValue({ weight: 32 });
    renderSession();

    const input = await screen.findByLabelText(/peso usado/i);
    const captionId = input.getAttribute('aria-describedby');
    expect(captionId).toBeTruthy();
    expect(document.getElementById(captionId)).toHaveTextContent(/este ejercicio/i);
  });

  it('a failed prefill lookup degrades to the empty caption and still allows logging', async () => {
    const user = userEvent.setup();
    db.getLastWeight.mockRejectedValue(new Error('idb unavailable'));
    renderSession();

    expect(await screen.findByText(/Sin registros de este ejercicio todavía/i)).toBeInTheDocument();

    const input = screen.getByLabelText(/peso usado/i);
    await user.type(input, '25');
    await user.click(screen.getByRole('radio', { name: /normal/i }));
    await user.click(screen.getByRole('button', { name: /marcar completado/i }));

    await waitFor(() => expect(db.saveSession).toHaveBeenCalled());
  });
});

describe('ActiveSessionScreen — tutorial link (AC16, AC17, AC18′)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.getActiveRutina.mockResolvedValue({ rutina: TWO_ON_ONE_MACHINE, importedAt: '2026-08-08' });
    db.getActiveSession.mockResolvedValue(sessionFor(TWO_ON_ONE_MACHINE));
    db.getLastWeight.mockResolvedValue(null);
    db.saveSession.mockResolvedValue(undefined);
  });

  async function openSheetFor(user, exerciseName) {
    const header = screen.getByRole('button', { name: new RegExp(exerciseName, 'i') });
    // The accordion is single-open: clicking an ALREADY-expanded card's own
    // header toggles it closed. The first exercise auto-expands on load, so
    // only click when this card isn't the one currently open (its weight
    // input, a sibling under the same card wrapper, is the tell).
    const alreadyOpen = !!header.closest('div')?.querySelector('input');
    if (!alreadyOpen) {
      await user.click(header);
    }
    const trigger = await screen.findByRole('button', { name: new RegExp(RICH_EQ.modelCode) });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    const href = within(dialog).getAllByRole('link')[0].getAttribute('href');
    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    return href;
  }

  it('gives two exercises on the same machine two different links (AC16)', async () => {
    const user = userEvent.setup();
    renderSession();
    await screen.findByRole('button', { name: new RegExp(RICH_EQ.modelCode) });

    const chestHref = await openSheetFor(user, 'Prensa de Pecho');
    const shoulderHref = await openSheetFor(user, 'Press de Hombro');

    expect(chestHref).not.toBe(shoulderHref);
    expect(chestHref).toContain(encodeURIComponent('Prensa de Pecho'));
    expect(shoulderHref).toContain(encodeURIComponent('Press de Hombro'));
  });

  it('never puts a Matrix model code or series in the query (AC16)', async () => {
    const user = userEvent.setup();
    renderSession();
    await screen.findByRole('button', { name: new RegExp(RICH_EQ.modelCode) });

    const href = await openSheetFor(user, 'Prensa de Pecho');

    expect(href).not.toMatch(new RegExp(RICH_EQ.modelCode, 'i'));
    expect(href).not.toMatch(/aura/i);
  });
});
