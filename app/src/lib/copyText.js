/**
 * import-flow-guided-first AD-4 — the one place that owns navigator.clipboard
 * and its denial handling. Never throws.
 *
 * @param {string} text
 * @returns {Promise<'copied'|'denied'>}
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'denied'; // permission denied, insecure context, or no Clipboard API
  }
}
