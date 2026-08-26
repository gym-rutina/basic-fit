import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExercisePickerSheet } from './ExercisePickerSheet.jsx';
import { I18nProvider } from '../i18n/index.js';

// pill-overflow-ux S4 — the Progreso exercise picker's sheet, contract-cloned
// from ClubPickerSheet (role=dialog/aria-modal/Escape/scrim/focus-return) with
// a searchable, alphabetically-sorted list (tech-plan.md D-D).
//
// Search is diacritic-insensitive BY REUSE: both query and labels go through
// lib/clubFilter.js's foldForSearch — OQ3 answered with an existing tested
// primitive instead of new matching code.
//
// RED until Cmok creates ExercisePickerSheet.jsx.

const ITEMS = [
  { key: 'prensa-pecho-g3s10', label: 'Prensa de Pecho · G3-S10' },
  { key: 'press-frances-szb40', label: 'Press francés · SZ-B40' },
  { key: 'abducciones-m5a01', label: 'Ábducciones · M5-A01' },
  { key: 'jalon-pecho-g3s20', label: 'Jalón al Pecho · G3-S20' },
];

function renderSheet(props = {}) {
  const close = vi.fn();
  const select = vi.fn();
  const trigger = { current: null };
  render(
    <I18nProvider initialLocale="es">
      <ExercisePickerSheet
        items={ITEMS}
        selectedKey="prensa-pecho-g3s10"
        onSelect={select}
        onClose={close}
        returnFocusTo={trigger}
        {...props}
      />
    </I18nProvider>
  );
  return { close, select };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('ExercisePickerSheet — dialog conventions (AC14, ClubPickerSheet contract)', () => {
  it('renders role=dialog + aria-modal', () => {
    renderSheet();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('autofocuses the close control on mount and restores focus to returnFocusTo on unmount', () => {
    const restore = vi.fn();
    const trigger = { current: { focus: restore } };
    const { unmount } = render(
      <I18nProvider initialLocale="es">
        <ExercisePickerSheet items={ITEMS} selectedKey="x" onSelect={() => {}} onClose={() => {}} returnFocusTo={trigger} />
      </I18nProvider>
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: /cerrar|✕/i }));
    unmount();
    expect(restore).toHaveBeenCalled();
  });

  it('closes on Escape and via the ✕ control', async () => {
    const user = userEvent.setup();
    const { close } = renderSheet();

    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /cerrar|✕/i }));
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe('ExercisePickerSheet — list semantics (AC11 alphabetical)', () => {
  it('sorts rows by FOLDED label ascending, so accented names interleave correctly', () => {
    renderSheet();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    const labels = rows.map((r) => r.textContent);

    // Folded order: abducciones < jalon < prensa < press — NOT raw-code order
    // (Á would sort last unsorted) and NOT insertion order.
    expect(labels[0]).toMatch(/Ábducciones/i);
    expect(labels[1]).toMatch(/Jalón al Pecho/i);
    expect(labels[2]).toMatch(/Prensa de Pecho/i);
    expect(labels[3]).toMatch(/Press francés/i);
  });

  it('marks the current selection (aria-current)', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: /Prensa de Pecho · G3-S10/ })).toHaveAttribute('aria-current', 'true');
  });
});

describe('ExercisePickerSheet — search (AC12, OQ3 diacritic-insensitive by reuse)', () => {
  it('matches case- AND accent-insensitively against display name incl. suffix', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText(/buscar ejercicio/i), 'FRANCÉS');

    expect(screen.getByRole('button', { name: /Press francés · SZ-B40/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Prensa de Pecho/ })).not.toBeInTheDocument();
  });

  it('announces no-results once via role=status, naming the query', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText(/buscar ejercicio/i), 'zzzz');

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('zzzz');
  });

  it('restores the full list when the query is cleared', async () => {
    const user = userEvent.setup();
    renderSheet();
    const input = screen.getByLabelText(/buscar ejercicio/i);

    await user.type(input, 'FRANCÉS');
    await user.clear(input);

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('ExercisePickerSheet — selection (AC13)', () => {
  it('calls onSelect with the item key exactly once and closes', async () => {
    const user = userEvent.setup();
    const { select, close } = renderSheet();

    await user.click(screen.getByRole('button', { name: /Jalón al Pecho · G3-S20/ }));

    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('jalon-pecho-g3s20');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('functions with a single-item list (AC15 — no hiding special-case)', () => {
    renderSheet({ items: [{ key: 'only-one', label: 'Solo este · G1-X01' }] });

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });
});
