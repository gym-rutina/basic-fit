import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LibraryScreen } from './LibraryScreen.jsx';
import * as db from '../lib/db.js';
import { I18nProvider } from '../i18n/index.js';

vi.mock('../lib/db.js');

// multi-rutina-library S1 — /library "Mis rutinas" (ux-design §2/§4).
// Ordering AC9: active first, then phaseNumber ↑, then importedAt ↓.
// Delete variants: D-del-inactive / D-del-active-pick (radiogroup, disabled
// until pick) / D-del-last. Empty state is UNREACHABLE by design (redirect).
//
// RED until Cmok creates LibraryScreen.jsx + the library.* i18n keys.

const E1 = {
  id: 'r-1',
  importedAt: '2026-01-01T00:00:00.000Z',
  rutina: {
    schemaVersion: 1,
    program: { name: 'Hipertrofia', phaseName: 'Fuerza', phaseNumber: 1, durationWeeks: 6 },
    days: [{ label: 'Día A', exercises: [] }, { label: 'Día B', exercises: [] }],
  },
};
const E2 = {
  id: 'r-2',
  importedAt: '2026-02-01T00:00:00.000Z',
  rutina: {
    schemaVersion: 1,
    program: { name: 'Hipertrofia', phaseName: 'Fuerza', phaseNumber: 2, durationWeeks: 6 },
    days: [{ label: 'Día A', exercises: [] }],
  },
};

function renderLibrary({ activeId = null } = {}) {
  const onActivated = vi.fn();
  render(
    <I18nProvider initialLocale="es">
      <MemoryRouter initialEntries={['/library']}>
        <Routes>
          <Route
            path="/library"
            element={<LibraryScreen activeId={activeId} onActivated={onActivated} />}
          />
          <Route path="/import" element={<div>IMPORT SCREEN</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
  return { onActivated };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LibraryScreen — list semantics (AC8, AC9)', () => {
  it('renders every entry with name, phase marker, day count and duration weeks', async () => {
    db.listRutinas.mockResolvedValue([E1, E2]);
    renderLibrary({ activeId: 'r-2' });

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);
    // Both entries share program.name "Hipertrofia" — getAllByText, not
    // getByText (two title lines legitimately match one regex).
    expect(screen.getAllByText(/hipertrofia/i)).toHaveLength(2);
    expect(screen.getAllByText(/fase 1/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 días/i)).toBeInTheDocument(); // E1's days.length
  });

  it('orders active first, then phaseNumber ascending (AC9)', async () => {
    // Deliberately stored out of order: r-2 (phase 2) first in storage.
    db.listRutinas.mockResolvedValue([E2, E1]);
    renderLibrary({ activeId: 'r-1' });

    const cards = await screen.findAllByRole('listitem');
    expect(cards[0]).toHaveAttribute('aria-current', 'true'); // r-1 active jumps to front
    expect(within(cards[0]).getByText(/fase 1/i)).toBeInTheDocument();
    expect(within(cards[1]).getByText(/fase 2/i)).toBeInTheDocument();
  });

  it('marks the active entry with the ACTIVA micro-label and aria-current; no Activate button on it', async () => {
    db.listRutinas.mockResolvedValue([E1]);
    renderLibrary({ activeId: 'r-1' });

    const card = await screen.findByRole('listitem');
    expect(card).toHaveAttribute('aria-current', 'true');
    expect(within(card).getByText(/activa/i)).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /^activar$/i })).not.toBeInTheDocument();
  });
});

describe('LibraryScreen — activate flow (AC10, AC11)', () => {
  it('activates in place: calls api, fires onActivated, list re-renders with new ACTIVA', async () => {
    db.listRutinas.mockResolvedValue([E2, E1]);
    db.activateRutina.mockResolvedValue(undefined);
    const { onActivated } = renderLibrary({ activeId: 'r-2' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /^activar$/i }));

    await waitFor(() => expect(db.activateRutina).toHaveBeenCalledWith('r-1'));
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1));
    // The card's aria-label AND its trash button's aria-label both contain
    // "Fase 1" (the delete affordances name the entry in full, §10), so this
    // is a getAllByLabelText: exactly one of the matches must now carry
    // aria-current — the re-rendered active card.
    await waitFor(() => {
      const current = screen
        .getAllByLabelText(/fase 1/i)
        .find((el) => el.getAttribute('aria-current') === 'true');
      expect(current).toBeTruthy();
    });
  });

  it('guards activation behind a naming-the-consequence confirm when a session is ACTIVE (AC11)', async () => {
    db.listRutinas.mockResolvedValue([E2, E1]);
    db.getActiveSession.mockResolvedValue({ id: 'live', status: 'active' });
    renderLibrary({ activeId: 'r-2' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /^activar$/i }));

    const sheet = await screen.findByRole('dialog');
    expect(sheet.textContent).toMatch(/entrenamiento en curso|sesión activa/i);
    expect(db.activateRutina).not.toHaveBeenCalled();

    await user.click(within(sheet).getByRole('button', { name: /continuar|activar/i }));
    await waitFor(() => expect(db.activateRutina).toHaveBeenCalledWith('r-1'));
  });
});

describe('LibraryScreen — delete variants (AC5/AC6/AC7, AC13 promise in copy)', () => {
  beforeEach(() => {
    db.listRutinas.mockResolvedValue([E1, E2]);
    db.getActiveSession.mockResolvedValue(null);
  });

  it('D-del-inactive: names the entry AND promises history survival in the sheet copy (AC13)', async () => {
    const user = userEvent.setup();
    renderLibrary({ activeId: 'r-2' });

    await user.click(await screen.findByRole('button', { name: /eliminar hipertrofia, fase 1/i }));

    const sheet = await screen.findByRole('dialog');
    expect(sheet.textContent).toMatch(/se conservan en historial/i);
    await user.click(within(sheet).getByRole('button', { name: /^eliminar$/i }));
    await waitFor(() => expect(db.deleteRutina).toHaveBeenCalledWith('r-1'));
  });

  it('D-del-active-pick: radiogroup of successors, delete DISABLED until a pick (AC7)', async () => {
    const user = userEvent.setup();
    db.deleteAndActivateRutina.mockResolvedValue(undefined);
    renderLibrary({ activeId: 'r-2' });

    await user.click(await screen.findByRole('button', { name: /eliminar hipertrofia, fase 2/i }));
    const sheet = await screen.findByRole('dialog');

    const radios = within(sheet).getAllByRole('radio');
    expect(radios).toHaveLength(1); // only the remaining entry is offered
    const primary = within(sheet).getByRole('button', { name: /eliminar y activar/i });
    expect(primary).toBeDisabled();

    await user.click(radios[0]);
    expect(primary).toBeEnabled();
    await user.click(primary);

    await waitFor(() =>
      expect(db.deleteAndActivateRutina).toHaveBeenCalledWith('r-2', 'r-1')
    );
  });

  it('D-del-last: warns of import-screen return and history survival (AC5 path)', async () => {
    const user = userEvent.setup();
    db.listRutinas.mockResolvedValue([E1]);
    renderLibrary({ activeId: 'r-1' });

    await user.click(await screen.findByRole('button', { name: /eliminar hipertrofia, fase 1/i }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet.textContent).toMatch(/única rutina/i);
    expect(sheet.textContent).toMatch(/historial se conserva/i);

    await user.click(within(sheet).getByRole('button', { name: /^eliminar$/i }));
    await waitFor(() => expect(db.deleteRutina).toHaveBeenCalledWith('r-1'));
  });
});

describe('LibraryScreen — guards & chrome', () => {
  it('empty library redirects to /import — unreachable by design (AC5 defensive guard)', async () => {
    db.listRutinas.mockResolvedValue([]);
    renderLibrary();

    expect(await screen.findByText('IMPORT SCREEN')).toBeInTheDocument();
  });

  it('offers the Import CTA that navigates to /import', async () => {
    db.listRutinas.mockResolvedValue([E1]);
    renderLibrary({ activeId: 'r-1' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /importar rutina/i }));

    expect(await screen.findByText('IMPORT SCREEN')).toBeInTheDocument();
  });
});
