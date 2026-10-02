import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { StepHeader } from '../../../design-system/components/primitives/StepHeader.jsx';
import { GuideSheet } from '../components/GuideSheet.jsx';
import { usePromptComposer } from '../lib/usePromptComposer.js';
import { useHeadingFocus } from '../lib/useHeadingFocus.js';
import { useI18n } from '../i18n/index.js';

// Collapsed preview = the first lines of the prompt, which is the REQUEST block
// (the user's own answers). "Ver completo" reveals the whole thing.
const PREVIEW_LINES = 6;

const SR_ONLY = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
const LINK_BUTTON = { minHeight: 44, padding: 0, font: '600 14px/1 var(--font-sans)', color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer' };

/**
 * Wizard step 2 of 2 (import-flow-guided-first W2a-W2f + G1, AC4/AC7/AC13/AC16)
 * — prompt preview, copy button, the three next steps, "Guía completa" sheet,
 * and the way on to the JSON screen. The club is chosen on step 1
 * (PromptPreferencesScreen); this screen shows nothing about it (back-closes-
 * dialogs-and-wizard-polish D2) — the composer reads the stored club. The prompt
 * comes from usePromptComposer, i.e. the same composePrompt() GuideOverlay used.
 * Router-free: `onBack` / `onHaveJson`.
 *
 * Props: { onBack: () => void, onHaveJson: () => void }
 */
export function PromptCopyScreen({ onBack, onHaveJson }) {
  const { t } = useI18n();
  const headingRef = useHeadingFocus();
  const { sessionsAvailable, includeSessions, setIncludeSessions, promptText, copied, copy } = usePromptComposer();

  const [guideOpen, setGuideOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [denied, setDenied] = useState(false);
  const guideTriggerRef = useRef(null);
  const previewRef = useRef(null);

  const lines = promptText.split('\n');
  const showFull = expanded || denied || lines.length <= PREVIEW_LINES;
  const previewText = showFull ? promptText : `${lines.slice(0, PREVIEW_LINES).join('\n')}\n…`;

  // Clipboard denied: reveal the whole prompt and select it so a long-press copies it.
  useEffect(() => {
    if (!denied || !previewRef.current) return;
    try {
      const range = document.createRange();
      range.selectNodeContents(previewRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      /* selection unsupported — the hint still tells the user what to do */
    }
  }, [denied]);

  async function handleCopy() {
    const outcome = await copy();
    setDenied(outcome === 'denied');
  }

  return (
    <div style={{ background: 'var(--bf-white)', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box', paddingBlock: 'var(--space-4) 0', paddingInline: 'var(--page-pad-x)' }}>
      <div style={{ width: '100%', maxWidth: 420, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <StepHeader
          step={2}
          total={2}
          onBack={onBack}
          backLabel={t('promptWizard.back')}
          stepLabel={t('promptWizard.stepOf', { step: 2, total: 2 })}
        />

        <h1 ref={headingRef} tabIndex={-1} style={{ font: 'var(--text-h2)', textTransform: 'uppercase', color: 'var(--bf-ink)', margin: 'var(--space-5) 0 6px', outline: 'none' }}>
          {t('promptWizard.copyHeading')}
        </h1>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>
          {t('promptWizard.copyIntro')}
        </p>

        <pre
          ref={previewRef}
          data-testid="prompt-preview"
          aria-label={t('promptWizard.previewLabel')}
          style={{
            margin: 0,
            padding: '12px 14px',
            background: 'var(--bf-grey-1)',
            borderRadius: 'var(--radius-control)',
            font: '12px/1.5 monospace',
            color: 'var(--bf-ink)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            maxHeight: expanded || denied ? '50vh' : undefined,
            overflowY: expanded || denied ? 'auto' : 'hidden',
          }}
        >
          {previewText}
        </pre>
        {lines.length > PREVIEW_LINES && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
            style={{ ...LINK_BUTTON, justifySelf: 'start', alignSelf: 'flex-start' }}
          >
            {t(expanded ? 'promptWizard.previewCollapse' : 'promptWizard.previewExpand')}
          </button>
        )}

        {sessionsAvailable && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, font: 'var(--text-body-sm)', color: 'var(--bf-ink)', cursor: 'pointer' }}>
            <input type="checkbox" checked={includeSessions} onChange={(e) => setIncludeSessions(e.target.checked)} />
            {t('promptWizard.sessionsCheckbox')}
          </label>
        )}

        <Button variant="primary" style={{ width: '100%', minHeight: 48, marginTop: 'var(--space-3)' }} onClick={handleCopy}>
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          {copied ? t('promptWizard.copied') : t('promptWizard.copyAction')}
        </Button>
        <div
          role="status"
          style={denied ? { font: 'var(--text-caption)', color: 'var(--text-muted)', marginTop: 6 } : SR_ONLY}
        >
          {copied ? t('promptWizard.copied') : denied ? t('promptWizard.copyDenied') : ''}
        </div>

        <ol style={{ margin: 'var(--space-5) 0 var(--space-2)', paddingLeft: 20, display: 'grid', gap: 6, font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)' }}>
          <li>{t('promptWizard.step1')}</li>
          <li>{t('promptWizard.step2')}</li>
          <li>{t('promptWizard.step3', { button: t('promptWizard.haveJson').replace(/\s*→\s*$/, '') })}</li>
        </ol>

        <button
          ref={guideTriggerRef}
          type="button"
          onClick={() => setGuideOpen(true)}
          style={{ ...LINK_BUTTON, alignSelf: 'flex-start' }}
        >
          {t('promptWizard.fullGuide')}
        </button>

        <div style={{ position: 'sticky', bottom: 0, marginTop: 'auto', background: 'var(--bf-white)', paddingBlock: 'var(--space-4)' }}>
          <Button variant="outline" style={{ width: '100%', minHeight: 48 }} onClick={onHaveJson}>
            {t('promptWizard.haveJson')}
          </Button>
        </div>
      </div>

      {guideOpen && <GuideSheet onClose={() => setGuideOpen(false)} returnFocusTo={guideTriggerRef} />}
    </div>
  );
}
