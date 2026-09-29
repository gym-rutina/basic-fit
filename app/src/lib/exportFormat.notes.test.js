import { describe, it, expect } from 'vitest';
import { buildExportPayload } from './exportFormat.js';

/**
 * club-equipment-reporting AC17 (tech-plan.md §2 D11) — notes flow into BOTH
 * export artifacts, exactly like weight/difficulty, so a user's annotations
 * feed their next LLM-authored phase. Conventions:
 *
 * - JSON: an entry gains a `notes` field ONLY when the logged exercise had
 *   one (entries without keep today's exact three-key shape).
 * - Markdown: a locale-neutral note line under the entry — four-space indent,
 *   `> ` prefix, single line (newlines collapsed to spaces). No translatable
 *   word, so no new i18n key.
 * - An exercise that was logged then undone (completedAt null) exports
 *   nothing, notes included — the existing rule.
 */

const logged = (over = {}) => ({
  equipmentId: 'g3-s10',
  name: 'Prensa de Pecho',
  weightUsed: 40,
  difficulty: 'normal',
  completedAt: '2026-09-20T10:00:00.000Z',
  ...over,
});
const session = (exercises, over = {}) => ({ id: 's', status: 'completed', dayLabel: 'Lunes', startedAt: '2026-09-20T09:00:00.000Z', exercises, ...over });

describe('JSON export (AC17)', () => {
  it('adds `notes` to the entry when the logged exercise has one', () => {
    const { json } = buildExportPayload([session([logged({ notes: 'sin polea, usé el agarre largo' })])]);
    const entries = Object.values(json.exercises)[0];
    expect(entries[0]).toEqual({ date: '2026-09-20', weightUsed: 40, difficulty: 'normal', notes: 'sin polea, usé el agarre largo' });
  });

  it('keeps the original three-key entry when there is no note — existing consumers see no change', () => {
    const { json } = buildExportPayload([session([logged()])]);
    const entry = Object.values(json.exercises)[0][0];
    expect(Object.keys(entry).sort()).toEqual(['date', 'difficulty', 'weightUsed']);
  });

  it('mixes noted and un-noted entries chronologically', () => {
    const { json } = buildExportPayload([
      session([logged({ completedAt: '2026-09-22T10:00:00.000Z', notes: 'b' })], { id: 's2' }),
      session([logged({ completedAt: '2026-09-20T10:00:00.000Z' })], { id: 's1' }),
    ]);
    const entries = Object.values(json.exercises)[0];
    expect(entries.map((e) => e.date)).toEqual(['2026-09-20', '2026-09-22']);
    expect(entries[0]).not.toHaveProperty('notes');
    expect(entries[1].notes).toBe('b');
  });

  it('exports nothing for an undone exercise, even one that still carries a note', () => {
    const { json, markdown } = buildExportPayload([session([logged({ completedAt: null, weightUsed: null, difficulty: null, notes: 'stale' })])]);
    expect(json.exercises).toEqual({});
    expect(JSON.stringify(json)).not.toContain('stale');
    expect(markdown).not.toContain('stale');
  });
});

describe('Markdown export (AC17)', () => {
  it('puts a note line directly under its entry', () => {
    const { markdown } = buildExportPayload([session([logged({ notes: 'agarre largo' })])]);
    expect(markdown).toContain('  · 40kg / normal\n    > agarre largo');
  });

  it('emits no note line when there is no note — byte-identical to today', () => {
    const { markdown } = buildExportPayload([session([logged()])]);
    expect(markdown).toBe('Prensa de Pecho (g3-s10)\n  · 40kg / normal');
  });

  it('collapses a multi-line note to one line', () => {
    const { markdown } = buildExportPayload([session([logged({ notes: 'línea uno\nlínea dos' })])]);
    expect(markdown).toContain('    > línea uno línea dos');
    expect(markdown).not.toMatch(/línea uno\n\s*línea dos/);
  });

  it('keeps each note under ITS entry when an exercise has several', () => {
    const { markdown } = buildExportPayload([
      session([logged({ completedAt: '2026-09-20T10:00:00.000Z', notes: 'primera' })], { id: 's1' }),
      session([logged({ completedAt: '2026-09-22T10:00:00.000Z' })], { id: 's2' }),
      session([logged({ completedAt: '2026-09-24T10:00:00.000Z', notes: 'tercera' })], { id: 's3' }),
    ]);
    const lines = markdown.split('\n');
    const i1 = lines.findIndex((l) => l.includes('> primera'));
    const i3 = lines.findIndex((l) => l.includes('> tercera'));
    expect(lines[i1 - 1]).toMatch(/^  · 40kg/);
    expect(lines[i3 - 1]).toMatch(/^  · 40kg/);
    expect(i3 - i1).toBe(3); // primera, [2nd entry], tercera-entry, tercera-note
  });

  it('respects the date range for notes exactly as for entries', () => {
    const { markdown, json } = buildExportPayload(
      [session([logged({ completedAt: '2026-09-20T10:00:00.000Z', notes: 'fuera' })])],
      { from: '2026-09-21' }
    );
    expect(markdown).not.toContain('fuera');
    expect(JSON.stringify(json)).not.toContain('fuera');
  });
});
