import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ActiveSessionScreen } from './ActiveSessionScreen.jsx';
import * as db from '../lib/db.js';
import { pressSystemBack, settleHistory, resetHashTo } from '../test-utils/history.js';

/**
 * back-closes-dialogs-and-wizard-polish AC1/AC6/AC7 at the screen the spec names:
 * ActiveSessionScreen's end-session sheet and its discard confirm (the
 * "close one sheet, open the next in the same commit" and "confirm navigates away
 * under the open dialog" patterns). Real jsdom history + HashRouter, like
 * components/sheet/backClosesDialog.test.jsx.
 */

vi.mock('../lib/db.js');

const RUTINA = {
  schemaVersion: 1,
  program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  days: [{ label: 'Lunes', exercises: [{ equipmentId: 'g3-s70', name: 'Prensa', sets: 3, reps: 10, restSeconds: 75 }] }],
};

function makeSession() {
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
  };
}

function PathProbe() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}
const currentPath = () => screen.getByTestId('path').textContent;

function Home() {
  const navigate = useNavigate();
  return (
    <div>
      <p>Home</p>
      <button type="button" onClick={() => navigate('/session')}>go to session</button>
    </div>
  );
}

async function mountOnSession() {
  resetHashTo('#/');
  const user = userEvent.setup();
  render(
    <HashRouter>
      <PathProbe />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/session" element={<ActiveSessionScreen onSessionEnded={vi.fn()} />} />
      </Routes>
    </HashRouter>
  );
  await user.click(screen.getByRole('button', { name: 'go to session' }));
  await settleHistory();
  expect(currentPath()).toBe('/session');
  return { user };
}

async function openEndSheet(user) {
  await user.click(await screen.findByRole('button', { name: /terminar sesión/i }));
  await screen.findByRole('alertdialog');
  await settleHistory();
}

async function openDiscardConfirm(user) {
  await user.click(screen.getByRole('button', { name: /descartar sin guardar/i }));
  await screen.findByText(/¿descartar el entrenamiento\?/i);
  await settleHistory();
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  db.getActiveRutina.mockResolvedValue({ rutina: RUTINA, importedAt: '2026-08-01' });
  db.getActiveSession.mockResolvedValue(makeSession());
  db.getLastWeight.mockResolvedValue(null);
  db.saveSession.mockResolvedValue(undefined);
  db.deleteSessions.mockResolvedValue(undefined);
});

afterEach(async () => {
  cleanup();
  await settleHistory();
});

describe('ActiveSessionScreen — system Back and the end-session dialogs (AC1, AC4, AC6, AC7)', () => {
  it('Back closes the end-session sheet and stays on the session; the next Back leaves to the previous page', async () => {
    const { user } = await mountOnSession();
    await openEndSheet(user);

    await pressSystemBack();

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/session');
    expect(db.saveSession).not.toHaveBeenCalled();
    expect(db.deleteSessions).not.toHaveBeenCalled();

    await pressSystemBack();
    expect(currentPath()).toBe('/');
  });

  it('closing the end sheet with "Cancelar" leaves no stale entry: one Back leaves the session page', async () => {
    const { user } = await mountOnSession();
    await openEndSheet(user);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /cancelar/i }));
    await settleHistory();

    await pressSystemBack();
    expect(currentPath()).toBe('/');
  });

  it('on the discard confirm, Back is "Volver": it re-opens the end sheet (never discards); Back again closes that; Back leaves', async () => {
    const { user } = await mountOnSession();
    await openEndSheet(user);
    await openDiscardConfirm(user);

    await pressSystemBack();

    expect(db.deleteSessions).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /sesión terminada sin completar/i })).toBeInTheDocument();
    expect(currentPath()).toBe('/session');

    await pressSystemBack();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/session');

    await pressSystemBack();
    expect(currentPath()).toBe('/');
  });

  it('while the discard is in flight (busy) Back is ignored: still on the dialog and on the session page; nothing is discarded by Back', async () => {
    let finish;
    db.deleteSessions.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { user } = await mountOnSession();
    await openEndSheet(user);
    await openDiscardConfirm(user);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /sí, descartar|descartando/i }));
    expect(db.deleteSessions).toHaveBeenCalledTimes(1);

    await pressSystemBack();

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(currentPath()).toBe('/session');
    expect(db.deleteSessions).toHaveBeenCalledTimes(1);
    finish(); // let the pending promise settle so nothing leaks into the next test
  });

  it('confirming the discard navigates home with no orphan entry: Back from Inicio is a real step, not swallowed', async () => {
    const { user } = await mountOnSession();
    await openEndSheet(user);
    await openDiscardConfirm(user);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /sí, descartar/i }));
    await screen.findByText('Home');
    await settleHistory();
    expect(currentPath()).toBe('/');

    await pressSystemBack();

    // history was [/, /session, (dialog marker), /]: the marker must be stepped over, so ONE Back
    // lands on the session page (what Back from Inicio does today), never on an invisible duplicate.
    expect(currentPath()).toBe('/session');
  });
});
