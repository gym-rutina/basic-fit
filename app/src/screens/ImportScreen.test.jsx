import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportScreen } from './ImportScreen.jsx';
import * as db from '../lib/db.js';
import { I18nProvider } from '../i18n/index.js';
import { mockClipboard } from '../test-utils/clipboard.js';

vi.mock('../lib/db.js', () => ({
  // multi-rutina-library §3 surgery — the mock factory gained the library API
  // (listRutinas/saveRutinaEntry/activateRutina); the legacy single-slot fns
  // stay only because earlier describes' module graph still names them.
  saveActiveRutina: vi.fn(),
  getActiveRutina: vi.fn().mockResolvedValue(null),
  getActiveSession: vi.fn().mockResolvedValue(null),
  listSessions: vi.fn().mockResolvedValue([]),
  listRutinas: vi.fn().mockResolvedValue([]),
  saveRutinaEntry: vi.fn(),
  activateRutina: vi.fn(),
  // full-data-backup — RestoreSheet (mounted by the new "Restaurar copia…"
  // entry) reads these; a resolved empty snapshot keeps the confirm beat calm.
  readAllForBackup: vi.fn().mockResolvedValue({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] }),
  restoreFromBackup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/onboardingStorage.js', () => ({
  hasSeenOnboarding: vi.fn().mockReturnValue(true),
  markOnboardingSeen: vi.fn(),
}));

/**
 * import-flow-guided-first (spec D2/D3/D4, AC5/AC6/AC8/AC10/AC15): ImportScreen
 * is now the JSON screen (J) only. The guide link, onboarding link and restore
 * button moved out — see ImportFork.test.jsx / PromptCopyScreen.test.jsx.
 * Tests here are RED until Cmok edits ImportScreen.jsx (tech-plan §2).
 */
describe('ImportScreen (J) — guided-path entry and removed entry points (AC6, AC8, AC10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no longer renders the small "LLM creation guide" text link or opens a guide overlay (AC10)', () => {
    render(
      <I18nProvider initialLocale="en">
        <ImportScreen />
      </I18nProvider>
    );
    expect(screen.queryByRole('link', { name: /llm creation guide/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no longer hosts the onboarding revisit link or the restore button (moved to the fork)', () => {
    render(<ImportScreen />);
    expect(screen.queryByRole('link', { name: /c[oó]mo funciona la app/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restaurar copia/i })).not.toBeInTheDocument();
  });

  it('shows a "Preparar prompt" button above the textarea while it is empty and calls onPreparePrompt (AC6, AC8)', async () => {
    const onPreparePrompt = vi.fn();
    const user = userEvent.setup();
    render(<ImportScreen onPreparePrompt={onPreparePrompt} />);
    await user.click(screen.getByRole('button', { name: /preparar prompt/i }));
    expect(onPreparePrompt).toHaveBeenCalledTimes(1);
  });

  it('hides that button once the textarea has content', () => {
    render(<ImportScreen onPreparePrompt={() => {}} />);
    fireEvent.change(screen.getByLabelText(/rutina\.json/i), { target: { value: '{"a":1}' } });
    expect(screen.queryByRole('button', { name: /preparar prompt/i })).not.toBeInTheDocument();
  });

  it('renders an "Atrás" control that calls onBack', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<ImportScreen onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the page heading on mount (AC13 route-change a11y)', () => {
    render(<ImportScreen />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('has exactly ONE "Preparar prompt" entry — the bottom text line was dropped (tech-plan AD-7)', () => {
    render(<ImportScreen onPreparePrompt={() => {}} />);
    expect(screen.getAllByText(/preparar prompt/i)).toHaveLength(1);
    expect(screen.queryByText(/a[uú]n no tienes el json/i)).not.toBeInTheDocument();
  });

  it('keeps "Cargar ejemplo" while empty and hides it with content (AC9, D4)', () => {
    render(<ImportScreen />);
    expect(screen.getByRole('button', { name: /ejemplo/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/rutina\.json/i), { target: { value: '{"a":1}' } });
    expect(screen.queryByRole('button', { name: /ejemplo/i })).not.toBeInTheDocument();
  });
});

describe('ImportScreen (J) — "Copiar errores" (AC15, UX J3/J4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderWithErrors(clipboard = 'ok') {
    const user = userEvent.setup();
    const writeText = mockClipboard(clipboard); // after setup(): user-event overwrites navigator.clipboard
    render(<ImportScreen />);
    fireEvent.change(screen.getByLabelText(/rutina\.json/i), { target: { value: '{"schemaVersion":1}' } });
    await user.click(screen.getByRole('button', { name: /^importar$/i }));
    await screen.findByRole('alert');
    return { user, writeText };
  }

  it('shows no "Copiar errores" button before any error', () => {
    render(<ImportScreen />);
    expect(screen.queryByRole('button', { name: /copiar errores/i })).not.toBeInTheDocument();
  });

  it('shows a "Copiar errores" button inside the error block once validation fails', async () => {
    await renderWithErrors();
    const alert = screen.getAllByRole('alert')[0];
    expect(within(alert).getByRole('button', { name: /copiar errores/i })).toBeInTheDocument();
  });

  it('copies the formatted "- " bullet list of the errors and confirms "Copiado"', async () => {
    const { user, writeText } = await renderWithErrors('ok');
    await user.click(screen.getByRole('button', { name: /copiar errores/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/^- /);
    expect(await screen.findByText(/copiado/i)).toBeInTheDocument();
  });

  it('keeps the button outside the live region; only the "Copiado" text is announced', async () => {
    const { user } = await renderWithErrors('ok');
    const button = screen.getByRole('button', { name: /copiar errores/i });
    await user.click(button);
    const copied = await screen.findByText(/copiado/i);
    const status = copied.closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(status.contains(button)).toBe(false);
    expect(screen.getByRole('button', { name: /copiar errores/i }).closest('[role="status"]')).toBeNull();
  });

  it('does not confirm "Copiado" when the clipboard is denied', async () => {
    const { user } = await renderWithErrors('denied');
    await user.click(screen.getByRole('button', { name: /copiar errores/i }));
    expect(screen.queryByText(/copiado/i)).not.toBeInTheDocument();
  });
});

// onboarding-request-fields R7.5, AC39 (tech-plan.md §2.5): the handout
// narrows (equipment.json/gyms.json/phase1-monday.json stop being served as
// downloads), but the in-app "load example" button is explicitly a NON-goal
// — phase1-monday.json stays in the repo, wired exactly as it is today.
describe('ImportScreen — load-example button still works (R7.5, AC39)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills the textarea with the bundled phase1-monday.json example', async () => {
    const user = userEvent.setup();
    render(<ImportScreen />);

    await user.click(screen.getByRole('button', { name: /ejemplo/i }));

    const textarea = screen.getByLabelText(/rutina\.json/i);
    expect(textarea.value.length).toBeGreaterThan(0);
    expect(() => JSON.parse(textarea.value)).not.toThrow();
  });
});

/**
 * multi-rutina-library D-G / §3 surgery — the replace-warning describes this
 * file never had are SUPERSEDED by success-panel describes: importing now
 * ADDS to the library, so the only post-validation behaviour left to pin is
 * the documented activation rule (AC23): empty library → silent save+activate
 * (byte-identical first-run, AC25); non-empty → panel with "Activar ahora" /
 * "Guardar sin activar". Validation suites above stay untouched (AC24).
 */
describe('ImportScreen — library dual path (multi-rutina-library AC22/AC23/AC25)', () => {
  const onImported = vi.fn();

  function renderImport() {
    return render(<ImportScreen onImported={onImported} />);
  }

  async function importExample(user) {
    await user.click(screen.getByRole('button', { name: /ejemplo/i }));
    await user.click(screen.getByRole('button', { name: /^importar$/i }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    db.listRutinas.mockResolvedValue([]);
    db.saveRutinaEntry.mockResolvedValue({ id: 'entry-1', importedAt: '2026-08-26T00:00:00.000Z' });
    db.activateRutina.mockResolvedValue(undefined);
  });

  it('EMPTY library: saves, activates silently, navigates home — no sheet ever (AC23, AC25)', async () => {
    db.listRutinas.mockResolvedValue([]);
    const user = userEvent.setup();
    renderImport();

    await importExample(user);

    await waitFor(() => expect(db.saveRutinaEntry).toHaveBeenCalledTimes(1));
    expect(db.activateRutina).toHaveBeenCalledWith('entry-1');
    expect(onImported).toHaveBeenCalledWith('/');
    // AC22 — the replace-warning ConfirmSheet is gone from the flow entirely.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('NON-EMPTY library: shows the success panel and writes nothing yet (AC23)', async () => {
    db.listRutinas.mockResolvedValue([{ id: 'existing' }]);
    const user = userEvent.setup();
    renderImport();

    await importExample(user);

    const panel = await screen.findByTestId('import-success-panel');
    expect(panel.textContent).toMatch(/mis rutinas/i);
    expect(panel.textContent).toMatch(/activo no cambia/i);
    expect(db.saveRutinaEntry).not.toHaveBeenCalled();
    expect(db.activateRutina).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('"Activar ahora": save + activate + navigate home (AC23)', async () => {
    db.listRutinas.mockResolvedValue([{ id: 'existing' }]);
    const user = userEvent.setup();
    renderImport();

    await importExample(user);
    await user.click(await screen.findByRole('button', { name: /activar ahora/i }));

    await waitFor(() => expect(db.activateRutina).toHaveBeenCalledWith('entry-1'));
    expect(onImported).toHaveBeenCalledWith('/');
  });

  it('"Guardar sin activar": save WITHOUT activation, navigate to /library (AC23)', async () => {
    db.listRutinas.mockResolvedValue([{ id: 'existing' }]);
    const user = userEvent.setup();
    renderImport();

    await importExample(user);
    await user.click(await screen.findByRole('button', { name: /guardar sin activar/i }));

    await waitFor(() => expect(db.saveRutinaEntry).toHaveBeenCalledTimes(1));
    expect(db.activateRutina).not.toHaveBeenCalled();
    expect(onImported).toHaveBeenCalledWith('/library');
  });

  it('save error: alert appears under the panel and both buttons recover (§3 save-error state)', async () => {
    db.listRutinas.mockResolvedValue([{ id: 'existing' }]);
    db.saveRutinaEntry.mockRejectedValue(new Error('IDB write failed'));
    const user = userEvent.setup();
    renderImport();

    await importExample(user);
    await user.click(await screen.findByRole('button', { name: /guardar sin activar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo guardar/i);
    expect(screen.getByRole('button', { name: /activar ahora/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /guardar sin activar/i })).toBeEnabled();
  });

  it('INVALID payload: validation block unchanged and NO entry is created (AC24)', async () => {
    const user = userEvent.setup();
    renderImport();

    // fireEvent, not user.type — user-event parses "{...}" as key modifiers.
    fireEvent.change(screen.getByLabelText(/rutina\.json/i), { target: { value: '{ "schemaVersion": 1 }' } });
    await user.click(screen.getByRole('button', { name: /^importar$/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument(); // the existing errors block
    expect(db.listRutinas).not.toHaveBeenCalled();
    expect(db.saveRutinaEntry).not.toHaveBeenCalled();
  });
});
