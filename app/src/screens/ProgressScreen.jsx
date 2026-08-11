/**
 * Progress screen — AC1/AC2/AC3/AC4/AC5 (tech-plan.md).
 * Rutina-gated: App.jsx redirects to /import when there is no active rutina.
 * Loading: returns null (matches HistoryScreen precedent).
 */
import React, { useEffect, useState } from 'react';
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

const PILL_BASE = {
  padding: '7px 14px',
  font: '600 13px/1.2 var(--font-sans)',
  borderRadius: 'var(--radius-control)',
  cursor: 'pointer',
  border: '1px solid var(--border-control)',
  marginRight: 6,
  marginBottom: 6,
};

/** ProgressScreen renders the three chart sections for AC2/AC3/AC4. */
export function ProgressScreen({ rutina }) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [sessions, setSessions] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(null);

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
  // exercises on one machine are two pills. Where two exercises share a NAME
  // (different machines), the pill label gets a model-code suffix — real
  // text inside the button, so it lands in the accessible name for free.
  const nameCounts = {};
  for (const ex of exercises) {
    nameCounts[ex.name] = (nameCounts[ex.name] || 0) + 1;
  }

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
              <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 10 }}>
                {exercises.map((ex) => {
                  const isActive = activeId === ex.exerciseKey;
                  const collides = nameCounts[ex.name] > 1;
                  return (
                    <button
                      key={ex.exerciseKey}
                      aria-pressed={isActive}
                      onClick={() => setSelectedId(ex.exerciseKey)}
                      style={{
                        ...PILL_BASE,
                        background: isActive ? 'var(--bf-orange, #f57c00)' : 'var(--bf-white)',
                        borderColor: isActive ? 'var(--bf-orange, #f57c00)' : 'var(--border-control)',
                        color: isActive ? 'var(--bf-white)' : 'var(--bf-ink)',
                      }}
                    >
                      <span dir="auto">{ex.name}</span>
                      {collides ? collisionSuffix(ex.equipmentId, t) : ''}
                    </button>
                  );
                })}
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
            <VolumeBarChart bars={volumes} />
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
    </div>
  );
}
