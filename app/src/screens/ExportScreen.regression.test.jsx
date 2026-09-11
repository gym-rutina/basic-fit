import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ExportScreen } from './ExportScreen.jsx';
import * as db from '../lib/db.js';
import { I18nProvider } from '../i18n/index.js';

/**
 * full-data-backup AC17 — the LLM export (route /export, reached from
 * Historial) keeps its current filename, copy and entry point. This guard
 * exists so the new backup feature cannot silently drift the two exports
 * together. It asserts the ONE thing AC4 pins as "never collides":
 * the LLM export still downloads `rutina-progreso-YYYY-MM-DD.json`.
 */

vi.mock('../lib/db.js', () => ({
  listSessions: vi.fn().mockResolvedValue([
    { id: 's1', status: 'completed', startedAt: '2026-07-01T09:00:00.000Z', endedAt: '2026-07-01T09:50:00.000Z', dayLabel: 'Lunes', dayIndex: 0, exercises: [] },
  ]),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('ExportScreen — LLM export filename is unchanged (AC17 / AC4 non-collision)', () => {
  it('downloads rutina-progreso-YYYY-MM-DD.json, never rutina-backup-*', async () => {
    const user = userEvent.setup();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendChild = vi.spyOn(document.body, 'appendChild');

    render(
      <I18nProvider initialLocale="es">
        <MemoryRouter initialEntries={['/export']}>
          <ExportScreen />
        </MemoryRouter>
      </I18nProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /descargar \.json/i }));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());

    const anchor = appendChild.mock.calls.map((c) => c[0]).find((n) => n && n.tagName === 'A');
    expect(anchor.download).toMatch(/^rutina-progreso-\d{4}-\d{2}-\d{2}\.json$/);
    expect(anchor.download).not.toMatch(/rutina-backup/);
  });
});
