import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField } from './SelectField.jsx';

// pill-overflow-ux — OQ1/OQ2 ratified: SelectField is the design system's
// FIRST form primitive, a thin wrapper around the native <select> (no listbox
// machinery). Colocated with its component since the tech-debt audit
// (2026-08-26 F3) extended vitest.config.js's include glob to design-system/**
// — before that, a test here would silently never run, and this file lived
// under app/src/components/ as an undocumented workaround.
//
// RED until Cmok creates SelectField.jsx.

const LOCALES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'be', label: 'Беларуская' },
  { value: 'fr', label: 'Français' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'de', label: 'Deutsch' },
];

describe('SelectField (pill-overflow-ux S2/S3 shared primitive)', () => {
  it('binds its visible label to the select via htmlFor/id', () => {
    render(
      <SelectField id="lang" label="Idioma de la interfaz" value="es" options={LOCALES} onChange={() => {}} />
    );

    const select = screen.getByRole('combobox', { name: 'Idioma de la interfaz' });
    expect(select).toHaveAttribute('id', 'lang');
    expect(screen.getByText('Idioma de la interfaz')).toHaveAttribute('for', 'lang');
  });

  it('reflects the current value as the selected option', () => {
    render(
      <SelectField id="lang" label="Idioma" value="be" options={LOCALES} onChange={() => {}} />
    );

    expect(screen.getByRole('combobox')).toHaveValue('be');
    // Autonym option text survives verbatim — undertranslation by design
    // (ux-design §3), matching the pills this control replaces.
    expect(screen.getByRole('option', { name: 'Беларуская' }).selected).toBe(true);
  });

  it('hands onChange the selected VALUE string, not the event', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SelectField id="lang" label="Idioma" value="es" options={LOCALES} onChange={handleChange} />
    );

    await user.selectOptions(screen.getByRole('combobox'), 'fr');

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('fr');
  });

  it('renders every option it is given — eight synthetic entries, no hardcoded-3 assumption (AC9)', () => {
    const EIGHT = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((v) => ({ value: v, label: v.toUpperCase() }));
    render(<SelectField id="x" label="X" value="a" options={EIGHT} onChange={() => {}} />);

    expect(screen.getAllByRole('option')).toHaveLength(8);
    expect(screen.getByRole('option', { name: 'H' })).toBeInTheDocument();
  });

  it('wires an optional hint via aria-describedby', () => {
    render(
      <SelectField id="lang" label="Idioma" value="es" options={LOCALES} onChange={() => {}} hint="Se usa solo en esta pantalla" />
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-describedby', 'lang-hint');
    expect(screen.getByText('Se usa solo en esta pantalla')).toHaveAttribute('id', 'lang-hint');
  });
});
