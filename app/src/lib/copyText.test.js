import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from './copyText.js';
import { mockClipboard } from '../test-utils/clipboard.js';

// import-flow-guided-first AD-4 — RED until Cmok creates copyText.js. The one
// place that owns navigator.clipboard and its denial handling.
describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves 'copied' after writing the text to the clipboard", async () => {
    const writeText = mockClipboard('ok');

    await expect(copyText('hola')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('hola');
  });

  it("resolves 'denied' (never throws) when the clipboard rejects", async () => {
    mockClipboard('denied');
    await expect(copyText('hola')).resolves.toBe('denied');
  });

  it("resolves 'denied' when the Clipboard API is missing", async () => {
    mockClipboard('missing');
    await expect(copyText('hola')).resolves.toBe('denied');
  });
});
