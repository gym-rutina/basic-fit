import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ActiveSessionScreen } from './ActiveSessionScreen.jsx';
import * as db from '../lib/db.js';
import * as outbox from '../lib/reportOutbox.js';
import { getEquipmentById, equipmentDisplayName } from '../data/equipment.js';

/**
 * club-equipment-reporting S1 + S2 + AC1–AC4, AC16, AC18 (tech-plan.md §2
 * D3/D8/D10, ux-design §2/§3). Same harness as ActiveSessionScreen.test.jsx:
 * db.js auto-mocked; reportOutbox.js auto-mocked too so what the screen
 * ENQUEUES is the observable, independent of storage.
 *
 * The screen calls `useClubExclusions(clubId, { method: 'session' })` ONCE at
 * the top (before its early return — rules of hooks), so «No está» writes the
 * same exclusions the Settings overlay and the Catálogo chip write.
 */

vi.mock('../lib/db.js');
vi.mock('../lib/reportOutbox.js');

const CLUB = { countryCode: 'ES', clubId: 'club-a', name: 'Test Club', address: 'Calle 1', city: 'Madrid' };
const CATALOG_ID = 'g3-s70';
const OTHER_CATALOG_ID = 'g3-s45';
const GEAR_ID = 'my-foam-roller';
const UNRESOLVED_ID = 'mancuerna-libre-15kg';

const CAT_EQ = getEquipmentById(CATALOG_ID);
const CAT_NAME = equipmentDisplayName(CAT_EQ);

const ex = (equipmentId, name) => ({ equipmentId, name, sets: 3, reps: 10, restSeconds: 60 });

function rutinaWith(exercises, extra = {}) {
  return {
    schemaVersion: 1,
    program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
    days: [{ label: 'Lunes', exercises }],
    ...extra,
  };
}

function sessionFor(rutina, overrides = {}) {
  return {
    id: 'sess-1',
    dayLabel: 'Lunes',
    dayIndex: 0,
    status: 'active',
    startedAt: '2026-09-29T10:00:00.000Z',
    endedAt: null,
    exercises: rutina.days[0].exercises.map((e) => ({
      equipmentId: e.equipmentId,
      name: e.name,
      weightUsed: null,
      difficulty: null,
      completedAt: null,
    })),
    ...overrides,
  };
}

function mount(rutina, { club = CLUB, excluded = [], session, hang = false } = {}) {
  if (club) localStorage.setItem('rutina:club', JSON.stringify(club));
  db.getActiveRutina.mockResolvedValue({ rutina, importedAt: '2026-09-29' });
  db.getActiveSession.mockResolvedValue(session ?? sessionFor(rutina));
  db.getLastWeight.mockResolvedValue(null);
  db.saveSession.mockResolvedValue(undefined);
  // hang: exclusions never resolve → the hook stays in its `null` (unloaded) tri-state
  if (hang) db.getClubExclusions.mockImplementation(() => new Promise(() => {}));
  else db.getClubExclusions.mockResolvedValue(excluded);
  db.setClubExclusions.mockResolvedValue(undefined);
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <Routes>
        <Route path="/session" element={<ActiveSessionScreen />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const notHereName = new RegExp(`^Reportar ${CAT_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} como no disponible en este club$`);
const notHereButton = () => screen.queryByRole('button', { name: /^Reportar .+ como no disponible en este club$/ });

async function complete(user, { weight = '40', notes } = {}) {
  const w = await screen.findByLabelText(/peso usado/i);
  await user.clear(w);
  await user.type(w, weight);
  if (notes !== undefined) await user.type(screen.getByLabelText(/notas \(opcional\)/i), notes);
  await user.click(screen.getByRole('radio', { name: /normal/i }));
  await user.click(screen.getByRole('button', { name: /marcar completado/i }));
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  outbox.enqueueReport.mockResolvedValue(undefined);
  outbox.enqueueImplicitPresent.mockResolvedValue(undefined);
});
afterEach(() => localStorage.clear());

describe('S1 — «No está» on the equipment reference row (AC1, AC2, AC4)', () => {
  it('offers exactly one report action on a catalog machine with a club selected, named for what it does (AC1)', async () => {
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    const btn = await screen.findByRole('button', { name: notHereName });
    expect(btn).toHaveTextContent('No está');
    // AC1: no separate "confirm present" control exists
    expect(screen.queryByRole('button', { name: /está aquí|confirmar presente|presente/i })).not.toBeInTheDocument();
    expect(btn.style.minHeight === '44px' || getComputedStyle(btn).minHeight === '44px').toBe(true);
  });

  it('tap: excludes locally through the single exclusions path AND enqueues an absent/session report (AC2)', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));

    await user.click(await screen.findByRole('button', { name: notHereName }));

    await waitFor(() => expect(db.setClubExclusions).toHaveBeenCalledWith('club-a', [CATALOG_ID]));
    expect(outbox.enqueueReport).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueReport).toHaveBeenCalledWith({ clubId: 'club-a', equipmentId: CATALOG_ID, signal: 'absent', method: 'session' });
  });

  it('one-tap finality: the action is replaced by the confirmation, announced politely, pointing corrections to Catálogo → Mi club', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));

    await user.click(await screen.findByRole('button', { name: notHereName }));

    const sentence = /Reportado\. Se ha ocultado en el catálogo de este club\. Puedes revertirlo desde Catálogo → Mi club\./;
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(notHereButton()).not.toBeInTheDocument();
    const live = [...document.querySelectorAll('[aria-live="polite"], [role="status"]')].map((n) => n.textContent).join(' | ');
    expect(live).toMatch(sentence);
  });

  it('the local exclusion never waits on the report: a rejecting outbox still confirms and excludes (AC8)', async () => {
    outbox.enqueueReport.mockRejectedValue(new Error('outbox down'));
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));

    await user.click(await screen.findByRole('button', { name: notHereName }));

    expect(await screen.findByText(/Reportado\./)).toBeInTheDocument();
    await waitFor(() => expect(db.setClubExclusions).toHaveBeenCalled());
  });

  it('renders NO action with no club selected — the row is today\'s row (AC4)', async () => {
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]), { club: null });
    await screen.findByLabelText(/peso usado/i);
    expect(notHereButton()).not.toBeInTheDocument();
  });

  it('renders NO action on a gear row (AC4 / AC19)', async () => {
    const rutina = rutinaWith([ex(GEAR_ID, 'Foam')], {
      extraEquipment: [{ id: GEAR_ID, kind: 'gear', names: { en: 'Foam roller', es: 'Rodillo', be: 'Ролік' } }],
    });
    mount(rutina);
    await screen.findByLabelText(/peso usado/i);
    expect(notHereButton()).not.toBeInTheDocument();
  });

  it('renders NO action on an unresolved id (AC4)', async () => {
    mount(rutinaWith([ex(UNRESOLVED_ID, 'Curl')]));
    await screen.findByLabelText(/peso usado/i);
    expect(notHereButton()).not.toBeInTheDocument();
  });

  it('renders NO action while exclusions are still loading — the tri-state: never report before knowing', async () => {
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]), { hang: true });
    await screen.findByLabelText(/peso usado/i);
    expect(notHereButton()).not.toBeInTheDocument();
  });

  it('renders NO action when the machine is already excluded locally — it was reported when it was excluded (no false "Reportado")', async () => {
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]), { excluded: [CATALOG_ID] });
    await screen.findByLabelText(/peso usado/i);
    await waitFor(() => expect(db.getClubExclusions).toHaveBeenCalled());
    expect(notHereButton()).not.toBeInTheDocument();
    expect(screen.queryByText(/Reportado\./)).not.toBeInTheDocument();
  });
});

describe('implicit present-report on completion (AC3, AC4)', () => {
  it('completing a catalog exercise with a club enqueues ONE implicit present, silently', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));

    await complete(user);

    await waitFor(() => expect(outbox.enqueueImplicitPresent).toHaveBeenCalledTimes(1));
    expect(outbox.enqueueImplicitPresent).toHaveBeenCalledWith({ clubId: 'club-a', equipmentId: CATALOG_ID });
    expect(outbox.enqueueReport).not.toHaveBeenCalled();
  });

  it('is fully silent: the only live announcement is the existing completion one', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    await complete(user);
    await waitFor(() => expect(outbox.enqueueImplicitPresent).toHaveBeenCalled());
    const live = [...document.querySelectorAll('[aria-live="polite"], [role="status"], [role="alert"]')].map((n) => n.textContent).join(' ');
    expect(live).not.toMatch(/report|club|equipo|disponible/i);
  });

  it('at most once per equipment per session — two exercises on the same machine enqueue once', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa A'), ex(CATALOG_ID, 'Prensa B')]));

    await complete(user); // first card
    await waitFor(() => expect(outbox.enqueueImplicitPresent).toHaveBeenCalledTimes(1));
    await complete(user); // second card auto-expands, same machine

    await waitFor(() => expect(db.saveSession).toHaveBeenCalledTimes(2));
    expect(outbox.enqueueImplicitPresent).toHaveBeenCalledTimes(1);
  });

  it('undo + re-complete of the same exercise does not enqueue again', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    await complete(user);
    await waitFor(() => expect(outbox.enqueueImplicitPresent).toHaveBeenCalledTimes(1));

    // completing collapses the card: reopen the (only) card header, then undo
    await user.click(await screen.findByRole('button', { name: /Prensa/ }));
    await user.click(await screen.findByRole('button', { name: /deshacer/i }));
    await complete(user, { weight: '45' });

    await waitFor(() => expect(db.saveSession.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(outbox.enqueueImplicitPresent).toHaveBeenCalledTimes(1);
  });

  it('two DIFFERENT machines each enqueue once', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa'), ex(OTHER_CATALOG_ID, 'Otra')]));
    await complete(user);
    await complete(user);
    await waitFor(() => expect(outbox.enqueueImplicitPresent).toHaveBeenCalledTimes(2));
    expect(outbox.enqueueImplicitPresent.mock.calls.map(([p]) => p.equipmentId).sort()).toEqual([CATALOG_ID, OTHER_CATALOG_ID].sort());
  });

  it('never for gear rows, unresolved ids or with no club (AC4)', async () => {
    const user = userEvent.setup();
    const rutina = rutinaWith([ex(GEAR_ID, 'Foam'), ex(UNRESOLVED_ID, 'Curl')], {
      extraEquipment: [{ id: GEAR_ID, kind: 'gear', names: { en: 'Foam roller', es: 'Rodillo', be: 'Ролік' } }],
    });
    mount(rutina);
    await complete(user);
    await complete(user);
    await waitFor(() => expect(db.saveSession).toHaveBeenCalledTimes(2));
    expect(outbox.enqueueImplicitPresent).not.toHaveBeenCalled();
  });

  it('never with no club selected', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]), { club: null });
    await complete(user);
    await waitFor(() => expect(db.saveSession).toHaveBeenCalled());
    expect(outbox.enqueueImplicitPresent).not.toHaveBeenCalled();
  });

  it('never contradicts the user\'s own overlay: a machine they excluded locally gets no implicit present', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]), { excluded: [CATALOG_ID] });
    await waitFor(() => expect(db.getClubExclusions).toHaveBeenCalled());
    await complete(user);
    await waitFor(() => expect(db.saveSession).toHaveBeenCalled());
    expect(outbox.enqueueImplicitPresent).not.toHaveBeenCalled();
  });

  it('a failing outbox never blocks completing the exercise (AC8)', async () => {
    outbox.enqueueImplicitPresent.mockRejectedValue(new Error('outbox down'));
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    await complete(user);
    await waitFor(() => expect(db.saveSession).toHaveBeenCalled());
    expect(db.saveSession.mock.calls.at(-1)[0].exercises[0].completedAt).toBeTruthy();
  });
});

describe('S2 — personal notes (AC16, AC18)', () => {
  it('shows an optional, labelled, 2-row textarea in the completion cluster', async () => {
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    const box = await screen.findByLabelText(/notas \(opcional\)/i);
    expect(box.tagName).toBe('TEXTAREA');
    expect(box).toHaveAttribute('rows', '2');
    expect(box).toHaveAttribute('dir', 'auto');
    expect(box).toHaveAttribute('placeholder', 'p. ej. sin polea, usé el agarre largo');
  });

  it('completing without a note works exactly as before and stores no `notes` key', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    await complete(user);
    await waitFor(() => expect(db.saveSession).toHaveBeenCalled());
    expect(db.saveSession.mock.calls.at(-1)[0].exercises[0]).not.toHaveProperty('notes');
  });

  it('persists the typed note on the exercise record beside weight/difficulty (AC16)', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    await complete(user, { notes: 'sin polea, usé el agarre largo' });
    await waitFor(() => expect(db.saveSession).toHaveBeenCalled());
    expect(db.saveSession.mock.calls.at(-1)[0].exercises[0]).toMatchObject({
      weightUsed: 40,
      difficulty: 'normal',
      notes: 'sin polea, usé el agarre largo',
    });
  });

  it('truncates at 200 characters on save and never blocks completion', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    const w = await screen.findByLabelText(/peso usado/i);
    await user.type(w, '40');
    // paste-like: set the long value in one event (typing 250 chars is slow)
    const box = screen.getByLabelText(/notas \(opcional\)/i);
    await user.click(box);
    await user.paste('x'.repeat(250));
    await user.click(screen.getByRole('radio', { name: /normal/i }));
    await user.click(screen.getByRole('button', { name: /marcar completado/i }));
    await waitFor(() => expect(db.saveSession).toHaveBeenCalled());
    expect(db.saveSession.mock.calls.at(-1)[0].exercises[0].notes).toHaveLength(200);
  });

  it('re-fills a saved note when a completed exercise is reopened', async () => {
    const rutina = rutinaWith([ex(CATALOG_ID, 'Prensa')]);
    const session = sessionFor(rutina);
    session.exercises[0] = { ...session.exercises[0], weightUsed: 40, difficulty: 'normal', completedAt: '2026-09-29T10:05:00.000Z', notes: 'agarre largo' };
    const user = userEvent.setup();
    mount(rutina, { session });
    await user.click(await screen.findByRole('button', { name: /Prensa/ }));
    expect(await screen.findByLabelText(/notas \(opcional\)/i)).toHaveValue('agarre largo');
  });

  it('a note can never reach an anonymous report — nothing the screen enqueues mentions it (AC18)', async () => {
    const user = userEvent.setup();
    mount(rutinaWith([ex(CATALOG_ID, 'Prensa')]));
    await complete(user, { notes: 'MI NOTA PRIVADA' });
    await waitFor(() => expect(outbox.enqueueImplicitPresent).toHaveBeenCalled());
    const everything = JSON.stringify([...outbox.enqueueImplicitPresent.mock.calls, ...outbox.enqueueReport.mock.calls]);
    expect(everything).not.toMatch(/MI NOTA PRIVADA|notes|weightUsed|difficulty/);
  });
});
