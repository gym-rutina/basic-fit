import { describe, it, expect } from 'vitest';
import { buildExportPayload } from './exportFormat.js';
import { tFor } from '../i18n/index.js';

/**
 * pwa-ui-language AC19 (collation) and AC20 (export artifacts) —
 * tech-plan.md D15, D16.
 *
 * The line AC20 draws: the Markdown SCAFFOLDING is chrome and follows the UI
 * locale; the JSON payload's keys, the enum tokens, and every axis-3 value are
 * a data contract (docs/export-format.md) and never move.
 *
 * `exportFormat.test.js` is left untouched (AC22) — this file is additive.
 */

const session = (dayLabel, exercises, status = 'completed', startedAt = '2026-07-01T09:00:00.000Z') => ({
  status,
  dayLabel,
  startedAt,
  exercises,
});

const logged = (name, equipmentId, weightUsed, difficulty = 'normal', completedAt = '2026-07-01T09:30:00.000Z') => ({
  name,
  equipmentId,
  weightUsed,
  difficulty,
  completedAt,
});

// Inserted B-before-A on purpose: Map insertion order and code-point order
// both put "Bíceps" first ('B' = U+0042 < 'Á' = U+00C1), so only a real
// localeCompare under the active locale passes.
const SESSIONS = [
  session('Lunes', [logged('Bíceps', 'g3-s12', 20)], 'completed', '2026-07-01T09:00:00.000Z'),
  session('Martes', [logged('Ábdomen', null, 0, 'normal', '2026-07-02T09:30:00.000Z')], 'completed', '2026-07-02T09:00:00.000Z'),
];

describe('collation (AC19)', () => {
  it('orders exercise groups by localeCompare, not by insertion or code point', () => {
    const { markdown } = buildExportPayload(SESSIONS, {}, { locale: 'es', t: tFor('es') });
    expect(markdown.indexOf('Ábdomen')).toBeLessThan(markdown.indexOf('Bíceps'));
  });

  it('is deterministic — the same history exports identically twice', () => {
    // The point of sorting at all: two exports of the same data must diff clean.
    const a = buildExportPayload(SESSIONS, {}, { locale: 'es', t: tFor('es') }).markdown;
    const b = buildExportPayload([...SESSIONS].reverse(), {}, { locale: 'es', t: tFor('es') }).markdown;
    expect(a).toBe(b);
  });
});

describe('export chrome follows the UI locale (AC20)', () => {
  const ABANDONED = [session('Lunes', [], 'abandoned')];

  it('localizes the abandoned-sessions heading', () => {
    expect(buildExportPayload(ABANDONED).markdown).toContain('Sesiones sin completar:');
    expect(buildExportPayload(ABANDONED, {}, { locale: 'en', t: tFor('en') }).markdown).toContain(
      'Unfinished sessions:'
    );
    expect(buildExportPayload(ABANDONED, {}, { locale: 'be', t: tFor('be') }).markdown).toContain(
      'Незавершаныя сесіі:'
    );
  });

  it('localizes the empty state', () => {
    expect(buildExportPayload([]).markdown).toBe('Sin sesiones registradas todavía.');
    expect(buildExportPayload([], {}, { locale: 'en', t: tFor('en') }).markdown).toBe('No sessions recorded yet.');
  });

  it('localizes the difficulty word inside an entry line', () => {
    const es = buildExportPayload(SESSIONS).markdown;
    const en = buildExportPayload(SESSIONS, {}, { locale: 'en', t: tFor('en') }).markdown;
    expect(es).toContain('normal');
    expect(en).toContain('just right');
  });

  it('defaults to Spanish for every existing call site (D4, AC22)', () => {
    expect(buildExportPayload(ABANDONED).markdown).toContain('Sesiones sin completar:');
  });
});

describe('the payload is frozen (AC20, AC15)', () => {
  it('keeps identical JSON across every locale', () => {
    const es = buildExportPayload(SESSIONS, {}, { locale: 'es', t: tFor('es') }).json;
    const en = buildExportPayload(SESSIONS, {}, { locale: 'en', t: tFor('en') }).json;
    const be = buildExportPayload(SESSIONS, {}, { locale: 'be', t: tFor('be') }).json;
    expect(JSON.stringify(en)).toBe(JSON.stringify(es));
    expect(JSON.stringify(be)).toBe(JSON.stringify(es));
  });

  it('keeps the difficulty enum token, never the display label', () => {
    const { json } = buildExportPayload(SESSIONS, {}, { locale: 'en', t: tFor('en') });
    const entries = Object.values(json.exercises).flat();
    expect(entries.every((e) => ['easy', 'normal', 'hard'].includes(e.difficulty))).toBe(true);
  });

  it('copies axis-3 exercise names verbatim in every locale (AC15)', () => {
    const be = buildExportPayload(
      [session('Панядзелак', [logged('Жым ад грудзей', 'g3-s10', 40)])],
      {},
      { locale: 'en', t: tFor('en') }
    );
    expect(Object.values(be.json.exerciseNames)).toContain('Жым ад грудзей');
    expect(be.markdown).toContain('Жым ад грудзей');
  });
});
