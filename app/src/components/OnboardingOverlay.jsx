import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { FilterPill } from '../../../design-system/components/primitives/FilterPill.jsx';
import { buildOnboardingSteps } from '../lib/onboardingContent.js';
import { markOnboardingSeen } from '../lib/onboardingStorage.js';
import { readPromptRequest, writePromptRequest } from '../lib/promptRequestStorage.js';
import { readClub } from '../lib/clubStorage.js';
import { useClubExclusions } from '../lib/useClubExclusions.js';
import { EQUIPMENT } from '../data/equipment.js';
import { LanguageSheet } from './LanguageSheet.jsx';
import { ClubPickerSheet } from './ClubPickerSheet.jsx';
import { ConfirmSheet } from './ConfirmSheet.jsx';
import { useI18n, LOCALE_AUTONYMS } from '../i18n/index.js';
import { useBackClosesDialog } from '../lib/useBackClosesDialog.js';

const DAY_PILLS = [1, 2, 3, 4, 5, 6, 7];
const FIELD2_CAP = 800;

// The Catálogo filter axis (CatalogScreen.jsx's own CATEGORY_LABEL_KEYS,
// duplicated here — 8-value frozen vocabulary per validate-data.js) — the
// smart hint (Rev4-D6) needs `item.category`'s natural-language name, not
// `item.kind`/equipmentKinds.js's machine/free-weight/accessory axis (that
// is EquipmentOverlaySheet's axis, a different purpose and shape).
const CATEGORY_LABEL_KEYS = {
  chest: 'catalog.categoryChest',
  back: 'catalog.categoryBack',
  shoulders: 'catalog.categoryShoulders',
  arms: 'catalog.categoryArms',
  core: 'catalog.categoryCore',
  legs: 'catalog.categoryLegs',
  'free-weights': 'catalog.categoryFreeWeights',
  accessories: 'catalog.categoryAccessories',
};

/**
 * Resolves 3 distinct equipment categories at the user's chosen club, for
 * the field-2 smart hint (Rev4-D6, tech-plan.md §2.7 — corrected data path:
 * `useClubExclusions` + `EQUIPMENT`-filter, NOT the nonexistent
 * `getClubEquipment()` ux-design.md Rev4-SF4 named). Returns `null` — meaning
 * "fall back to the generic hint" — for: no club yet, the exclusions hook
 * still resolving (`excludedIds === null`, D6's tri-state), or fewer than 3
 * distinct categories remain once exclusions are applied. This degrades
 * gracefully rather than ever rendering a malformed hint.
 *
 * @param {{clubId?: string}|null} club
 * @param {Set<string>|null} excludedIds
 * @returns {[string, string, string]|null}
 */
function resolveSmartHintCategories(club, excludedIds) {
  if (!club || !excludedIds) return null;
  const seen = new Set();
  for (const item of EQUIPMENT) {
    if (!item || excludedIds.has(item.id)) continue;
    if (item.category) seen.add(item.category);
    if (seen.size >= 3) break;
  }
  return seen.size >= 3 ? Array.from(seen).slice(0, 3) : null;
}

/** R1.5/mockups.md open item #1 — the header Skip confirm is conditional on
 * whether any of the 5 REQUEST fields (not the club — that is field 6, a
 * different persistence path, R1.3) currently carries a draft value. */
function hasDraftContent(draft) {
  return (
    Boolean(draft.field1 && draft.field1.trim()) ||
    Boolean(draft.field2 && draft.field2.trim()) ||
    typeof draft.field3 === 'number' ||
    Boolean(draft.field4 && draft.field4.trim()) ||
    Boolean(draft.field5 && draft.field5.trim())
  );
}

function draftFromRecord(record) {
  return {
    field1: record.field1 ?? '',
    field2: record.field2 ?? '',
    field3: record.field3,
    field4: record.field4 ?? '',
    field5: record.field5 ?? '',
  };
}

/** Rev4-D4/D5 — a small inline auto-expand effect (no library): height =
 * scrollHeight, clamped to the max-rows pixel height, then scrolls past it. */
function autoExpandTextarea(el, minRows, maxRows) {
  if (!el) return;
  const computed = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(el) : null;
  const lineHeight = (computed && parseFloat(computed.lineHeight)) || 20;
  const maxHeight = lineHeight * maxRows;
  const minHeight = lineHeight * minRows;
  el.style.height = 'auto';
  const next = Math.min(el.scrollHeight || minHeight, maxHeight);
  el.style.height = Math.max(next, minHeight) + 'px';
  el.style.overflowY = (el.scrollHeight || 0) > maxHeight ? 'auto' : 'hidden';
}

const fieldLabelStyle = {
  display: 'block',
  font: '600 13px/1.3 var(--font-sans)',
  color: 'var(--bf-ink)',
  marginBottom: 6,
};
const fieldHintStyle = {
  font: 'var(--text-caption)',
  color: 'var(--text-muted)',
  margin: '6px 0 0',
};
const fieldExampleStyle = {
  font: 'var(--text-caption)',
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  margin: '2px 0 0',
};
const textInputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--border-control)',
  borderRadius: 'var(--radius-control)',
  padding: '10px 12px',
  font: 'var(--text-body-sm)',
  color: 'var(--bf-ink)',
  background: 'var(--bf-white)',
};
const fieldBlockStyle = { marginBottom: 'var(--space-5)' };

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
 * onboarding-request-fields (tech-plan.md §2.7): gains 4 input steps after
 * the 2 informational steps — club, name+goal, schedule, injuries (Rev3
 * order). Local draft state is seeded from `readPromptRequest()` once on
 * mount (R1.6); club is NOT part of that draft (R1.3) — it is read directly
 * from `clubStorage.readClub()` and written by `ClubPickerSheet` itself.
 * Persistence is ONE `writePromptRequest()` call — at "¡Empezar!" (always,
 * R1.5) or at a CONFIRMED header Skip (mockups.md open item #1) — never
 * per-keystroke.
 *
 * `guideOnly` (the fork's "How the app works →" revisit link): the user has
 * just come through the carousel, so re-running it from the welcome step and
 * its input steps would send them back to where they started. This mode shows
 * only the "How it works" info step, closes with a single button, and never
 * writes the prompt-request draft or the seen flag.
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
  const [draft, setDraft] = useState(() => draftFromRecord(readPromptRequest()));
  const [club, setClub] = useState(() => readClub());
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const [showClubPicker, setShowClubPicker] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const headingRef = useRef(null);
  const inputAreaRef = useRef(null);
  const current = ONBOARDING_STEPS[step];
  const isFirst = step === 0;
  const isLastStep = step === TOTAL_STEPS - 1;

  const { excludedIds } = useClubExclusions(club?.clubId ?? null);
  const smartCats = resolveSmartHintCategories(club, excludedIds);
  const field2Hint = smartCats
    ? t('promptRequest.field2.hintSmart', {
        cat1: t(CATEGORY_LABEL_KEYS[smartCats[0]]),
        cat2: t(CATEGORY_LABEL_KEYS[smartCats[1]]),
        cat3: t(CATEGORY_LABEL_KEYS[smartCats[2]]),
      })
    : t('promptRequest.field2.hint');

  function setDraftField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function persistAndExit() {
    writePromptRequest(draft);
    markOnboardingSeen();
    onClose && onClose();
  }

  function exitImmediately() {
    markOnboardingSeen();
    onClose && onClose();
  }

  function attemptExit() {
    if (guideOnly) {
      onClose && onClose();
    } else if (hasDraftContent(draft)) {
      setShowSkipConfirm(true);
    } else {
      exitImmediately();
    }
  }

  function handleNext() {
    if (isLastStep) {
      if (guideOnly) onClose && onClose();
      else persistAndExit();
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // System Back (D1): previous step; on step 1 the same as Skip (guideOnly just closes; a
  // draft asks "¿Salir sin terminar?"). Stays armed (returns false) whenever the carousel stays.
  useBackClosesDialog(() => {
    if (step > 0) {
      handleBack();
      return false;
    }
    const willConfirm = !guideOnly && hasDraftContent(draft);
    attemptExit();
    return willConfirm ? false : undefined;
  });

  function handleClubSelected(selected) {
    setClub(selected);
    setShowClubPicker(false);
  }

  function handleDayPillClick(n) {
    setDraft((d) => ({ ...d, field3: d.field3 === n ? undefined : n }));
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
  }, [onClose, draft]);

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

    if (current.field === 'name-goal') {
      return (
        <div ref={inputAreaRef}>
          <div style={fieldBlockStyle}>
            <label htmlFor="onboarding-field1" style={fieldLabelStyle}>
              {t('promptRequest.field1.label')}
            </label>
            <input
              id="onboarding-field1"
              type="text"
              value={draft.field1}
              onChange={(e) => setDraftField('field1', e.target.value)}
              style={textInputStyle}
            />
            <p style={fieldHintStyle}>{t('promptRequest.field1.hint')}</p>
            <p style={fieldExampleStyle}>{t('promptRequest.field1.example')}</p>
          </div>
          <div style={fieldBlockStyle}>
            <label htmlFor="onboarding-field2" style={fieldLabelStyle}>
              {t('promptRequest.field2.label')}
            </label>
            <textarea
              id="onboarding-field2"
              rows={3}
              value={draft.field2}
              onChange={(e) => {
                setDraftField('field2', e.target.value);
                autoExpandTextarea(e.target, 3, 8);
              }}
              style={{ ...textInputStyle, resize: 'none' }}
            />
            <p style={fieldHintStyle}>{field2Hint}</p>
            <p style={fieldExampleStyle}>
              {t('common.example')}: {t('promptRequest.field2.example')}
            </p>
            {draft.field2.length > 400 && (
              <p aria-live="polite" style={{ ...fieldHintStyle, textAlign: 'right' }}>
                {t('promptRequest.counter', { n: draft.field2.length, max: FIELD2_CAP })}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (current.field === 'schedule') {
      return (
        <div ref={inputAreaRef}>
          <div style={fieldBlockStyle}>
            <span id="onboarding-field3-label" style={fieldLabelStyle}>
              {t('promptRequest.field3.label')}
            </span>
            <div role="radiogroup" aria-label={t('promptRequest.field3.label')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAY_PILLS.map((n) => (
                <FilterPill
                  key={n}
                  role="radio"
                  aria-checked={draft.field3 === n}
                  active={draft.field3 === n}
                  onClick={() => handleDayPillClick(n)}
                  style={{ padding: '10px 14px' }}
                >
                  {n}
                </FilterPill>
              ))}
            </div>
            <p style={fieldHintStyle}>{t('promptRequest.field3.hint')}</p>
          </div>
          <div style={fieldBlockStyle}>
            <label htmlFor="onboarding-field4" style={fieldLabelStyle}>
              {t('promptRequest.field4.label')}
            </label>
            <input
              id="onboarding-field4"
              type="text"
              value={draft.field4}
              onChange={(e) => setDraftField('field4', e.target.value)}
              style={textInputStyle}
            />
            <p style={fieldHintStyle}>{t('promptRequest.field4.hint')}</p>
            <p style={fieldExampleStyle}>
              {t('common.example')}: {t('promptRequest.field4.example')}
            </p>
          </div>
        </div>
      );
    }

    // injuries — last step
    return (
      <div ref={inputAreaRef}>
        <div style={fieldBlockStyle}>
          <label htmlFor="onboarding-field5" style={fieldLabelStyle}>
            {t('promptRequest.field5.label')}
          </label>
          <textarea
            id="onboarding-field5"
            rows={4}
            value={draft.field5}
            placeholder={t('promptRequest.field5.placeholder')}
            onChange={(e) => {
              setDraftField('field5', e.target.value);
              autoExpandTextarea(e.target, 4, 8);
            }}
            style={{ ...textInputStyle, resize: 'none' }}
          />
          <p style={fieldHintStyle}>{t('promptRequest.field5.hint')}</p>
          <p style={fieldExampleStyle}>
            {t('common.example')}: {t('promptRequest.field5.example')}
          </p>
        </div>
      </div>
    );
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

          {current.steps && (
            <div style={{ textAlign: 'left', margin: '0 auto' }}>
              <ol
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: 10,
                }}
              >
                {current.steps.map((line, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 10,
                      font: 'var(--text-body-sm)',
                      color: 'var(--bf-ink)',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--bf-purple)' }}>{i + 1}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>

              {current.outcomes && (
                <div
                  style={{
                    marginTop: 'var(--space-4)',
                    display: 'grid',
                    gap: 4,
                    font: 'var(--text-body-sm)',
                    color: 'var(--bf-ink-2)',
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
      {showSkipConfirm && (
        <ConfirmSheet
          title={t('onboarding.skipConfirm.title')}
          description={t('onboarding.skipConfirm.body')}
          primaryLabel={t('onboarding.skipConfirm.confirm')}
          onPrimary={persistAndExit}
          cancelLabel={t('onboarding.skipConfirm.cancel')}
          onCancel={() => setShowSkipConfirm(false)}
        />
      )}
    </div>
  );
}
