import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { GUIDE_HTML, GUIDE_PROMPT } from '../data/guideContent.js';
import { GUIDE_DATA_ARCHIVE, GUIDE_DATA_FILES_BASE_URL } from '../lib/guideLocale.js';
import { readClub } from '../lib/clubStorage.js';
import { EQUIPMENT } from '../data/equipment.js';
import { buildPrompt } from '../lib/promptEquipment.js';
import { useClubExclusions } from '../lib/useClubExclusions.js';
import { ClubPickerSheet } from './ClubPickerSheet.jsx';
import { EquipmentOverlaySheet } from './EquipmentOverlaySheet.jsx';
import { tFor, useI18n } from '../i18n/index.js';

/** Byte size → de-emphasized "N KB" caption (ux-design.md Decision 7). */
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
 * Full-screen in-app guide overlay (spec AC2).
 *
 * pwa-ui-language AC8 (tech-plan.md D17): keeps its `locale` PROP for
 * back-compat — `GuideOverlay.test.jsx` renders `<GuideOverlay locale="en"
 * …/>` bare, with no provider, and asserts English chrome. So this builds
 * its OWN translator from the locale it ends up rendering
 * (`tFor(active)`), never the context's `t` directly — that would be
 * Spanish here, since a bare render has no provider. `active` falls back to
 * the UI locale from context only when no explicit `locale` prop is given,
 * which is exactly how ImportScreen calls it now (AC8's whole point: the
 * guide follows the active UI locale, not `navigator.language`).
 *
 * Props:
 *   locale:  'es' | 'en' | 'be' (optional — defaults to the UI locale)
 *   onClose: () => void
 */
export function GuideOverlay({ locale, onClose }) {
  const { locale: uiLocale } = useI18n();
  const active = locale ?? uiLocale;
  const t = tFor(active);
  const closeRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [club, setClub] = useState(() => readClub());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const { excludedIds } = useClubExclusions(club?.clubId ?? null);
  const html = GUIDE_HTML[active] || GUIDE_HTML.en || t('guide.fallbackHtml');

  // D22a (tech-plan-build-b.md §5): append the club + equipment section from
  // buildPrompt to the base GUIDE_PROMPT template.
  //
  // WHY uncontrolled textarea + ref rather than controlled (value=):
  // React's updateWrapper calls node.defaultValue = newValue on every render,
  // which updates the textarea's text child node. testing-library's getByText
  // reads those text child nodes, so a controlled textarea with club data in
  // its value would match getByText(clubName) — colliding with the club info
  // box tests that use getByText to assert visible UI, not prompt content.
  //
  // An uncontrolled textarea (defaultValue=GUIDE_PROMPT, no value= prop) gets
  // its text child node set once at mount and never touched by React again.
  // getNodeText(textarea) returns GUIDE_PROMPT only — no club name collision.
  // The ref lets useEffect write directly to element.value so AC36's
  // editor.value check (which reads the DOM property) sees the full prompt
  // after act() flushes the effect. node.defaultValue is not changed.
  const promptRef = useRef(null);
  const computedPromptText = useMemo(
    () => GUIDE_PROMPT + '\n' + buildPrompt({ equipment: EQUIPMENT, lang: active, excludedIds, club }),
    [active, excludedIds, club]
  );
  useEffect(() => {
    if (promptRef.current) promptRef.current.value = computedPromptText;
  }, [computedPromptText]);

  function handleClubSelected(selected) {
    setClub(selected);
    setPickerOpen(false);
  }

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' && onClose) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(promptRef.current?.value ?? computedPromptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied — user can still select manually */
    }
  }

  return (
    <>
      <style>{ARTICLE_CSS}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-overlay-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 400,
          background: 'var(--bf-white)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          flexShrink: 0,
          background: 'var(--bf-white)',
          borderBottom: '1px solid var(--bf-grey-2)',
          paddingBlock: 'var(--space-4)',
          paddingInline: 'var(--page-pad-x)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span
            id="guide-overlay-title"
            style={{ font: 'var(--text-h4)', color: 'var(--bf-ink)' }}
          >
            {t('guide.title')}
          </span>

          <button
            ref={closeRef}
            type="button"
            aria-label={t('guide.close')}
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
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

        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingBlock: 'var(--space-6) var(--space-10)',
          paddingInline: 'var(--page-pad-x)',
        }}>
          <div style={{ maxWidth: 600, margin: '0 auto var(--space-6)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 8,
            }}>
              <span
                id="guide-prompt-label"
                style={{
                  font: 'var(--text-label)',
                  letterSpacing: 'var(--tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                {t('guide.promptLabel')}
              </span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                aria-live="polite"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  font: '600 13px/1 var(--font-sans)',
                  color: copied ? 'var(--bf-success)' : 'var(--bf-purple)',
                  background: copied ? 'var(--bf-success-tint)' : 'var(--bf-purple-tint)',
                  border: `1px solid ${copied ? 'var(--bf-success)' : 'var(--bf-purple)'}`,
                  borderRadius: 'var(--radius-control)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Icon name={copied ? 'check' : 'copy'} size={14} />
                {copied ? t('guide.copied') : t('guide.copy')}
              </button>
            </div>
            <p style={{
              font: 'var(--text-body-sm)',
              color: 'var(--text-muted)',
              margin: '0 0 10px',
            }}>
              {t('guide.fillHint')}
            </p>
            <textarea
              ref={promptRef}
              id="guide-prompt-editor"
              aria-labelledby="guide-prompt-label"
              defaultValue={GUIDE_PROMPT}
              spellCheck={false}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bf-white)',
                border: '1px solid var(--border-control)',
                borderRadius: 'var(--radius-control)',
                padding: '12px 14px',
                font: '12px/1.5 monospace',
                color: 'var(--bf-ink)',
                margin: '0 0 10px',
                minHeight: 'min(42vh, 320px)',
                maxHeight: 'min(60vh, 480px)',
                resize: 'vertical',
              }}
            />
            {/* gym-directory-and-catalog R6.1/R6.7/D3/D16 — the gyms.html id-lookup
                callout is replaced by the club picker trigger. Empty state prompts
                selection; a resolved (or stale, D16) club shows its cached name +
                address on the FIRST paint (clubStorage.readClub() is synchronous). */}
            <div style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              background: 'var(--bf-purple-tint)',
              border: '1px solid var(--bf-purple)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}>
              <Icon name="map-pin" size={18} style={{ color: 'var(--bf-purple)', marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 13px/1.3 var(--font-sans)', color: 'var(--bf-ink)', marginBottom: 4 }}>
                  {t('club.fieldHeading')}
                </div>
                {club ? (
                  <>
                    <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '0 0 2px', fontWeight: 700 }}>{club.name}</p>
                    <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '0 0 10px' }}>{club.address}</p>
                  </>
                ) : (
                  <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '0 0 10px' }}>{t('club.selectButton')}</p>
                )}
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    font: '600 13px/1 var(--font-sans)',
                    color: 'var(--bf-white)',
                    background: 'var(--bf-purple)',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-control)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {club ? t('club.changeButton') : t('club.chooseCta')}
                  <Icon name="chevron-right" size={14} />
                </button>
                {/* R7.1 — opens the equipment overlay once a club is chosen.
                    club.equipmentOverlayTrigger exists in all three i18n
                    catalogs (added alongside EquipmentOverlaySheet) but was
                    never rendered by this screen until D22a (cycle-9). */}
                {club && (
                  <button
                    type="button"
                    onClick={() => setOverlayOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      font: '600 13px/1 var(--font-sans)',
                      color: 'var(--bf-purple)',
                      background: 'var(--bf-purple-tint)',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-control)',
                      border: '1px solid var(--bf-purple)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="settings" size={14} />
                    {t('club.equipmentOverlayTrigger')}
                  </button>
                )}
              </div>
            </div>

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
                  href={GUIDE_DATA_FILES_BASE_URL + GUIDE_DATA_ARCHIVE.path}
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
                      {t('guide.downloadArchiveLabel')}
                    </span>
                    <br />
                    <span
                      className="guide-downloads-row-filename"
                      style={{ font: '12px/1.4 monospace', color: 'var(--bf-ink-2)' }}
                    >
                      {GUIDE_DATA_ARCHIVE.filename}
                    </span>
                    <span
                      className="guide-downloads-row-size"
                      style={{ font: 'var(--text-caption)', color: 'var(--text-muted)' }}
                    >
                      {' '}· {formatKb(GUIDE_DATA_ARCHIVE.bytes)}
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
          </div>

          <article
            className="guide-article"
            style={{
              font: 'var(--text-body-sm)',
              color: 'var(--bf-ink)',
              lineHeight: 1.6,
              maxWidth: 600,
              margin: '0 auto',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        {/* D22a (R7.1) — ClubPickerSheet and EquipmentOverlaySheet must be
            mounted INSIDE the root dialog (zIndex: 400, opaque background),
            not as siblings. Both sheets are zIndex: 300 — any sibling renders
            behind the opaque guide panel and is invisible to the user. The
            Bagnik probe confirmed nested placement makes dialogs[1] the sheet
            by document order, which the test asserts (tech-plan-build-b §5). */}
        {pickerOpen && (
          <ClubPickerSheet
            onSelect={handleClubSelected}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {overlayOpen && club && (
          <EquipmentOverlaySheet
            club={{ clubId: club.clubId, name: club.name, city: club.city, address: club.address }}
            onClose={() => setOverlayOpen(false)}
          />
        )}
      </div>
    </>
  );
}
