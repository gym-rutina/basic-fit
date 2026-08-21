import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideOverlay } from './GuideOverlay.jsx';

vi.mock('../data/guideContent.js', () => ({
  GUIDE_PROMPT: '### REQUEST\n1. Test field:\n\n### OUTPUT\nJSON only.',
  GUIDE_HTML: {
    en: '<p>Guide body</p>',
    es: '<p>Cuerpo de la guía</p>',
    be: '<p>Тэкст кіраўніцтва</p>',
  },
}));

// Cycle-9 addition (tech-plan-build-b.md D22a — R6.1/R6.2/R7.1 wiring gap).
// A minimal two-item catalog, deterministic across locales, so prompt-content
// assertions below can check for specific ids/rows without depending on the
// real 48-entry catalog.
const equipmentFx = vi.hoisted(() => ({
  EQUIPMENT: [
    {
      id: 'g3-s70',
      modelCode: 'G3-S70',
      names: { en: 'Leg Press', es: 'Prensa de piernas', be: 'Жым ног' },
      category: 'machines',
      muscleGroup: { primary: ['legs'] },
    },
    {
      id: 'mg-pl13',
      modelCode: 'MG-PL13',
      names: { en: 'Bench Press', es: 'Press de banca', be: 'Жым лежачы' },
      category: 'free-weights',
      muscleGroup: { primary: ['chest'] },
    },
  ],
}));
vi.mock('../data/equipment.js', () => ({ EQUIPMENT: equipmentFx.EQUIPMENT }));

// The real hook's own IndexedDB round-trip is covered by its own test
// (useClubExclusions is not exercised via db.js here — GuideOverlay's
// integration with promptEquipment.js is). Controllable per-test via
// `useClubExclusionsMock.mockReturnValue(...)`.
const useClubExclusionsMock = vi.hoisted(() =>
  vi.fn(() => ({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false }))
);
vi.mock('../lib/useClubExclusions.js', () => ({ useClubExclusions: useClubExclusionsMock }));

// onboarding-request-fields R4 (field 8 / session history). Both mocked so
// these tests exercise GuideOverlay's OWN wiring (checkbox, async paint,
// feeding sessionsMarkdown into the composed prompt) rather than re-testing
// listSessions (db.test.js) or buildExportPayload (exportFormat.test.js),
// which already have their own dedicated coverage.
const listSessionsMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../lib/db.js', () => ({ listSessions: listSessionsMock }));
const buildExportPayloadMock = vi.hoisted(() => vi.fn().mockReturnValue({ json: {}, markdown: '' }));
vi.mock('../lib/exportFormat.js', () => ({ buildExportPayload: buildExportPayloadMock }));

// File-wide safety net: several describe blocks below (most pre-dating this
// feature) call `vi.restoreAllMocks()` in their own `afterEach`. In Vitest 2.x
// that resets EVERY `vi.fn()` in the file back to its no-argument creation
// state — not just `vi.spyOn` mocks — which would silently turn
// `listSessionsMock`/`buildExportPayloadMock` into no-ops returning
// `undefined` after the first such describe block runs, crashing every
// subsequent render on the `listSessions().then(...)` call (GuideOverlay.jsx
// R4.5). A single top-level `afterEach` runs AFTER each describe block's own
// local `afterEach` (outer hooks fire after inner ones), so it re-applies the
// safe defaults every test gets, regardless of which describe block it's in.
afterEach(() => {
  listSessionsMock.mockResolvedValue([]);
  buildExportPayloadMock.mockReturnValue({ json: {}, markdown: '' });
});

const TEST_CLUB = {
  countryCode: 'ES',
  clubId: '85c4896006bc45d89f562c977651600c',
  name: 'Avd. Andalucia C.C. Carrefour Alameda',
  address: 'Avda. Andalucia s/n',
  city: 'Málaga',
};

describe('GuideOverlay — prompt copy', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an editable prompt and a copy button', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(editor.value).toContain('### REQUEST');
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeInTheDocument();
  });

  it('shows Copied feedback when Copy is clicked', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay locale="en" onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    expect(await screen.findByRole('button', { name: /^copied$/i })).toBeInTheDocument();
  });

  it('allows editing the prompt before copy', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay locale="en" onClose={() => {}} />);

    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    await user.clear(editor);
    await user.type(editor, 'My filled prompt');

    expect(editor.value).toBe('My filled prompt');
  });
});

// onboarding-request-fields Q1/R7.2 (tech-plan.md §2.9): the fallback download
// narrows from the 4-file zip archive to a single plain rutina.schema.json
// file (with its descriptions intact — it is the SOURCE schema, not the
// stripped/inlined one). This REPLACES the prior feature's zip-archive block
// wholesale — buildDataArchive()/GUIDE_DATA_ARCHIVE are deleted per Q1's
// stated assumption (still needs a user yes/no before Cmok builds this — see
// tech-plan.md Known Gaps). Pending Cmok implementation; failures here are
// expected until this row is rebuilt as a single schema-file link.
describe('GuideOverlay — fallback schema download (Q1/R7.2, AC37)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const SCHEMA_FILENAME = 'rutina.schema.json';
  const SCHEMA_PATH = 'data/schema/rutina.schema.json';
  const BASE_URL = 'https://gym-rutina.github.io/basic-fit/';
  const OLD_NAMES = ['rutina-data-files.zip', 'equipment.json', 'gyms.json', 'phase1-monday.json'];

  it('renders exactly one download row — the schema file, not the old zip or the other three data files', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    expect(screen.getByText(SCHEMA_FILENAME)).toBeInTheDocument();
    for (const oldName of OLD_NAMES) {
      expect(screen.queryByText(oldName)).not.toBeInTheDocument();
    }
  });

  it('the row has a same-origin GitHub Pages href with the download attribute (AC37)', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    const link = screen.getByText(SCHEMA_FILENAME).closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('download');
    expect(link.getAttribute('href')).toBe(`${BASE_URL}${SCHEMA_PATH}`);
  });

  it('the row is a single link reachable by an accessible name including the filename', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /rutina\.schema\.json/i })).toBeInTheDocument();
  });

  it('renders the download row for es and be locales too', () => {
    const { unmount } = render(<GuideOverlay locale="es" onClose={() => {}} />);
    expect(screen.getByText(SCHEMA_FILENAME)).toBeInTheDocument();
    unmount();

    render(<GuideOverlay locale="be" onClose={() => {}} />);
    expect(screen.getByText(SCHEMA_FILENAME)).toBeInTheDocument();
  });
});

/**
 * gym-directory-and-catalog R6.7 / R6.1 / AC36 (tech-plan.md D3/D15).
 *
 * The `gyms.html` id-lookup callout is replaced by the club picker. Those
 * strings (`guide.gymHint`, `gymBody`, `gymLink`, `gymAlt`, `catalogLink`)
 * are DELETED from the catalogs, not merely hidden — each one asserts
 * something this feature makes false, and a stale string in three catalogs is
 * exactly the kind of drift that survives a visual review.
 */
describe('GuideOverlay — club picker replaces the gyms.html callout (R6.7)', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders no link to gyms.html', () => {
    render(<GuideOverlay locale="es" onClose={() => {}} />);
    const links = screen.queryAllByRole('link');
    for (const link of links) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/gyms\.html/);
    }
  });

  it('does not instruct the user to look up a numeric gym id', () => {
    render(<GuideOverlay locale="es" onClose={() => {}} />);
    expect(screen.queryByText(/id num[ée]rico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/listado de gimnasios/i)).not.toBeInTheDocument();
  });

  it('offers a club picker trigger instead', () => {
    render(<GuideOverlay locale="es" onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /club/i })).toBeInTheDocument();
  });

  it('prompts the user to choose a club when none is stored (empty state)', () => {
    render(<GuideOverlay locale="es" onClose={() => {}} />);
    expect(screen.getByText(/selecciona tu club/i)).toBeInTheDocument();
  });

  it('renders the stored club name and address on FIRST paint for a returning user (D3)', () => {
    // The whole reason selection lives in localStorage rather than IndexedDB:
    // a synchronous read means no flash of "Selecciona tu club". If this ever
    // needs a `waitFor`, D3's guarantee has been lost.
    localStorage.setItem(
      'rutina:club',
      JSON.stringify({
        countryCode: 'ES',
        clubId: '1ec43550fd654c7d8e23bc6c96cd2ff0',
        name: 'Alameda',
        address: 'Av. de Andalucía 12',
        city: 'Málaga',
      })
    );

    render(<GuideOverlay locale="es" onClose={() => {}} />);

    expect(screen.getByText(/Alameda/)).toBeInTheDocument();
    expect(screen.getByText(/Av\. de Andaluc[íi]a 12/)).toBeInTheDocument();
  });

  it('degrades to the cached name with a re-select affordance for a stale club (D16)', () => {
    // The directory is re-scraped monthly and the GUID is the only join key.
    // A club that vanished must not blank the trigger or crash the overlay.
    localStorage.setItem(
      'rutina:club',
      JSON.stringify({
        countryCode: 'ES',
        clubId: 'f'.repeat(32),
        name: 'Club Fantasma',
        address: 'Calle Inexistente 1',
        city: 'Málaga',
      })
    );

    render(<GuideOverlay locale="es" onClose={() => {}} />);

    expect(screen.getByText(/Club Fantasma/)).toBeInTheDocument();
    // Bagnik's cycle-9 re-gate finding: /club/i is too weak once R7.1's
    // "¿Qué equipamiento tiene tu club?" trigger exists — both it and
    // "Cambiar club" match, so a bare-role query throws "found multiple
    // elements" on a CORRECT implementation. Scoped to the specific button.
    expect(screen.getByRole('button', { name: /cambiar club/i })).toBeInTheDocument();
  });

  it('completes the copy flow without ever opening the equipment overlay (R7.3, AC44)', async () => {
    // The overlay is a correction, not a required step. This is the assertion
    // that keeps it optional.
    render(<GuideOverlay locale="es" onClose={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /copiar|copy/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.queryByText(/desmarca lo que no tenga/i)).not.toBeInTheDocument();
  });
});

/**
 * gym-directory-and-catalog R6.1/R6.2/R6.3/R7.5, AC36/AC40/AC43
 * (tech-plan-build-b.md D22a — cycle-9 wiring-gap correction).
 *
 * Cycle-8 code QA marked AC36/R6.1 as passing by exercising `buildPrompt()`
 * in isolation (promptEquipment.test.js). Nothing asserted that GuideOverlay
 * actually CALLS it: `handleClubSelected` only set `club` state, and
 * `promptText` was seeded once from the static `GUIDE_PROMPT` import and
 * never touched again — picking a club updated the "Tu club" box only, and
 * the copyable prompt stayed field-6-blank. These tests pin the integration
 * point that let that gap through a green suite.
 */
describe('GuideOverlay — prompt reflects the selected club and equipment (R6.1, R6.2, R6.3, AC36, AC40 — cycle-9 correction)', () => {
  beforeEach(() => {
    localStorage.clear();
    useClubExclusionsMock.mockReturnValue({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("fills the copyable prompt with the selected club's name, city, address and id (AC36)", () => {
    localStorage.setItem('rutina:club', JSON.stringify(TEST_CLUB));

    render(<GuideOverlay locale="en" onClose={() => {}} />);

    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(editor.value).toContain(TEST_CLUB.name);
    expect(editor.value).toContain(TEST_CLUB.city);
    expect(editor.value).toContain(TEST_CLUB.address);
    expect(editor.value).toContain(TEST_CLUB.clubId);
  });

  it('embeds the club-scoped equipment table, not the old gyms.json-filter instruction (R6.2, R6.3, AC40)', () => {
    localStorage.setItem('rutina:club', JSON.stringify(TEST_CLUB));

    render(<GuideOverlay locale="en" onClose={() => {}} />);

    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(editor.value).toContain('g3-s70');
    expect(editor.value).toContain('mg-pl13');
    // R6.3 — the LLM never needs the directory once field 6 carries the
    // resolved club; the old "filter equipment.json by the gyms array"
    // instruction must be gone from the copyable text.
    expect(editor.value).not.toMatch(/gyms\.json/);
    expect(editor.value).not.toMatch(/\bgyms\s+array\b/i);
  });

  it('shows a placeholder rather than throwing when no club is selected yet (R5.6)', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(editor.value).not.toMatch(/undefined/);
  });

  it('excludes items already marked out for this club from the copied prompt (R7.5, AC43)', () => {
    useClubExclusionsMock.mockReturnValue({
      excludedIds: new Set(['g3-s70']),
      exclude: vi.fn(),
      include: vi.fn(),
      writeFailed: false,
    });
    localStorage.setItem('rutina:club', JSON.stringify(TEST_CLUB));

    render(<GuideOverlay locale="en" onClose={() => {}} />);

    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(editor.value).not.toContain('g3-s70');
    expect(editor.value).toContain('mg-pl13');
  });
});

describe('GuideOverlay — opens the equipment overlay from the club row (R7.1 — cycle-9 correction)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('rutina:club', JSON.stringify(TEST_CLUB));
    useClubExclusionsMock.mockReturnValue({ excludedIds: new Set(), exclude: vi.fn(), include: vi.fn(), writeFailed: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('offers an affordance to open "which equipment does your club have?" once a club is selected', () => {
    // club.equipmentOverlayTrigger already exists in all three i18n catalogs
    // (added alongside EquipmentOverlaySheet) but was never rendered by any
    // screen — this is the string this button must use.
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /what equipment does your club have/i })).toBeInTheDocument();
  });

  it('does not offer the affordance before a club is selected', () => {
    localStorage.clear();
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /what equipment does your club have/i })).not.toBeInTheDocument();
  });

  it('opens the equipment overlay dialog when clicked', async () => {
    // Bagnik's cycle-9 test-gate finding: GuideOverlay's own root already
    // carries role="dialog" (GuideOverlay.jsx:126-128) from first paint, so
    // `findByRole('dialog')` throws "found multiple elements" the moment
    // R7.1 is correctly implemented — a test that fails on correct code.
    // Scoped to a COUNT so it proves a SECOND dialog opened, not merely that
    // "a" dialog exists.
    const user = userEvent.setup();
    render(<GuideOverlay locale="en" onClose={() => {}} />);

    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /what equipment does your club have/i }));

    // Bagnik's cycle-9 re-gate finding: a bare count of 2 would also pass if
    // the trigger mistakenly opened ClubPickerSheet instead — asserting the
    // second dialog's own aria-labelledby (EquipmentOverlaySheet.jsx:88)
    // proves it's specifically the equipment overlay that opened.
    await waitFor(() => {
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(2);
      expect(dialogs[1]).toHaveAttribute('aria-labelledby', 'equipment-overlay-title');
    });
  });
});

/**
 * onboarding-request-fields R3.1-R3.5, AC13-AC18 (tech-plan.md §2.8).
 *
 * Pending Cmok implementation — see tech-plan.md. Failures here are expected
 * until Cmok adds the REQUEST EDITOR form. Field labels below are pinned to
 * mockups.md's Screen 2 wireframe copy ("Nombre / programa", "Objetivo
 * principal", "Días / semana", "Duración de la sesión", "Lesiones /
 * movimientos a evitar") — not invented here. A looser day/week regex is
 * used because onboarding's own step uses very slightly different wording
 * ("Días por semana") — both are valid per their respective wireframes.
 *
 * Cmok fix: several tests below originally rendered `locale="en"` while
 * asserting these Spanish field-label strings — unsatisfiable together once
 * the form is properly localized (GuideOverlay.jsx's own D17 contract: it
 * builds its translator from the `locale` PROP, so `locale="en"` must render
 * "Name / program", not "Nombre / programa" — confirmed independently by
 * OnboardingOverlay's own AC42 test, which requires this SAME field to
 * re-render in English once the UI locale switches). Rendered with
 * `locale="es"` instead, matching the one sibling test in this same describe
 * block ("shows a warning...", AC17) that already used `locale="es"`
 * correctly. The "LLM prompt" textbox queries are loosened to `/prompt/i`
 * (matches both "LLM prompt" and "Prompt para el LLM"), and the Copy button
 * query is swapped to its Spanish text, so each test still exercises exactly
 * what its AC names — pre-fill, live update+persist, copy-includes-typed-
 * value, no duplicate club control — without an internal locale conflict.
 */
describe('GuideOverlay — REQUEST EDITOR form (R3.1-R3.5, AC13-AC18)', () => {
  beforeEach(() => {
    localStorage.clear();
    // NOTE (found while recovering from an interrupted build): this ONLY
    // protects tests that don't call `userEvent.setup()` — see the AC16 test
    // below for why. `userEvent.setup()` (the v14 API) initializes its own
    // clipboard support and overwrites `navigator.clipboard`, clobbering
    // whatever was installed here before `.setup()` runs. `userEvent.click()`
    // (the static, non-setup API other describe blocks in this file use) does
    // not have this problem.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders an editable form for fields 1-5 above the prompt textarea, pre-filled from a persisted record (AC13)', () => {
    localStorage.setItem(
      'rutina:promptRequest',
      JSON.stringify({ field1: 'Elena — Fase 2', field2: 'Hipertrofia', field3: 4, field4: '45-60 min', field5: 'Ninguna' })
    );
    render(<GuideOverlay locale="es" onClose={() => {}} />);

    expect(screen.getByLabelText(/nombre \/ programa/i)).toHaveValue('Elena — Fase 2');
    expect(screen.getByLabelText(/objetivo principal/i)).toHaveValue('Hipertrofia');
    expect(screen.getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/duraci[oó]n de la sesi[oó]n/i)).toHaveValue('45-60 min');
    expect(screen.getByLabelText(/lesiones.*movimientos a evitar/i)).toHaveValue('Ninguna');
  });

  it('editing a field updates the composed prompt in the same interaction and persists it (AC14)', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay locale="es" onClose={() => {}} />);

    const nameField = screen.getByLabelText(/nombre \/ programa/i);
    await user.type(nameField, 'Elena — Fase 2');

    const editor = screen.getByRole('textbox', { name: /prompt/i });
    expect(editor.value).toContain('Elena — Fase 2');

    const stored = JSON.parse(localStorage.getItem('rutina:promptRequest') || '{}');
    expect(stored.field1).toBe('Elena — Fase 2');
  });

  it('shows a warning that editing the form discards a manual textarea edit (AC17, mockups.md "⚠ Editar actualiza el prompt y descarta cualquier edición manual.")', () => {
    render(<GuideOverlay locale="es" onClose={() => {}} />);
    expect(screen.getByText(/descarta.*edici[oó]n manual/i)).toBeInTheDocument();
  });

  it('a form edit still overwrites a prior manual textarea edit — R3.3 unchanged behaviour', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay locale="es" onClose={() => {}} />);

    const editor = screen.getByRole('textbox', { name: /prompt/i });
    await user.clear(editor);
    await user.type(editor, 'My manual edit');
    expect(editor.value).toBe('My manual edit');

    await user.type(screen.getByLabelText(/nombre \/ programa/i), 'Elena');
    expect(editor.value).not.toBe('My manual edit');
    expect(editor.value).toContain('Elena');
  });

  it('shows the composed prompt size in KB next to Copy (AC15)', () => {
    // Scoped via aria-live: the download card's OWN "N KB" caption (the
    // schema file's size, R7.2) also matches a bare /\d+\s*KB/ query — a
    // vacuous getByText here would pass on either one, not specifically the
    // composed-prompt size this AC is actually about.
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    const sizeCaptions = screen.getAllByText(/\d+\s*KB/).filter((el) => el.getAttribute('aria-live') === 'polite');
    expect(sizeCaptions).toHaveLength(1);
  });

  it('Copy copies the composed prompt — including a freshly-typed answer — read from the clipboard call, not defaultValue (AC16)', async () => {
    const user = userEvent.setup();
    // `userEvent.setup()` above initializes its own clipboard support and
    // overwrites `navigator.clipboard` — the beforeEach's mock (installed
    // before `.setup()` runs) is already gone by this point. Re-install it
    // AFTER `.setup()`, which is the only ordering that survives.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<GuideOverlay locale="es" onClose={() => {}} />);

    await user.type(screen.getByLabelText(/nombre \/ programa/i), 'Elena — Fase 2');
    await user.click(screen.getByRole('button', { name: /^copiar$/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Elena — Fase 2'));
  });

  it('does not duplicate field 6 as a new form control — only the existing club row offers it (AC18)', () => {
    render(<GuideOverlay locale="es" onClose={() => {}} />);
    const clubButtons = screen.getAllByRole('button', { name: /elegir club|cambiar club/i });
    expect(clubButtons).toHaveLength(1);
  });
});

/**
 * onboarding-request-fields R4.1-R4.5, AC19-AC23 (tech-plan.md §2.8).
 *
 * listSessions (db.js) and buildExportPayload (exportFormat.js) are both
 * mocked — each already has its own dedicated test file; these tests
 * exercise GuideOverlay's OWN wiring (the checkbox, the async paint, feeding
 * sessionsMarkdown into the composed prompt), not session aggregation.
 */
describe('GuideOverlay — field 8, session history (R4, AC19-AC23)', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    listSessionsMock.mockResolvedValue([]);
    buildExportPayloadMock.mockReturnValue({ json: {}, markdown: '' });
  });

  it('with zero sessions there is no checkbox and field 8 keeps its placeholder (AC21)', async () => {
    listSessionsMock.mockResolvedValue([]);
    render(<GuideOverlay locale="en" onClose={() => {}} />);

    await waitFor(() => expect(listSessionsMock).toHaveBeenCalled());
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('with sessions present, field 8 carries the export markdown and a checked checkbox naming the session count (AC19)', async () => {
    listSessionsMock.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    buildExportPayloadMock.mockReturnValue({ json: {}, markdown: 'Prensa de Pecho (g3-s10)\n  · 32kg / normal' });

    render(<GuideOverlay locale="en" onClose={() => {}} />);

    const checkbox = await screen.findByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAccessibleName(expect.stringMatching(/3/));

    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(editor.value).toContain('Prensa de Pecho');
  });

  it('unchecking the checkbox removes the markdown and restores the placeholder line, in the same interaction (AC20)', async () => {
    listSessionsMock.mockResolvedValue([{ id: 1 }]);
    buildExportPayloadMock.mockReturnValue({ json: {}, markdown: 'Prensa de Pecho (g3-s10)\n  · 32kg / normal' });
    const user = userEvent.setup();

    render(<GuideOverlay locale="en" onClose={() => {}} />);
    const checkbox = await screen.findByRole('checkbox');

    await user.click(checkbox);

    expect(checkbox).not.toBeChecked();
    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(editor.value).not.toContain('Prensa de Pecho');
  });

  it('paints with field 8 empty before listSessions resolves, then fills in without a remount (AC22)', async () => {
    let resolveSessions;
    listSessionsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSessions = resolve;
      })
    );

    render(<GuideOverlay locale="en" onClose={() => {}} />);
    const editorBeforeResolve = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    buildExportPayloadMock.mockReturnValue({ json: {}, markdown: 'Prensa de Pecho (g3-s10)' });
    resolveSessions([{ id: 1 }]);

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: /llm prompt/i })).toBe(editorBeforeResolve);
  });

  it('resets the checkbox to checked on reopen (AC23) — it is never persisted (R4.4)', async () => {
    listSessionsMock.mockResolvedValue([{ id: 1 }]);
    buildExportPayloadMock.mockReturnValue({ json: {}, markdown: 'Prensa de Pecho (g3-s10)' });
    const user = userEvent.setup();

    const { unmount } = render(<GuideOverlay locale="en" onClose={() => {}} />);
    const firstCheckbox = await screen.findByRole('checkbox');
    await user.click(firstCheckbox);
    expect(firstCheckbox).not.toBeChecked();
    unmount();

    render(<GuideOverlay locale="en" onClose={() => {}} />);
    const secondCheckbox = await screen.findByRole('checkbox');
    expect(secondCheckbox).toBeChecked();
  });
});

/**
 * onboarding-request-fields R2.3 (tech-plan.md §2.8, AC10) — mirrors the
 * defensive contract every existing storage-backed screen already has
 * (clubStorage's own render-through-a-throw is what this parallels).
 */
describe('GuideOverlay — defensive rendering when promptRequestStorage throws (AC10)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('still renders the form and falls back to prompt placeholders when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => render(<GuideOverlay locale="en" onClose={() => {}} />)).not.toThrow();
    const editor = screen.getByRole('textbox', { name: /llm prompt/i });
    expect(editor.value).not.toMatch(/undefined/);
  });
});
