/**
 * LLM-prompt REQUEST-field answer storage (onboarding-request-fields
 * R2.1-R2.4, R1.7, R1.8, tech-plan.md §2.1).
 *
 * Mirrors `clubStorage.js`'s contract on purpose: same `rutina:` namespace,
 * same synchronous/defensive/never-throws convention. R2.2's whole reason is
 * that `GuideOverlay` must render filled answers on its FIRST paint — the
 * same reason `clubStorage` is not in IndexedDB.
 *
 * Record shape: { field1?: string, field2?: string, field3?: number,
 * field4?: string, field5?: string }. field3 is the ONLY numeric field;
 * `readPromptRequest()` sanitizes it to an integer 1-7, else drops the key
 * (R1.8, AC7, AC11/AC12 pattern) — this runs on BOTH write and read so a
 * hand-edited or future-version-corrupted stored value degrades to
 * "unanswered" rather than ever reaching `composeRequestBlock`.
 *
 * Caps are enforced on WRITE (truncate, not reject — R1.7): fields 1/4 <=
 * 200 chars, field 2 <= 800 chars (Rev4-SF1), field 5 <= 500 chars. Unknown
 * keys in a persisted record are dropped on read (R2.4) — only
 * field1..field5 survive.
 */

export const PROMPT_REQUEST_KEY = 'rutina:promptRequest';

const TEXT_FIELD_CAPS = {
  field1: 200,
  field2: 800,
  field4: 200,
  field5: 500,
};

const KNOWN_FIELDS = ['field1', 'field2', 'field3', 'field4', 'field5'];

function sanitizeDays(value) {
  return Number.isInteger(value) && value >= 1 && value <= 7 ? value : undefined;
}

function sanitizeRecord(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const result = {};
  for (const key of KNOWN_FIELDS) {
    if (!(key in raw)) continue;
    if (key === 'field3') {
      const days = sanitizeDays(raw.field3);
      if (days !== undefined) result.field3 = days;
      continue;
    }
    const value = raw[key];
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

/**
 * @returns {{field1?: string, field2?: string, field3?: number, field4?: string, field5?: string}}
 */
export function readPromptRequest() {
  try {
    const raw = localStorage.getItem(PROMPT_REQUEST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return sanitizeRecord(parsed);
  } catch {
    return {}; // corrupt JSON, private-browsing storage denial, etc.
  }
}

/**
 * @param {{field1?: string, field2?: string, field3?: number, field4?: string, field5?: string}} record
 */
export function writePromptRequest(record) {
  try {
    const source = record && typeof record === 'object' ? record : {};
    const toStore = {};

    for (const [field, cap] of Object.entries(TEXT_FIELD_CAPS)) {
      if (typeof source[field] !== 'string') continue;
      toStore[field] = source[field].trim().slice(0, cap);
    }

    const days = sanitizeDays(source.field3);
    if (days !== undefined) toStore.field3 = days;

    localStorage.setItem(PROMPT_REQUEST_KEY, JSON.stringify(toStore));
  } catch {
    // Quota exceeded / storage disabled — same defensive convention as
    // clubStorage.js / uiLangStorage.js / onboardingStorage.js: lose the
    // write, never fail the flow.
  }
}

export function clearPromptRequest() {
  try {
    localStorage.removeItem(PROMPT_REQUEST_KEY);
  } catch {
    // ignore
  }
}
