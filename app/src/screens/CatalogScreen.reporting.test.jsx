import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
import * as outbox from '../lib/reportOutbox.js';

/**
 * club-equipment-reporting × move-club-picker-to-settings (tech-plan.md §2 D3,
 * spec AC5/AC10). DECISION, not accident: a Catálogo chip tap is a membership
 * edit exactly like an overlay checkbox, so it reports — method "catalog",
 * both directions — through the SAME hook, with no second wiring site.
 */

const fx = vi.hoisted(() => {
  const store = new Map();
  return {
    store,
    getClubExclusions: vi.fn(async (id) => [...(store.get(id) ?? [])]),
    setClubExclusions: vi.fn(async (id, ids) => {
      store.set(id, [...ids]);
    }),
  };
});

vi.mock('../lib/db.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getClubExclusions: fx.getClubExclusions, setClubExclusions: fx.setClubExclusions };
});
vi.mock('../lib/reportOutbox.js');

const CLUB = { countryCode: 'ES', clubId: 'club-a', name: 'Test Club', address: 'Calle 1', city: 'Madrid' };
const nameOf = (item) => equipmentDisplayName(item, 'es');
const UNIQUE = EQUIPMENT.filter((e) => EQUIPMENT.filter((o) => nameOf(o) === nameOf(e)).length === 1);
const [A] = UNIQUE;

function renderCatalog() {
  localStorage.setItem(CLUB_KEY, JSON.stringify(CLUB));
  return render(
    <I18nProvider initialLocale="es">
      <MemoryRouter initialEntries={['/catalog']}>
        <CatalogScreen />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  fx.store.clear();
  fx.getClubExclusions.mockClear();
  fx.setClubExclusions.mockClear();
  vi.mocked(outbox.enqueueReport).mockReset().mockResolvedValue(undefined);
  vi.mocked(outbox.enqueueImplicitPresent).mockReset().mockResolvedValue(undefined);
});
afterEach(() => localStorage.clear());

describe('Catálogo chip is a reporting source (method: "catalog")', () => {
  it('excluding via the chip (pill ON) enqueues one absent/catalog report', async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.click(await screen.findByRole('button', { name: `Quitar ${nameOf(A)} de mi club` }));

    expect(outbox.enqueueReport).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueReport).toHaveBeenCalledWith({ clubId: 'club-a', equipmentId: A.id, signal: 'absent', method: 'catalog' });
  });

  it('including via the chip (pill OFF) enqueues one present/catalog report', async () => {
    fx.store.set('club-a', [A.id]);
    const user = userEvent.setup();
    renderCatalog();
    await user.click(await screen.findByRole('button', { name: 'Solo mi club' })); // pill OFF → excluded card visible

    await user.click(await screen.findByRole('button', { name: `Añadir ${nameOf(A)} a mi club` }));

    expect(outbox.enqueueReport).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueReport).toHaveBeenCalledWith({ clubId: 'club-a', equipmentId: A.id, signal: 'present', method: 'catalog' });
  });

  it('a failing outbox never blocks the chip flip or the persisted write (AC8)', async () => {
    vi.mocked(outbox.enqueueReport).mockRejectedValue(new Error('outbox down'));
    const user = userEvent.setup();
    renderCatalog();

    await user.click(await screen.findByRole('button', { name: `Quitar ${nameOf(A)} de mi club` }));

    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalledWith('club-a', [A.id]));
    expect(screen.queryByRole('heading', { level: 3, name: nameOf(A) })).not.toBeInTheDocument();
  });

  it('browsing (no tap) reports nothing — merely opening the Catálogo or toggling the pill is not a signal', async () => {
    const user = userEvent.setup();
    renderCatalog();
    await screen.findAllByRole('button', { name: /^Quitar .+ de mi club$/ });
    await user.click(screen.getByRole('button', { name: 'Solo mi club' }));
    expect(outbox.enqueueReport).not.toHaveBeenCalled();
    expect(outbox.enqueueImplicitPresent).not.toHaveBeenCalled();
  });
});

describe('AC10 — the report outbox has exactly the sanctioned call sites (static tree scan)', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.(js|jsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('only useClubExclusions.js may call enqueueReport, and only ActiveSessionScreen.jsx may call enqueueImplicitPresent', () => {
    const callers = { enqueueReport: [], enqueueImplicitPresent: [] };
    for (const file of walk(SRC)) {
      if (file.endsWith(path.join('lib', 'reportOutbox.js'))) continue;
      const src = strip(fs.readFileSync(file, 'utf8'));
      for (const fn of Object.keys(callers)) {
        if (new RegExp(`\\b${fn}\\s*\\(`).test(src)) callers[fn].push(path.relative(SRC, file).replaceAll('\\', '/'));
      }
    }
    expect(callers.enqueueReport).toEqual(['lib/useClubExclusions.js']);
    expect(callers.enqueueImplicitPresent).toEqual(['screens/ActiveSessionScreen.jsx']);
  });

  it('the screens and sheets never import the outbox or the db report functions directly', () => {
    for (const rel of ['screens/CatalogScreen.jsx', 'components/EquipmentOverlaySheet.jsx', 'components/MiClubSection.jsx', 'components/ClubMembershipChip.jsx']) {
      const src = strip(fs.readFileSync(path.join(SRC, rel), 'utf8'));
      expect(src, rel).not.toMatch(/reportOutbox|putReport|listReports|reportFlush/);
    }
  });
});
