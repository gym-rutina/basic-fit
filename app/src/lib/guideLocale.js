import { resolveUiLocale } from '../i18n/index.js';

/**
 * pwa-ui-language AC8 (tech-plan.md D17): `detectGuideLocale` is re-expressed
 * as a thin wrapper over `resolveUiLocale` — the SAME rule, one
 * implementation, rather than a second copy that can silently diverge from
 * the UI locale (DEC-2's rule was lifted from here in the first place).
 * `stored` is always absent here: this function only ever gets a bare
 * `navLang` argument at its remaining call site (GuideOverlay's own
 * `locale ?? uiLocale` fallback), never a persisted preference of its own.
 */
export function detectGuideLocale(navLang = navigator.language) {
  return resolveUiLocale(null, navLang);
}

/**
 * Public gym list (names + ids) — not part of the LLM prompt. Not copy — a
 * URL — so it stays here rather than folding into the i18n catalogs.
 */
export const GYMS_CATALOG_URL =
  'https://gym-rutina.github.io/basic-fit/gyms.html';

/**
 * In-app "download data archive" card (llm-guide-zip-download; superseded
 * the per-file "download data files" card from llm-guide-file-downloads).
 * Served same-origin from the deployed PWA (GitHub Pages) so the HTML
 * `download` attribute reliably forces a save dialog instead of an inline
 * browser view — see spec AC2. Always the absolute production URL, mirroring
 * GYMS_CATALOG_URL's existing convention (the guide never points this at
 * localhost, even in local dev).
 */
export const GUIDE_DATA_FILES_BASE_URL =
  'https://gym-rutina.github.io/basic-fit/';

/**
 * Single zip archive replacing the four per-file downloads
 * (llm-guide-zip-download). `path` must mirror where
 * scripts/copy-static-pages.js's buildDataArchive() writes the archive
 * inside dist/ (dist/data/rutina-data-files.zip → 'data/rutina-data-files.zip'
 * here, combined with GUIDE_DATA_FILES_BASE_URL above). `bytes` is
 * hand-maintained (not build-computed) — same convention as the old
 * per-file `bytes` fields; update it after running `npm run build && npm run postbuild`
 * and reading the "Wrote dist/data/rutina-data-files.zip (N bytes)" log line.
 */
export const GUIDE_DATA_ARCHIVE = {
  filename: 'rutina-data-files.zip',
  path: 'data/rutina-data-files.zip',
  bytes: 19291,
};
