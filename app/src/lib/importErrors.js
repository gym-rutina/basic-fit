/**
 * import-flow-guided-first AC15 (tech-plan AD-4) — the text a user pastes back
 * into their AI chat: one "- " bullet per validation error.
 *
 * @param {unknown} errors
 * @returns {string}
 */
export function formatErrorsForClipboard(errors) {
  if (!Array.isArray(errors)) return '';
  return errors
    .filter((e) => typeof e === 'string' && e.trim() !== '')
    .map((e) => `- ${e.trim()}`)
    .join('\n');
}
