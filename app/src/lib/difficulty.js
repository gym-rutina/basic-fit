import { defaultT } from '../i18n/index.js';

/**
 * Shared difficulty enum <-> display-label mapping.
 *
 * IMPORTANT (Bagnik build note #2, non-negotiable): the internal token is
 * `easy | normal | hard` and must never be renamed — sessionMachine.test.js
 * and exportFormat.test.js assert on the literal token `'normal'`. Only the
 * DISPLAY label changes per language (pwa-ui-language AC6) — an English UI
 * renders "Just right" for the `normal` token, a Belarusian UI renders
 * "У самы раз", etc. `t` defaults to the es-pinned translator (D4), so every
 * existing call site keeps its Spanish output byte-for-byte (AC22).
 */
export const DIFFICULTY_TOKENS = ['easy', 'normal', 'hard'];

/** @param {(key: string) => string} [t] */
export function difficultyLevels(t = defaultT) {
  return DIFFICULTY_TOKENS.map((id) => ({ id, label: t(`difficulty.${id}`) }));
}

export function difficultyLabel(id, t = defaultT) {
  return DIFFICULTY_TOKENS.includes(id) ? t(`difficulty.${id}`) : '';
}
