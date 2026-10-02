import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgramScreen } from './ProgramScreen.jsx';
import { I18nProvider, UI_LOCALES, tFor } from '../i18n/index.js';
import { dayFocusLabels } from '../lib/muscleGroups.js';
import * as libraryNotice from '../lib/libraryNoticeStorage.js';

vi.mock('../lib/libraryNoticeStorage.js', () => ({
  hasSeenLibraryNotice: vi.fn(),
  markLibraryNoticeSeen: vi.fn(),
}));

/**
 * program-remove-weekly-summary (spec.md AC1-AC5, AC7).
 *
 * The Program overview used to end its day block with a derived "Weekly
 * summary" table (Day / Focus / Exercises) that repeated what the Training
 * days list right above it already shows. The section is removed entirely
 * (D1). These tests pin the removal from the outside (what the user sees) and
 * the dead-code cleanup from the inside (what the source still carries).
 */

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DS_DIR = path.resolve(SRC_DIR, '..', '..', 'design-system');

// The section title each locale rendered BEFORE the removal. Hard-coded on
// purpose: once the catalog keys are deleted these strings exist nowhere else,
// so the test cannot be satisfied by "the key is gone, so lookup returns the
// key" — it proves the real wording is not on screen.
const OLD_TITLE = {
  es: 'Resumen semanal',
  en: 'Weekly summary',
  be: 'Тыднёвы агляд',
  fr: 'Résumé hebdomadaire',
  nl: 'Weekoverzicht',
  de: 'Wochenübersicht',
};

const EXERCISES_DAY_0 = [
  { equipmentId: 'g3-s10', name: 'Press de Hombro', sets: 4, reps: 8, restSeconds: 75, muscleGroups: ['quadriceps', 'glutes'] },
  { equipmentId: 'g3-s10', name: 'Curl', sets: 3, reps: 10, restSeconds: 60, muscleGroups: ['glutes', 'biceps'] },
];
const EXERCISES_DAY_1 = [
  { equipmentId: 'g3-s10', name: 'Remo', sets: 3, reps: 10, restSeconds: 60, muscleGroups: ['biceps'] },
];

const BASE = {
  schemaVersion: 1,
  program: { name: 'Test', phaseName: 'Fase 1', phaseNumber: 1, durationWeeks: 4 },
  phaseInfo: { objective: 'Test objective', intensityPercent: '60%', restSeconds: 60, frequencyPerWeek: 3 },
  warmup: { durationMinutes: 5, steps: ['Warm up step'] },
  cooldown: { durationMinutes: 5, steps: ['Cool down step'] },
  days: [
    { label: 'Lunes', intro: 'Pierna', exercises: EXERCISES_DAY_0 },
    { label: 'Miércoles', exercises: EXERCISES_DAY_1 }, // no intro on purpose
  ],
};

const RUTINA_FULL = { ...BASE, rules: ['Regla uno'], notes: [{ title: 'Nota uno', body: 'Cuerpo uno' }] };
const RUTINA_BARE = { ...BASE, rules: [], notes: [] };

function renderOverview(rutina, locale = 'es') {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/program']}>
        <Routes>
          <Route path="/program" element={<ProgramScreen rutina={rutina} />} />
          <Route path="/program/:dayIndex" element={<ProgramScreen rutina={rutina} />} />
          <Route path="/library" element={<div>LIBRARY SCREEN</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

function renderDayDetail(rutina) {
  return render(
    <I18nProvider initialLocale="es">
      <MemoryRouter initialEntries={['/program/0']}>
        <Routes>
          <Route path="/program/:dayIndex" element={<ProgramScreen rutina={rutina} />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

const h2Texts = (container) => [...container.querySelectorAll('h2')].map((h) => h.textContent.trim());

beforeEach(() => {
  vi.clearAllMocks();
  libraryNotice.hasSeenLibraryNotice.mockReturnValue(true); // migration notice off
});

describe('AC1 — /program renders no Weekly summary section in any UI locale', () => {
  it.each(UI_LOCALES)('%s: no summary heading, no table, no column headers', (locale) => {
    const t = tFor(locale);
    const { container } = renderOverview(RUTINA_FULL, locale);

    // Non-vacuity: the overview really rendered in this locale.
    expect(screen.getByRole('heading', { name: t('program.trainingDaysTitle') })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: OLD_TITLE[locale] })).not.toBeInTheDocument();
    expect(screen.queryByText(OLD_TITLE[locale])).not.toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
  });
});

describe('AC2 — section order: objectives, warm-up, Training days, cool-down, rules, notes, library action', () => {
  const t = tFor('es');
  const title = (key) => t(key);

  it('with rules and notes present, the h2 sequence is exactly the six sections in order', () => {
    const { container } = renderOverview(RUTINA_FULL);
    expect(h2Texts(container)).toEqual([
      title('program.phaseObjectivesTitle'),
      title('program.warmupTitle'),
      title('program.trainingDaysTitle'),
      title('program.cooldownTitle'),
      title('program.rulesTitle'),
      title('program.notesTitle'),
    ]);
  });

  it('with empty rules and notes, those sections stay conditional and the sequence ends at cool-down', () => {
    const { container } = renderOverview(RUTINA_BARE);
    expect(h2Texts(container)).toEqual([
      title('program.phaseObjectivesTitle'),
      title('program.warmupTitle'),
      title('program.trainingDaysTitle'),
      title('program.cooldownTitle'),
    ]);
  });

  it('keeps the "Mis rutinas" library action after the last section', () => {
    const { container } = renderOverview(RUTINA_FULL);
    const headings = [...container.querySelectorAll('h2')];
    const action = screen.getByRole('button', { name: t('program.libraryAction') });
    const follows = headings.at(-1).compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(follows).toBeTruthy();
  });
});

describe('AC3 — Training days list is unchanged and is now the only per-day overview', () => {
  const t = tFor('es');

  it('shows each day label (+ intro) exactly once, as a link to /program/:dayIndex', () => {
    renderOverview(RUTINA_FULL);

    // getAllByText + length pins "exactly once": with the summary table still
    // rendered the same text appears a second time in a table cell.
    const withIntro = screen.getAllByText('Lunes — Pierna');
    expect(withIntro).toHaveLength(1);
    expect(withIntro[0].closest('a')).toHaveAttribute('href', '/program/0');

    const noIntro = screen.getAllByText('Miércoles');
    expect(noIntro).toHaveLength(1); // no dangling " — " when intro is absent
    expect(noIntro[0].closest('a')).toHaveAttribute('href', '/program/1');
  });

  it('shows the focus labels and the exercise count inside each row', () => {
    renderOverview(RUTINA_FULL);

    const focus0 = dayFocusLabels(EXERCISES_DAY_0, { t }).join(', ');
    const focus1 = dayFocusLabels(EXERCISES_DAY_1, { t }).join(', ');
    expect(focus0).toBe('Cuádriceps, Glúteos, Bíceps'); // fixture sanity: unique, first-seen order

    const row0 = screen.getAllByText('Lunes — Pierna')[0].closest('a');
    const row1 = screen.getAllByText('Miércoles')[0].closest('a');

    expect(screen.getAllByText(focus0)).toHaveLength(1);
    expect(row0).toHaveTextContent(focus0);
    expect(row0).toHaveTextContent(t('program.exerciseAbbrev', { n: 2 }));

    expect(screen.getAllByText(focus1)).toHaveLength(1);
    expect(row1).toHaveTextContent(focus1);
    expect(row1).toHaveTextContent(t('program.exerciseAbbrev', { n: 1 }));
  });
});

describe('AC4 — day detail (/program/:dayIndex) is unaffected', () => {
  it('still renders the exercise and its technique link, and never a summary section or table', async () => {
    const { container } = renderDayDetail(RUTINA_FULL);

    expect(await screen.findByRole('link', { name: /ver técnica de «Press de Hombro»/i })).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
    expect(screen.queryByText(OLD_TITLE.es)).not.toBeInTheDocument();
  });
});

describe('AC5 — dead code is gone from the Program screen and its neighbours', () => {
  const read = (...p) => fs.readFileSync(path.join(SRC_DIR, ...p), 'utf8');

  it('ProgramScreen.jsx no longer imports SummaryTable or builds summaryRows', () => {
    const source = read('screens', 'ProgramScreen.jsx');
    expect({
      importsSummaryTable: /import[^;]*SummaryTable/.test(source),
      rendersSummaryTable: /<SummaryTable/.test(source),
      summaryRows: /summaryRows/.test(source),
    }).toEqual({ importsSummaryTable: false, rendersSummaryTable: false, summaryRows: false });
  });

  it('ProgramScreen.jsx header comment no longer describes a derived summary table', () => {
    expect(/derived summary table/i.test(read('screens', 'ProgramScreen.jsx'))).toBe(false);
  });

  it('lib/muscleGroups.js comment no longer points at ProgramScreen\'s SummaryTable', () => {
    expect(/derived SummaryTable/.test(read('lib', 'muscleGroups.js'))).toBe(false);
  });

  it('keeps dayFocusLabels — the Training days row is still its consumer', () => {
    expect(/dayFocusLabels\(/.test(read('screens', 'ProgramScreen.jsx'))).toBe(true);
  });
});

describe('AC7 — the design system keeps SummaryTable; only the app stops using it', () => {
  it('design-system/components/composite/SummaryTable.jsx (+ .d.ts) still exist and export SummaryTable', () => {
    const jsx = path.join(DS_DIR, 'components', 'composite', 'SummaryTable.jsx');
    const dts = path.join(DS_DIR, 'components', 'composite', 'SummaryTable.d.ts');
    expect(fs.existsSync(jsx)).toBe(true);
    expect(fs.existsSync(dts)).toBe(true);
    expect(/export function SummaryTable/.test(fs.readFileSync(jsx, 'utf8'))).toBe(true);
  });
});
