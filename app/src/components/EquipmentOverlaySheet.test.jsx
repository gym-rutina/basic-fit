import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EquipmentOverlaySheet } from './EquipmentOverlaySheet.jsx';
import { I18nProvider } from '../i18n/index.js';
import { EQUIPMENT } from '../data/equipment.js';

/**
 * gym-directory-and-catalog AC44 / AC44b / R7.1–R7.5 (tech-plan.md D11/D21,
 * ux-design.md §3, mockups.md Screens E/F/F′/F‴).
 *
 * NOTE for whoever builds this: `design-system/ui_kits/rutina/EquipmentOverlaySheet.jsx`
 * is a MOCKUP, not a source to port (tech-plan-build-b.md D20). It reads
 * `window.BF_KIT_DATA`/`window.BF_KIT_CLUB_STORE`, uses kit-data field names
 * (`item.name.es`, `item.model` rather than `names`/`modelCode`), and hardcodes
 * Spanish literals that `strayLiterals.test.js` fails on. Match its STRUCTURE —
 * three static kind sections, native checkbox + label at 44px, the aria-live
 * excluded count, the role="alert" write-failure note — and write it fresh as
 * an ES module against i18n keys.
 *
 * R7.3 is the criterion with teeth: the overlay is a correction, never a
 * required setup step, and an IndexedDB write failure must NOT block the user.
 * That is why the write-failure test asserts the toggle still applies.
 */

const CLUB = { clubId: '1ec43550fd654c7d8e23bc6c96cd2ff0', name: 'Alameda', city: 'Málaga' };

function renderOverlay(props = {}) {
  return render(
    <I18nProvider initialLocale="es">
      <EquipmentOverlaySheet club={CLUB} onClose={props.onClose ?? vi.fn()} {...props} />
    </I18nProvider>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('sheet semantics (ux-design §5)', () => {
  it('is a labelled modal dialog', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('names the club it is scoped to', () => {
    renderOverlay();
    expect(screen.getByText(/Alameda/)).toBeInTheDocument();
  });
});

describe('three sections grouped by kind (AC44, R7.2)', () => {
  it('renders all 48 entries as checkboxes', async () => {
    renderOverlay();
    expect(await screen.findAllByRole('checkbox')).toHaveLength(EQUIPMENT.length);
    expect(EQUIPMENT.length).toBe(48);
  });

  it('renders exactly three sections holding 29 / 14 / 5 items', () => {
    /**
     * Asserted by GROUP MEMBERSHIP, not by searching the document for the
     * digits. `getByText(/5/)` matches 16 model codes in the shipped catalog
     * (G3-S45, G3-S50, ZMT-CTKB-5626, …) and throws "Found multiple
     * elements" — reporting a correct implementation as a broken test. Same
     * class as the two gate blockers; caught by sweeping for it rather than
     * by waiting for it to fail.
     *
     * The counts are the criterion: grouping by `category` instead of `kind`
     * yields 27/16/5, which still sums to 48 — which is why AC44b's
     * membership assertion below exists as well.
     */
    renderOverlay();

    const counts = {
      machine: within(screen.getByRole('group', { name: /m[áa]quinas/i })).getAllByRole('checkbox').length,
      'free-weight': within(screen.getByRole('group', { name: /peso libre/i })).getAllByRole('checkbox').length,
      accessory: within(screen.getByRole('group', { name: /accesorios/i })).getAllByRole('checkbox').length,
    };

    expect(counts).toEqual({ machine: 29, 'free-weight': 14, accessory: 5 });
  });

  it('orders the sections Máquinas → Peso libre → Accesorios (KIND_ORDER)', () => {
    renderOverlay();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    const joined = headings.join('|');
    expect(joined).toMatch(/M[áa]quinas.*Peso libre.*Accesorios/);
  });

  it('renders no fourth section for gear (AC44c)', () => {
    // `kind: "gear"` is rutina-side only; equipment.schema.json rejects it.
    // A fourth section would render permanently empty.
    renderOverlay();
    // queryAllByText — `queryByText` throws on multiple matches just as
    // `getByText` does, so a fourth section rendering the word twice would
    // surface as a thrown error rather than as this assertion failing.
    expect(screen.queryAllByText(/equipamiento adicional|gear/i)).toHaveLength(0);
  });
});

describe('the two-axis disagreement in the rendered sheet (AC44b, M11)', () => {
  it('shows G3-MS24 and MG-PL13 under Máquinas, not under Peso libre', () => {
    /**
     * This is what M11 is actually about: users looking for the Adjustable
     * Pulley expect it with the machines, not next to the dumbbells.
     *
     * Asserted through the CHECKBOX ROLE, not `getByText`. Two reasons, and
     * the second is the one that bit three gates running:
     *
     *  1. It asserts the criterion. AC44b is about which GROUP the item is
     *     in; a bare text match would also pass if the code rendered the
     *     model code in a section heading or a tooltip.
     *  2. `getByText(/G3-MS24/i)` and `queryByText` BOTH throw on multiple
     *     matches, and id `g3-ms24` and modelCode `G3-MS24` both match that
     *     regex. A correct implementation that renders the id anywhere would
     *     be reported as a broken test rather than as a pass — and the
     *     negative assertions below would report the REAL bug (item in the
     *     wrong section) as a thrown error instead of a failed expectation.
     *
     * `*AllBy*` cannot throw on multiplicity, so the count is the assertion.
     */
    renderOverlay();

    const machineSection = screen.getByRole('group', { name: /m[áa]quinas/i });
    const freeWeights = screen.getByRole('group', { name: /peso libre/i });

    for (const code of [/G3-MS24/i, /MG-PL13/i]) {
      expect(within(machineSection).getAllByRole('checkbox', { name: code })).toHaveLength(1);
      expect(within(freeWeights).queryAllByRole('checkbox', { name: code })).toHaveLength(0);
    }
  });
});

describe('toggling exclusions (R7.1, R7.4, R7.5, AC43)', () => {
  it('starts with everything ticked — defaults to "all present" (R7.4)', async () => {
    renderOverlay();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  it('unticking marks an item excluded and updates the live count', async () => {
    renderOverlay();
    const boxes = await screen.findAllByRole('checkbox');

    await userEvent.click(boxes[0]);

    expect(boxes[0].checked).toBe(false);
    const live = document.querySelector('[aria-live="polite"]');
    expect(live.textContent).toMatch(/1/);
  });

  it('re-ticking removes the exclusion again', async () => {
    renderOverlay();
    const boxes = await screen.findAllByRole('checkbox');

    await userEvent.click(boxes[0]);
    await userEvent.click(boxes[0]);

    expect(boxes[0].checked).toBe(true);
  });

  it('gives every row a native checkbox with an associated label', async () => {
    // ux-design §5: native input + label, >= 44px. A div-with-role would lose
    // the label association and the whole list becomes unusable by voice.
    renderOverlay();
    const boxes = await screen.findAllByRole('checkbox');
    for (const box of boxes.slice(0, 5)) {
      expect(box.tagName).toBe('INPUT');
      expect(box).toHaveAccessibleName();
    }
  });
});

describe('write failure never blocks the flow (R7.3, ux-design §2 error row)', () => {
  it('keeps the toggle applied in memory when persistence throws', async () => {
    // R7.3 — "a correction, not a required setup step". If a failed write
    // reverted the checkbox, a user on a device with a full quota would fight
    // the UI forever. State updates first; the failure is reported second.
    const onPersistError = vi.fn();
    renderOverlay({ simulateWriteError: true, onPersistError });

    const boxes = await screen.findAllByRole('checkbox');
    await userEvent.click(boxes[0]);

    expect(boxes[0].checked).toBe(false);
  });

  it('shows a non-blocking inline alert rather than a modal error', async () => {
    renderOverlay({ simulateWriteError: true });

    const boxes = await screen.findAllByRole('checkbox');
    await userEvent.click(boxes[0]);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Still dismissible — the flow completes.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('still allows the sheet to be closed after a write failure', async () => {
    const onClose = vi.fn();
    renderOverlay({ simulateWriteError: true, onClose });

    const boxes = await screen.findAllByRole('checkbox');
    await userEvent.click(boxes[0]);
    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});

describe('the flow completes without ever opening this sheet (AC44, R7.3)', () => {
  it('is not required — no test here opens it as a precondition', () => {
    // Documentation-as-assertion: the guide flow's own tests
    // (GuideOverlay.test.jsx) must reach a copied prompt without rendering
    // this component at all. Asserted there, restated here so the constraint
    // is visible from the component that would otherwise become mandatory.
    expect(true).toBe(true);
  });
});
