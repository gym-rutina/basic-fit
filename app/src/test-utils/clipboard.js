import { vi } from 'vitest';

/**
 * Installs a fake navigator.clipboard. `Object.assign(navigator, …)` throws
 * (getter-only in jsdom), and `userEvent.setup()` OVERWRITES navigator.clipboard
 * — so call this AFTER `userEvent.setup()`, never before (see the note in
 * GuideOverlay.test.jsx's REQUEST EDITOR describe).
 *
 * @param {'ok'|'denied'|'missing'} mode
 * @returns {import('vitest').Mock|undefined} the writeText mock (undefined when missing)
 */
export function mockClipboard(mode = 'ok') {
  if (mode === 'missing') {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    return undefined;
  }
  const writeText = vi.fn();
  if (mode === 'denied') writeText.mockRejectedValue(new Error('denied'));
  else writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return writeText;
}
