import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { DetailItem } from '../../../design-system/components/primitives/DetailItem.jsx';
import { ConfirmSheet } from '../components/ConfirmSheet.jsx';
import { EquipmentReferenceSheet } from '../components/EquipmentReferenceSheet.jsx';
import { sessionReducer } from '../lib/sessionMachine.js';
import { getActiveRutina, getActiveSession, saveSession, getLastWeight, deleteSessions } from '../lib/db.js';
import { difficultyLevels, difficultyLabel } from '../lib/difficulty.js';
import { getEquipmentById, mainImageUrl, equipmentDisplayName } from '../data/equipment.js';
import { exerciseKey } from '../lib/exerciseKey.js';
import { buildVideoQuery } from '../lib/videoQuery.js';
import { useI18n } from '../i18n/index.js';

/**
 * Joins this day's prescription (rutina) with the session's tracking record
 * by **index** (createSession writes a parallel array). Matching by
 * equipmentId alone breaks when a day repeats a machine or the rutina grew
 * after the session started — the card still renders, but COMPLETE could not
 * find a track and crashed on `completedEx.name`.
 */
function mergeExercises(rutinaExercises, sessionExercises) {
  return rutinaExercises.map((rx, index) => {
    const tracking = sessionExercises[index] || {};
    return {
      ...rx,
      exerciseIndex: index,
      weightUsed: tracking.weightUsed ?? null,
      difficulty: tracking.difficulty ?? null,
      completedAt: tracking.completedAt ?? null,
    };
  });
}

/** Text-only difficulty picker — no emoji/icon (project's no-emoji-as-icons policy; a11y: difficulty is never color/icon-only). */
function DifficultyPicker({ value, onChange, t }) {
  return (
    <div role="radiogroup" aria-label={t('session.difficultyQuestion')} style={{ display: 'flex', gap: 8 }}>
      {difficultyLevels(t).map((d) => {
        const selected = value === d.id;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(d.id)}
            style={{
              flex: 1,
              minHeight: 44,
              padding: '10px 4px',
              font: '700 13px/1.2 var(--font-sans)',
              letterSpacing: '.02em',
              borderRadius: 'var(--radius-control)',
              border: selected ? '2px solid var(--bf-purple)' : '1px solid var(--border-control)',
              background: selected ? 'var(--bf-purple-tint)' : 'var(--bf-white)',
              color: selected ? 'var(--bf-purple-dark)' : 'var(--bf-ink)',
              cursor: 'pointer',
            }}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact equipment reference row rendered inside the expanded exercise card.
 * Three display states: unresolved → plain text id; gear → plain text name
 * (AC27, AC29, R4.2/R4.3); resolved catalog machine → button that opens
 * EquipmentReferenceSheet overlay.
 *
 * gym-directory-and-catalog R4.2 — the session resolver merges the catalog
 * with the active rutina's `extraEquipment[]`, session UI only (the Catalog
 * tab's data path is unchanged, AC28). `getEquipmentById` never sees gear —
 * it is scoped to `equipment.json` — so an id that misses the catalog is
 * looked up in `extraEquipment` before falling back to the raw-id text.
 * AC29: `kind: "gear"` carries no images/videos/manuals, so its row is
 * name-only — no image, no model-code, no reference sheet to open.
 *
 * exercise-level-tracking AC18′ (UAT decision A2): the catalog machine video
 * fallback is DELETED here, not demoted — the machine's clip is equipment-
 * level and cannot be the tutorial for whichever exercise is on it today (it
 * stays reachable in the Catálogo tab, unaffected by this feature). Every
 * resolved apparatus now gets a composed exercise-tutorial link via
 * buildVideoQuery, so the sheet always has a video, and the old "resolved +
 * sparse → plain text" branch is unreachable and has been removed (D8).
 */
function EquipmentRow({ ex, extraEquipment, locale, t }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const triggerRef = useRef(null);

  const eq = getEquipmentById(ex.equipmentId);
  const gear = !eq ? (extraEquipment || []).find((g) => g && g.id === ex.equipmentId) : null;

  if (!eq && !gear) {
    return (
      <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', padding: '4px 0' }}>
        {ex.equipmentId}
      </div>
    );
  }

  if (gear) {
    return (
      <div dir="auto" style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink)', padding: '4px 0' }}>
        {equipmentDisplayName(gear, locale)}
      </div>
    );
  }

  const imageUrl = mainImageUrl(eq);
  const seriesPrefix = eq.series ? eq.series + ' ' : '';
  const displayName = seriesPrefix + eq.modelCode + ' — ' + equipmentDisplayName(eq, locale);
  const steps = ex.technique || [];
  const videoHref = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(buildVideoQuery(ex, eq, locale));
  const videoLabel = t('program.watchTechnique', { name: ex.name });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setSheetOpen(true)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 0',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-control)', flexShrink: 0 }}
          />
        )}
        <span style={{ flex: 1, minWidth: 0, font: 'var(--text-body-sm)', color: 'var(--bf-ink)' }}>
          {displayName}
        </span>
        <Icon name="chevron-right" size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {sheetOpen && (
        <EquipmentReferenceSheet
          name={displayName}
          imageUrl={imageUrl}
          steps={steps}
          videoHref={videoHref}
          videoLabel={videoLabel}
          onClose={() => {
            setSheetOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

/**
 * Caption copy for the weight-input's four states (ux-design.md S1, AC19).
 * `isDone` is checked first and independently of `prefillState` — a
 * completed card shows ITS OWN logged value, never the lastWeights lookup,
 * so there is no "loading"/"empty" distinction to make once it is done.
 */
function prefillCaption(prefillState, isDone, t) {
  if (isDone) return t('session.weightRecorded');
  if (prefillState === 'loading') return t('session.weightSavedPerExercise');
  if (prefillState === 'filled') return t('session.weightPrefilled');
  return t('session.weightNoRecords');
}

function ExerciseLogCard({ ex, isExpanded, isNextPending, onToggle, onComplete, onUndo, locale, t, extraEquipment }) {
  const isDone = Boolean(ex.completedAt);
  const [weight, setWeight] = useState(ex.weightUsed ?? '');
  const [difficulty, setDifficulty] = useState(ex.difficulty ?? null);
  // 'loading' | 'filled' | 'empty' — "is the input empty" cannot tell apart
  // "not looked up yet" from "looked up, nothing there" (tech-plan.md D9),
  // and rendering the "Prellenado…" claim before the lookup resolves would
  // be false for one frame.
  const [prefillState, setPrefillState] = useState('loading');
  const weightInputId = 'weight-' + ex.exerciseIndex + '-' + (ex.equipmentId ?? 'x');
  const captionId = weightInputId + '-caption';

  // Prefill: an already-done exercise being reopened shows ITS OWN logged
  // values (correction); a not-yet-done exercise becoming current prefills
  // from the last logged weight for THAT EXERCISE — exercise-level-tracking
  // AC5, since two exercises can share a machine and "last weight for this
  // equipment" was always the wrong question. A rejected lookup degrades to
  // the empty caption and must never block logging (AC19).
  useEffect(() => {
    if (isDone) {
      setWeight(ex.weightUsed ?? '');
      setDifficulty(ex.difficulty ?? null);
      return undefined;
    }
    if (!isExpanded) return undefined;
    const key = exerciseKey(ex);
    if (key == null) {
      setPrefillState('empty');
      return undefined;
    }
    setPrefillState('loading');
    let cancelled = false;
    getLastWeight(key)
      .then((record) => {
        if (cancelled) return;
        if (record) {
          setWeight(record.weight);
          setPrefillState('filled');
        } else {
          setPrefillState('empty');
        }
      })
      .catch(() => {
        if (!cancelled) setPrefillState('empty');
      });
    return () => {
      cancelled = true;
    };
  }, [isExpanded, isDone, ex.equipmentId, ex.name, ex.weightUsed, ex.difficulty]);

  const isCurrent = isExpanded || (isNextPending && !isDone);

  return (
    <div
      style={{
        background: 'var(--bf-white)',
        border: '1px solid var(--border-default)',
        borderLeft: isCurrent ? '3px solid var(--bf-purple)' : '3px solid transparent',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box' }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDone ? 'var(--bf-success)' : 'var(--bf-grey-2)',
            color: isDone ? 'var(--bf-white)' : 'var(--text-muted)',
          }}
        >
          {isDone ? <Icon name="check" size={14} strokeWidth={3} /> : null}
        </span>
        <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <div dir="auto" style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{ex.name}</div>
          {isDone && !isExpanded && (
            <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
              {ex.weightUsed != null ? ex.weightUsed + ' kg · ' : ''}
              {difficultyLabel(ex.difficulty, t)}
            </div>
          )}
          {!isDone && !isExpanded && (
            <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
              {ex.sets} × <span dir="auto">{ex.reps}</span>
            </div>
          )}
        </span>
        {isNextPending && !isDone && !isExpanded && (
          <span style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--bf-purple)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('session.currentBadge')}</span>
        )}
      </button>

      {isExpanded && (
        <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 8 }}>
            <DetailItem
              label={t('session.setsReps')}
              value={
                <>
                  {ex.sets} × <span dir="auto">{ex.reps}</span>
                </>
              }
            />
            <DetailItem label={t('program.rest')} value={t('session.restSecondsAbbrev', { n: ex.restSeconds })} />
            {ex.intensity && <DetailItem label={t('program.intensity')} value={<span dir="auto">{ex.intensity}</span>} />}
          </div>

          <EquipmentRow ex={ex} extraEquipment={extraEquipment} locale={locale} t={t} />

          <div>
            <label
              htmlFor={weightInputId}
              style={{ display: 'block', font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}
            >
              {t('session.weightUsedLabel')}
            </label>
            <input
              id={weightInputId}
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-describedby={captionId}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                font: '700 20px/1.2 var(--font-sans)',
                color: 'var(--bf-ink)',
                border: '1px solid var(--border-control)',
                borderRadius: 'var(--radius-control)',
                padding: '12px 14px',
              }}
            />
            <div id={captionId} style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', marginTop: 4 }}>
              {prefillCaption(prefillState, isDone, t)}
            </div>
          </div>

          <div>
            <div style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{t('session.howWasItLabel')}</div>
            <DifficultyPicker value={difficulty} onChange={setDifficulty} t={t} />
          </div>

          <Button
            variant="primary"
            disabled={!difficulty}
            onClick={() =>
              onComplete({
                exerciseIndex: ex.exerciseIndex,
                equipmentId: ex.equipmentId,
                name: ex.name,
                weightUsed: weight === '' ? null : Number(weight),
                difficulty,
              })
            }
          >
            <Icon name="check" size={16} /> {t('session.markCompleteAction')}
          </Button>
          {isDone && (
            <Button variant="ghost" onClick={() => onUndo(ex.exerciseIndex)}>
              {t('common.undo')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ActiveSessionScreen({ onSessionEnded }) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [rutina, setRutina] = useState(undefined);
  const [session, setSession] = useState(undefined); // undefined = loading, null = none found
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardError, setDiscardError] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getActiveRutina(), getActiveSession()]).then(([activeRutina, activeSession]) => {
      if (cancelled) return;
      setRutina(activeRutina ? activeRutina.rutina : null);
      setSession(activeSession);
      if (activeSession && activeRutina) {
        const day = activeRutina.rutina.days[activeSession.dayIndex] || { exercises: [] };
        const merged = mergeExercises(day.exercises, activeSession.exercises);
        const firstPending = merged.find((e) => !e.completedAt);
        setExpandedIndex(firstPending ? firstPending.exerciseIndex : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const day = rutina && session ? rutina.days[session.dayIndex] : null;
  const merged = useMemo(() => (day && session ? mergeExercises(day.exercises, session.exercises) : []), [day, session]);
  const doneCount = merged.filter((e) => e.completedAt).length;
  const total = merged.length;
  const firstPendingIndex = merged.find((e) => !e.completedAt)?.exerciseIndex ?? null;

  // Defensive guard: /session is only reachable via Start/Resume (ux-design.md
  // States Matrix) — if there's genuinely no active session, don't render a
  // broken screen, send the user back to Home.
  useEffect(() => {
    if (session === null) navigate('/', { replace: true });
  }, [session, navigate]);

  if (!rutina || !session || !day) {
    return null;
  }

  // Every mutation (complete, undo, finish, abandon) must refresh the
  // shell-level active-session state, not just the terminal ones — otherwise
  // SessionInProgressBanner and Inicio keep showing the done/total count
  // from whenever the shell last loaded, and other screens only pick up a
  // freshly-completed exercise after a full page reload remounts the shell.
  function persist(next) {
    setSession(next);
    saveSession(next).then(() => {
      onSessionEnded && onSessionEnded();
    });
  }

  function handleComplete({ exerciseIndex, equipmentId, name, weightUsed, difficulty }) {
    const now = new Date().toISOString();
    const next = sessionReducer(session, {
      type: 'COMPLETE_EXERCISE',
      exerciseIndex,
      equipmentId,
      name,
      weightUsed,
      difficulty,
      now,
    });
    persist(next);

    const completedEx = next.exercises[exerciseIndex];
    const label = completedEx?.name || name || '';
    const diffLabel = difficultyLabel(difficulty, t).toLowerCase();
    setAnnouncement(
      weightUsed != null
        ? t('session.completedAnnouncementWithWeight', { label, weight: weightUsed, difficulty: diffLabel })
        : t('session.completedAnnouncementNoWeight', { label, difficulty: diffLabel })
    );

    const nextMerged = mergeExercises(day.exercises, next.exercises);
    const nextPending = nextMerged.find((e) => !e.completedAt);
    setExpandedIndex(nextPending ? nextPending.exerciseIndex : null);
  }

  function handleUndo(exerciseIndex) {
    const next = sessionReducer(session, { type: 'UNDO_EXERCISE', exerciseIndex });
    persist(next);
    setExpandedIndex(exerciseIndex);
  }

  function handleFinish() {
    const next = sessionReducer(session, { type: 'FINISH', now: new Date().toISOString() });
    persist(next);
    setShowEndDialog(false);
    navigate('/');
  }

  function handleAbandon() {
    const next = sessionReducer(session, { type: 'ABANDON', now: new Date().toISOString() });
    persist(next);
    setShowEndDialog(false);
    navigate('/');
  }

  /**
   * Discard is a hard DELETE, never a sessionMachine transition (tech-plan.md
   * Decision 2 — the reducer returns a session object; discard produces
   * none). On failure the sheet stays open and we do NOT navigate — the
   * user must never land on Inicio believing an untouched session was
   * discarded (mockups.md Screen B″).
   */
  async function handleDiscard() {
    setDiscardBusy(true);
    setDiscardError(null);
    try {
      await deleteSessions([session.id]);
      setShowDiscardConfirm(false);
      onSessionEnded && onSessionEnded();
      navigate('/');
    } catch {
      setDiscardBusy(false);
      setDiscardError(t('session.discardError'));
    }
  }

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 40 }}>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bf-white)', borderBottom: '1px solid var(--border-default)', paddingBlock: 'var(--space-4)', paddingInline: 'var(--page-pad-x)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button aria-label={t('session.endSessionTitle')} onClick={() => setShowEndDialog(true)} style={{ all: 'unset', cursor: 'pointer', color: 'var(--bf-ink)', padding: 8 }}>
            <Icon name="x" size={20} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div dir="auto" style={{ font: '700 15px/1.2 var(--font-sans)', color: 'var(--bf-ink)' }}>{session.dayLabel}</div>
            <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
              {t('common.completedOfSpaced', { done: doneCount, total })}
            </div>
          </div>
          <span style={{ width: 36 }} />
        </div>
        <div style={{ height: 4, background: 'var(--bf-grey-2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (total ? (doneCount / total) * 100 : 0) + '%', background: 'var(--bf-purple)', transition: 'width var(--motion-base)' }} />
        </div>
      </div>

      <div style={{ paddingBlock: 'var(--space-4)', paddingInline: 'var(--page-pad-x)', display: 'grid', gap: 10 }}>
        {merged.map((ex) => (
          <ExerciseLogCard
            key={ex.exerciseIndex + '-' + (ex.equipmentId ?? 'x')}
            ex={ex}
            isExpanded={expandedIndex === ex.exerciseIndex}
            isNextPending={firstPendingIndex === ex.exerciseIndex}
            onToggle={() => setExpandedIndex(expandedIndex === ex.exerciseIndex ? null : ex.exerciseIndex)}
            onComplete={handleComplete}
            onUndo={handleUndo}
            locale={locale}
            t={t}
            extraEquipment={rutina.extraEquipment}
          />
        ))}
      </div>

      {showEndDialog && (
        <ConfirmSheet
          title={t('session.endSessionTitle')}
          description={t('session.endSessionDesc', { done: doneCount, total })}
          primaryLabel={t('session.finishAction')}
          onPrimary={handleFinish}
          secondaryLabel={t('session.finishIncompleteAction')}
          onSecondary={handleAbandon}
          cancelLabel={t('common.cancel')}
          onCancel={() => setShowEndDialog(false)}
          destructiveAction={{
            label: t('session.discardWithoutSaving'),
            onClick: () => {
              setShowEndDialog(false);
              setDiscardError(null);
              setShowDiscardConfirm(true);
            },
          }}
        />
      )}

      {showDiscardConfirm && (
        <ConfirmSheet
          title={t('session.discardTitle')}
          description={t('session.discardBody')}
          primaryLabel={discardBusy ? t('session.discardingLabel') : t('session.discardConfirm')}
          onPrimary={handleDiscard}
          cancelLabel={t('common.back')}
          onCancel={() => {
            setShowDiscardConfirm(false);
            setShowEndDialog(true);
          }}
          danger
          busy={discardBusy}
          error={discardError}
        />
      )}
    </div>
  );
}
