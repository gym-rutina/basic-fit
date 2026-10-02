import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportFork } from './ImportFork.jsx';
import * as db from '../lib/db.js';

// import-flow-guided-first F1/F2 (AC2, AC9, AC12, AC13) — RED until Cmok
// creates ImportFork.jsx. Restore-entry and onboarding-revisit coverage moved
// here from ImportScreen.test.jsx (tech-plan §5).

vi.mock('../lib/db.js', () => ({
  listRutinas: vi.fn().mockResolvedValue([]),
  listSessions: vi.fn().mockResolvedValue([]),
  readAllForBackup: vi.fn().mockResolvedValue({ rutinas: [], activeRutinaId: null, sessions: [], lastWeights: [] }),
  restoreFromBackup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/onboardingStorage.js', () => ({
  hasSeenOnboarding: vi.fn().mockReturnValue(true),
  markOnboardingSeen: vi.fn(),
}));

function setup(props = {}) {
  const onPrepare = vi.fn();
  const onImport = vi.fn();
  const user = userEvent.setup();
  render(<ImportFork onPrepare={onPrepare} onImport={onImport} {...props} />);
  return { onPrepare, onImport, user };
}

describe('ImportFork — hierarchy (AC2, AC13)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the "Crea tu rutina" heading', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: /crea tu rutina/i })).toBeInTheDocument();
  });

  it('offers exactly two choice buttons: prepare-prompt (recommended) and import', () => {
    setup();
    const prepare = screen.getByRole('button', { name: /prepara un prompt/i });
    const imp = screen.getByRole('button', { name: /ya tengo un rutina\.json/i });
    expect(prepare).toBeInTheDocument();
    expect(imp).toBeInTheDocument();
    // "exactly two": the restore control and onboarding link are a ghost button / link, not choices
    expect(document.querySelectorAll('[data-variant]')).toHaveLength(2);
  });

  it('marks the prepare-prompt card "recommended" and the import card "default" (AC2)', () => {
    setup();
    expect(screen.getByRole('button', { name: /prepara un prompt/i }).closest('[data-variant]'))
      .toHaveAttribute('data-variant', 'recommended');
    expect(screen.getByRole('button', { name: /ya tengo un rutina\.json/i }).closest('[data-variant]'))
      .toHaveAttribute('data-variant', 'default');
  });

  it('moves focus to the page heading on mount (AC13 route-change a11y)', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('puts the "Recomendado" badge in the prepare-prompt card name, and only there', () => {
    setup();
    expect(screen.getByRole('button', { name: /prepara un prompt/i })).toHaveAccessibleName(/recomendado/i);
    expect(screen.getByRole('button', { name: /ya tengo un rutina\.json/i })).not.toHaveAccessibleName(/recomendado/i);
  });

  it('never claims a fixed number of questions ("4 preguntas") — Q4 approved wording', () => {
    setup();
    expect(document.body.textContent).not.toMatch(/\b4 preguntas\b/i);
  });

  it('calls onPrepare / onImport from the matching cards', async () => {
    const { onPrepare, onImport, user } = setup();
    await user.click(screen.getByRole('button', { name: /prepara un prompt/i }));
    expect(onPrepare).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /ya tengo un rutina\.json/i }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('renders no dialog at rest', () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ImportFork — restore entry (AC9, moved from ImportScreen full-data-backup S3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Restaurar copia…" whose label never contains "importar" (AC16 of full-data-backup)', () => {
    setup();
    const btn = screen.getByRole('button', { name: /restaurar copia/i });
    expect(btn.textContent.toLowerCase()).not.toContain('importar');
  });

  it('clicking it mounts the RestoreSheet dialog and writes nothing', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /restaurar copia/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /elegir archivo/i })).toBeInTheDocument();
    expect(db.restoreFromBackup).not.toHaveBeenCalled();
  });
});

describe('ImportFork — onboarding revisit link (AC12, moved from ImportScreen AC7)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens the onboarding overlay from the link', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: /c[oó]mo funciona la app/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lands on "Así funciona", not back at the carousel\'s welcome step, with no input steps', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: /c[oó]mo funciona la app/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /así funciona/i })).toBeInTheDocument();
    expect(within(dialog).queryByText(/tu entrenador sin cuentas/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /atrás/i })).not.toBeInTheDocument();
  });

  it('dismissing it (Cerrar) leaves the fork interactive underneath', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: /c[oó]mo funciona la app/i }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: /cerrar/i })[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prepara un prompt/i })).toBeInTheDocument();
  });

  it('closing it never re-marks onboarding seen nor rewrites the prompt-request draft', async () => {
    const { markOnboardingSeen } = await import('../lib/onboardingStorage.js');
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: /c[oó]mo funciona la app/i }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: /cerrar/i })[0]);
    expect(markOnboardingSeen).not.toHaveBeenCalled();
  });
});
