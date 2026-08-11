import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProgramScreen } from '../screens/ProgramScreen.jsx';
import { HomeScreen } from '../screens/HomeScreen.jsx';
import { ActiveSessionScreen } from '../screens/ActiveSessionScreen.jsx';
import { I18nProvider, UI_LOCALES } from './index.js';
import * as db from '../lib/db.js';

vi.mock('../lib/db.js');

/**
 * pwa-ui-language AC15 + AC16 (tech-plan.md D14).
 *
 * Axis 3 — the user's own routine content — is accepted as authored (DEC-5).
 * The app never translates it, never validates its language, never tags it,
 * and never reshapes it. `schemaVersion` stays 1.
 *
 * `dir="auto"` and NOT `lang`: the app genuinely does not know what language
 * a routine is in, so it must not claim one. `dir="auto"` lets the browser
 * work the direction out per string, which is the only correct answer
 * available to us.
 */

const BE_RUTINA = {
  schemaVersion: 1,
  program: { name: 'Праграма сілы', phaseName: 'Фаза 1', phaseNumber: 1, durationWeeks: 4 },
  phaseInfo: { objective: 'Нарасціць сілу', intensityPercent: '70%', restSeconds: 90, frequencyPerWeek: 3 },
  warmup: { durationMinutes: 5, steps: ['Разагрэў'] },
  cooldown: { durationMinutes: 5, steps: ['Заміналка'] },
  days: [
    {
      label: 'Панядзелак',
      exercises: [
        {
          name: 'Жым ад грудзей',
          muscleGroups: ['pectoralis-major'],
          equipmentId: 'g3-s10',
          sets: 3,
          reps: '10 да адмовы',
          restSeconds: 90,
          intensity: '70% ад 1ПМ',
          technique: ['Трымайце спіну роўна'],
        },
      ],
    },
  ],
  rules: ['Не спяшайцеся'],
  notes: [{ title: 'Заўвага', body: 'Піце ваду' }],
};

function renderDayDetail(locale) {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/program/0']}>
        <Routes>
          <Route path="/program/:dayIndex" element={<ProgramScreen rutina={BE_RUTINA} onGoImport={vi.fn()} onRutinaCleared={vi.fn()} />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

// pwa-ui-language AC16 code-QA follow-up (Bagnik fail #1, fix cycle 1) — the
// overview route (day-list, warmup/cooldown, weekly summary) is a SEPARATE
// render path from the day-detail one above, and Bagnik found six of the
// twelve missing dir="auto" sites live here.
function renderOverview(locale) {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/program']}>
        <Routes>
          <Route path="/program" element={<ProgramScreen rutina={BE_RUTINA} onGoImport={vi.fn()} onRutinaCleared={vi.fn()} />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

function renderHome(locale) {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/']}>
        <HomeScreen
          rutina={BE_RUTINA}
          loadError={false}
          onGoImport={vi.fn()}
          activeSessionStatus="ready"
          activeSession={null}
          onRetryActiveSession={vi.fn()}
        />
      </MemoryRouter>
    </I18nProvider>
  );
}

// Two exercises on purpose: ActiveSessionScreen auto-expands the first
// pending exercise and collapses the rest, and the two AC16 sites Bagnik
// found there (`:257` inline collapsed reps, `:269`/`:271` expanded
// DetailItem reps/intensity) only render in different expansion states.
const SESSION_EXERCISES = [
  {
    name: 'Жым ад грудзей',
    equipmentId: 'g3-s10',
    sets: 3,
    reps: '10 да адмовы',
    restSeconds: 90,
    intensity: '70% ад 1ПМ',
    technique: ['Трымайце спіну роўна'],
  },
  {
    name: 'Разгінанне ног',
    equipmentId: 'g3-s10',
    sets: 3,
    reps: '12 паўтораў',
    restSeconds: 60,
  },
];

const BE_SESSION_RUTINA = { ...BE_RUTINA, days: [{ label: BE_RUTINA.days[0].label, exercises: SESSION_EXERCISES }] };

function renderActiveSession(locale) {
  db.getActiveRutina.mockResolvedValue({ rutina: BE_SESSION_RUTINA, importedAt: '2026-08-01' });
  db.getActiveSession.mockResolvedValue({
    id: 'sess-axis3',
    dayLabel: BE_SESSION_RUTINA.days[0].label,
    dayIndex: 0,
    status: 'active',
    startedAt: '2026-08-01T10:00:00.000Z',
    endedAt: null,
    exercises: SESSION_EXERCISES.map((ex) => ({
      equipmentId: ex.equipmentId,
      name: ex.name,
      weightUsed: null,
      difficulty: null,
      completedAt: null,
    })),
  });
  db.getLastWeight.mockResolvedValue(null);
  db.saveSession.mockResolvedValue(undefined);

  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter initialEntries={['/session']}>
        <Routes>
          <Route path="/session" element={<ActiveSessionScreen />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  db.getActiveSession.mockResolvedValue(null);
  db.listSessions.mockResolvedValue([]);
});

describe('axis-3 content is rendered verbatim (AC15)', () => {
  it('renders a Belarusian exercise name byte-identically in every UI locale', () => {
    for (const locale of UI_LOCALES) {
      const { unmount } = renderDayDetail(locale);
      expect(screen.getByRole('heading', { name: 'Жым ад грудзей' })).toBeInTheDocument();
      unmount();
    }
  });

  it('never translates, transliterates or normalises the authored technique cue', () => {
    renderDayDetail('en');
    expect(screen.getByText('Трымайце спіну роўна')).toBeInTheDocument();
  });

  it('leaves the rutina schema at version 1 with plain string fields (DEC-5)', () => {
    // The superseded rutina-bilingual-content spec would have made these
    // required {en,es,be} objects and bumped schemaVersion to 2.
    const schemaPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../data/schema/rutina.schema.json'
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    expect(schema.properties.schemaVersion).toMatchObject({ type: 'integer', minimum: 1 });
    expect(schema.properties.schemaVersion.description).toContain('Current value: 1.');
    expect(JSON.stringify(schema)).not.toContain('localizedString');
    expect(schema.properties.days.items.properties.label.type).toBe('string');
    expect(schema.properties.days.items.properties.exercises.items.properties.name.type).toBe('string');
  });
});

describe('axis-3 nodes carry dir="auto" and no lang (AC16)', () => {
  const textOf = (el) => el.textContent.trim();

  it('marks the exercise name', () => {
    const { container } = renderDayDetail('es');
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).toContain('Жым ад грудзей');
  });

  it('marks the technique cue', () => {
    const { container } = renderDayDetail('es');
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).toContain('Трымайце спіну роўна');
  });

  it('marks the exercise reps value in the details grid', () => {
    const { container } = renderDayDetail('es');
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).toContain(BE_RUTINA.days[0].exercises[0].reps);
  });

  it('marks the exercise intensity value in the details grid', () => {
    const { container } = renderDayDetail('es');
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).toContain(BE_RUTINA.days[0].exercises[0].intensity);
  });

  it('never puts a lang attribute on user content — the app does not know the language', () => {
    const { container } = renderDayDetail('es');
    for (const el of container.querySelectorAll('[dir="auto"]')) {
      expect(el.hasAttribute('lang')).toBe(false);
    }
  });

  it('does not mark UI chrome as dir="auto" — chrome direction follows the UI locale', () => {
    // es/en/be are all LTR, so chrome must not opt into per-string direction
    // detection; that is an axis-3-only affordance.
    const { container } = renderDayDetail('es');
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).not.toContain('Programa');
    expect(marked).not.toContain('Descanso');
  });
});

/**
 * pwa-ui-language AC16 code-QA follow-up (Bagnik fail #1, fix cycle 1).
 *
 * Bagnik's code-QA run found 12 axis-3 render sites with no `dir="auto"` —
 * the day-detail screen above (tested since architecture-planning) was fine,
 * but nothing exercised the overview route, HomeScreen or
 * ActiveSessionScreen. This block closes that gap for every site that can be
 * reached without disproportionate fixture work: 6 of 6 overview sites, 1 of
 * 1 HomeScreen site, and all 3 ActiveSessionScreen sites (2 unique lines,
 * one of which needs a second, collapsed exercise to render at all).
 *
 * Not covered here: `ScreenHeader`/`SectionBanner`/`SummaryTable`/
 * `DetailItem` themselves are deliberately unchanged (they also render
 * chrome), so there is nothing further to assert on the shared components —
 * only the call sites that feed them axis-3 values.
 */
describe('axis-3 nodes carry dir="auto" on the program overview (AC16)', () => {
  const textOf = (el) => el.textContent.trim();

  it('marks the program name, phase name, phase objective and warmup/cooldown steps', () => {
    const { container } = renderOverview('es');
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).toContain(BE_RUTINA.program.name);
    expect(marked).toContain(BE_RUTINA.program.phaseName);
    expect(marked).toContain(BE_RUTINA.phaseInfo.objective);
    expect(marked).toContain(BE_RUTINA.warmup.steps[0]);
    expect(marked).toContain(BE_RUTINA.cooldown.steps[0]);
  });

  it('marks the day label inside the weekly summary table specifically', () => {
    // The day-list link row above the table already carried dir="auto"
    // before this fix cycle, so asserting against the whole container would
    // pass even if the summary-table cell (the actual regression) were never
    // fixed — scope the query to the <table> to prove that cell specifically.
    const { container } = renderOverview('es');
    const table = container.querySelector('table');
    const marked = [...table.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).toContain(BE_RUTINA.days[0].label);
  });

  it('does not mark the overview chrome as dir="auto"', () => {
    // Both strings are real chrome rendered by this exact screen (section
    // titles), not borrowed from elsewhere — a vacuous negative assertion
    // would prove nothing.
    const { container } = renderOverview('es');
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).not.toContain('Objetivos de esta fase');
    expect(marked).not.toContain('Días de entrenamiento');
  });
});

describe('axis-3 nodes carry dir="auto" on Inicio and the active session (AC16)', () => {
  const textOf = (el) => el.textContent.trim();

  it('marks the program name on Inicio (HomeScreen)', () => {
    const { container } = renderHome('es');
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    expect(marked).toContain(BE_RUTINA.program.name);
  });

  it('marks reps in both the collapsed and the expanded exercise card, and intensity when expanded', async () => {
    const { container } = renderActiveSession('es');
    // First pending exercise auto-expands; wait for the async rutina/session load.
    await screen.findByText(SESSION_EXERCISES[0].name);
    const marked = [...container.querySelectorAll('[dir="auto"]')].map(textOf);
    // Expanded (index 0): DetailItem reps + DetailItem intensity.
    expect(marked).toContain(SESSION_EXERCISES[0].reps);
    expect(marked).toContain(SESSION_EXERCISES[0].intensity);
    // Collapsed (index 1): inline "sets × reps" summary line.
    expect(marked).toContain(SESSION_EXERCISES[1].reps);
  });
});
