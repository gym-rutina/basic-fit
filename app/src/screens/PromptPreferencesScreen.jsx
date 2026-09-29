import React, { useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { FilterPill } from '../../../design-system/components/primitives/FilterPill.jsx';
import { StepHeader } from '../../../design-system/components/primitives/StepHeader.jsx';
import { usePromptComposer } from '../lib/usePromptComposer.js';
import { hasAnsweredFields } from '../lib/promptRequestMode.js';
import { useHeadingFocus } from '../lib/useHeadingFocus.js';
import { useI18n } from '../i18n/index.js';

const DAY_PILLS = [1, 2, 3, 4, 5, 6, 7];
const TEXT_KEYS = ['field1', 'field2', 'field4', 'field5'];

const LABEL_STYLE = { display: 'block', font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 };
const HINT_STYLE = { font: 'var(--text-caption)', color: 'var(--text-muted)', margin: '4px 0 0' };
const INPUT_STYLE = { display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 44, border: '1px solid var(--border-control)', borderRadius: 'var(--radius-control)', padding: '10px 12px', font: 'var(--text-body-sm)', color: 'var(--bf-ink)', background: 'var(--bf-white)' };

/**
 * Wizard step 1 of 2 (import-flow-guided-first W1a-W1c, AC3/AC7/AC13/AC14) —
 * the five prompt-request fields, all optional, persisted on every edit via
 * usePromptComposer (promptRequestStorage caps apply). Opens as a pre-filled
 * review when any field is already answered (e.g. by onboarding) and as a
 * blank form otherwise; the mode — and which fields start as summary rows — is
 * fixed ON MOUNT so typing never flips the layout mid-edit (AD-3).
 * Router-free: `onNext` / `onBack` are callbacks.
 *
 * Props: { onNext: () => void, onBack: () => void }
 */
export function PromptPreferencesScreen({ onNext, onBack }) {
  const { t } = useI18n();
  const { draft, setField, toggleDay } = usePromptComposer();
  const headingRef = useHeadingFocus();

  const [reviewMode] = useState(() => hasAnsweredFields(draft));
  // Fields that start as tappable summary rows (review mode, already answered).
  const [rowKeys] = useState(() =>
    reviewMode ? TEXT_KEYS.filter((k) => typeof draft[k] === 'string' && draft[k].trim() !== '') : []
  );
  const [editing, setEditing] = useState(() => new Set());
  const [moreOpen, setMoreOpen] = useState(false);

  const startEditing = (key) => setEditing((prev) => new Set(prev).add(key));

  function renderField({ key, label, multiline, placeholderKey, hintKey }) {
    const id = `prompt-${key}`;
    if (rowKeys.includes(key) && !editing.has(key)) {
      return (
        <div key={key}>
          <span style={LABEL_STYLE}>{label}</span>
          <button
            type="button"
            onClick={() => startEditing(key)}
            style={{ ...INPUT_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer' }}
          >
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{draft[key]}</span>
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      );
    }
    const common = {
      id,
      value: draft[key],
      autoFocus: rowKeys.includes(key),
      placeholder: placeholderKey ? t(placeholderKey) : undefined,
      onChange: (e) => setField(key, e.target.value),
      style: { ...INPUT_STYLE, ...(multiline ? { resize: 'vertical' } : {}) },
    };
    return (
      <div key={key}>
        <label htmlFor={id} style={LABEL_STYLE}>{label}</label>
        {multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
        {hintKey && <p style={HINT_STYLE}>{t(hintKey)}</p>}
      </div>
    );
  }

  const nameAnswered = rowKeys.includes('field1');

  return (
    <div style={{ background: 'var(--bf-white)', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box', paddingBlock: 'var(--space-4) 0', paddingInline: 'var(--page-pad-x)' }}>
      <div style={{ width: '100%', maxWidth: 420, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <StepHeader
          step={1}
          total={2}
          onBack={onBack}
          backLabel={t('promptWizard.back')}
          stepLabel={t('promptWizard.stepOf', { step: 1, total: 2 })}
        />

        <h1 ref={headingRef} tabIndex={-1} style={{ font: 'var(--text-h2)', textTransform: 'uppercase', color: 'var(--bf-ink)', margin: 'var(--space-5) 0 6px', outline: 'none' }}>
          {t(reviewMode ? 'promptWizard.prefsHeadingReview' : 'promptWizard.prefsHeadingBlank')}
        </h1>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-5)' }}>
          {t(reviewMode ? 'promptWizard.prefsIntroReview' : 'promptWizard.prefsIntroBlank')}
        </p>

        <div style={{ display: 'grid', gap: 18 }}>
          {renderField({ key: 'field2', label: t('promptRequest.field2.label'), multiline: true, placeholderKey: 'promptRequest.field2.example', hintKey: 'promptRequest.field2.hint' })}

          <div>
            <span id="prompt-days-label" style={LABEL_STYLE}>{t('promptRequest.field3.label')}</span>
            <div role="group" aria-labelledby="prompt-days-label" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAY_PILLS.map((n) => {
                const active = draft.field3 === n;
                return (
                  <FilterPill
                    key={n}
                    active={active}
                    onClick={() => toggleDay(n)}
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      padding: '0 12px',
                      ...(active ? { background: 'var(--bf-purple)', borderColor: 'var(--bf-purple)' } : {}),
                    }}
                  >
                    {n}
                  </FilterPill>
                );
              })}
            </div>
          </div>

          {renderField({ key: 'field4', label: t('promptWizard.durationLabel'), placeholderKey: 'promptRequest.field4.example' })}
          {renderField({ key: 'field5', label: t('promptRequest.field5.label'), multiline: true, placeholderKey: 'promptRequest.field5.placeholder' })}

          {!nameAnswered && (
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
              style={{ justifySelf: 'start', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, font: '600 14px/1 var(--font-sans)', color: 'var(--bf-purple)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Icon name={moreOpen ? 'chevron-down' : 'chevron-right'} size={14} />
              {t('promptWizard.moreOptions')}
            </button>
          )}
          {(nameAnswered || moreOpen) &&
            renderField({ key: 'field1', label: t('promptWizard.nameLabel'), placeholderKey: 'promptRequest.field1.example', hintKey: 'promptRequest.field1.hint' })}
        </div>

        <div style={{ position: 'sticky', bottom: 0, marginTop: 'auto', background: 'var(--bf-white)', paddingBlock: 'var(--space-4)' }}>
          <Button variant="primary" style={{ width: '100%', minHeight: 48 }} onClick={onNext}>
            {t('promptWizard.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
