import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CatalogScreen } from './CatalogScreen.jsx';
import { I18nProvider } from '../i18n/index.js';

/**
 * The directory module is MOCKED, and the club total is a deliberately
 * non-real sentinel (gate cycle 3, tech-plan-build-b D22).
 *
 * AC45's stat must come from `GYM_INDEX.metadata.totalClubs`. Against the real
 * module that criterion is untestable: the live total is 1,727, so an
 * implementation that HARDCODES 1727 in the JSX is indistinguishable from one
 * that reads the metadata — both render the same string, and an assertion like
 * `>= 1700` passes for both. Mocking the module with a total that exists
 * nowhere in the real data separates them, and that is the whole reason the
 * number below is not 1727.
 */
const gymsFx = vi.hoisted(() => {
  // `COUNTRIES` IS `GYM_INDEX.countries` (tech-plan.md:133), so it is derived
  // rather than declared twice. Cycle 3 wrote `countries: []` beside a
  // two-entry COUNTRIES here as well as in ClubPickerSheet.test.jsx — Bagnik
  // flagged only the other one, and patching just the flagged instance is how
  // cycles 1 and 2 each produced the next cycle's blocker.
  const COUNTRIES = [
    { code: 'ES', names: { en: 'Spain', es: 'España', be: 'Іспанія' }, cities: [] },
    { code: 'FR', names: { en: 'France', es: 'Francia', be: 'Францыя' }, cities: [] },
  ];
  return { GYM_INDEX: { metadata: { totalClubs: 1483 }, countries: COUNTRIES } };
});

// Key-for-key against the D2 surface at tech-plan.md:130-138 — arities and
// async-ness included.
vi.mock('../data/gyms.js', () => ({
  GYM_INDEX: gymsFx.GYM_INDEX,
  COUNTRIES: gymsFx.GYM_INDEX.countries,
  TOTAL_CLUBS: gymsFx.GYM_INDEX.metadata.totalClubs,
  citiesFor: (countryCode) => gymsFx.GYM_INDEX.countries.find((c) => c.code === countryCode)?.cities ?? [],
  /* eslint-disable no-unused-vars -- arity is the contract (tech-plan.md:130-138);
     a zero-arity stub teaches whoever reads this mock the wrong signature. */
  loadClubs: async (countryCode) => [],
  findClubById: async (countryCode, id) => null,
  resolveLegacyGymId: async (legacyId) => null,
  /* eslint-enable no-unused-vars */
}));

// Derived from the mock, never a second literal — two copies of the sentinel
// could drift and the assertion would then be checking the wrong number.
const FIXTURE_TOTAL = gymsFx.GYM_INDEX.metadata.totalClubs;

/**
 * pwa-ui-language AC13 + AC14 (tech-plan.md D12).
 *
 * DEC-4's shape: one mental model ("the app's language") for 95% of use, plus
 * the ability to look up an English machine name from a Spanish UI. The
 * override is transient — it belongs to this screen, not to the user's
 * preferences, so it is never persisted and it never touches the chrome
 * around it.
 *
 * ux-design.md is explicit that the `Idioma` pill row is unchanged
 * pixel-for-pixel. Only its DEFAULT changes.
 */

const CHEST_PRESS = { es: 'Prensa de Pecho', en: 'Chest Press', be: 'Жым ад грудзей' };

function renderCatalog(locale) {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/catalog']}>
        <CatalogScreen />
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('equipment text follows the UI locale app-wide (AC13)', () => {
  it('renders equipment names in the active UI locale, not hardcoded Spanish', () => {
    renderCatalog('en');
    expect(screen.getByText(CHEST_PRESS.en)).toBeInTheDocument();
    expect(screen.queryByText(CHEST_PRESS.es)).not.toBeInTheDocument();
  });

  it('renders Belarusian equipment names when the UI is Belarusian', () => {
    renderCatalog('be');
    expect(screen.getByText(CHEST_PRESS.be)).toBeInTheDocument();
  });
});

describe('the Catálogo override (AC14)', () => {
  it('defaults to the active UI locale instead of hardcoding es', () => {
    // CatalogScreen.jsx:31 used to be useState('es') regardless of anything.
    // Asserted through the rendered equipment text rather than the pill's
    // styling: AC14 keeps FilterPill unchanged, so "which pill is active" has
    // no accessible marker on this screen by design.
    renderCatalog('be');
    expect(screen.getByText(CHEST_PRESS.be)).toBeInTheDocument();
    expect(screen.queryByText(CHEST_PRESS.es)).not.toBeInTheDocument();
  });

  it('changes equipment text only — the chrome around it stays in the UI locale', async () => {
    // This is the whole point of DEC-4: look up an English machine name
    // without your app turning English.
    const user = userEvent.setup();
    renderCatalog('es');
    expect(screen.getByText(CHEST_PRESS.es)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(screen.getByText(CHEST_PRESS.en)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Catálogo de equipamiento' })).toBeInTheDocument();
  });

  it('is not persisted', async () => {
    const user = userEvent.setup();
    renderCatalog('es');

    await user.click(screen.getByRole('button', { name: 'BE' }));

    expect(localStorage.length).toBe(0);
  });

  it('resets to the UI locale when the tab is left and re-entered', async () => {
    const user = userEvent.setup();
    const first = renderCatalog('es');

    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText(CHEST_PRESS.en)).toBeInTheDocument();

    first.unmount();
    renderCatalog('es');

    expect(screen.getByText(CHEST_PRESS.es)).toBeInTheDocument();
  });

  it('keeps the pill row rendering the data languages, in data order', () => {
    // equipment.json's metadata.languages is ['en','es','be']; UI_LOCALES is
    // ['es','en','be']. AC14 keeps the row data-driven, so its visual order
    // does not change.
    renderCatalog('es');
    const labels = screen
      .getAllByRole('button', { name: /^(EN|ES|BE)$/ })
      .map((p) => p.textContent.trim());
    expect(labels).toEqual(['EN', 'ES', 'BE']);
  });
});

describe('Catálogo chrome is migrated (AC6)', () => {
  it('translates the screen title and the category filter labels', () => {
    renderCatalog('en');
    expect(screen.getByRole('heading', { level: 1, name: 'Equipment catalog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Todas' })).not.toBeInTheDocument();
  });
});

describe('category pills always render a real label (Build A / Bagnik code-QA fix #2)', () => {
  /**
   * CatalogScreen.jsx derives its category pills from the DATA
   * (`new Set(EQUIPMENT.map(e => e.category))`) but labels them from a
   * HARDCODED CATEGORY_KEYS map. Adding a category to the data without
   * adding its key here ships a pill whose i18n lookup key is `undefined`
   * — `t()` does not throw on a missing key, it falls back through the
   * chain to the key itself, so the pill would render the literal text
   * "undefined". This test exists so that failure class cannot recur
   * silently the next time a category is added to the data.
   */
  it('renders no pill whose text is "undefined" or a raw i18n key', () => {
    renderCatalog('es');
    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      const text = button.textContent.trim();
      expect(text).not.toBe('undefined');
      expect(text).not.toMatch(/^catalog\./);
    }
  });

  it('renders a real pill for both S2-added categories (free-weights, accessories)', () => {
    renderCatalog('es');
    expect(screen.getByRole('button', { name: 'Peso libre' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accesorios' })).toBeInTheDocument();
  });
});

/**
 * gym-directory-and-catalog AC45 / AC28 / AC20, OQ-D and tech-plan.md D14.
 *
 * X8 is the reason this section exists: the Catálogo used to render one card
 * per gym from a 7-entry `GYMS` array. The directory is now 1,727 clubs, and
 * 1,727 cards is not a page. The per-gym grid and the `GYMS.length` stat are
 * replaced by a single club row plus a filter.
 */
describe('the per-gym grid is gone (AC45, X8)', () => {
  it('renders no "Gimnasios" heading', () => {
    renderCatalog('es');
    expect(screen.queryByText('Gimnasios')).not.toBeInTheDocument();
  });

  it('renders no per-gym card grid', () => {
    renderCatalog('es');
    // The old grid stamped an "id N" badge on every card. Any survivor of
    // that markup means the grid is still being rendered from somewhere.
    // queryAllByText, not queryByText — the latter THROWS on multiple
    // matches, which would report the bug as a broken test.
    expect(screen.queryAllByText(/^id \d+$/)).toEqual([]);
  });

  it('reads the club total from the directory metadata, not a literal (AC45)', () => {
    renderCatalog('es');
    // Exact, against the mocked sentinel — the previous `>= 1700` floor was
    // satisfied by a hardcoded 1727 just as well as by a correct read, so it
    // could not tell the two apart. This assertion fails for a hardcoded
    // literal, for `GYMS.length` (7), and for `COUNTRIES.length` (2 here)
    // alike. Digits are stripped so a thousands separator is free to differ
    // by locale.
    const numbers = screen
      .getAllByText(/^\d[\d.,\s]*$/)
      .map((el) => Number(el.textContent.replace(/[^\d]/g, '')))
      .filter((n) => Number.isFinite(n));
    expect(numbers).toContain(FIXTURE_TOTAL);
  });

  it('offers a way into the club picker', () => {
    renderCatalog('es');
    expect(screen.getByRole('button', { name: /club/i })).toBeInTheDocument();
  });
});

/**
 * gym-directory-and-catalog R7.6 (tech-plan-build-b.md D22a — cycle-9
 * wiring-gap correction). `EquipmentOverlaySheet` was fully built and
 * independently tested but imported by no screen — R7.6's "Catálogo tab
 * gains club filters" had no entry point, so `useClubExclusions`' set could
 * never become non-empty in practice even though the "Solo mi club" pill
 * (AC46's sibling requirement) was correctly wired end to end.
 */
describe('Catálogo offers a way into the equipment overlay (R7.6 — cycle-9 correction)', () => {
  beforeEach(() => {
    localStorage.setItem(
      'rutina:club',
      JSON.stringify({
        countryCode: 'ES',
        clubId: '85c4896006bc45d89f562c977651600c',
        name: 'Test Club',
        address: 'Calle 1',
        city: 'Madrid',
      })
    );
  });

  it('offers an affordance to open "which equipment does your club have?" once a club is selected', () => {
    // club.equipmentOverlayTrigger already exists in all three i18n catalogs
    // (added alongside EquipmentOverlaySheet) but was never rendered by any
    // screen — this is the string this button must use, shared with the
    // guide's own R7.1 entry point.
    renderCatalog('en');
    expect(screen.getByRole('button', { name: /what equipment does your club have/i })).toBeInTheDocument();
  });

  it('does not offer the affordance before a club is selected', () => {
    localStorage.clear();
    renderCatalog('en');
    expect(screen.queryByRole('button', { name: /what equipment does your club have/i })).not.toBeInTheDocument();
  });

  it('opens the equipment overlay dialog when clicked', async () => {
    const user = userEvent.setup();
    renderCatalog('en');

    await user.click(screen.getByRole('button', { name: /what equipment does your club have/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('no extraEquipment leakage (AC28)', () => {
  it('lists only equipment.json entries, never a rutina\'s gear', () => {
    // The Catalog data path is unchanged (R4.2): gear is merged for the
    // SESSION UI only. A gear id showing up here would mean the merge leaked
    // into the catalog module.
    renderCatalog('es');
    // queryAllByText → toHaveLength(0), not queryByText: a leak that put the
    // gear id on more than one card would THROW "found multiple elements"
    // instead of failing this assertion — reporting the bug as a broken test.
    for (const gearId of ['resistance-band', 'foam-roller', 'ab-wheel']) {
      expect(screen.queryAllByText(new RegExp(gearId, 'i'))).toHaveLength(0);
    }
  });
});

describe('FilterPill exposes its pressed state (D14, AC46)', () => {
  it('gives every filter pill aria-pressed reflecting whether it is active', () => {
    // A pill whose entire meaning IS its selected state is unusable by screen
    // reader without this. Shared primitive, so this also fixes the existing
    // Idioma/Categoría rows.
    renderCatalog('es');

    const all = screen.getByRole('button', { name: 'Todas' });
    expect(all).toHaveAttribute('aria-pressed', 'true');

    const chest = screen.getByRole('button', { name: 'Pecho' });
    expect(chest).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates aria-pressed when a different pill is chosen', async () => {
    renderCatalog('es');

    await userEvent.click(screen.getByRole('button', { name: 'Pecho' }));

    expect(screen.getByRole('button', { name: 'Pecho' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the subtitle no longer claims the catalog is Matrix-only (X4)', () => {
  it('does not say "Matrix Aura"', () => {
    // The catalog now carries ZIVA free weights and accessories too. X4 is
    // stated in the spec as a documentation rule, but it is also a shipped
    // UI string — this is the only test that catches it.
    renderCatalog('es');
    // queryAllByText, not queryByText — the latter THROWS on multiple matches,
    // and "Matrix Aura" can legitimately appear on more than one equipment
    // card, which would report the bug as a broken test. Same fix as the
    // `id \d+` assertion above.
    expect(screen.queryAllByText(/Matrix Aura/i)).toEqual([]);
  });
});
