import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { buildOnboardingSteps } from '../lib/onboardingContent.js';
import { markOnboardingSeen } from '../lib/onboardingStorage.js';
import { readClub } from '../lib/clubStorage.js';
import { LanguageSheet } from './LanguageSheet.jsx';
import { ClubPickerSheet } from './ClubPickerSheet.jsx';
import { useI18n, LOCALE_AUTONYMS } from '../i18n/index.js';
import { useBackClosesDialog } from '../lib/useBackClosesDialog.js';

/** Decorative-only step position (dots) — aria-hidden, real progress is the sr-only text below. */
function DotIndicator({ total, current }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: i === current ? 'var(--bf-purple)' : 'transparent',
            border: `1px solid ${i === current ? 'var(--bf-purple)' : 'var(--border-control)'}`,
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Full-screen onboarding carousel (spec AC1, AC2, AC3, AC4), shown once on
 * first app open and reachable afterward on demand (AC7). Same
 * role="dialog" aria-modal="true" + Escape-to-close chrome pattern as
 * GuideOverlay.jsx (ux-design.md — reused verbatim, no new DS primitive).
 *
 * Owns "mark seen" internally (tech-plan.md Decision 5): both Shell
 * (first-run) and ImportScreen (on-demand revisit) pass only `onClose`.
 *
 * onboarding-fork-shortening: one input step remains after the 2
 * informational steps — club. The five REQUEST prompt fields are collected
 * by the fork's "Prepare prompt" wizard (PromptPreferencesScreen) instead,
 * so the carousel no longer reads or writes the prompt-request draft.
 * Club is read directly from `clubStorage.readClub()` and written by
 * `ClubPickerSheet` itself.
 *
 * `guideOnly` (the fork's "How the app works →" revisit link): the user has
 * just come through the carousel, so re-running it from the welcome step
 * would send them back to where they started. This mode shows only the
 * "How it works" info step, closes with a single button, and never marks
 * the seen flag.
 *
 * Props:
 *   onClose: () => void
 *   guideOnly?: boolean
 */
export function OnboardingOverlay({ onClose, guideOnly = false }) {
  const { t, locale } = useI18n();
  const ONBOARDING_STEPS = useMemo(() => {
    const all = buildOnboardingSteps(t);
    return guideOnly ? all.filter((s) => s.steps) : all;
  }, [t, guideOnly]);
  const TOTAL_STEPS = ONBOARDING_STEPS.length;
  const [step, setStep] = useState(0);
  const [club, setClub] = useState(() => readClub());
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const [showClubPicker, setShowClubPicker] = useState(false);
  const headingRef = useRef(null);
  const inputAreaRef = useRef(null);
  const current = ONBOARDING_STEPS[step];
  const isFirst = step === 0;
  const isLastStep = step === TOTAL_STEPS - 1;

  function exitImmediately() {
    markOnboardingSeen();
    onClose && onClose();
  }

  function attemptExit() {
    if (guideOnly) {
      onClose && onClose();
    } else {
      exitImmediately();
    }
  }

  function handleNext() {
    if (isLastStep) {
      if (guideOnly) onClose && onClose();
      else exitImmediately();
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // System Back (D1): previous step; on step 1 the same as Skip (guideOnly just
  // closes). Stays armed (returns false) whenever the carousel stays.
  useBackClosesDialog(() => {
    if (step > 0) {
      handleBack();
      return false;
    }
    attemptExit();
    return undefined;
  });

  function handleClubSelected(selected) {
    setClub(selected);
    setShowClubPicker(false);
  }

  // Focus management (mockups.md open item #3, tech-plan.md §2.7): input
  // steps focus their first form control; info steps keep the existing
  // heading focus. This deliberately supersedes spec.md AC8's literal
  // "the step heading takes focus on every step change" wording for input
  // steps specifically — expected, not a regression (Bagnik test-gate F3).
  useEffect(() => {
    if (current.type !== 'input') {
      headingRef.current?.focus();
      return;
    }
    const target = inputAreaRef.current?.querySelector('input, textarea, [role="radio"], button');
    target?.focus();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') attemptExit();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  function renderInputFields() {
    if (current.field === 'club') {
      return (
        <div ref={inputAreaRef}>
          {club ? (
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                background: 'var(--bf-purple-tint)',
                border: '1px solid var(--bf-purple)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
              }}
            >
              <Icon name="map-pin" size={18} style={{ color: 'var(--bf-purple)', marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ font: '700 13px/1.3 var(--font-sans)', color: 'var(--bf-ink)', margin: '0 0 2px' }}>{club.name}</p>
                <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '0 0 10px' }}>{club.address}</p>
                <button
                  type="button"
                  onClick={() => setShowClubPicker(true)}
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
                  {t('club.changeButton')}
                  <Icon name="chevron-right" size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowClubPicker(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                justifyContent: 'space-between',
                font: '600 15px/1 var(--font-sans)',
                color: 'var(--bf-ink)',
                background: 'var(--bf-white)',
                border: '1px solid var(--border-control)',
                borderRadius: 'var(--radius-control)',
                padding: '14px 16px',
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon name="map-pin" size={16} />
                {t('club.chooseCta')}
              </span>
              <Icon name="chevron-right" size={16} />
            </button>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'var(--bf-white)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!guideOnly && (
        <div
          className="sr-only"
          aria-live="polite"
        >
          {t('onboarding.stepAnnouncement', { current: step + 1, total: TOTAL_STEPS })}
        </div>
      )}

      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBlock: 'var(--space-4)',
          paddingInline: 'var(--page-pad-x)',
        }}
      >
        {guideOnly ? <span /> : <DotIndicator total={TOTAL_STEPS} current={step} />}
        <button
          type="button"
          onClick={attemptExit}
          style={{
            font: '600 14px/1 var(--font-sans)',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            padding: '6px 4px',
            cursor: 'pointer',
          }}
        >
          {guideOnly ? t('common.close') : t('onboarding.skip')}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: current.type === 'input' ? 'flex-start' : 'center',
          paddingBlock: 'var(--space-6)',
          paddingInline: 'var(--page-pad-x)',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--bf-purple)', marginBottom: 'var(--space-4)' }}>
            <Icon name={current.icon} size={40} strokeWidth={1.6} />
          </div>

          <h1
            id="onboarding-title"
            ref={headingRef}
            tabIndex={-1}
            style={{
              font: 'var(--text-h2)',
              color: 'var(--bf-ink)',
              margin: '0 0 var(--space-4)',
              outline: 'none',
            }}
          >
            {current.title}
          </h1>

          {(current.body || current.preamble) && (
            <p
              style={{
                font: 'var(--text-body-sm)',
                color: 'var(--bf-ink-2)',
                margin: '0 auto',
                maxWidth: 320,
              }}
            >
              {current.body || current.preamble}
            </p>
          )}

          {isFirst && !guideOnly && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={t('onboarding.languageTrigger')}
                onClick={() => setShowLanguageSheet(true)}
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  padding: '8px 16px',
                  border: '1px solid var(--border-control)',
                  borderRadius: 'var(--radius-control)',
                  font: '600 14px/1 var(--font-sans)',
                  color: 'var(--bf-ink)',
                }}
              >
                <Icon name="globe" size={16} />
                <span>{LOCALE_AUTONYMS[locale]}</span>
                <Icon name="chevron-down" size={14} />
              </button>
            </div>
          )}

          {guideOnly && current.steps && (
            <div style={{ width: '100%', maxWidth: 340, margin: 'var(--space-5) auto 0', textAlign: 'left' }}>
              <ol
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: 12,
                }}
              >
                {current.steps.map((line, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      font: 'var(--text-body-sm)',
                      color: 'var(--bf-ink)',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--bf-purple)',
                        color: 'var(--bf-white)',
                        font: '700 12px/1 var(--font-sans)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ paddingTop: 4 }}>{line}</span>
                  </li>
                ))}
              </ol>

              {current.glosses && (
                <div
                  style={{
                    marginTop: 'var(--space-4)',
                    display: 'grid',
                    gap: 6,
                    font: 'var(--text-caption)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {current.glosses.map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </div>
              )}

              {current.outcomes && (
                <div
                  style={{
                    marginTop: 'var(--space-4)',
                    display: 'grid',
                    gap: 4,
                    font: 'var(--text-caption)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {current.outcomes.map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {current.type === 'input' && (
            <div style={{ marginTop: 'var(--space-5)', textAlign: 'left' }}>{renderInputFields()}</div>
          )}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          paddingBlock: 'var(--space-4)',
          paddingInline: 'var(--page-pad-x)',
        }}
      >
        {!isFirst && (
          <Button variant="outline" onClick={handleBack}>
            {t('onboarding.back')}
          </Button>
        )}
        <Button variant="primary" onClick={handleNext} style={isFirst ? { marginLeft: 'auto' } : undefined}>
          {guideOnly ? t('common.close') : isLastStep ? t('onboarding.start') : t('onboarding.next')}
        </Button>
      </div>

      {showLanguageSheet && <LanguageSheet onClose={() => setShowLanguageSheet(false)} />}
      {showClubPicker && <ClubPickerSheet onSelect={handleClubSelected} onClose={() => setShowClubPicker(false)} />}
    </div>
  );
}
