import { describe, it, expect } from 'vitest';
import { formatErrorsForClipboard } from './importErrors.js';

// import-flow-guided-first AC15 (tech-plan AD-4) — RED until Cmok creates
// importErrors.js. The text the user pastes back into their AI chat.
describe('formatErrorsForClipboard', () => {
  it('renders one "- " bullet per error, newline separated', () => {
    expect(formatErrorsForClipboard(['program.phaseName: required', 'equipmentId "g3-xx" no existe']))
      .toBe('- program.phaseName: required\n- equipmentId "g3-xx" no existe');
  });

  it('trims entries and drops empty / non-string ones', () => {
    expect(formatErrorsForClipboard(['  a  ', '', '   ', null, 42, 'b'])).toBe('- a\n- b');
  });

  it('returns an empty string for no errors or bad input', () => {
    expect(formatErrorsForClipboard([])).toBe('');
    expect(formatErrorsForClipboard(undefined)).toBe('');
    expect(formatErrorsForClipboard('nope')).toBe('');
  });
});
