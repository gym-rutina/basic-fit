import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideSheet } from './GuideSheet.jsx';
import { I18nProvider, tFor } from '../i18n/index.js';

// import-flow-guided-first AC16 (tech-plan §4/§5/§6) — the "Guía completa" sheet
// extracted from GuideOverlay: article + schema download in a SheetShell.
// Migrated from GuideOverlay.test.jsx: "fallback schema download (AC37)".

vi.mock('../data/guideContent.js', () => ({
  GUIDE_PROMPT: '### REQUEST\n\n### OUTPUT\nJSON only.',
  GUIDE_HTML: {
    en: '<p>Guide body</p>',
    es: '<p>Cuerpo de la guía</p>',
    be: '<p>Тэкст кіраўніцтва</p>',
  },
}));

const SCHEMA_FILENAME = 'rutina.schema.json';
const SCHEMA_PATH = 'data/schema/rutina.schema.json';
const BASE_URL = 'https://gym-rutina.github.io/basic-fit/';
const OLD_NAMES = ['rutina-data-files.zip', 'equipment.json', 'gyms.json', 'phase1-monday.json'];

describe('GuideSheet — structure and article (AC16)', () => {
  it('renders a labelled dialog titled "Guía completa" with the guide article', () => {
    render(<GuideSheet locale="es" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: /gu[ií]a completa/i });
    expect(within(dialog).getByText('Cuerpo de la guía')).toBeInTheDocument();
  });

  it('closes from the close button and from Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<GuideSheet locale="es" onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('focuses the close button on open', () => {
    render(<GuideSheet locale="es" onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /cerrar/i })).toHaveFocus();
  });

  it('keeps a 44px close target', () => {
    render(<GuideSheet locale="es" onClose={() => {}} />);
    expect(parseInt(screen.getByRole('button', { name: /cerrar/i }).style.height, 10)).toBeGreaterThanOrEqual(44);
  });
});

describe('GuideSheet — locale (pwa-ui-language AC8, migrated from GuideOverlay)', () => {
  it('honours an explicit locale prop with no provider at all, using that locale for chrome and article', () => {
    render(<GuideSheet locale="en" onClose={() => {}} />);
    expect(screen.getByRole('button', { name: tFor('en')('guide.close') })).toBeInTheDocument();
    expect(screen.getByText('Guide body')).toBeInTheDocument();
  });

  it('follows the UI locale from context when no prop is given', () => {
    render(
      <I18nProvider initialLocale="be">
        <GuideSheet onClose={() => {}} />
      </I18nProvider>
    );
    expect(screen.getByRole('button', { name: tFor('be')('guide.close') })).toBeInTheDocument();
    expect(screen.getByText('Тэкст кіраўніцтва')).toBeInTheDocument();
  });

  it('falls back to the en article for locales without their own (fr/nl/de)', () => {
    render(
      <I18nProvider initialLocale="fr">
        <GuideSheet onClose={() => {}} />
      </I18nProvider>
    );
    expect(screen.getByText('Guide body')).toBeInTheDocument();
  });
});

describe('GuideSheet — fallback schema download (Q1/R7.2, AC37 migrated from GuideOverlay)', () => {
  it('renders exactly one download row — the schema file, not the old zip or the other data files', () => {
    render(<GuideSheet locale="en" onClose={() => {}} />);
    expect(screen.getByText(SCHEMA_FILENAME)).toBeInTheDocument();
    for (const oldName of OLD_NAMES) {
      expect(screen.queryByText(oldName)).not.toBeInTheDocument();
    }
  });

  it('the row has a same-origin GitHub Pages href with the download attribute (AC37)', () => {
    render(<GuideSheet locale="en" onClose={() => {}} />);
    const link = screen.getByText(SCHEMA_FILENAME).closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('download');
    expect(link.getAttribute('href')).toBe(`${BASE_URL}${SCHEMA_PATH}`);
  });

  it('the row is a single link reachable by an accessible name including the filename', () => {
    render(<GuideSheet locale="en" onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /rutina\.schema\.json/i })).toBeInTheDocument();
  });

  it('renders the download row for es and be locales too', () => {
    const { unmount } = render(<GuideSheet locale="es" onClose={() => {}} />);
    expect(screen.getByText(SCHEMA_FILENAME)).toBeInTheDocument();
    unmount();
    render(<GuideSheet locale="be" onClose={() => {}} />);
    expect(screen.getByText(SCHEMA_FILENAME)).toBeInTheDocument();
  });
});
