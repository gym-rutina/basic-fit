import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/index.js';
import { RestoreSheet } from './RestoreSheet.jsx';
import * as db from '../lib/db.js';
import { UI_LANG_KEY } from '../lib/uiLangStorage.js';
import { INVITE_KEY } from '../lib/inviteStorage.js';
import validExample from '../../../data/examples/phase1-monday.json';

/**
 * full-data-backup S2 — the restore flow (ux-design.md §3, mockup C/D/E).
 * RestoreSheet owns its own hidden <input type=file>; the host just mounts it.
 * db.js is mocked; parseBackup + the real rutina validator + the real
 * settingsRegistry (real jsdom localStorage) run for real.
 *
 * Red-first: fails until Cmok writes RestoreSheet.jsx + backupFormat.js +
 * settingsRegistry.js (writeAllSettings) + the backup.* i18n keys.
 */

vi.mock('../lib/db.js', () => ({
  readAllForBackup: vi.fn(),
  restoreFromBackup: vi.fn().mockResolvedValue(undefined),
}));

const envelope = (over = {}) => ({
  formatVersion: over.formatVersion ?? 1,
  appVersion: '1.17.1',
  exportedAt: over.exportedAt ?? '2026-01-03T12:00:00.000Z',
  data: {
    rutinas: over.rutinas ?? [
      { id: 'r1', seq: 1, importedAt: '2026-01-01T00:00:00.000Z', rutina: validExample },
      { id: 'r2', seq: 2, importedAt: '2026-01-02T00:00:00.000Z', rutina: validExample },
    ],
    activeRutinaId: 'activeRutinaId' in over ? over.activeRutinaId : 'r1',
    sessions: over.sessions ?? new Array(34).fill(0).map((_, i) => ({ id: `s${i}`, status: 'completed', exercises: [] })),
    lastWeights: [],
    settings: over.settings ?? {},
  },
});

function renderSheet(props = {}) {
  const onClose = props.onClose ?? vi.fn();
  const onRestored = props.onRestored ?? vi.fn();
  const utils = render(
    <I18nProvider initialLocale="es">
      <RestoreSheet onClose={onClose} onRestored={onRestored} />
    </I18nProvider>,
  );
  return { ...utils, onClose, onRestored };
}

/** Drop a file onto RestoreSheet's own hidden <input type=file>. */
function chooseFile(container, text, name = 'rutina-backup-2026-01-03.json') {
  const input = container.querySelector('input[type="file"]');
  expect(input).toBeTruthy();
  const file = new File([text], name, { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  db.readAllForBackup.mockResolvedValue({ rutinas: [{}, {}], activeRutinaId: 'r1', sessions: new Array(34).fill({}), lastWeights: [] });
  vi.spyOn(global, 'fetch').mockImplementation(() => { throw new Error('network used'); });
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('RestoreSheet — pick state (GAP-2 fix, S3 "opens flow")', () => {
  it('renders an identifiable dialog with a file-choose control on mount', () => {
    renderSheet();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /elegir archivo/i })).toBeInTheDocument();
    // nothing has been restored just by opening
    expect(db.restoreFromBackup).not.toHaveBeenCalled();
  });

  it('the bundled example rutina is valid (fixture guard)', () => {
    expect(validExample).toHaveProperty('program.name');
  });
});

describe('RestoreSheet — confirm beat (AC12, OQ-1)', () => {
  it('shows the file summary and the concrete loss counts from local data', async () => {
    const { container } = renderSheet();
    chooseFile(container, JSON.stringify(envelope()));

    expect(await screen.findByText(/2 rutinas \(1 activa\)/i)).toBeInTheDocument();
    expect(screen.getByText(/34 sesiones/i)).toBeInTheDocument();
    expect(screen.getByText(/exportada el/i)).toBeInTheDocument();
    expect(screen.getByText(/se borrará lo actual de este dispositivo: 34 sesiones y 2 rutinas/i)).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restaurar y reemplazar/i })).toBeInTheDocument();
  });

  it('empty-install variant: no BORRARÁ sentence, uses "Se restaurarán …" (AC12 exemption)', async () => {
    db.readAllForBackup.mockResolvedValue({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] });
    const { container } = renderSheet();
    chooseFile(container, JSON.stringify(envelope()));

    expect(await screen.findByText(/se restaurarán 2 rutinas y 34 sesiones/i)).toBeInTheDocument();
    expect(screen.queryByText(/se borrará lo actual/i)).not.toBeInTheDocument();
  });
});

describe('RestoreSheet — rejection matrix (AC10, AC11 — nothing written)', () => {
  it('newer formatVersion → errNewerVersion, no ConfirmSheet, restoreFromBackup never called (AC10)', async () => {
    const { container } = renderSheet();
    chooseFile(container, JSON.stringify(envelope({ formatVersion: 2 })));

    expect(await screen.findByRole('alert')).toHaveTextContent(/versión más nueva.*actualiza la app/i);
    expect(screen.queryByRole('button', { name: /restaurar y reemplazar/i })).not.toBeInTheDocument();
    expect(db.restoreFromBackup).not.toHaveBeenCalled();
  });

  it('non-JSON / bad schema → errInvalidFile, nothing written (AC11)', async () => {
    const { container } = renderSheet();
    chooseFile(container, '{ not json at all');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no es válido o está dañado/i);
    expect(db.restoreFromBackup).not.toHaveBeenCalled();
  });

  it('a rutina inside the file fails validation → errInvalidRutina with the first error (AC11)', async () => {
    const broken = envelope({ rutinas: [{ id: 'x', seq: 1, importedAt: '2026-01-01T00:00:00.000Z', rutina: { schemaVersion: 1 } }] });
    const { container } = renderSheet();
    chooseFile(container, JSON.stringify(broken));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/una rutina del archivo no es válida/i);
    expect(alert).toHaveTextContent(/todo el restore se cancela/i);
    expect(db.restoreFromBackup).not.toHaveBeenCalled();
  });
});

describe('RestoreSheet — apply (AC7, AC9)', () => {
  it('confirming calls restoreFromBackup with the file data, announces, and calls onRestored', async () => {
    const user = userEvent.setup();
    const { container, onRestored } = renderSheet();
    chooseFile(container, JSON.stringify(envelope()));

    await user.click(await screen.findByRole('button', { name: /restaurar y reemplazar/i }));

    await waitFor(() => expect(db.restoreFromBackup).toHaveBeenCalledTimes(1));
    expect(db.restoreFromBackup.mock.calls[0][0]).toMatchObject({ rutinas: expect.any(Array), activeRutinaId: 'r1' });
    expect(screen.getByText(/copia restaurada/i)).toBeInTheDocument();
    const live = screen.getByText(/copia restaurada/i).closest('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(onRestored).toHaveBeenCalled(), { timeout: 2000 }); // contract delays onRestored ~800ms so the SR announcement is heard before the host reloads
  });

  it('a failed apply keeps the sheet open, shows errApplyFailed, and offers retry (AC9)', async () => {
    const user = userEvent.setup();
    db.restoreFromBackup.mockRejectedValueOnce(new Error('tx aborted'));
    const { container, onRestored } = renderSheet();
    chooseFile(container, JSON.stringify(envelope()));

    await user.click(await screen.findByRole('button', { name: /restaurar y reemplazar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo restaurar.*intactos/i);
    expect(onRestored).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar restauración/i })).toBeEnabled();
  });
});

describe('RestoreSheet — settings round-trip on restore (GAP-1 fix, AC1/AC7/AD-9)', () => {
  it('confirming writes envelope.data.settings back to localStorage', async () => {
    const user = userEvent.setup();
    // start from a DIFFERENT local state so the write is observable
    localStorage.setItem(UI_LANG_KEY, 'es');
    const env = envelope({ settings: { [UI_LANG_KEY]: 'en', [INVITE_KEY]: 'https://invite.basic-fit.com/xKb92a1c' } });
    const { container } = renderSheet();
    chooseFile(container, JSON.stringify(env));

    await user.click(await screen.findByRole('button', { name: /restaurar y reemplazar/i }));

    await waitFor(() => expect(db.restoreFromBackup).toHaveBeenCalled());
    await waitFor(() => {
      expect(localStorage.getItem(UI_LANG_KEY)).toBe('en');
      expect(localStorage.getItem(INVITE_KEY)).toBe('https://invite.basic-fit.com/xKb92a1c');
    });
  });

  it('settings are written AFTER the DB restore resolves, never before (AD-9)', async () => {
    const user = userEvent.setup();
    let resolveDb;
    db.restoreFromBackup.mockImplementation(() => new Promise((r) => { resolveDb = r; }));
    const env = envelope({ settings: { [UI_LANG_KEY]: 'be' } });
    const { container } = renderSheet();
    chooseFile(container, JSON.stringify(env));

    await user.click(await screen.findByRole('button', { name: /restaurar y reemplazar/i }));
    await waitFor(() => expect(db.restoreFromBackup).toHaveBeenCalled());
    // DB write still pending → settings NOT yet written
    expect(localStorage.getItem(UI_LANG_KEY)).toBeNull();

    resolveDb();
    await waitFor(() => expect(localStorage.getItem(UI_LANG_KEY)).toBe('be'));
  });

  it('a settings-write failure after a committed DB restore still completes (onRestored called) (AD-9)', async () => {
    const user = userEvent.setup();
    const env = envelope({ settings: { [UI_LANG_KEY]: 'nl' } });
    const { container, onRestored } = renderSheet();
    chooseFile(container, JSON.stringify(env));
    await screen.findByRole('button', { name: /restaurar y reemplazar/i });

    // localStorage.setItem throws only during the settings write phase
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota'); });
    await user.click(screen.getByRole('button', { name: /restaurar y reemplazar/i }));

    await waitFor(() => expect(db.restoreFromBackup).toHaveBeenCalled());
    // restore is "done" the moment the DB tx commits — the swallowed setting must not block it
    await waitFor(() => expect(onRestored).toHaveBeenCalled(), { timeout: 2000 });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // no error surfaced for a swallowed setting
  });
});

describe('RestoreSheet — offline (AC15)', () => {
  it('never touches the network across parse and apply', async () => {
    const user = userEvent.setup();
    const { container } = renderSheet();
    chooseFile(container, JSON.stringify(envelope()));
    await user.click(await screen.findByRole('button', { name: /restaurar y reemplazar/i }));
    await waitFor(() => expect(db.restoreFromBackup).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
