import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTodayDay } from './today.js';

/**
 * pwa-ui-language AC18 — the D2 fix (tech-plan.md D2).
 *
 * `resolveTodayDay` matched `days[].label` against a hardcoded SPANISH
 * weekday array, so a routine authored with "Monday" or "Панядзелак" silently
 * dropped out of mode:'today' into the mode:'next' guess. No error, no
 * warning — HomeScreen just quietly stopped saying "today's session".
 *
 * The weekday tables are matched for ALL three languages regardless of the
 * active UI locale: axis-3 content language and axis-1 UI language are
 * independent, which is the entire premise of the three-axis model.
 *
 * `today.locale.test.js` is additive — `today.test.js` stays untouched (AC22).
 */

const WEDNESDAY = new Date('2026-07-15T09:00:00'); // getDay() === 3
const SUNDAY = new Date('2026-07-12T09:00:00'); // getDay() === 0

const days = (...labels) => labels.map((label) => ({ label, exercises: [{ equipmentId: 'g3-s10' }] }));

describe('resolveTodayDay — English day labels (AC18)', () => {
  it('matches an English weekday label', () => {
    expect(resolveTodayDay(days('Monday', 'Wednesday', 'Friday'), WEDNESDAY, [])).toMatchObject({
      mode: 'today',
      index: 1,
    });
  });

  it('is case-insensitive, like the Spanish path already was', () => {
    expect(resolveTodayDay(days('WEDNESDAY'), WEDNESDAY, [])).toMatchObject({ mode: 'today', index: 0 });
    expect(resolveTodayDay(days('  wednesday  '), WEDNESDAY, [])).toMatchObject({ mode: 'today', index: 0 });
  });

  it('matches Sunday, the index-0 boundary', () => {
    expect(resolveTodayDay(days('Sunday', 'Monday'), SUNDAY, [])).toMatchObject({ mode: 'today', index: 0 });
  });
});

describe('resolveTodayDay — Belarusian day labels (AC18)', () => {
  it('matches a Belarusian weekday label', () => {
    expect(resolveTodayDay(days('Панядзелак', 'Серада', 'Пятніца'), WEDNESDAY, [])).toMatchObject({
      mode: 'today',
      index: 1,
    });
  });

  it('matches Belarusian Sunday', () => {
    expect(resolveTodayDay(days('Нядзеля', 'Панядзелак'), SUNDAY, [])).toMatchObject({ mode: 'today', index: 0 });
  });

  it('is case-insensitive for Cyrillic too', () => {
    expect(resolveTodayDay(days('СЕРАДА'), WEDNESDAY, [])).toMatchObject({ mode: 'today', index: 0 });
  });
});

describe('resolveTodayDay — Spanish behaviour is preserved exactly (AC18)', () => {
  it('still matches the accented and unaccented Spanish spellings', () => {
    expect(resolveTodayDay(days('Miércoles'), WEDNESDAY, [])).toMatchObject({ mode: 'today', index: 0 });
    expect(resolveTodayDay(days('miercoles'), WEDNESDAY, [])).toMatchObject({ mode: 'today', index: 0 });
  });

  it('still falls through to mode:next for a label that names no weekday', () => {
    // "Día A" / "Push" / "Full Body" routines must keep the existing chain.
    const result = resolveTodayDay(days('Full Body A', 'Full Body B'), WEDNESDAY, []);
    expect(result).toMatchObject({ mode: 'next', index: 0 });
  });

  it('still skips days with a completed session when falling back', () => {
    const result = resolveTodayDay(days('Push', 'Pull'), WEDNESDAY, [{ dayIndex: 0, status: 'completed' }]);
    expect(result).toMatchObject({ mode: 'next', index: 1 });
  });

  it('does not match a weekday name for a DIFFERENT day of the week', () => {
    // The three tables must not blur together into "any weekday matches".
    expect(resolveTodayDay(days('Monday'), WEDNESDAY, [])).toMatchObject({ mode: 'next' });
    expect(resolveTodayDay(days('Панядзелак'), WEDNESDAY, [])).toMatchObject({ mode: 'next' });
    expect(resolveTodayDay(days('lunes'), WEDNESDAY, [])).toMatchObject({ mode: 'next' });
  });
});

describe('today.js boundary rule', () => {
  it('still has zero imports — the weekday table is data, not i18n', () => {
    // Deliberate: axis-3 matching must not depend on the active UI locale, so
    // there is nothing here for the i18n module to provide.
    const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'today.js');
    const source = fs.readFileSync(file, 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
