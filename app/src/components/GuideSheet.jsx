import React, { useRef } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { GUIDE_HTML } from '../data/guideContent.js';
import { GUIDE_SCHEMA_DOWNLOAD, GUIDE_DATA_FILES_BASE_URL } from '../lib/guideLocale.js';
import { SheetShell } from './sheet/SheetShell.jsx';
import { tFor, useI18n } from '../i18n/index.js';

/** Byte size → de-emphasized "N KB" caption. */
function formatKb(bytes) {
  return Math.round(bytes / 1024) + ' KB';
}

/* Scoped styles for guide article content (pre-rendered HTML from Markdown). */
const ARTICLE_CSS = `
  .guide-article h1 { font: var(--text-h2); color: var(--bf-ink); margin: 0 0 16px; }
  .guide-article h2 { font: var(--text-h3); color: var(--bf-ink); margin: 24px 0 12px; }
  .guide-article h3 { font: var(--text-h4); color: var(--bf-ink); margin: 20px 0 8px; }
  .guide-article p  { margin: 8px 0; }
  .guide-article ul, .guide-article ol { padding-left: 20px; display: grid; gap: 6px; margin: 8px 0; }
  .guide-article li { margin: 0; }
  .guide-article strong { font-weight: 700; }
  .guide-article a { color: var(--text-link); }
  .guide-article blockquote {
    margin: 12px 0;
    padding: 10px 14px;
    border-left: 3px solid var(--bf-purple);
    background: var(--bf-grey-1);
    color: var(--bf-ink-2);
  }
  .guide-article table {
    width: 100%;
    border-collapse: collapse;
    font: 13px/1.4 var(--font-sans);
    margin: 12px 0;
    display: block;
    overflow-x: auto;
  }
  .guide-article th, .guide-article td {
    border: 1px solid var(--border-control);
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  .guide-article th { background: var(--bf-grey-1); font-weight: 700; }
  .guide-article code {
    font: 13px/1.4 monospace;
    background: var(--bf-grey-1);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .guide-article pre {
    background: var(--bf-grey-1);
    border-radius: var(--radius-control);
    padding: 12px 14px;
    font: 13px/1.5 monospace;
    overflow-x: auto;
    white-space: pre-wrap;
    margin: 8px 0;
  }
  .guide-article pre code {
    background: none;
    padding: 0;
  }
`;

/**
 * "Guía completa" bottom sheet (import-flow-guided-first AC16, D3) — the long
 * LLM-creation guide article plus the schema download row, extracted from the
 * deleted GuideOverlay. Opened from wizard step 2; never a wizard step itself.
 *
 * Keeps GuideOverlay's locale contract (pwa-ui-language AC8): an explicit
 * locale prop wins, else the UI locale from context; the chrome is built
 * with tFor(active) so a bare render (no provider) still works. fr/nl/de
 * fall back to the en article (GUIDE_HTML has es/en/be only).
 *
 * Props:
 *   onClose:      () => void
 *   locale?:      'es' | 'en' | 'be' | ... (defaults to the UI locale)
 *   returnFocusTo?: { current: HTMLElement } — focus target on close
 */
export function GuideSheet({ onClose, locale, returnFocusTo }) {
  const { locale: uiLocale } = useI18n();
  const active = locale ?? uiLocale;
  const t = tFor(active);
  const closeRef = useRef(null);
  const html = GUIDE_HTML[active] || GUIDE_HTML.en || t('guide.fallbackHtml');

  return (
    <>
      <style>{ARTICLE_CSS}</style>
      <SheetShell
        onClose={onClose}
        labelledBy="guide-sheet-title"
        initialFocusRef={closeRef}
        returnFocusTo={returnFocusTo}
        maxHeight="88vh"
        trapFocus
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--space-4)' }}>
          <h2 id="guide-sheet-title" style={{ font: 'var(--text-h4)', color: 'var(--bf-ink)', margin: 0 }}>
            {t('promptWizard.fullGuide')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label={t('guide.close')}
            onClick={onClose}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-control)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <article
          className="guide-article"
          style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink)', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div
          className="guide-downloads"
          style={{
            marginTop: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--bf-purple-tint)',
            border: '1px solid var(--bf-purple)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div
            className="guide-downloads-heading"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Icon name="download" size={18} style={{ color: 'var(--bf-purple)' }} />
            <span style={{ font: '700 13px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
              {t('guide.downloadsHeading')}
            </span>
          </div>
          <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: 0 }}>
            {t('guide.downloadsBody')}
          </p>
          <div
            className="guide-downloads-grid"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <a
              href={GUIDE_DATA_FILES_BASE_URL + GUIDE_SCHEMA_DOWNLOAD.path}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="guide-downloads-row"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                background: 'var(--bf-white)',
                border: '1px solid var(--bf-purple)',
                borderRadius: 'var(--radius-control)',
                padding: '8px 12px',
                textDecoration: 'none',
                color: 'var(--bf-ink)',
              }}
            >
              <span className="guide-downloads-row-label" style={{ minWidth: 0 }}>
                <span style={{ font: '600 13px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
                  {t('guide.schemaDownloadLabel')}
                </span>
                <br />
                <span
                  className="guide-downloads-row-filename"
                  style={{ font: '12px/1.4 monospace', color: 'var(--bf-ink-2)' }}
                >
                  {GUIDE_SCHEMA_DOWNLOAD.filename}
                </span>
                <span
                  className="guide-downloads-row-size"
                  style={{ font: 'var(--text-caption)', color: 'var(--text-muted)' }}
                >
                  {' '}· {formatKb(GUIDE_SCHEMA_DOWNLOAD.bytes)}
                </span>
              </span>
              <span
                className="guide-downloads-row-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  font: '600 13px/1 var(--font-sans)',
                  color: 'var(--bf-purple)',
                  flexShrink: 0,
                }}
              >
                <Icon name="download" size={14} />
                {t('guide.downloadAction')}
              </span>
            </a>
          </div>
        </div>
      </SheetShell>
    </>
  );
}
