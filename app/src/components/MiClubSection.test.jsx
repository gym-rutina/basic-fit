import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MiClubSection } from './MiClubSection.jsx';
import { I18nProvider } from '../i18n/index.js';
import { CLUB_KEY } from '../lib/clubStorage.js';
import { EQUIPMENT } from '../data/equipment.js';

/**
 * move-club-picker-to-settings S1 (ux-design.md §2, tech-plan.md §3) — the
 * Settings "Mi club" section. Self-contained like ClubAccessSection: heading,
 * identity, change action, equipment entry row, both sheet hosts, own `<hr>`.
 *
 * Two doubles, both deliberate:
 * - `../lib/db.js` is replaced by an in-memory per-club store so the AC10
 *   single-write-path is observable (call args) and the tri-state
 *   (`hang`) and R7.3 (`failWrites`) paths are reproducible without
 *   IndexedDB. The REAL useClubExclusions + EquipmentOverlaySheet run on top.
 * - `./ClubPickerSheet.jsx` is stubbed to a dialog with two buttons. The
 *   real sheet's search/persist behaviour is ClubPickerSheet.test.jsx's job
 *   (AC2 "no second copy of picker logic": this section only WIRES it, and
 *   the source scan below proves it does not re-implement persistence).
 */

const fx = vi.hoisted(() => {
  const store = new Map();
  const f = {
    store,
    hang: false,
    failWrites: false,
    getClubExclusions: vi.fn(async (id) => {
      if (f.hang) return new Promise(() => {});
      return [...(store.get(id) ?? [])];
    }),
    setClubExclusions: vi.fn(async (id, ids) => {
      if (f.failWrites) throw new Error('quota exceeded');
      store.set(id, [...ids]);
    }),
    NEW_CLUB: { countryCode: 'ES', clubId: 'club-b', name: 'Otro Club', address: 'Calle 2', city: 'Sevilla' },
  };
  return f;
});

vi.mock('../lib/db.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getClubExclusions: fx.getClubExclusions, setClubExclusions: fx.setClubExclusions };
});

vi.mock('./ClubPickerSheet.jsx', async () => {
  const React = await import('react');
  return {
    ClubPickerSheet: ({ onSelect, onClose }) =>
      React.createElement(
        'div',
        { role: 'dialog', 'aria-label': 'picker stub' },
        React.createElement('button', { type: 'button', onClick: () => onSelect(fx.NEW_CLUB) }, 'stub-pick'),
        React.createElement('button', { type: 'button', onClick: onClose }, 'stub-close')
      ),
  };
});

const CLUB = { countryCode: 'ES', clubId: 'club-a', name: 'Test Club', address: 'Calle 1', city: 'Madrid' };
const TOTAL = EQUIPMENT.length;

function seedClub(club = CLUB) {
  localStorage.setItem(CLUB_KEY, JSON.stringify(club));
}

function renderSection() {
  return render(
    <I18nProvider initialLocale="es">
      <MiClubSection />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  fx.store.clear();
  fx.hang = false;
  fx.failWrites = false;
  fx.getClubExclusions.mockClear();
  fx.setClubExclusions.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('MiClubSection — identity, synchronous first paint (AC1)', () => {
  it('shows name and address on the FIRST render when a club is stored (no flash of "no club")', () => {
    seedClub();
    renderSection(); // no await: the assertions run against the first committed frame
    expect(screen.getByText('Mi club')).toBeInTheDocument();
    expect(screen.getByText('Test Club')).toBeInTheDocument();
    expect(screen.getByText('Calle 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar club' })).toBeInTheDocument();
    expect(screen.queryByText('Aún no has elegido tu club.')).not.toBeInTheDocument();
  });

  it('shows a selection prompt — and no equipment row — when nothing is stored', () => {
    renderSection();
    expect(screen.getByText('Mi club')).toBeInTheDocument();
    expect(screen.getByText('Aún no has elegido tu club.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir club' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambiar club' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Equipo del club/)).not.toBeInTheDocument();
  });

  it('never queries the exclusions store while no club exists', () => {
    renderSection();
    expect(fx.getClubExclusions).not.toHaveBeenCalled();
  });
});

describe('MiClubSection — the picker (AC2)', () => {
  it('opens the picker from "Cambiar club" and updates in place on selection', async () => {
    seedClub();
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: 'Cambiar club' }));
    expect(screen.getByRole('dialog', { name: 'picker stub' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'stub-pick' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Otro Club')).toBeInTheDocument();
    expect(screen.getByText('Calle 2')).toBeInTheDocument();
    expect(screen.queryByText('Test Club')).not.toBeInTheDocument();
  });

  it('leaves the section unchanged when the picker is dismissed', async () => {
    seedClub();
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: 'Cambiar club' }));
    await user.click(screen.getByRole('button', { name: 'stub-close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Test Club')).toBeInTheDocument();
  });

  it('turns the unset state into the set state after the first selection', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: 'Elegir club' }));
    await user.click(screen.getByRole('button', { name: 'stub-pick' }));

    expect(screen.getByText('Otro Club')).toBeInTheDocument();
    expect(screen.queryByText('Aún no has elegido tu club.')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Equipo del club/ })).toBeInTheDocument();
  });

  it('re-points the equipment count at the newly chosen club', async () => {
    seedClub();
    fx.store.set('club-a', [EQUIPMENT[0].id, EQUIPMENT[1].id]);
    fx.store.set('club-b', [EQUIPMENT[2].id]);
    const user = userEvent.setup();
    renderSection();
    expect(await screen.findByText(`${TOTAL} equipos · 2 marcados como ausentes`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cambiar club' }));
    await user.click(screen.getByRole('button', { name: 'stub-pick' }));

    expect(await screen.findByText(`${TOTAL} equipos · 1 marcados como ausentes`)).toBeInTheDocument();
  });

  it('adds no picker persistence of its own — ClubPickerSheet owns writeClub (AC2 "no second copy")', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = fs
      .readFileSync(path.join(here, 'MiClubSection.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).toMatch(/from '\.\/ClubPickerSheet\.jsx'/);
    expect(src).toMatch(/from '\.\/EquipmentOverlaySheet\.jsx'/);
    expect(src).not.toMatch(/writeClub|setClubExclusions/);
  });
});

describe('MiClubSection — the equipment entry row (OQ-4 count hint, ux-design §2/§10)', () => {
  it('shows "{total} equipos · {n} marcados como ausentes" and folds the count into the accessible name', async () => {
    seedClub();
    fx.store.set('club-a', [EQUIPMENT[0].id, EQUIPMENT[1].id]);
    renderSection();

    const row = await screen.findByRole('button', {
      name: new RegExp(`Equipo del club.*${TOTAL} equipos.*2 marcados como ausentes`),
    });
    expect(row).toBeInTheDocument();
    expect(screen.getByText(`${TOTAL} equipos · 2 marcados como ausentes`)).toBeInTheDocument();
  });

  it('reports zero once loaded and nothing is excluded', async () => {
    seedClub();
    renderSection();
    expect(await screen.findByText(`${TOTAL} equipos · 0 marcados como ausentes`)).toBeInTheDocument();
  });

  it('drops the "ausentes" clause while exclusions are still loading — never a flash of "0" (tri-state)', () => {
    seedClub();
    fx.hang = true;
    renderSection();
    expect(screen.getByText(`${TOTAL} equipos`)).toBeInTheDocument();
    expect(screen.queryByText(/ausentes/)).not.toBeInTheDocument();
  });

  it('is a real button with a >=44px hit target', async () => {
    seedClub();
    renderSection();
    const row = await screen.findByRole('button', { name: /Equipo del club/ });
    expect(row).toHaveAttribute('type', 'button');
    expect(row).toHaveStyle({ minHeight: '44px' });
  });
});

describe('MiClubSection — the moved equipment overlay (AC3)', () => {
  async function openOverlay(user) {
    const row = await screen.findByRole('button', { name: /Equipo del club/ });
    await user.click(row);
    return screen.findByRole('dialog', { name: /Equipamiento de tu club/ });
  }

  it('opens the intact EquipmentOverlaySheet with one checkbox per catalog item', async () => {
    seedClub();
    const user = userEvent.setup();
    renderSection();

    const dialog = await openOverlay(user);

    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(TOTAL);
    expect(within(dialog).getByText(/Test Club/)).toBeInTheDocument();
  });

  it('writes toggles through the exclusions store, keyed by clubId (single write path)', async () => {
    seedClub();
    const user = userEvent.setup();
    renderSection();
    const dialog = await openOverlay(user);

    await user.click(within(dialog).getAllByRole('checkbox')[0]);

    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalledTimes(1));
    const [clubId, ids] = fx.setClubExclusions.mock.calls[0];
    expect(clubId).toBe('club-a');
    expect(ids).toHaveLength(1);
  });

  it('refreshes the count hint on the row after the overlay closes', async () => {
    seedClub();
    const user = userEvent.setup();
    renderSection();
    const dialog = await openOverlay(user);

    await user.click(within(dialog).getAllByRole('checkbox')[0]);
    await user.click(within(dialog).getByRole('button', { name: 'Listo' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText(`${TOTAL} equipos · 1 marcados como ausentes`)).toBeInTheDocument();
  });

  it('keeps the R7.3 inline write-failure note, and the toggle still applies', async () => {
    seedClub();
    fx.failWrites = true;
    const user = userEvent.setup();
    renderSection();
    const dialog = await openOverlay(user);
    const first = within(dialog).getAllByRole('checkbox')[0];

    await user.click(first);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(first).not.toBeChecked();
  });
});
