import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/index.js';
import { BackupSection } from './BackupSection.jsx';
import * as db from '../lib/db.js';
import { INVITE_KEY } from '../lib/inviteStorage.js';
import { UI_LANG_KEY } from '../lib/uiLangStorage.js';

/**
 * full-data-backup S1 — the /settings "Copia de seguridad" section
 * (ux-design.md §2, mockup frames A/B). Real jsdom localStorage (the bearer
 * check IS a storage interaction); db.js is mocked so the export path is
 * observable without fake-indexeddb here.
 *
 * Red-first: fails until Cmok writes BackupSection.jsx + backupFormat.js +
 * settingsRegistry.js + appVersion.js + the backup.* i18n keys.
 */

vi.mock('../lib/db.js', () => ({
  readAllForBackup: vi.fn().mockResolvedValue({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] }),
  restoreFromBackup: vi.fn().mockResolvedValue(undefined),
}));

function renderSection() {
  return render(
    <I18nProvider initialLocale="es">
      <BackupSection />
    </I18nProvider>,
  );
}

let createObjectURL, revokeObjectURL, anchorClick;
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  db.readAllForBackup.mockResolvedValue({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] });
  createObjectURL = vi.fn(() => 'blob:mock');
  revokeObjectURL = vi.fn();
  // capture the download without navigating jsdom
  global.URL.createObjectURL = createObjectURL;
  global.URL.revokeObjectURL = revokeObjectURL;
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(global, 'fetch').mockImplementation(() => { throw new Error('network used'); });
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('BackupSection — idle (frame A, AC16)', () => {
  it('renders the section heading, both actions and the disclosure', () => {
    renderSection();
    expect(screen.getByText('Copia de seguridad')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar copia completa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restaurar copia/i })).toBeInTheDocument();
    expect(screen.getByText(/restaurar reemplaza lo que hay en este dispositivo/i)).toBeInTheDocument();
    expect(screen.getByText(/funciona sin conexión/i)).toBeInTheDocument();
  });

  it('offers NO share affordance (OQ-6 — download only)', () => {
    renderSection();
    expect(screen.queryByRole('button', { name: /compartir|share/i })).not.toBeInTheDocument();
  });

  it('never says "importar" anywhere in the section (AC16 wording separation)', () => {
    const { container } = renderSection();
    expect(container.textContent.toLowerCase()).not.toContain('importar');
  });
});

describe('BackupSection — bearer warning (AC13)', () => {
  it('is absent when no invite URL is stored', () => {
    renderSection();
    expect(screen.queryByText(/quien lo tenga puede entrar al gimnasio/i)).not.toBeInTheDocument();
  });

  it('appears when inviteStorage holds a value', () => {
    localStorage.setItem(INVITE_KEY, 'https://invite.basic-fit.com/xKb92a1c');
    renderSection();
    expect(screen.getByText(/quien lo tenga puede entrar al gimnasio/i)).toBeInTheDocument();
    expect(screen.getByText(/trátalo como una llave/i)).toBeInTheDocument();
  });
});

describe('BackupSection — export (AC1, AC3, AC4, AC5, AC6, AC15)', () => {
  it('downloads a file named rutina-backup-YYYY-MM-DD.json, never rutina-progreso-*', async () => {
    const user = userEvent.setup();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    renderSection();

    await user.click(screen.getByRole('button', { name: /descargar copia completa/i }));

    await waitFor(() => expect(anchorClick).toHaveBeenCalled());
    const anchor = appendChild.mock.calls.map((c) => c[0]).find((n) => n && n.tagName === 'A');
    expect(anchor.download).toMatch(/^rutina-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(anchor.download).not.toMatch(/rutina-progreso/);
  });

  it('the blob is JSON carrying formatVersion and the data block', async () => {
    const user = userEvent.setup();
    let blobText = '';
    global.URL.createObjectURL = vi.fn((blob) => { blobText = blob.__text__ ?? ''; return 'blob:mock'; });
    // jsdom Blob: read the parts we passed in
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) { super(parts, opts); this.__text__ = String(parts?.[0] ?? ''); }
    };
    renderSection();

    await user.click(screen.getByRole('button', { name: /descargar copia completa/i }));
    await waitFor(() => expect(anchorClick).toHaveBeenCalled());

    const parsed = JSON.parse(blobText);
    expect(parsed.formatVersion).toBe(1);
    expect(parsed).toHaveProperty('appVersion');
    expect(parsed.data).toHaveProperty('rutinas');
    expect(parsed.data).toHaveProperty('settings');
    global.Blob = OrigBlob;
  });

  it('works with an empty database — no redirect, button stays usable (AC3)', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: /descargar copia completa/i }));
    await waitFor(() => expect(anchorClick).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /descargar copia completa/i })).toBeEnabled();
  });

  it('shows the preparing label while working, then re-enables (AC6)', async () => {
    const user = userEvent.setup();
    let release;
    db.readAllForBackup.mockImplementation(() => new Promise((r) => { release = () => r({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] }); }));
    renderSection();

    await user.click(screen.getByRole('button', { name: /descargar copia completa/i }));
    expect(await screen.findByText(/preparando/i)).toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.getByRole('button', { name: /descargar copia completa/i })).toBeEnabled());
  });

  it('surfaces a visible failure when the read rejects (AC6)', async () => {
    const user = userEvent.setup();
    db.readAllForBackup.mockRejectedValue(new Error('idb boom'));
    renderSection();

    await user.click(screen.getByRole('button', { name: /descargar copia completa/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo generar la copia/i);
    expect(screen.getByRole('button', { name: /descargar copia completa/i })).toBeEnabled();
  });

  it('never touches the network (AC15)', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: /descargar copia completa/i }));
    await waitFor(() => expect(anchorClick).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('the blob carries every seeded allowlisted localStorage setting by its raw value (GAP-1 fix, AC1)', async () => {
    const user = userEvent.setup();
    localStorage.setItem(UI_LANG_KEY, 'be');
    localStorage.setItem(INVITE_KEY, 'https://invite.basic-fit.com/xKb92a1c');

    let blobText = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) { super(parts, opts); blobText = String(parts?.[0] ?? ''); }
    };
    renderSection();

    await user.click(screen.getByRole('button', { name: /descargar copia completa/i }));
    await waitFor(() => expect(anchorClick).toHaveBeenCalled());

    const parsed = JSON.parse(blobText);
    expect(parsed.data.settings[UI_LANG_KEY]).toBe('be');
    expect(parsed.data.settings[INVITE_KEY]).toBe('https://invite.basic-fit.com/xKb92a1c');
    global.Blob = OrigBlob;
  });
});

describe('BackupSection — restore entry opens the flow (GAP-2 fix)', () => {
  it('clicking "Restaurar copia…" mounts the RestoreSheet dialog', async () => {
    const user = userEvent.setup();
    renderSection();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /restaurar copia/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
