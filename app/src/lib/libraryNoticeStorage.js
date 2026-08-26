/**
 * multi-rutina-library D-H — the one-shot "your program now lives in
 * Mis rutinas" migration notice flag. Plain localStorage boolean following
 * onboardingStorage's try/catch degrade pattern exactly: storage-disabled
 * environments just see the notice once per visit instead of throwing.
 *
 * The exported const exists for backup-registry parity (F8 convention).
 */

export const LIBRARY_NOTICE_KEY = 'rutina:libraryNoticeSeen';

/** @returns {boolean} true once the user has acknowledged the library notice */
export function hasSeenLibraryNotice() {
  try {
    return localStorage.getItem(LIBRARY_NOTICE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Marks the notice acknowledged. Idempotent; never throws. */
export function markLibraryNoticeSeen() {
  try {
    localStorage.setItem(LIBRARY_NOTICE_KEY, 'true');
  } catch {
    // Storage disabled — nothing persists, notice shows again next boot.
  }
}
