import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EquipmentOverlaySheet } from './EquipmentOverlaySheet.jsx';
import { I18nProvider } from '../i18n/index.js';
import * as outbox from '../lib/reportOutbox.js';

/**
 * club-equipment-reporting S3 / AC5 (ux-design §4) — overlay PARITY. Checkbox
 * toggles gain a silent side-effect (a report through the shared hook) and
 * ZERO visual delta: no counter, badge, toast or status is added. The
 * overlay's own include/exclude state is the entire feedback.
 *
 * Unlike the session flow, an explicit include here IS reported as present:
 * there is no "exercise just completed" moment to infer it from (AC5).
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

const CLUB = { clubId: 'club-a', name: 'Alameda', city: 'Málaga' };

function renderOverlay() {
  return render(
    <I18nProvider initialLocale="es">
      <EquipmentOverlaySheet club={CLUB} onClose={vi.fn()} />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  fx.store.clear();
  fx.getClubExclusions.mockClear();
  fx.setClubExclusions.mockClear();
  vi.mocked(outbox.enqueueReport).mockReset().mockResolvedValue(undefined);
});

describe('EquipmentOverlaySheet reports on toggle (AC5)', () => {
  it('unticking a box enqueues an absent/catalog report for that equipment; re-ticking enqueues present', async () => {
    const user = userEvent.setup();
    renderOverlay();
    const boxes = await screen.findAllByRole('checkbox');

    await user.click(boxes[0]);
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalledTimes(1));
    const toggledId = fx.setClubExclusions.mock.calls[0][1][0];
    expect(outbox.enqueueReport).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueReport).toHaveBeenLastCalledWith({ clubId: 'club-a', equipmentId: toggledId, signal: 'absent', method: 'catalog' });

    await user.click(boxes[0]);
    expect(outbox.enqueueReport).toHaveBeenCalledTimes(2);
    expect(outbox.enqueueReport).toHaveBeenLastCalledWith({ clubId: 'club-a', equipmentId: toggledId, signal: 'present', method: 'catalog' });
  });

  it('the report is enqueued from the shared hook, not a second write site: the persisted set and the report agree', async () => {
    const user = userEvent.setup();
    renderOverlay();
    const boxes = await screen.findAllByRole('checkbox');
    await user.click(boxes[3]);
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalled());
    expect(fx.setClubExclusions.mock.calls[0][1]).toEqual([outbox.enqueueReport.mock.calls[0][0].equipmentId]);
  });

  it('a failing outbox never blocks the toggle (AC8)', async () => {
    vi.mocked(outbox.enqueueReport).mockRejectedValue(new Error('outbox down'));
    const user = userEvent.setup();
    renderOverlay();
    const boxes = await screen.findAllByRole('checkbox');
    await user.click(boxes[0]);
    expect(boxes[0]).not.toBeChecked();
    await waitFor(() => expect(fx.setClubExclusions).toHaveBeenCalled());
  });

  it('opening the overlay reports nothing', async () => {
    renderOverlay();
    await screen.findAllByRole('checkbox');
    expect(outbox.enqueueReport).not.toHaveBeenCalled();
  });
});

describe('zero visual delta (ux-design §4 / mockup frame D)', () => {
  it('a toggle adds no status/alert/badge and no new buttons — the reporting is invisible', async () => {
    const user = userEvent.setup();
    const { container } = renderOverlay();
    const boxes = await screen.findAllByRole('checkbox');
    const before = {
      buttons: screen.getAllByRole('button').length,
      alerts: screen.queryAllByRole('alert').length,
    };

    await user.click(boxes[0]);
    await waitFor(() => expect(outbox.enqueueReport).toHaveBeenCalled());

    expect(screen.getAllByRole('button').length).toBe(before.buttons);
    expect(screen.queryAllByRole('alert').length).toBe(before.alerts);
    // the sheet's own excluded-count legitimately changes ("0 excluidos" → "1 excluido");
    // what must NOT appear is any reporting/sync vocabulary
    expect(container.textContent).not.toMatch(/report|enviad|sincroniz|cola de/i);
  });
});
