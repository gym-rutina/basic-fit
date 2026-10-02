import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptPreferencesScreen } from './PromptPreferencesScreen.jsx';
import { PROMPT_REQUEST_KEY, readPromptRequest } from '../lib/promptRequestStorage.js';
import { writeClub, clearClub, readClub } from '../lib/clubStorage.js';
import { EQUIPMENT } from '../data/equipment.js';

// import-flow-guided-first W1a/W1b/W1c (AC3, AC7, AC13, AC14) — RED until Cmok
// creates PromptPreferencesScreen.jsx. Migrated from GuideOverlay's REQUEST
// EDITOR describe (R3.x, AC13-AC18).

vi.mock('../lib/db.js', () => ({ listSessions: vi.fn().mockResolvedValue([]) }));

// back-closes-dialogs-and-wizard-polish (AC12-AC16, AC18): the club now lives on step 1.
// Per-club exclusions are controlled here so the machine-count formula (AC16) is exact.
const exclusionsFx = vi.hoisted(() => ({ excluded: new Set() }));
vi.mock('../lib/useClubExclusions.js', () => ({
  useClubExclusions: () => ({ excludedIds: exclusionsFx.excluded, exclude: vi.fn(), include: vi.fn(), writeFailed: false }),
}));

// ClubPickerSheet has its own suite. This stand-in is built on the real SheetShell so the
// "focus returns to the trigger" contract (returnFocusTo) is exercised for real.
vi.mock('../components/ClubPickerSheet.jsx', async () => {
  const { SheetShell, SheetCloseButton } = await import('../components/sheet/SheetShell.jsx');
  return {
    ClubPickerSheet: ({ onSelect, onClose, returnFocusTo }) => (
      <SheetShell onClose={onClose} labelledBy="picker-stub-title" returnFocusTo={returnFocusTo}>
        <h3 id="picker-stub-title">picker-stub</h3>
        <SheetCloseButton onClick={onClose} />
        <button
          type="button"
          onClick={() =>
            onSelect({ countryCode: 'ES', clubId: 'club-2', name: 'Barcelona Sants', city: 'Barcelona', address: 'Sants 2' })
          }
        >
          pick-stub
        </button>
      </SheetShell>
    ),
  };
});

const CLUB = { countryCode: 'ES', clubId: 'club-1', name: 'Madrid Gran Vía', city: 'Madrid', address: 'Gran Vía 1' };

function setup() {
  const onNext = vi.fn();
  const onBack = vi.fn();
  const user = userEvent.setup();
  render(<PromptPreferencesScreen onNext={onNext} onBack={onBack} />);
  return { onNext, onBack, user };
}

describe('PromptPreferencesScreen — adaptive mode (AC14)', () => {
  beforeEach(() => localStorage.clear());

  it('blank storage → "Tu objetivo" heading, all fields open', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: /tu objetivo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^objetivo/i)).toBeInTheDocument();
  });

  it('answered storage → "Revisa tus respuestas" heading and the stored value is visible', () => {
    localStorage.setItem(PROMPT_REQUEST_KEY, JSON.stringify({ field2: 'Hipertrofia tren superior' }));
    setup();
    expect(screen.getByRole('heading', { level: 1, name: /revisa tus respuestas/i })).toBeInTheDocument();
    expect(screen.getByText(/hipertrofia tren superior/i)).toBeInTheDocument();
  });

  it('mode is fixed on mount: typing in a blank form does not flip the heading to "Revisa…"', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/^objetivo/i), 'fuerza');
    expect(screen.getByRole('heading', { level: 1, name: /tu objetivo/i })).toBeInTheDocument();
  });
});

describe('PromptPreferencesScreen — fields and persistence (AC3)', () => {
  beforeEach(() => localStorage.clear());

  it('exposes goal, days, session length and injuries; name is hidden under "Más opciones"', () => {
    setup();
    expect(screen.getByLabelText(/^objetivo/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /d[ií]as por semana/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/duraci[oó]n de sesi[oó]n/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lesiones/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/nombre del programa/i)).not.toBeInTheDocument();
  });

  it('"Más opciones" reveals the program-name field', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /m[aá]s opciones/i }));
    expect(screen.getByLabelText(/nombre del programa/i)).toBeInTheDocument();
  });

  it('persists every edit immediately via promptRequestStorage', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^objetivo/i), { target: { value: 'Fuerza' } });
    expect(readPromptRequest().field2).toBe('Fuerza');
    fireEvent.change(screen.getByLabelText(/lesiones/i), { target: { value: 'rodilla' } });
    expect(readPromptRequest().field5).toBe('rodilla');
  });

  it('applies the storage caps on write (goal 800 chars)', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^objetivo/i), { target: { value: 'x'.repeat(900) } });
    expect(readPromptRequest().field2.length).toBeLessThanOrEqual(800);
  });

  it('day pills 1-7: aria-pressed reflects the choice, tapping again clears, value persists', async () => {
    const { user } = setup();
    const three = screen.getByRole('button', { name: '3' });
    expect(three).toHaveAttribute('aria-pressed', 'false');
    await user.click(three);
    expect(three).toHaveAttribute('aria-pressed', 'true');
    expect(readPromptRequest().field3).toBe(3);
    await user.click(three);
    expect(three).toHaveAttribute('aria-pressed', 'false');
    expect(readPromptRequest().field3).toBeUndefined();
  });

  it('renders exactly seven day pills, each at least 44px tall', () => {
    setup();
    const group = screen.getByRole('group', { name: /d[ií]as por semana/i });
    const pills = group.querySelectorAll('button');
    expect(pills).toHaveLength(7);
    pills.forEach((p) => expect(parseInt(p.style.minHeight, 10)).toBeGreaterThanOrEqual(44));
  });
});

describe('PromptPreferencesScreen — navigation (AC3, AC7, AC13)', () => {
  beforeEach(() => localStorage.clear());

  it('shows "Paso 1 de 2" in a polite live region', () => {
    setup();
    expect(screen.getByText(/paso 1 de 2/i).closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('"Siguiente" is enabled with every field empty and calls onNext', async () => {
    const { onNext, user } = setup();
    const next = screen.getByRole('button', { name: /siguiente/i });
    expect(next).toBeEnabled();
    await user.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('"Atrás" calls onBack and entered data survives a remount (AC7)', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<PromptPreferencesScreen onNext={() => {}} onBack={onBack} />);
    fireEvent.change(screen.getByLabelText(/^objetivo/i), { target: { value: 'Resistencia' } });
    await user.click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();

    render(<PromptPreferencesScreen onNext={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/resistencia/i)).toBeInTheDocument();
  });

  it('moves focus to the page heading on mount (route-change a11y)', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// back-closes-dialogs-and-wizard-polish, item B — club on wizard step 1
// ---------------------------------------------------------------------------
describe('PromptPreferencesScreen — club row (AC12, AC14, AC15, AC16)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearClub();
    exclusionsFx.excluded = new Set();
  });

  it('with a club: shows its name, a machine count and a "Cambiar" control; no warning', () => {
    writeClub(CLUB);
    setup();
    expect(screen.getByText(/madrid gran v[ií]a/i)).toBeInTheDocument();
    expect(screen.getByText(/\d+\s+m[aá]quinas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar/i })).toBeInTheDocument();
    expect(screen.queryByText(/sin tu club/i)).not.toBeInTheDocument();
  });

  it('without a club: the "Elige tu club" row with its CTA, plus the no-club warning (AC14)', () => {
    setup();
    expect(screen.getByText(/elige tu club/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /elegir club/i })).toBeInTheDocument();
    expect(screen.getByText(/sin tu club la ia no sabr[aá] qu[eé] m[aá]quinas hay/i)).toBeInTheDocument();
  });

  it('the club stays optional: "Siguiente" is enabled and calls onNext with no club (AC15)', async () => {
    const { onNext, user } = setup();
    const next = screen.getByRole('button', { name: /siguiente/i });
    expect(next).toBeEnabled();
    await user.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('is the FIRST row of the form, before the goal (club -> goal -> schedule -> injuries)', () => {
    setup();
    const clubRow = screen.getByText(/elige tu club/i);
    const goal = screen.getByLabelText(/^objetivo/i);
    expect(clubRow.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the picker trigger has a 44px touch target', () => {
    setup();
    const trigger = screen.getByRole('button', { name: /elegir club/i });
    expect(parseInt(trigger.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('a stored club alone does NOT flip the screen into review mode (hasAnsweredFields is unchanged)', () => {
    writeClub(CLUB);
    setup();
    expect(screen.getByRole('heading', { level: 1, name: /tu objetivo/i })).toBeInTheDocument();
  });

  it('"Elegir club" opens the picker; selecting persists the club, updates the row, closes the picker and returns focus to the trigger', async () => {
    const { user } = setup();
    // fireEvent, not user.click: Safari/iOS do not focus a button on tap, so the sheet's own
    // "previously focused element" fallback would be <body> — only an explicit returnFocusTo
    // (the trigger ref) brings focus back to the trigger.
    fireEvent.click(screen.getByRole('button', { name: /elegir club/i }));
    expect(screen.getByRole('dialog', { name: 'picker-stub' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'pick-stub' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/barcelona sants/i)).toBeInTheDocument();
    expect(readClub()).toMatchObject({ clubId: 'club-2' }); // same persistence as before (clubStorage.writeClub)
    expect(screen.queryByText(/sin tu club/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar/i })).toHaveFocus();
  });

  it('"Cambiar" re-opens the picker on a stored club', async () => {
    writeClub(CLUB);
    const { user } = setup();
    fireEvent.click(screen.getByRole('button', { name: /cambiar/i })); // no focus on tap (Safari/iOS): see above
    expect(screen.getByRole('dialog', { name: 'picker-stub' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar/i })).toHaveFocus();
  });

  it('machine count = catalog minus the club exclusions (AC16)', () => {
    writeClub(CLUB);
    exclusionsFx.excluded = new Set(EQUIPMENT.slice(0, 3).map((item) => item.id));
    setup();
    expect(screen.getByText(new RegExp(`${EQUIPMENT.length - 3}\\s+m[aá]quinas`))).toBeInTheDocument();
  });

  it('machine count is the full catalog while exclusions are still loading (null = unfiltered, like step 2 used to)', () => {
    writeClub(CLUB);
    exclusionsFx.excluded = null;
    setup();
    expect(screen.getByText(new RegExp(`${EQUIPMENT.length}\\s+m[aá]quinas`))).toBeInTheDocument();
  });

  it('the club survives a remount (step 1 -> step 2 -> Atrás reads storage, no stale state) (AC18)', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /elegir club/i }));
    await user.click(screen.getByRole('button', { name: 'pick-stub' }));
    cleanup();
    render(<PromptPreferencesScreen onNext={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/barcelona sants/i)).toBeInTheDocument();
  });
});
