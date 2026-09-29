import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptPreferencesScreen } from './PromptPreferencesScreen.jsx';
import { PROMPT_REQUEST_KEY, readPromptRequest } from '../lib/promptRequestStorage.js';

// import-flow-guided-first W1a/W1b/W1c (AC3, AC7, AC13, AC14) — RED until Cmok
// creates PromptPreferencesScreen.jsx. Migrated from GuideOverlay's REQUEST
// EDITOR describe (R3.x, AC13-AC18).

vi.mock('../lib/db.js', () => ({ listSessions: vi.fn().mockResolvedValue([]) }));

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
