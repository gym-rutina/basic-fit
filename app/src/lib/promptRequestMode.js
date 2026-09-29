/**
 * import-flow-guided-first AC14 (tech-plan AD-3) — has the user already
 * answered any of the five prompt-request fields (e.g. during onboarding)?
 * Wizard step 1 opens as a pre-filled review when true, blank form when false.
 *
 * @param {{field1?: string, field2?: string, field3?: number, field4?: string, field5?: string}|null|undefined} record
 * @returns {boolean}
 */
export function hasAnsweredFields(record) {
  if (record === null || typeof record !== 'object') return false;
  for (const key of ['field1', 'field2', 'field4', 'field5']) {
    const v = record[key];
    if (typeof v === 'string' && v.trim() !== '') return true;
  }
  const days = record.field3;
  return Number.isInteger(days) && days >= 1 && days <= 7;
}
