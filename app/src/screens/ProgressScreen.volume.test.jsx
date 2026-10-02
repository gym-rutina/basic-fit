import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgressScreen } from './ProgressScreen.jsx';
import * as db from '../lib/db.js';
import { I18nProvider, defaultT, tFor } from '../i18n/index.js';

vi.mock('../lib/db.js');

/**
 * progress-volume-fix (spec.md AC1, AC7, AC9, AC10, D2) — the Volume section as
 * the user sees it.
 *
 * The rutina here uses the strings the schema actually produces ("10-12",
 * "30s"), which is exactly the shape that made the user's chart EMPTY (D2):
 * sets * "10-12" * weight = NaN, so every bar's height was NaN.
 */

const RUTINA = {
  schemaVersion: 1,
  program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  days: [
    {
      label: 'Lunes',
      exercises: [
        { equipmentId: 'g3-s10', name: 'Prensa de Pecho', sets: 3, reps: '10-12', restSeconds: 75 },
        { equipmentId: null, name: 'Plancha', sets: 3, reps: '30s', restSeconds: 60 },
      ],
    },
  ],
};

const ex = (name, weightUsed, over = {}) => ({
  equipmentId: name === 'Plancha' ? null : 'g3-s10',
  name,
  weightUsed,
  difficulty: 'normal',
  completedAt: '2026-07-06T09:10:00.000Z',
  ...over,
});

const past = (id, day, exercises, over = {}) => ({
  id,
  dayLabel: 'Lunes',
  dayIndex: 0,
  status: 'completed',
  startedAt: `2026-07-${day}T09:00:00.000Z`,
  endedAt: `2026-07-${day}T09:50:00.000Z`,
  exercises,
  ...over,
});

function renderProgress({ locale } = {}) {
  const screen_ = (
    <MemoryRouter initialEntries={['/progress']}>
      <Routes>
        <Route path="/progress" element={<ProgressScreen rutina={RUTINA} />} />
      </Routes>
    </MemoryRouter>
  );
  return render(locale ? <I18nProvider initialLocale={locale}>{screen_}</I18nProvider> : screen_);
}

const volumeRegion = (title) => screen.findByRole('region', { name: title });

const norm = (s) => String(s).replace(/[\s  ]+/g, ' ').trim();
const byText = (expected) => (content) => norm(content) === norm(expected);
const num = (locale, n) => new Intl.NumberFormat(locale).format(n);
const shortDate = (locale, key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d, 12));
};

describe('ProgressScreen — Volume section with string reps (D2, AC1, AC7)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('draws a real bar per session when the program has a range and a hold — the chart is not empty', async () => {
    db.listSessions.mockResolvedValue([
      // snapshot tier: the session screen stamped "10-12" / "30s" at creation
      past('s1', '06', [
        { ...ex('Prensa de Pecho', 50), sets: 3, reps: '10-12' }, // 3 x 10 x 50 = 1500
        { ...ex('Plancha', 20), sets: 3, reps: '30s' }, //            hold -> 0
      ]),
      // legacy tier: no snapshot, joined against the active rutina's "10-12"
      past('s2', '20', [ex('Prensa de Pecho', 60, { completedAt: '2026-07-20T09:10:00.000Z' })]), // 3 x 10 x 60 = 1800
    ]);
    renderProgress();

    const region = await volumeRegion(/Volumen/i);
    expect(region.querySelectorAll('rect')).toHaveLength(2);
    expect(region.innerHTML.match(/NaN|Infinity|undefined/g)).toBeNull();

    // each bar's number is discoverable as text (AC8): es default locale
    expect(within(region).getByText(byText(`${shortDate('es', '2026-07-06')} · ${num('es', 1500)} kg`))).toBeInTheDocument();
    expect(within(region).getByText(byText(`${shortDate('es', '2026-07-20')} · ${num('es', 1800)} kg`))).toBeInTheDocument();
  });

  it('a hold-only session is a zero bar, not an excluded session and not NaN (Q4)', async () => {
    db.listSessions.mockResolvedValue([
      past('hold', '06', [{ ...ex('Plancha', 20), sets: 3, reps: '45 s' }]),
    ]);
    renderProgress();

    const region = await volumeRegion(/Volumen/i);
    expect(region.querySelectorAll('rect')).toHaveLength(1);
    expect(within(region).getByText(byText(`${shortDate('es', '2026-07-06')} · 0 kg`))).toBeInTheDocument();
    expect(screen.queryByText(/Sin datos de volumen/i)).toBeNull();
  });
});

describe('ProgressScreen — Volume caption (AC9)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const ONE_SESSION = () => [past('s1', '06', [{ ...ex('Prensa de Pecho', 50), sets: 3, reps: '10-12' }])];

  it('states what the number is in one localized line, inside the Volume section, not as a heading', async () => {
    db.listSessions.mockResolvedValue(ONE_SESSION());
    renderProgress();

    const region = await volumeRegion(/Volumen/i);
    const caption = within(region).getByText(defaultT('progress.volumeCaption'));
    expect(caption).toBeInTheDocument();
    expect(caption.tagName).not.toMatch(/^H[1-6]$/);
    // the key resolved (defaultT echoes the key when it is missing from every catalog)
    expect(defaultT('progress.volumeCaption')).not.toBe('progress.volumeCaption');
  });

  it('follows the active UI locale: caption and number formatting in en', async () => {
    db.listSessions.mockResolvedValue([
      // 4 x "10-12" x 300 = 12 000 — big enough to need a thousands separator
      past('big', '06', [{ ...ex('Prensa de Pecho', 300), sets: 4, reps: '10-12' }]),
    ]);
    renderProgress({ locale: 'en' });

    const region = await volumeRegion(tFor('en')('progress.volumeTitle'));
    expect(within(region).getByText(tFor('en')('progress.volumeCaption'))).toBeInTheDocument();
    expect(within(region).getByText(byText(`${shortDate('en', '2026-07-06')} · 12,000 kg`))).toBeInTheDocument();
    expect(within(region).queryByText(defaultT('progress.volumeCaption'))).toBeNull();
  });

  it('follows the active UI locale: de groups with a dot', async () => {
    db.listSessions.mockResolvedValue([
      past('big', '06', [{ ...ex('Prensa de Pecho', 300), sets: 4, reps: '10-12' }]),
    ]);
    renderProgress({ locale: 'de' });

    const region = await volumeRegion(tFor('de')('progress.volumeTitle'));
    expect(within(region).getByText(tFor('de')('progress.volumeCaption'))).toBeInTheDocument();
    expect(within(region).getByText(/12\.000 kg$/)).toBeInTheDocument();
  });
});

describe('ProgressScreen — empty and zero-bar contracts are unchanged (AC10)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows noVolumeData and no caption/chart when no session is plottable', async () => {
    db.listSessions.mockResolvedValue([
      // another rutina, no snapshot -> cannot be joined -> excluded (multi-rutina-library AC19)
      past('gone', '06', [ex('Prensa de Pecho', 50)], { rutinaId: 'r-old' }),
    ]);
    renderProgress();

    const region = await volumeRegion(/Volumen/i);
    expect(within(region).getByText(/Sin datos de volumen todavía/i)).toBeInTheDocument();
    expect(region.querySelector('svg')).toBeNull();
    expect(within(region).queryByText(defaultT('progress.volumeCaption'))).toBeNull();
  });

  it('a genuinely weightless session still shows its zero bar', async () => {
    db.listSessions.mockResolvedValue([
      past('zw', '06', [{ ...ex('Prensa de Pecho', null), sets: 3, reps: '10-12' }], { rutinaId: 'r-old' }),
    ]);
    renderProgress();

    const region = await volumeRegion(/Volumen/i);
    expect(region.querySelectorAll('rect')).toHaveLength(1);
    expect(within(region).queryByText(/Sin datos de volumen/i)).toBeNull();
  });
});
