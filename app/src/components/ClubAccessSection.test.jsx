import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/index.js';
import { ClubAccessSection } from './ClubAccessSection.jsx';
import { INVITE_KEY } from '../lib/inviteStorage.js';

// club-invite-link S1 — the /settings "Acceso al club" section, every cell of
// ux-design.md's §2 states matrix (mockup frames A–D). Storage is real jsdom
// localStorage here — the component's contract IS the storage interaction,
// so mocking inviteStorage would test nothing.
//
// Failures are expected until Cmok implements ClubAccessSection.jsx + the
// i18n keys together (red-first convention; t() falls back to the key string
// so half-landed states fail at the right assertion).

const URL_A = 'https://invite.basic-fit.com/xKb92a1c';
const URL_B = 'https://invite.basic-fit.com/replaced99';

function renderSection() {
  return render(
    <I18nProvider initialLocale="es">
      <ClubAccessSection />
    </I18nProvider>
  );
}

const input = () => screen.getByLabelText('Enlace de invitación');
const saveButton = () => screen.getByRole('button', { name: 'Guardar' });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('ClubAccessSection — unset state (frame A)', () => {
  it('renders heading, input and Guardar; no Eliminar, no Guardado line', () => {
    renderSection();

    expect(screen.getByText('Acceso al club')).toBeInTheDocument();
    expect(input()).toHaveValue('');
    expect(saveButton()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(screen.queryByText(/guardado:/i)).not.toBeInTheDocument();
  });

  it('shows the AC14+AC7 disclosure while storage works', () => {
    renderSection();

    // The three load-bearing sentences: device-only + never sent + anyone-with-link.
    const disclosure = screen.getByText(/se guarda solo en este dispositivo/i);
    expect(disclosure).toBeInTheDocument();
    expect(disclosure.textContent).toMatch(/nunca lo envía/i);
    expect(disclosure.textContent).toMatch(/cualquiera con este enlace puede entrar al club/i);
    // AC7's honesty clause — the app says it cannot check validity.
    expect(disclosure.textContent).toMatch(/no puede comprobar si el enlace sigue válido/i);
  });
});

describe('ClubAccessSection — save & replace (frames A→B)', () => {
  // ALL input insertion in this file is fireEvent.change (one-shot value
  // set), never per-char userEvent.type: this is a PASTE box — the real
  // gesture IS one insert. History: per-char typing was load-flaky past the
  // 5s default AND a mid-sequence death leaked keystrokes into the NEXT
  // test's DOM; user-event's paste() is broken under jsdom 25. Three gates
  // FAILed 2026-08-26 before the whole file converged here.
  it('saves a pasted https URL: Guardado line + Eliminar appear (AC1)', async () => {
    const user = userEvent.setup();
    renderSection();

    fireEvent.change(input(), { target: { value: URL_A } });
    await user.click(saveButton());

    expect(screen.getByText(/guardado:/i)).toBeInTheDocument();
    expect(screen.getByText(URL_A)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(localStorage.getItem(INVITE_KEY)).toBe(URL_A);
  });

  it('pre-fills the input with the stored value on mount — editing is replace (AC3)', () => {
    localStorage.setItem(INVITE_KEY, URL_A);
    renderSection();

    expect(input()).toHaveValue(URL_A);
  });

  it('replaces a saved URL with a different one (AC3)', async () => {
    localStorage.setItem(INVITE_KEY, URL_A);
    const user = userEvent.setup();
    renderSection();

    await user.clear(input());
    fireEvent.change(input(), { target: { value: URL_B } });
    await user.click(saveButton());

    expect(screen.getByText(URL_B)).toBeInTheDocument();
    expect(screen.queryByText(URL_A)).not.toBeInTheDocument();
    expect(localStorage.getItem(INVITE_KEY)).toBe(URL_B);
  });

  it('trims whitespace before storing (AC6)', async () => {
    const user = userEvent.setup();
    renderSection();

    fireEvent.change(input(), { target: { value: `  ${URL_A}  ` } });
    await user.click(saveButton());

    expect(localStorage.getItem(INVITE_KEY)).toBe(URL_A);
    expect(screen.getByText(URL_A)).toBeInTheDocument();
  });
});

describe('ClubAccessSection — failed saves never destroy a working invite (AC5)', () => {
  beforeEach(() => {
    localStorage.setItem(INVITE_KEY, URL_A);
  });

  it('unsafe scheme: alert names «javascript:», draft kept, Guardado line UNCHANGED (AC4 UI + AC5)', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.clear(input());
    fireEvent.change(input(), { target: { value: 'javascript:alert(document.cookie)' } });
    await user.click(saveButton());

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('javascript:');
    expect(alert.textContent).toMatch(/solo se aceptan enlaces https/i);
    // The previously saved invite survives the failed save — both on screen
    // and in storage. A failed save that wiped a working invite would strand
    // the user at the gym door (AC5).
    expect(screen.getByText(URL_A)).toBeInTheDocument();
    expect(localStorage.getItem(INVITE_KEY)).toBe(URL_A);
    // The draft stays in the input for correction (ux-design §7).
    expect(input()).toHaveValue('javascript:alert(document.cookie)');
  });

  it('not-a-URL: actionable alert copy, stored value intact (AC5)', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.clear(input());
    fireEvent.change(input(), { target: { value: 'hola mundo' } });
    await user.click(saveButton());

    expect(screen.getByRole('alert').textContent).toMatch(/no parece un enlace válido/i);
    expect(screen.getByText(URL_A)).toBeInTheDocument();
    expect(localStorage.getItem(INVITE_KEY)).toBe(URL_A);
  });

  it('Guardar re-enables for the next attempt after a failed save', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.clear(input());
    fireEvent.change(input(), { target: { value: 'javascript:x' } });
    await user.click(saveButton());
    expect(saveButton()).toBeEnabled();

    await user.clear(input());
    fireEvent.change(input(), { target: { value: URL_B } });
    await user.click(saveButton());
    expect(localStorage.getItem(INVITE_KEY)).toBe(URL_B);
  });
});

describe('ClubAccessSection — remove (AC3 → unset atomically)', () => {
  it('removes: back to unset state, key gone, focus returns to input', async () => {
    localStorage.setItem(INVITE_KEY, URL_A);
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(input()).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(screen.queryByText(/guardado:/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(INVITE_KEY)).toBeNull();
    // ux-design §7/§0 remove-done row: focus lands back on the input.
    expect(input()).toHaveFocus();
  });
});

describe('ClubAccessSection — storage degraded (frame D, D-B honest failure)', () => {
  it('shows the honest failure line instead of pretending success when setItem throws', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private browsing');
    });
    const user = userEvent.setup();
    renderSection();

    fireEvent.change(input(), { target: { value: URL_A } });
    await user.click(saveButton());

    expect(screen.getByText(/no se pudo guardar \(almacenamiento no disponible/i)).toBeInTheDocument();
    // Nothing pretends success: no Guardado line, no Eliminar, nothing stored.
    expect(screen.queryByText(/guardado:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });
});

/**
 * club-invite-amendments — A1/A3/A4: extract-on-save, audience explainer.
 * RED until Cmok wires extraction + the hint line.
 */
describe('ClubAccessSection — paste-with-text extraction (club-invite-amendments A1/A3)', () => {
  it('saves the BARE link from mixed text and shows it as the draft (AC-A1)', async () => {
    const user = userEvent.setup();
    renderSection();

    fireEvent.change(input(), { target: { value: '¡Pásate! https://member.basic-fit.com/friends/es-ES/join/QQRQ0FG9 ¡nos vemos!' } });
    await user.click(saveButton());

    // Storage holds the bare URL…
    expect(localStorage.getItem(INVITE_KEY)).toBe('https://member.basic-fit.com/friends/es-ES/join/QQRQ0FG9');
    expect(screen.getByText('https://member.basic-fit.com/friends/es-ES/join/QQRQ0FG9')).toBeInTheDocument();
    // …and the input now shows exactly what was saved, not the surrounding prose.
    expect(input()).toHaveValue('https://member.basic-fit.com/friends/es-ES/join/QQRQ0FG9');
  });

  it('text without any link → invalid alert, stored value intact, draft preserved (AC-A3)', async () => {
    localStorage.setItem(INVITE_KEY, URL_A);
    const user = userEvent.setup();
    renderSection();

    await user.clear(input());
    fireEvent.change(input(), { target: { value: 'mensaje sin ningún enlace, solo texto' } });
    await user.click(saveButton());

    expect(screen.getByRole('alert').textContent).toMatch(/no parece un enlace válido/i);
    expect(screen.getByText(URL_A)).toBeInTheDocument();
    expect(input()).toHaveValue('mensaje sin ningún enlace, solo texto');
  });

  it('shows the audience explainer between heading and input (AC-A8)', () => {
    renderSection();

    const hint = screen.getByText(/si un amigo te compartió su invitación/i);
    expect(hint.textContent).toMatch(/código qr/i);
  });
});
