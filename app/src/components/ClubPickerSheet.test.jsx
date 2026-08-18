import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ClubPickerSheet } from './ClubPickerSheet.jsx';
import { I18nProvider } from '../i18n/index.js';

/**
 * gym-directory-and-catalog AC36 / AC39 / AC46, spec R5.1–R5.6
 * (tech-plan.md D1/D3, ux-design.md §2/§5).
 *
 * Three dependent comboboxes: country → city → club. No fourth level (M9).
 *
 * The a11y assertions here are not decoration. ux-design §5 turned them into
 * plan requirements precisely because a sheet like this is trivially usable
 * with a mouse and completely unusable with a screen reader if the combobox
 * wiring is skipped — and no visual review catches that.
 *
 * The single most load-bearing assertion in this file is the one on each club
 * option's ACCESSIBLE NAME being "{name}, {address}". X9 records that club
 * names are frequently just the street, so an address that is only visually
 * stacked underneath leaves two options reading identically to a screen
 * reader. `getByRole('option', { name })` is the only assertion that fails
 * when that happens.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE MOCKS `../data/gyms.js` (gate cycle 3, tech-plan-build-b D22)
 *
 * Three consecutive test gates failed on the same defect, and the root cause
 * was never the individual assertions — it was that this file rendered against
 * the REAL directory module. That data is scraped, six-country, ~1,727 records,
 * and does not exist on disk yet. Every filtering assertion was therefore a
 * guess about data nobody controls:
 *
 *   cycle 1  typed the literal 'calle' and asserted the list narrowed. 'Calle'
 *            may prefix every Madrid address (then nothing narrows) or none.
 *   cycle 2  replaced it with a token DERIVED from `options[0].textContent`.
 *            That relocated the assumption instead of removing it: the
 *            assertion it fed (`after.length < before`) still needs the token
 *            to DISCRIMINATE, and nothing verified it did. A real shipped
 *            record — "Calle San Juan 33, Calle San Juan 33" — yields no 6+
 *            letter run at all, and "Avenida"/"Madrid" match every option.
 *
 * The rule the first two cycles inverted: **derive from data you do not
 * control; hardcode against a fixture you do.** With the module mocked, every
 * property these tests depend on is true BY CONSTRUCTION and is verifiable by
 * reading the fixture 20 lines below the assertion that uses it — so the
 * fixture is deliberately inline rather than shared. (It also must be: a
 * `gyms.fixture.js` under app/src would be walked by `strayLiterals.test.js`,
 * which excludes only `.test.` files, and 'Chamberí'/'España' would trip it.)
 *
 * The fixture is REAL-SHAPED — the six fields `buildCountryFile` emits and
 * nothing else, 32-hex ids — the same discipline `clubFilter.test.js` uses.
 * What this file still owns is the WIRING proof: that the component actually
 * calls the filter and renders its result through the combobox. The filtering
 * RULES (folding, name-or-address, empty query) belong to `clubFilter.test.js`
 * and are not re-proven here through the DOM.
 * ────────────────────────────────────────────────────────────────────────────
 */

const fx = vi.hoisted(() => {
  // Madrid's four clubs. Every token these tests type is annotated with the
  // number of clubs it matches; those counts are the assertions' preconditions
  // and are checked mechanically by the "fixture invariants" block below, so a
  // careless edit here fails loudly instead of silently weakening a test.
  //
  //   'Chamber' → 1  (name only)
  //   'Eloy'    → 1  (ADDRESS only — appears in no name; a name-only filter
  //                   returns 0, which is exactly the X9 failure)
  //   'via'     → 1  (folded from 'Vía'; an unfolded filter returns 0)
  //   'Calle'   → 4  (ALL of them — the non-discriminating control)
  const MADRID = [
    {
      id: 'aa11bb22cc33dd44ee55ff6677889900',
      name: 'Chamberí',
      city: 'Madrid',
      address: 'Calle de Eloy Gonzalo 27',
    },
    {
      // X9's case, and the exact record that broke cycle 2's derivation: the
      // name IS the street, so the accessible name must carry the address to
      // stay distinguishable — and there is no 6+ letter run to derive from.
      id: 'bb22cc33dd44ee55ff667788990011aa',
      name: 'Calle San Juan 33',
      city: 'Madrid',
      address: 'Calle San Juan 33',
    },
    {
      id: 'cc33dd44ee55ff667788990011aabb22',
      name: 'Gran Vía',
      city: 'Madrid',
      address: 'Calle Gran Vía 45',
    },
    {
      id: 'dd44ee55ff667788990011aabb22cc33',
      name: 'Atocha',
      city: 'Madrid',
      address: 'Calle de Atocha 112',
    },
  ];
  const BARCELONA = [
    {
      id: 'ee55ff667788990011aabb22cc33dd44',
      name: 'Sants',
      city: 'Barcelona',
      address: 'Carrer de Sants 8',
    },
    {
      id: 'ff667788990011aabb22cc33dd44ee55',
      name: 'Diagonal',
      city: 'Barcelona',
      address: 'Avinguda Diagonal 3',
    },
  ];
  const PARIS = [
    {
      id: '00112233445566778899aabbccddeeff',
      name: 'Rue Jean Mennesson 24/7',
      city: 'Paris',
      address: '18 Rue Jean Mennesson',
    },
  ];

  const CLUBS = { ES: [...MADRID, ...BARCELONA], FR: PARIS };
  const CITIES = {
    // clubCount descending, then name — the D2 order the picker relies on.
    ES: [
      { key: 'madrid', name: 'Madrid', clubCount: MADRID.length },
      { key: 'barcelona', name: 'Barcelona', clubCount: BARCELONA.length },
    ],
    FR: [{ key: 'paris', name: 'Paris', clubCount: PARIS.length }],
  };

  // `COUNTRIES` IS `GYM_INDEX.countries` — the same array, not a parallel one.
  // tech-plan.md:133 declares `export const COUNTRIES; // GYM_INDEX.countries`.
  // Cycle 3's mock set `countries: []` beside a two-entry COUNTRIES, so an
  // implementation reading `GYM_INDEX.countries` — which is contract-correct —
  // got an empty list and failed ~15 tests. That is the value-keyed failure
  // mode wearing new clothes: a fixture that rejects a correct implementation.
  // Deriving one from the other makes the contradiction unrepresentable.
  const COUNTRIES = [
    { code: 'ES', names: { en: 'Spain', es: 'España', be: 'Іспанія' }, cities: CITIES.ES },
    { code: 'FR', names: { en: 'France', es: 'Francia', be: 'Францыя' }, cities: CITIES.FR },
  ];
  const TOTAL_CLUBS = [...MADRID, ...BARCELONA, ...PARIS].length;
  const GYM_INDEX = { metadata: { totalClubs: TOTAL_CLUBS }, countries: COUNTRIES };

  return { MADRID, BARCELONA, PARIS, CLUBS, CITIES, COUNTRIES, GYM_INDEX, TOTAL_CLUBS };
});

// Key-for-key against the D2 surface at tech-plan.md:130-138. Arities and
// async-ness match the declaration, because whoever reads this mock to learn
// the module's shape must not be taught a shape that does not exist.
vi.mock('../data/gyms.js', () => ({
  GYM_INDEX: fx.GYM_INDEX,
  COUNTRIES: fx.GYM_INDEX.countries, // same array, per the contract
  TOTAL_CLUBS: fx.GYM_INDEX.metadata.totalClubs,
  citiesFor: (countryCode) => fx.CITIES[countryCode] ?? [],
  loadClubs: async (countryCode) => fx.CLUBS[countryCode] ?? [],
  findClubById: async (countryCode, id) => (fx.CLUBS[countryCode] ?? []).find((c) => c.id === id) ?? null,
  // eslint-disable-next-line no-unused-vars -- arity is the contract (tech-plan.md:137)
  resolveLegacyGymId: async (legacyId) => null,
}));

function renderPicker(props = {}) {
  return render(
    <I18nProvider initialLocale="es">
      <ClubPickerSheet onSelect={props.onSelect ?? vi.fn()} onClose={props.onClose ?? vi.fn()} {...props} />
    </I18nProvider>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

/**
 * The step cycles 1 and 2 both skipped: PROVE the fixture discriminates before
 * relying on it. Every token the filtering tests type is checked here against
 * the fixture with a fold written independently of `clubFilter.js` — if it
 * imported `foldForSearch`, a bug in that function would make this check agree
 * with the bug instead of catching it.
 *
 * These are assertions about test data, not about the app, so they pass today
 * and stay passing. Their job is to fail the moment someone edits a club name
 * and silently turns a discriminating token into a universal one — the exact
 * mutation that produced two of the three gate blockers.
 */
describe('fixture invariants (the preconditions every filtering test rests on)', () => {
  const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  // name + address + CITY: `filterClubs` searches all three
  // (`clubFilter.test.js` — "matches the city too, so typing the city name
  // never empties the list"). An independent model that omitted `city` would
  // under-count, and would miss a fixture edit that made a city name collide
  // with a search term.
  const searchable = (c) => fold(`${c.name} ${c.address} ${c.city}`);
  const matches = (term) => fx.MADRID.filter((c) => searchable(c).includes(fold(term))).length;

  it('gives each typed token exactly the reach its test assumes', () => {
    expect({
      Chamber: matches('Chamber'),
      Eloy: matches('Eloy'),
      via: matches('via'),
      'Vía': matches('Vía'),
      Calle: matches('Calle'),
      zzzznotaclub: matches('zzzznotaclub'),
    }).toEqual({
      Chamber: 1, // narrowing test
      Eloy: 1, // address-match test
      via: 1, // diacritic test, folded
      'Vía': 1, // diacritic test, accented — must agree with the folded form
      Calle: fx.MADRID.length, // the non-discriminating control
      zzzznotaclub: 0, // zero-match state
    });
  });

  it('requires folding for the diacritic term to match — the mutation guard', () => {
    /**
     * Bagnik, gate cycle 4: the invariants caught a token becoming universal
     * but NOT a de-accenting edit. Rename 'Gran Vía' to 'Gran Via' and the
     * diacritic test stays green while silently testing nothing — 'via' would
     * then match the raw text, so an implementation with no `foldForSearch`
     * at all would pass it.
     *
     * Pinning both halves is what makes the diacritic test load-bearing: the
     * term must match ONLY after folding.
     */
    const raw = fx.MADRID.map((c) => `${c.name} ${c.address} ${c.city}`.toLowerCase());
    expect(raw.filter((t) => t.includes('via'))).toEqual([]);
    expect(raw.map(fold).filter((t) => t.includes('via'))).toHaveLength(1);
  });

  it('matches "Eloy" on an address and never on a name (what makes X9 testable)', () => {
    expect(fx.MADRID.filter((c) => fold(c.name).includes('eloy'))).toEqual([]);
    expect(fx.MADRID.filter((c) => fold(c.address).includes('eloy'))).toHaveLength(1);
  });

  it('carries a club whose name IS its street, with no long token to derive', () => {
    // Cycle 2 derived a 6+ letter run from `options[0].textContent`. This
    // record — real, from the ES page-2 capture — has none once the shared
    // 'Calle' is discounted, which is how the derived-token approach produced
    // `undefined` and failed a correct implementation.
    const streetNamed = fx.MADRID.find((c) => c.name === c.address);
    expect(streetNamed).toBeTruthy();
    expect(streetNamed.name).toMatch(/^Calle /);
  });

  it('keeps every club to the four fields buildCountryFile emits (AC4, D6a — cycle-9 correction)', () => {
    // cityKey dropped from club records this cycle (tech-plan-build-b.md
    // D6a) — the picker now matches a selected city to its clubs by `city`
    // (display name) instead.
    for (const club of [...fx.MADRID, ...fx.BARCELONA, ...fx.PARIS]) {
      expect(Object.keys(club).sort()).toEqual(['address', 'city', 'id', 'name']);
      expect(club.id).toMatch(/^[0-9a-f]{32}$/);
    }
  });
});

describe('sheet semantics (AC46, ux-design §5)', () => {
  it('is a labelled modal dialog', () => {
    renderPicker();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('moves focus into the sheet on open', () => {
    renderPicker();
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape when no listbox is open', async () => {
    const onClose = vi.fn();
    renderPicker({ onClose });

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('first Escape collapses an open listbox, second closes the sheet', async () => {
    // ux-design §5. Collapsing straight to "sheet closed" loses the user's
    // partial selection and is the classic combobox-in-a-modal bug.
    const onClose = vi.fn();
    renderPicker({ onClose });

    const country = screen.getByRole('combobox', { name: /pa[íi]s/i });
    await userEvent.click(country);
    expect(country).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');
    expect(country).toHaveAttribute('aria-expanded', 'false');
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('dependent fields (R5.1, ux-design §2 empty state)', () => {
  it('disables city and club until a country is chosen, with a visible reason', () => {
    renderPicker();

    const city = screen.getByRole('combobox', { name: /ciudad/i });
    const club = screen.getByRole('combobox', { name: /club/i });

    for (const field of [city, club]) {
      // disabled AND aria-disabled AND visible reason text — never colour
      // alone (ux-design §5).
      expect(field).toBeDisabled();
      expect(field).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getByText(/selecciona.*pa[íi]s/i)).toBeInTheDocument();
  });

  it('enables city once a country is chosen', async () => {
    renderPicker();

    await userEvent.click(screen.getByRole('combobox', { name: /pa[íi]s/i }));
    await userEvent.click(screen.getByRole('option', { name: /espa[ñn]a/i }));

    expect(screen.getByRole('combobox', { name: /ciudad/i })).not.toBeDisabled();
    expect(screen.getByRole('combobox', { name: /club/i })).toBeDisabled();
  });

  it('resets city and club when the country changes', async () => {
    // Leaving a stale Madrid selected under France would let the user submit
    // a club that is not in the chosen country.
    renderPicker();

    await userEvent.click(screen.getByRole('combobox', { name: /pa[íi]s/i }));
    await userEvent.click(screen.getByRole('option', { name: /espa[ñn]a/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /ciudad/i }));
    await userEvent.click(screen.getAllByRole('option')[0]);

    await userEvent.click(screen.getByRole('combobox', { name: /pa[íi]s/i }));
    await userEvent.click(screen.getByRole('option', { name: /francia|france/i }));

    expect(screen.getByRole('combobox', { name: /ciudad/i })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /club/i })).toBeDisabled();
  });

  it('has exactly three comboboxes — no fourth level (M9)', () => {
    renderPicker();
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });
});

describe('combobox semantics (R5.4, AC46)', () => {
  it('wires aria-expanded, aria-controls and aria-activedescendant', async () => {
    renderPicker();
    const country = screen.getByRole('combobox', { name: /pa[íi]s/i });

    expect(country).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(country);
    expect(country).toHaveAttribute('aria-expanded', 'true');
    expect(country).toHaveAttribute('aria-controls');

    await userEvent.keyboard('{ArrowDown}');
    const active = country.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(document.getElementById(active)).toHaveAttribute('role', 'option');
  });

  it('moves through options with the arrow keys and selects with Enter', async () => {
    renderPicker();
    const country = screen.getByRole('combobox', { name: /pa[íi]s/i });

    await userEvent.click(country);
    await userEvent.keyboard('{ArrowDown}{Enter}');

    // NOT `toHaveValue(expect.any(String))`: jest-dom's toHaveValue compares
    // with `===` (matchers-*.mjs `compareAsSet`), not `this.equals` — an
    // asymmetric matcher can never satisfy `===` and the assertion would fail
    // unconditionally regardless of what the combobox actually holds. `expect(
    // ...).toEqual(expect.any(String))` is the form that actually honours an
    // asymmetric matcher; the next line's `.length` check is what proves the
    // value is non-empty, which is this test's real intent.
    expect(country.value).toEqual(expect.any(String));
    expect(country.value.length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: /ciudad/i })).not.toBeDisabled();
  });

  it('announces the result count in a polite live region on every filter change', async () => {
    renderPicker();

    await userEvent.click(screen.getByRole('combobox', { name: /pa[íi]s/i }));
    await userEvent.click(screen.getByRole('option', { name: /espa[ñn]a/i }));

    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live.textContent).toMatch(/\d+/);
  });
});

describe('club rows and filtering (AC39, R5.3, X9)', () => {
  async function openMadrid() {
    renderPicker();
    await userEvent.click(screen.getByRole('combobox', { name: /pa[íi]s/i }));
    await userEvent.click(screen.getByRole('option', { name: /espa[ñn]a/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /ciudad/i }));
    await userEvent.click(await screen.findByRole('option', { name: /madrid/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /club/i }));
  }

  it('lists Madrid\'s clubs', async () => {
    await openMadrid();
    const options = await screen.findAllByRole('option');
    // Exact, not `> 1`: the city's club list must be the city's clubs, and a
    // filter that leaked Barcelona in would still satisfy `> 1`.
    expect(options).toHaveLength(fx.MADRID.length);
  });

  it('gives every club option an accessible name of "{name}, {address}" (X9)', async () => {
    // THE assertion of this file. A club whose name is just the street is
    // indistinguishable from its neighbour unless the address is part of the
    // accessible name — visually stacking it is not enough.
    await openMadrid();
    const options = await screen.findAllByRole('option');
    for (const option of options.slice(0, 5)) {
      expect(option).toHaveAccessibleName(/.+,\s.+/);
    }
  });

  it('narrows the list to the clubs that match (AC39)', async () => {
    // 'Chamber' is in exactly one of the four Madrid clubs by construction.
    // Asserting the EXACT surviving count, not `< before`, is the difference
    // that matters: `toBeLessThan` also passes for an implementation that
    // clears the list on any keystroke, or that drops a random subset.
    await openMadrid();
    expect(screen.queryAllByRole('option')).toHaveLength(fx.MADRID.length);

    await userEvent.type(screen.getByRole('combobox', { name: /club/i }), 'Chamber');

    const after = screen.queryAllByRole('option');
    expect(after).toHaveLength(1);
    expect(after[0]).toHaveAccessibleName(/Chamberí/);
  });

  it('keeps every club when the fragment matches all of them', async () => {
    // The control for the test above, and only writable against a fixture:
    // 'Calle' is in all four addresses, so a CORRECT filter narrows to four.
    // This is what fails an implementation that "narrows" by resetting the
    // list, or that treats any non-empty query as a miss — neither of which
    // a `toBeLessThan` assertion can see.
    await openMadrid();
    await userEvent.type(screen.getByRole('combobox', { name: /club/i }), 'Calle');

    expect(screen.queryAllByRole('option')).toHaveLength(fx.MADRID.length);
  });

  it('matches on the ADDRESS, not the name alone (X9, R5.3)', async () => {
    // The X9 failure in one assertion. 'Eloy' appears in one club's address
    // and in NO club's name, so a name-only filter returns zero here while
    // looking perfectly correct in every other test in this file.
    await openMadrid();
    await userEvent.type(screen.getByRole('combobox', { name: /club/i }), 'Eloy');

    const after = screen.queryAllByRole('option');
    expect(after).toHaveLength(1);
    expect(after[0]).toHaveAccessibleName(/Eloy Gonzalo/);
  });

  it('matches diacritic-insensitively (D19)', async () => {
    // 'Gran Vía' is the only club carrying 'vía'. Typing the FOLDED form must
    // find it — an implementation that skips `foldForSearch` returns zero —
    // and the accented form must find exactly the same one.
    await openMadrid();
    const club = screen.getByRole('combobox', { name: /club/i });

    await userEvent.type(club, 'via');
    expect(screen.queryAllByRole('option')).toHaveLength(1);

    await userEvent.clear(club);
    await userEvent.type(club, 'Vía');
    const accented = screen.queryAllByRole('option');
    expect(accented).toHaveLength(1);
    expect(accented[0]).toHaveAccessibleName(/Gran Vía/);
  });

  it('shows the zero-match state with a manual-edit escape hatch (R5.6)', async () => {
    await openMadrid();
    await userEvent.type(screen.getByRole('combobox', { name: /club/i }), 'zzzznotaclub');

    expect(screen.getByText(/no se encontraron clubes/i)).toBeInTheDocument();
    // R5.6 — a user whose club is missing must never be blocked.
    expect(screen.getByRole('button', { name: /editar.*campo 6|manualmente/i })).toBeInTheDocument();
  });
});

describe('selection (AC36, R5.5)', () => {
  it('reports the full club record so field 6 can be filled', async () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider initialLocale="es">
        <ClubPickerSheet onSelect={onSelect} onClose={vi.fn()} />
      </I18nProvider>
    );

    await userEvent.click(screen.getByRole('combobox', { name: /pa[íi]s/i }));
    await userEvent.click(screen.getByRole('option', { name: /espa[ñn]a/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /ciudad/i }));
    await userEvent.click(await screen.findByRole('option', { name: /madrid/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /club/i }));
    await userEvent.click((await screen.findAllByRole('option'))[0]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const club = onSelect.mock.calls[0][0];
    // AC36 — name, city, address AND id. All four are substituted into
    // field 6, and the id is what makes an imported rutina resolvable.
    expect(club).toMatchObject({
      clubId: expect.stringMatching(/^[0-9a-f]{32}$/),
      name: expect.any(String),
      city: expect.any(String),
      address: expect.any(String),
      countryCode: 'ES',
    });
  });

  it('persists the selection so a returning user is not re-asked (R5.5)', async () => {
    render(
      <I18nProvider initialLocale="es">
        <ClubPickerSheet onSelect={vi.fn()} onClose={vi.fn()} />
      </I18nProvider>
    );

    await userEvent.click(screen.getByRole('combobox', { name: /pa[íi]s/i }));
    await userEvent.click(screen.getByRole('option', { name: /espa[ñn]a/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /ciudad/i }));
    await userEvent.click(await screen.findByRole('option', { name: /madrid/i }));
    await userEvent.click(screen.getByRole('combobox', { name: /club/i }));
    await userEvent.click((await screen.findAllByRole('option'))[0]);

    expect(localStorage.getItem('rutina:club')).toBeTruthy();
  });

  it('returns focus to the trigger on close (ux-design §5)', async () => {
    // The earlier version of this test asserted only that onClose fired,
    // which is not what its title claims and would pass against a sheet that
    // dumped focus on <body> — leaving a keyboard user stranded at the top of
    // the document every time they close the picker.
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const onClose = vi.fn();
    const { unmount } = renderPicker({ onClose, returnFocusTo: { current: trigger } });

    // Focus moves INTO the sheet on open…
    expect(document.activeElement).not.toBe(trigger);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();

    // …and back to the trigger once the sheet unmounts.
    unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
