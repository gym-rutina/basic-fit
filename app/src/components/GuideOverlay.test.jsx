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

// llm-guide-zip-download: User UAT (2026-07-29) approved replacing the shipped
// 4-row "Download data files" card (llm-guide-file-downloads, 2026-07-25) with
// a single zip-archive row. Pending Cmok implementation — see ux-design.md +
// tech-plan.md for the exact component structure. Failures here are expected
// until that row is built.
describe('GuideOverlay — data archive download', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ARCHIVE_FILENAME = 'rutina-data-files.zip';
  const ARCHIVE_PATH = 'data/rutina-data-files.zip';
  const BASE_URL = 'https://bthos.github.io/gym-routine-basic-fit/';
  const OLD_PER_FILE_NAMES = [
    'rutina.schema.json',
    'equipment.json',
    'gyms.json',
    'phase1-monday.json',
  ];

  it('renders a heading introducing the download card (AC1)', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    expect(screen.getByText(/llm without web access/i)).toBeInTheDocument();
  });

  it('renders exactly one download row — the zip, not the four old per-file rows (AC1)', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    expect(screen.getByText(ARCHIVE_FILENAME)).toBeInTheDocument();
    for (const oldName of OLD_PER_FILE_NAMES) {
      expect(screen.queryByText(oldName)).not.toBeInTheDocument();
    }
  });

  it('the row has a same-origin GitHub Pages href with the download attribute, not raw.githubusercontent.com (AC2)', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    const link = screen.getByText(ARCHIVE_FILENAME).closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('download');
    expect(link.getAttribute('href')).toBe(`${BASE_URL}${ARCHIVE_PATH}`);
  });

  it('the row is a single link reachable by an accessible name including the zip filename (a11y — one <a>, no nested controls)', () => {
    render(<GuideOverlay locale="en" onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /rutina-data-files\.zip/i })).toBeInTheDocument();
  });

  it('renders the download row for es and be locales too', () => {
    const { unmount } = render(<GuideOverlay locale="es" onClose={() => {}} />);
    expect(screen.getByText(ARCHIVE_FILENAME)).toBeInTheDocument();
    unmount();

    render(<GuideOverlay locale="be" onClose={() => {}} />);
    expect(screen.getByText(ARCHIVE_FILENAME)).toBeInTheDocument();
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
