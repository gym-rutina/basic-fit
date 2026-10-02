/**
 * Progress screen — AC1/AC2/AC3/AC4/AC5 (tech-plan.md).
 * Rutina-gated: App.jsx redirects to /import when there is no active rutina.
 * Loading: returns null (matches HistoryScreen precedent).
 *
 * pill-overflow-ux S4 (tech-plan.md D-D): the unbounded exercise-pill row is
 * now a trigger button + searchable ExercisePickerSheet. The DATA layer is
 * untouched — listLoggedExercises, collisionSuffix and selectedId all behave
 * exactly as before; only the presentation changed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { listSessions } from '../lib/db.js';
import {
  listLoggedExercises,
  buildWeightSeries,
  buildSessionVolumes,
  buildFrequencyGrid,
  buildFrequencyStats,
  localDateKey,
} from '../lib/progress.js';
import {
  WeightProgressChart,
  VolumeBarChart,
  FrequencyHeatmap,
} from '../components/ProgressCharts.jsx';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet.jsx';
import { collisionSuffix } from '../lib/machineLabel.js';
import { useI18n } from '../i18n/index.js';

const PAGE_STYLE = {
  background: 'var(--bf-grey-1)',
  minHeight: '100vh',
  paddingBottom: 100,
  minWidth: 0,
  maxWidth: '100%',
  overflowX: 'hidden',
};

const SECTION_STYLE = {
  background: 'var(--bf-white)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4)',
  marginBottom: 10,
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
};

/** ProgressScreen renders the three chart sections for AC2/AC3/AC4. */
export function ProgressScreen({ rutina }) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [sessions, setSessions] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    listSessions().then((s) => {
      if (!cancelled) setSessions(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (sessions === null) return null;

  const pastSessions = sessions.filter((s) => s.status !== 'active');

  if (pastSessions.length === 0) {
    return (
      <div
        style={{
          background: 'var(--bf-grey-1)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBlock: 'var(--page-gutter)',
          paddingInline: 'var(--page-pad-x)',
          textAlign: 'center',
        }}
      >
        <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
          <Icon name="trending-up" size={36} />
        </div>
        <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 6px' }}>
          {t('progress.emptyTitle')}
        </h2>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', maxWidth: 280 }}>
          {t('progress.emptyBody')}
        </p>
      </div>
    );
  }

  const exercises = listLoggedExercises(sessions);
  const activeId = selectedId || exercises[0]?.exerciseKey || null;
  const weightPoints = buildWeightSeries(sessions, activeId);
  const volumes = buildSessionVolumes(sessions, rutina);
  const todayKey = localDateKey();
  const { cells } = buildFrequencyGrid(sessions, { weeks: 12, todayKey, t });
  const stats = buildFrequencyStats(sessions, { todayKey });

  // exercise-level-tracking AC10: the picker selects by exercise key, so two
  // exercises on one machine are two rows in the sheet. Where two exercises
  // share a NAME (different machines), the row label gets a model-code
  // suffix — real text inside the row button, so it lands in the accessible
  // name for free. Labels arrive PRE-DISAMBIGUATED here; the sheet is i18n/
  // data-agnostic about them (tech-plan.md D-D).
  const nameCounts = {};
  for (const ex of exercises) {
    nameCounts[ex.name] = (nameCounts[ex.name] || 0) + 1;
  }
  const pickerItems = exercises.map((ex) => ({
    key: ex.exerciseKey,
    label: `${ex.name}${nameCounts[ex.name] > 1 ? collisionSuffix(ex.equipmentId, t) : ''}`,
  }));
  const activeLabel =
    pickerItems.find((it) => it.key === activeId)?.label ?? pickerItems[0]?.label ?? '';

  return (
    <div style={PAGE_STYLE}>
      <ScreenHeader title={t('tab.progress')} onSettings={() => navigate('/settings')} />

      <div style={{ paddingBlock: 'var(--space-5)', paddingInline: 'var(--page-pad-x)', display: 'grid', gap: 10, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* AC2 — Weight/reps per exercise */}
        <section aria-labelledby="progress-weight-heading" style={SECTION_STYLE}>
          <h2
            id="progress-weight-heading"
            style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 10px' }}
          >
            {t('progress.byExercise')}
          </h2>
          {exercises.length === 0 ? (
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
              {t('progress.noExercisesYet')}
            </p>
          ) : (
            <>
              {/* pill-overflow-ux S4 trigger (AC10): shows the ACTIVE
                  exercise's display name including its collision suffix, and
                  opens the picker sheet. Styled like SelectField so the two
                  "pick one of N" controls read as the same pattern; the
                  chevron Icon is aria-hidden, so the accessible name is the
                  exercise label itself. */}
              <div style={{ marginBottom: 10 }}>
                <span
                  style={{
                    font: 'var(--text-label)',
                    letterSpacing: 'var(--tracking-label)',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  {t('progress.exerciseLabel')}
                </span>
                <button
                  ref={triggerRef}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    width: '100%',
                    minHeight: 44,
                    padding: '10px 14px',
                    font: '400 15px/1.3 var(--font-sans)',
                    color: 'var(--bf-ink)',
                    background: 'var(--bf-white)',
                    border: '1px solid var(--border-control)',
                    borderRadius: 'var(--radius-control)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span dir="auto">{activeLabel}</span>
                  <Icon name="chevron-down" size={18} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
              {weightPoints.length === 0 ? (
                <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
                  {t('progress.noDataForExercise')}
                </p>
              ) : (
                <WeightProgressChart points={weightPoints} />
              )}
            </>
          )}
        </section>

        {/* AC3 — Session volume */}
        <section aria-labelledby="progress-volume-heading" style={SECTION_STYLE}>
          <h2
            id="progress-volume-heading"
            style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 10px' }}
          >
            {t('progress.volumeTitle')}
          </h2>
          {volumes.length === 0 ? (
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
              {t('progress.noVolumeData')}
            </p>
          ) : (
            <>
              {/* progress-volume-fix AC9: say what the number IS — planned sets ×
                  reps × the weight the user logged (actual reps per set are not
                  logged). A caption, not a heading. */}
              <p
                style={{
                  font: 'var(--text-body-sm)',
                  color: 'var(--text-muted)',
                  margin: '0 0 10px',
                  overflowWrap: 'anywhere',
                }}
              >
                {t('progress.volumeCaption')}
              </p>
              <VolumeBarChart bars={volumes} locale={locale} />
            </>
          )}
        </section>

        {/* AC4 — Frequency heatmap */}
        <section aria-labelledby="progress-freq-heading" style={SECTION_STYLE}>
          <h2
            id="progress-freq-heading"
            style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 10px' }}
          >
            {t('progress.frequencyTitle')}
          </h2>
          <FrequencyHeatmap cells={cells} stats={stats} t={t} />
        </section>
      </div>

      {/* pill-overflow-ux S4: the picker sheet. The sheet closes ITSELF on row
          activation (calls onSelect then onClose), so the handler here only
          records the selection; returnFocusTo hands focus back to the trigger
          (AC14's ClubPickerSheet contract). */}
      {pickerOpen && exercises.length > 0 && (
        <ExercisePickerSheet
          items={pickerItems}
          selectedKey={activeId}
          onSelect={(key) => setSelectedId(key)}
          onClose={() => setPickerOpen(false)}
          returnFocusTo={triggerRef}
        />
      )}
    </div>
  );
}
