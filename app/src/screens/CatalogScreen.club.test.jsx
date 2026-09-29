import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { CatalogScreen } from './CatalogScreen.jsx';
import { I18nProvider } from '../i18n/index.js';
import { CLUB_KEY } from '../lib/clubStorage.js';
import { EQUIPMENT, equipmentDisplayName } from '../data/equipment.js';

/**
 * move-club-picker-to-settings — the Catálogo half (AC4–AC10, AC12).
 * ux-design.md S2 (club block DELETED), S3 (pill re-homed), S4 (per-card
 * chip), S5 (club-filtered empty state); tech-plan.md §3/§4.
 *
 * `../lib/db.js` is replaced by an in-memory per-club store: the REAL
 * useClubExclusions runs on top, so what is asserted is the actual write
 * path (call args of setClubExclusions), the tri-state (`hang`) and the
 * R7.3 failure path (`failWrites`) — none of which jsdom's missing
 * IndexedDB can reproduce.
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
  };
  return f;
});

vi.mock('../lib/db.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getClubExclusions: fx.getClubExclusions, setClubExclusions: fx.setClubExclusions };
});

const CLUB = { countryCode: 'ES', clubId: 'club-a', name: 'Test Club', address: 'Calle 1', city: 'Madrid' };
const TOTAL = EQUIPMENT.length;
const nameOf = (item) => equipmentDisplayName(item, 'es');
// Items whose Spanish display name is unique, so a chip's accessible name
// (which embeds it) addresses exactly one card.
const UNIQUE = EQUIPMENT.filter((e) => EQUIPMENT.filter((o) => nameOf(o) === nameOf(e)).length === 1);
const [A, B, C] = UNIQUE;

const CHIP_NAME = /^(Quitar|Añadir) .+ (de|a) mi club$/;
const removeName = (item) => `Quitar ${nameOf(item)} de mi club`;
const addName = (item) => `Añadir ${nameOf(item)} a mi club`;

function seedClub() {
  localStorage.setItem(CLUB_KEY, JSON.stringify(CLUB));
}

function renderCatalog(locale = 'es') {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/catalog']}>
        <CatalogScreen />
      </MemoryRouter>
    </I18nProvider>
  );
}

const pill = () => screen.getByRole('button', { name: 'Solo mi club' });
const cards = () => screen.queryAllByRole('article');
const chips = () => screen.queryAllByRole('button', { name: CHIP_NAME });
const cardHeading = (item) => screen.queryByRole('heading', { level: 3, name: nameOf(item) });

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

it('fixture sanity: at least three equipment items have a unique display name', () => {
  expect(UNIQUE.length).toBeGreaterThanOrEqual(3);
  expect(C).toBeDefined();
});

describe('AC4 — Catálogo renders NO club identity or change UI, in any state', () => {
  it('with a club selected: no name/address row, no change or overlay entry, no sheets', async () => {
    seedClub();
    renderCatalog();
    await screen.findAllByRole('button', { name: CHIP_NAME }); // exclusions loaded → settled frame

    expect(screen.queryByText('Test Club')).not.toBeInTheDocument();
    expect(screen.queryByText('Calle 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cambiar club|elegir club/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /qué equipamiento tiene tu club/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('with no club: no selection prompt and no Elegir club button either (removal is unconditional)', () => {
    renderCatalog();
    expect(screen.queryByText(/Elige tu club para filtrar/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /elegir club|cambiar club/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is removed from the SOURCE, not hidden: no picker/overlay hosts, no club-row keys', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = fs
      .readFileSync(path.join(here, 'CatalogScreen.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/ClubPickerSheet|EquipmentOverlaySheet/);
    expect(src).not.toMatch(/clubRowEmptyHint|clubRowButton|club\.changeButton|equipmentOverlayTrigger/);
    expect(src).not.toMatch(/club\.(name|address)/);
  });
});

describe('AC5 / AC6 — the "Solo mi club" pill', () => {
  it('is structurally ABSENT with no club (AC6): no pill, no chips, full catalog', () => {
    renderCatalog();
    expect(screen.queryByRole('button', { name: 'Solo mi club' })).not.toBeInTheDocument();
    expect(chips()).toHaveLength(0);
    expect(cards()).toHaveLength(TOTAL);
  });

  it('is the club control that remains: present, ON by default (AC5)', async () => {
    seedClub();
    renderCatalog();
    expect(pill()).toHaveAttribute('aria-pressed', 'true');
    await screen.findAllByRole('button', { name: CHIP_NAME });
  });

  it('is inert while nothing is excluded: ON but the whole catalog shows (filterByClub guard, AC5)', async () => {
    seedClub();
    renderCatalog();
    await screen.findAllByRole('button', { name: CHIP_NAME });
    expect(pill()).toHaveAttribute('aria-pressed', 'true');
    expect(cards()).toHaveLength(TOTAL);
  });

  it('filters excluded items while ON and restores them when toggled OFF (semantics unchanged)', async () => {
    seedClub();
    fx.store.set('club-a', [A.id, B.id]);
    const user = userEvent.setup();
    renderCatalog();

    await waitFor(() => expect(cards()).toHaveLength(TOTAL - 2));
    expect(cardHeading(A)).not.toBeInTheDocument();
    expect(cardHeading(B)).not.toBeInTheDocument();

    await user.click(pill());

    expect(pill()).toHaveAttribute('aria-pressed', 'false');
    expect(cards()).toHaveLength(TOTAL);
    expect(cardHeading(A)).toBeInTheDocument();
  });
});

describe('AC7 — pill ON: each visible card excludes with one tap', () => {
  it('gives every visible card an "En mi club" chip named for the remove action', async () => {
    seedClub();
    fx.store.set('club-a', [B.id]);
    renderCatalog();

    await waitFor(() => expect(cards()).toHaveLength(TOTAL - 1));
    expect(chips()).toHaveLength(TOTAL - 1);
    const chip = screen.getByRole('button', { name: removeName(A) });
    expect(chip).toHaveTextContent('En mi club');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('removes the card from the filtered view on tap and persists the exclusion', async () => {
    seedClub();
    fx.store.set('club-a', [B.id]);
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => expect(cards()).toHaveLength(TOTAL - 1));

    await user.click(screen.getByRole('button', { name: removeName(A) }));

    expect(cardHeading(A)).not.toBeInTheDocument();
    expect(cards()).toHaveLength(TOTAL - 2);
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalledTimes(1));
    const [clubId, ids] = fx.setClubExclusions.mock.calls[0];
    expect(clubId).toBe('club-a');
    expect([...ids].sort()).toEqual([A.id, B.id].sort());
  });
});

describe('AC8 — pill OFF: every card reflects membership and flips immediately', () => {
  async function pillOff(user) {
    await waitFor(() => expect(cards()).toHaveLength(TOTAL - 1));
    await user.click(pill());
    expect(cards()).toHaveLength(TOTAL);
  }

  it('offers removal on included items and addition on excluded items', async () => {
    seedClub();
    fx.store.set('club-a', [B.id]);
    const user = userEvent.setup();
    renderCatalog();
    await pillOff(user);

    const included = screen.getByRole('button', { name: removeName(A) });
    expect(included).toHaveTextContent('En mi club');
    const excluded = screen.getByRole('button', { name: addName(B) });
    expect(excluded).toHaveTextContent('Fuera de mi club');
    expect(excluded).toHaveAttribute('aria-pressed', 'false');
    expect(chips()).toHaveLength(TOTAL);
  });

  it('flips an included chip to excluded in place (card stays in the grid) and persists', async () => {
    seedClub();
    fx.store.set('club-a', [B.id]);
    const user = userEvent.setup();
    renderCatalog();
    await pillOff(user);

    await user.click(screen.getByRole('button', { name: removeName(A) }));

    const flipped = screen.getByRole('button', { name: addName(A) });
    expect(flipped).toHaveTextContent('Fuera de mi club');
    expect(cardHeading(A)).toBeInTheDocument();
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalled());
    const [, ids] = fx.setClubExclusions.mock.calls.at(-1);
    expect([...ids].sort()).toEqual([A.id, B.id].sort());
  });

  it('flips an excluded chip back to included and persists the removal', async () => {
    seedClub();
    fx.store.set('club-a', [B.id]);
    const user = userEvent.setup();
    renderCatalog();
    await pillOff(user);

    await user.click(screen.getByRole('button', { name: addName(B) }));

    expect(screen.getByRole('button', { name: removeName(B) })).toHaveTextContent('En mi club');
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalled());
    expect(fx.setClubExclusions.mock.calls.at(-1)).toEqual(['club-a', []]);
  });
});

describe('AC9 — tri-state and persistence failure', () => {
  it('renders UNFILTERED with NO chips while exclusions are unloaded (null ≠ filtered)', () => {
    seedClub();
    fx.hang = true;
    renderCatalog();
    expect(cards()).toHaveLength(TOTAL);
    expect(chips()).toHaveLength(0);
    expect(pill()).toBeInTheDocument();
  });

  it('applies the toggle in memory and shows ONE R7.3 note when the write fails (pill ON)', async () => {
    seedClub();
    fx.failWrites = true;
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => expect(chips()).toHaveLength(TOTAL));

    await user.click(screen.getByRole('button', { name: removeName(A) }));

    expect(cardHeading(A)).not.toBeInTheDocument(); // flow never blocked
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('No se pudo guardar — los cambios se mantienen en esta sesión');
  });

  it('keeps the note visible even though the toggled card left the grid, and clears it on the next good write', async () => {
    seedClub();
    fx.failWrites = true;
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => expect(chips()).toHaveLength(TOTAL));

    await user.click(screen.getByRole('button', { name: removeName(A) }));
    await screen.findByRole('alert');
    expect(cardHeading(A)).not.toBeInTheDocument(); // the note is NOT card-anchored

    fx.failWrites = false;
    await user.click(screen.getByRole('button', { name: removeName(B) }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('flips the chip and shows the note on a failed write with the pill OFF', async () => {
    seedClub();
    fx.failWrites = true;
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => expect(chips()).toHaveLength(TOTAL));
    await user.click(pill());

    await user.click(screen.getByRole('button', { name: removeName(A) }));

    expect(screen.getByRole('button', { name: addName(A) })).toBeInTheDocument();
    expect(await screen.findAllByRole('alert')).toHaveLength(1);
  });

  it('shows no note when nothing failed', async () => {
    seedClub();
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => expect(chips()).toHaveLength(TOTAL));
    await user.click(screen.getByRole('button', { name: removeName(A) }));
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AC10 — one mutation path', () => {
  it('accumulates across chips: the 2nd write carries the 1st exclusion (one hook instance, not one per chip)', async () => {
    seedClub();
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => expect(chips()).toHaveLength(TOTAL));

    await user.click(screen.getByRole('button', { name: removeName(A) }));
    await user.click(screen.getByRole('button', { name: removeName(B) }));

    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalledTimes(2));
    const [first, second] = fx.setClubExclusions.mock.calls;
    expect(first[0]).toBe('club-a');
    expect(second[0]).toBe('club-a');
    expect([...first[1]]).toEqual([A.id]);
    expect([...second[1]].sort()).toEqual([A.id, B.id].sort());
  });

  it('has exactly one useClubExclusions call and no direct store access in the Catálogo or the chip', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const read = (rel) =>
      fs
        .readFileSync(path.join(here, rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    const catalog = read('CatalogScreen.jsx');
    const chip = read('../components/ClubMembershipChip.jsx');
    expect((catalog.match(/useClubExclusions\(/g) || []).length).toBe(1);
    expect(catalog).not.toMatch(/setClubExclusions|getClubExclusions/);
    expect(chip).not.toMatch(/useClubExclusions|setClubExclusions|getClubExclusions/);
  });
});

describe('S5 — club-filter-caused empty grid (ux-design §5, OQ-2)', () => {
  const ALL = EQUIPMENT.map((e) => e.id);

  it('shows the dedicated status message instead of the generic "Sin resultados"', async () => {
    seedClub();
    fx.store.set('club-a', ALL);
    renderCatalog();

    const msg = await screen.findByText(/Has marcado todo el equipo como ausente de tu club/);
    expect(msg.closest('[role="status"]')).not.toBeNull();
    expect(msg).toHaveTextContent('Desactiva «Solo mi club»');
    expect(msg).toHaveTextContent('Ajustes');
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
    expect(cards()).toHaveLength(0);
  });

  it('moves focus to the pill when the last visible card is excluded', async () => {
    seedClub();
    fx.store.set('club-a', ALL.filter((id) => id !== C.id));
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => expect(cards()).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: removeName(C) }));

    await screen.findByText(/Has marcado todo el equipo como ausente de tu club/);
    await waitFor(() => expect(pill()).toHaveFocus());
  });

  it('is absent with the pill OFF — the full catalog shows instead', async () => {
    seedClub();
    fx.store.set('club-a', ALL);
    const user = userEvent.setup();
    renderCatalog();
    await screen.findByText(/Has marcado todo el equipo como ausente de tu club/);

    await user.click(pill());

    expect(screen.queryByText(/Has marcado todo el equipo/)).not.toBeInTheDocument();
    expect(cards()).toHaveLength(TOTAL);
  });
});

describe('AC12 — the rest of the Catálogo behaves as before', () => {
  it('category filtering still narrows the grid, and each remaining card keeps its chip', async () => {
    seedClub();
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => expect(chips()).toHaveLength(TOTAL));
    const chestCount = EQUIPMENT.filter((e) => e.category === 'chest').length;

    await user.click(screen.getByRole('button', { name: 'Pecho' }));

    expect(cards()).toHaveLength(chestCount);
    expect(chips()).toHaveLength(chestCount);
  });

  it('keeps the English UI chrome: chip strings follow the locale', async () => {
    seedClub();
    renderCatalog('en');
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Remove .+ from my club$/ }).length).toBe(TOTAL));
    expect(within(document.body).queryByText('En mi club')).not.toBeInTheDocument();
  });
});
