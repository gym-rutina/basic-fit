import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptCopyScreen } from './PromptCopyScreen.jsx';
import { writeClub, clearClub, readClub } from '../lib/clubStorage.js';
import { PROMPT_REQUEST_KEY } from '../lib/promptRequestStorage.js';
import * as db from '../lib/db.js';
import { mockClipboard } from '../test-utils/clipboard.js';

// import-flow-guided-first W2a-W2f, G1 (AC4, AC7, AC13, AC16) — RED until Cmok
// creates PromptCopyScreen.jsx (+ GuideSheet). Migrated from GuideOverlay's
// prompt-copy / club-picker / session-history describes (tech-plan §4).

vi.mock('../lib/db.js', () => ({ listSessions: vi.fn().mockResolvedValue([]) }));

// ClubPickerSheet has its own suite; here it is only the "did Cambiar open it,
// and does selecting update the row" seam.
vi.mock('../components/ClubPickerSheet.jsx', () => ({
  ClubPickerSheet: ({ onSelect, onClose }) => (
    <div role="dialog" aria-label="picker-stub">
      <button
        onClick={() =>
          onSelect({ countryCode: 'ES', clubId: 'club-2', name: 'Barcelona Sants', city: 'Barcelona', address: 'Sants 2' })
        }
      >
        pick-stub
      </button>
      <button onClick={onClose}>close-stub</button>
    </div>
  ),
}));

const CLUB = { countryCode: 'ES', clubId: 'club-1', name: 'Madrid Gran Vía', city: 'Madrid', address: 'Gran Vía 1' };

// userEvent.setup() overwrites navigator.clipboard, so the fake goes in AFTER it.
function setup(clipboard = 'ok') {
  const onBack = vi.fn();
  const onHaveJson = vi.fn();
  const user = userEvent.setup();
  const writeText = mockClipboard(clipboard);
  render(<PromptCopyScreen onBack={onBack} onHaveJson={onHaveJson} />);
  return { onBack, onHaveJson, user, writeText };
}

describe('PromptCopyScreen — structure (AC4, AC13)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    db.listSessions.mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows "Paso 2 de 2" in a live region and focuses the heading', () => {
    setup();
    expect(screen.getByText(/paso 2 de 2/i).closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /copia tu prompt/i })).toHaveFocus();
  });

  it('lists the three next-step instructions', () => {
    setup();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('shows a prompt preview containing the user\'s answers', () => {
    localStorage.setItem(PROMPT_REQUEST_KEY, JSON.stringify({ field2: 'Marcador-objetivo-abc' }));
    setup();
    expect(screen.getByTestId('prompt-preview').textContent).toContain('Marcador-objetivo-abc');
  });

  it('"Atrás" calls onBack; "Ya tengo el JSON" calls onHaveJson', async () => {
    const { onBack, onHaveJson, user } = setup();
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /ya tengo el json/i }));
    expect(onHaveJson).toHaveBeenCalledTimes(1);
  });
});

// back-closes-dialogs-and-wizard-polish AC13/D2 — the club moved to wizard step 1
// (PromptPreferencesScreen.test.jsx); step 2 shows NOTHING about it: no row, no
// "Cambiar", no machine count, no picker trigger, no no-club warning. The prompt
// itself still carries the stored club (AC15).
describe('PromptCopyScreen — no club UI on step 2 (AC13, D2)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    db.listSessions.mockResolvedValue([]);
  });

  const outsidePreview = (matcher) =>
    screen.queryAllByText(matcher).filter((el) => !el.closest('[data-testid="prompt-preview"]'));

  it('with a club stored: no club name, machine count, "Cambiar" or picker trigger outside the prompt preview', () => {
    writeClub(CLUB);
    setup();
    expect(outsidePreview(/madrid gran v[ií]a/i)).toHaveLength(0);
    expect(screen.queryByText(/\d+\s+m[aá]quinas/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cambiar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /elegir club|elige tu club/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('without a club: no picker trigger and no "sin tu club" warning; Copiar stays enabled', () => {
    setup();
    expect(screen.queryByRole('button', { name: /elegir club|elige tu club/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/sin tu club/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar prompt/i })).toBeEnabled();
  });

  it('the copied prompt still carries the stored club (AC15: selection persists, step 2 only reads it)', async () => {
    writeClub(CLUB);
    const { user, writeText } = setup('ok');
    await user.click(screen.getByRole('button', { name: /copiar prompt/i }));
    expect(writeText.mock.calls[0][0]).toContain('Madrid Gran Vía');
    expect(readClub()).toMatchObject({ clubId: 'club-1' }); // reading does not disturb storage
  });
});

// AC17/AC19 — copy that is true with or without a club, and a step 3 that no
// longer suggests a paste target on this screen. Catalog-level checks for all 6
// locales live in i18n/promptWizardCopy.test.js; this is the rendered es screen.
describe('PromptCopyScreen — wording (AC17, AC19)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    db.listSessions.mockResolvedValue([]);
  });

  it('the intro no longer claims the prompt "already includes your club\'s machines"', () => {
    setup();
    expect(screen.queryByText(/ya incluye las m[aá]quinas de tu club/i)).not.toBeInTheDocument();
  });

  it('step 3 names the "Ya tengo el JSON" button (label derived, no arrow) and says to paste on the NEXT screen', () => {
    setup();
    const items = screen.getAllByRole('listitem');
    const step3 = items[2];
    expect(step3).toHaveTextContent('Ya tengo el JSON');
    expect(step3.textContent).not.toContain('→');
    expect(step3).toHaveTextContent(/siguiente/i);
    expect(step3).not.toHaveTextContent(/vuelve aqu[ií]/i);
  });

  it('the step-3 label is the live haveJson label: it matches the button the step points at', () => {
    setup();
    const button = screen.getByRole('button', { name: /ya tengo el json/i });
    const label = button.textContent.replace(/\s*→\s*$/, '');
    expect(screen.getAllByRole('listitem')[2]).toHaveTextContent(label);
  });
});

describe('PromptCopyScreen — copy states (AC4, AC13)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    db.listSessions.mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('copies the composed prompt and confirms in a role="status" region', async () => {
    const { user, writeText } = setup('ok');
    await user.click(screen.getByRole('button', { name: /copiar prompt/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0].length).toBeGreaterThan(50);
    expect(await screen.findByRole('status')).toHaveTextContent(/copiado/i);
  });

  it('clipboard denied: shows the long-press hint and no "Copiado" confirmation', async () => {
    const { user } = setup('denied');
    await user.click(screen.getByRole('button', { name: /copiar prompt/i }));
    expect(await screen.findByText(/mant[eé]n pulsado/i)).toBeInTheDocument();
    expect(screen.queryByText(/copiado/i)).not.toBeInTheDocument();
  });

  it('"Ver completo" expands the preview and toggles to "Ver menos"', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /ver completo/i }));
    expect(screen.getByRole('button', { name: /ver menos/i })).toBeInTheDocument();
  });
});

describe('PromptCopyScreen — session history checkbox (R4 migrated, UX Q5)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
  });

  it('is absent when there is no history', async () => {
    db.listSessions.mockResolvedValue([]);
    setup();
    await waitFor(() => expect(db.listSessions).toHaveBeenCalled());
    expect(screen.queryByRole('checkbox', { name: /sesiones anteriores/i })).not.toBeInTheDocument();
  });

  it('is present and checked by default when history exists', async () => {
    db.listSessions.mockResolvedValue([
      { id: 's1', dayIndex: 0, startedAt: '2026-09-01T10:00:00Z', endedAt: '2026-09-01T11:00:00Z', exercises: [] },
    ]);
    setup();
    expect(await screen.findByRole('checkbox', { name: /sesiones anteriores/i })).toBeChecked();
  });
});

describe('PromptCopyScreen — "Guía completa" sheet (AC16, D3)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    db.listSessions.mockResolvedValue([]);
  });

  it('opens a dialog from the "Guía completa" link and closes it, returning focus to the link', async () => {
    const { user } = setup();
    const trigger = screen.getByRole('button', { name: /gu[ií]a completa/i });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /cerrar|close/i })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /cerrar|close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
