import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportScreen } from './ImportScreen.jsx';
import * as db from '../lib/db.js';
import { I18nProvider } from '../i18n/index.js';

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
 * pwa-ui-language AC8 (tech-plan.md D17) updated this block's mechanism, not
 * its intent: `detectGuideLocale` stopped being a second, independently
 * mockable source of truth — the guide now follows the ACTIVE UI LOCALE via
 * `useI18n()`, exactly like every other piece of chrome. Forcing English
 * here is now done the same way any other screen would be put into English
 * (`I18nProvider initialLocale="en"`) rather than by mocking a function
 * ImportScreen no longer calls. See guideConsumer.test.jsx and
 * GuideOverlay.test.jsx for the AC8 contract itself.
 */
describe('ImportScreen — LLM guide link (AC1, AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderEnglish() {
    return render(
      <I18nProvider initialLocale="en">
        <ImportScreen />
      </I18nProvider>
    );
  }

  it('does not show the guide overlay on mount', () => {
    renderEnglish();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the guide overlay when the link is clicked', async () => {
    const user = userEvent.setup();
    renderEnglish();

    await user.click(screen.getByRole('link', { name: /view the llm creation guide/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('LLM creation guide')).toBeInTheDocument();
  });

  it('dismisses the guide overlay when the close button is clicked', async () => {
    const user = userEvent.setup();
    renderEnglish();

    await user.click(screen.getByRole('link', { name: /view the llm creation guide/i }));
    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// onboarding-screens (AC7): pending Cmok implementation — see tech-plan.md.
// Failures here are expected until Cmok adds the revisit link to
// ImportScreen.jsx.
describe('ImportScreen — onboarding revisit link (AC7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show the onboarding overlay on mount', () => {
    render(<ImportScreen />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the onboarding overlay when the revisit link is clicked', async () => {
    const user = userEvent.setup();
    render(<ImportScreen />);

    await user.click(screen.getByRole('link', { name: /c[oó]mo funciona la app/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('dismissing the revisited onboarding overlay (Saltar) leaves ImportScreen interactive underneath (AC6)', async () => {
    const user = userEvent.setup();
    render(<ImportScreen />);

    await user.click(screen.getByRole('link', { name: /c[oó]mo funciona la app/i }));
    await user.click(screen.getByRole('button', { name: /saltar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/rutina\.json/i)).toBeInTheDocument();
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

/**
 * full-data-backup S3 (ux-design.md §4, mockup frame F) — the empty-state
 * "Restaurar copia…" ghost entry. Same visibility rule as "Cargar ejemplo"
 * ({!text && …}); opens the restore flow directly (RestoreSheet), bypassing
 * the import textarea. Copy must never say "importar" (AC16 wording
 * separation). Red until Cmok wires the button + RestoreSheet into
 * ImportScreen.jsx.
 */
describe('ImportScreen — restore-copy entry (full-data-backup S3, OQ-4/AC16)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows "Restaurar copia…" while the textarea is empty, next to "Cargar ejemplo"', () => {
    render(<ImportScreen />);
    expect(screen.getByRole('button', { name: /restaurar copia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ejemplo/i })).toBeInTheDocument();
  });

  it('hides both ghost controls once the textarea has content (same visibility rule)', () => {
    render(<ImportScreen />);
    fireEvent.change(screen.getByLabelText(/rutina\.json/i), { target: { value: '{"schemaVersion":1}' } });
    expect(screen.queryByRole('button', { name: /restaurar copia/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ejemplo/i })).not.toBeInTheDocument();
  });

  it('its label never contains "importar" (AC16)', () => {
    render(<ImportScreen />);
    expect(screen.getByRole('button', { name: /restaurar copia/i }).textContent.toLowerCase()).not.toContain('importar');
  });

  it('clicking it mounts the RestoreSheet dialog (GAP-2 fix — real "opens flow" assertion)', async () => {
    const user = userEvent.setup();
    render(<ImportScreen />);
    // ImportScreen shows no dialog at rest (the guide/onboarding overlays are role="dialog"
    // too but are closed here) — assert the transition on click.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /restaurar copia/i }));

    // RestoreSheet's "pick" state is a role="dialog" sheet with its OWN file-choose
    // control. Scope the button query INSIDE the dialog: ImportScreen.jsx:194 has a
    // pre-existing "Elegir archivo .json" button (the import picker) that also matches
    // /elegir archivo/i — asserting it unscoped would (a) pass even if the wrong overlay
    // opened and (b) throw "multiple elements" once RestoreSheet renders its own.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /elegir archivo/i })).toBeInTheDocument();
    // opening the flow writes nothing
    expect(db.restoreFromBackup).not.toHaveBeenCalled();
  });
});
