import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScreenHeader } from './ScreenHeader.jsx';
import { I18nProvider } from '../i18n/index.js';

/**
 * pwa-ui-language AC11 + Q3 (tech-plan.md D9, D10).
 *
 * ux-design.md found a real collision before anything was drawn: `trailing` is
 * already occupied on two of the five tab roots — HomeScreen's phase Badge and
 * HistoryScreen's Seleccionar/Cancelar controls. The settings affordance
 * therefore gets its OWN slot in the brand row.
 *
 * The trap that slot carries: the brand row is a single `aria-hidden="true"`
 * div today. Appending a button to it would hide the control from every
 * assistive technology while looking perfectly fine on screen.
 */

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function renderHeader(props = {}, locale = 'es') {
  return render(
    <I18nProvider initialLocale={locale}>
      <ScreenHeader title="Inicio" {...props} />
    </I18nProvider>
  );
}

describe('brand-row settings affordance (AC11)', () => {
  it('is absent unless a call site asks for it', () => {
    // Back-compat for ProgramScreen's day detail, ActiveSession, Import and
    // Export, none of which are tab roots.
    renderHeader();
    expect(screen.queryByRole('button', { name: /ajustes/i })).not.toBeInTheDocument();
  });

  it('renders a real button with an accessible name when onSettings is given', () => {
    renderHeader({ onSettings: vi.fn() });
    const control = screen.getByRole('button', { name: 'Ajustes' });
    expect(control.tagName).toBe('BUTTON');
    expect(control).toHaveAttribute('type', 'button');
  });

  it('is NOT inside an aria-hidden subtree', () => {
    // The whole reason the brand row has to be restructured rather than
    // appended to.
    renderHeader({ onSettings: vi.fn() });
    const control = screen.getByRole('button', { name: 'Ajustes' });
    expect(control.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('keeps the Basic-Fit wordmark decorative', () => {
    const { container } = renderHeader({ onSettings: vi.fn() });
    const wordmark = [...container.querySelectorAll('*')].find((el) => el.textContent === 'Basic-Fit' && el.children.length === 0);
    expect(wordmark).toHaveAttribute('aria-hidden', 'true');
  });

  it('meets the 44px minimum touch target', () => {
    renderHeader({ onSettings: vi.fn() });
    const control = screen.getByRole('button', { name: 'Ajustes' });
    expect(parseInt(control.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(control.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
  });

  it('shows the active locale as visible text, not colour or icon alone', () => {
    // ux-design.md's enhancement: this makes the control a passive, always-
    // visible language indicator, which is what closes DEC-2's discoverability
    // gap for a fr/de/it browser that silently landed in English.
    renderHeader({ onSettings: vi.fn() }, 'en');
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveTextContent('EN');
    renderHeader({ onSettings: vi.fn() }, 'be');
    expect(screen.getByRole('button', { name: 'Налады' })).toHaveTextContent('BE');
  });

  it('calls back on click', async () => {
    const onSettings = vi.fn();
    const user = userEvent.setup();
    renderHeader({ onSettings });
    await user.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});

describe('existing slots are untouched (AC11)', () => {
  it('still renders trailing content alongside the affordance', () => {
    // HomeScreen's phase Badge and HistoryScreen's selection controls live
    // here. Neither may move to make room.
    renderHeader({ onSettings: vi.fn(), trailing: <span>Fase 2</span> });
    expect(screen.getByText('Fase 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeInTheDocument();
  });

  it('still renders leading content', () => {
    renderHeader({ onSettings: vi.fn(), leading: <a href="#/program">‹ Volver</a> });
    expect(screen.getByRole('link', { name: '‹ Volver' })).toBeInTheDocument();
  });

  it('still renders title, subtitle and badge', () => {
    renderHeader({ subtitle: 'Sub', badge: 'Fase 1' });
    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument();
    expect(screen.getByText('Sub')).toBeInTheDocument();
    expect(screen.getByText('Fase 1')).toBeInTheDocument();
  });
});

describe('placement — exactly the tab roots (Q3)', () => {
  it('is wired from the five tab-root screens and nowhere else', () => {
    // ux-design.md's rule is "renders exactly where BottomTabBar highlights a
    // tab root". That is a rule about call sites, so it is checked at the call
    // sites — a sixth one appearing (or one of the five disappearing) is
    // exactly the regression this catches.
    const expected = [
      'screens/CatalogScreen.jsx',
      'screens/HistoryScreen.jsx',
      'screens/HomeScreen.jsx',
      'screens/ProgramScreen.jsx',
      'screens/ProgressScreen.jsx',
    ];
    const found = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          if (/onSettings\s*=/.test(fs.readFileSync(full, 'utf8'))) {
            found.push(path.relative(SRC_DIR, full).replace(/\\/g, '/'));
          }
        }
      }
    })(SRC_DIR);
    expect(found.filter((f) => !f.startsWith('components/ScreenHeader')).sort()).toEqual(expected);
  });
});
