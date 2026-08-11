import { describe, it, expect } from 'vitest';
import { buildFrequencyGrid } from './progress.js';
import { tFor } from '../i18n/index.js';

/**
 * pwa-ui-language AC7 — accessible names are strings too (tech-plan.md D4).
 *
 * The heatmap's cell labels are the clearest case in the app: `'sesión
 * completada'` / `'sin sesión'` are never rendered visually, so a
 * screen-reader user is the only person who would ever notice they stayed
 * Spanish in an English build. Nothing about the visible UI would look wrong.
 */

const SESSIONS = [
  { status: 'completed', startedAt: '2026-07-14T09:00:00.000Z', exercises: [{ completedAt: '2026-07-14T09:30:00.000Z' }] },
];

const grid = (t) => buildFrequencyGrid(SESSIONS, { weeks: 2, todayKey: '2026-07-15', t });

describe('heatmap cell aria labels (AC7)', () => {
  it('defaults to Spanish, so every existing call site is unchanged (D4, AC22)', () => {
    const labels = new Set(buildFrequencyGrid(SESSIONS, { weeks: 2, todayKey: '2026-07-15' }).cells.map((c) => c.ariaLabel));
    expect(labels).toContain('sesión completada');
    expect(labels).toContain('sin sesión');
  });

  it('follows the active locale', () => {
    const en = new Set(grid(tFor('en')).cells.map((c) => c.ariaLabel));
    expect(en).toContain('session completed');
    expect(en).toContain('no session');
    expect(en).not.toContain('sesión completada');

    const be = new Set(grid(tFor('be')).cells.map((c) => c.ariaLabel));
    expect(be).toContain('сесія завершана');
    expect(be).toContain('няма сесіі');
  });

  it('never leaves a cell without an accessible name', () => {
    for (const locale of ['es', 'en', 'be']) {
      for (const cell of grid(tFor(locale)).cells) {
        expect(typeof cell.ariaLabel).toBe('string');
        expect(cell.ariaLabel.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('leaves the grid shape alone — this is a copy change, not a data change', () => {
    const es = grid(tFor('es'));
    const be = grid(tFor('be'));
    expect(be.weeks).toBe(es.weeks);
    expect(be.cells.map((c) => `${c.date}:${c.filled}`)).toEqual(es.cells.map((c) => `${c.date}:${c.filled}`));
  });
});
