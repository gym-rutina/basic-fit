import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClubMembershipChip } from './ClubMembershipChip.jsx';
import { I18nProvider } from '../i18n/index.js';

/**
 * move-club-picker-to-settings S4 (ux-design.md §4, tech-plan.md §3) — the
 * per-card membership chip. PRESENTATIONAL ONLY: it owns no hook and no
 * write; CatalogScreen threads exclude/include into it (AC10 single write
 * path). Contract:
 *   <ClubMembershipChip name included onExclude onInclude />
 * Visible text is the STATE; the accessible name is the ACTION (the
 * MoreMusclesChip precedent) — `{name}` disambiguates many chips per screen.
 */

const NAME = 'Prensa de Pecho';

function renderChip(props = {}, locale = 'es') {
  const handlers = { onExclude: vi.fn(), onInclude: vi.fn() };
  render(
    <I18nProvider initialLocale={locale}>
      <ClubMembershipChip name={NAME} included {...handlers} {...props} />
    </I18nProvider>
  );
  return handlers;
}

describe('ClubMembershipChip — included (AC7/AC8)', () => {
  it('shows the state as text and the action as the accessible name', () => {
    renderChip({ included: true });
    const chip = screen.getByRole('button', { name: `Quitar ${NAME} de mi club` });
    expect(chip).toHaveTextContent('En mi club');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('excludes on tap — and only excludes', async () => {
    const { onExclude, onInclude } = renderChip({ included: true });
    await userEvent.click(screen.getByRole('button', { name: `Quitar ${NAME} de mi club` }));
    expect(onExclude).toHaveBeenCalledTimes(1);
    expect(onInclude).not.toHaveBeenCalled();
  });
});

describe('ClubMembershipChip — excluded (AC8)', () => {
  it('shows the muted state text and an "add" action name', () => {
    renderChip({ included: false });
    const chip = screen.getByRole('button', { name: `Añadir ${NAME} a mi club` });
    expect(chip).toHaveTextContent('Fuera de mi club');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('includes on tap — and only includes', async () => {
    const { onExclude, onInclude } = renderChip({ included: false });
    await userEvent.click(screen.getByRole('button', { name: `Añadir ${NAME} a mi club` }));
    expect(onInclude).toHaveBeenCalledTimes(1);
    expect(onExclude).not.toHaveBeenCalled();
  });
});

describe('ClubMembershipChip — shape', () => {
  it('is a real <button type="button"> with a >=44px hit target (ux-design §9/§10)', () => {
    renderChip();
    const chip = screen.getByRole('button');
    expect(chip.tagName).toBe('BUTTON');
    expect(chip).toHaveAttribute('type', 'button');
    expect(chip).toHaveStyle({ minHeight: '44px' });
  });

  it('reads its strings from the i18n catalog, not literals (en locale)', () => {
    renderChip({ included: true }, 'en');
    const chip = screen.getByRole('button', { name: `Remove ${NAME} from my club` });
    expect(chip).toHaveTextContent('In my club');
  });

  it('touches no storage layer itself — the screen owns the single write path (AC10)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = fs
      .readFileSync(path.join(here, 'ClubMembershipChip.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/useClubExclusions|setClubExclusions|getClubExclusions|lib\/db\.js/);
  });
});
