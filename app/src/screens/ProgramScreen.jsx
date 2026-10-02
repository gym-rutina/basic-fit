import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { SectionBanner } from '../../../design-system/components/composite/SectionBanner.jsx';
import { ExerciseCard } from '../../../design-system/components/composite/ExerciseCard.jsx';
import { RuleItem } from '../../../design-system/components/primitives/RuleItem.jsx';
import { NoteItem } from '../../../design-system/components/primitives/NoteItem.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { getEquipmentById, mainImageUrl, equipmentDisplayName } from '../data/equipment.js';
import { dayFocusLabels, muscleGroupLabels } from '../lib/muscleGroups.js';
import { hasSeenLibraryNotice, markLibraryNoticeSeen } from '../lib/libraryNoticeStorage.js';
import { buildVideoQuery } from '../lib/videoQuery.js';
import { useI18n } from '../i18n/index.js';

const wrap = { maxWidth: 760, margin: '0 auto', paddingInline: 'var(--page-pad-x)', display: 'grid', gap: 'var(--space-8)' };

function SectionTitle({ children }) {
  return <h2 style={{ font: 'var(--text-h2)', textTransform: 'uppercase', color: 'var(--bf-ink)', margin: '0 0 4px' }}>{children}</h2>;
}

/**
 * Data-driven rewrite of the mockup's RoutineScreen.jsx (tech-plan.md's
 * Porting Plan). ONE component, branching on whether :dayIndex is present
 * in the route — ProgramScreen({ rutina }) per tech-plan.md's literal file
 * layout (a single ProgramScreen.jsx, not two files): "/program" is the
 * day-list overview (phase info, warmup/cooldown, rules, notes; the
 * Training days list is the sole per-day overview); "/program/:dayIndex"
 * drills into one day's full exercise
 * render. Mirrors ux-design.md's "Program → Day list → Day detail" flow,
 * replacing the original single-page anchor-nav document.
 *
 * pwa-ui-language D10: the settings affordance appears on the OVERVIEW only
 * — the day-detail header already has its own `leading` back control and is
 * one level deep from the tab root, so it does not get a second global
 * affordance (Q3). The overview constructs its own `navigate('/settings')`
 * handler rather than receiving one as a prop.
 *
 * multi-rutina-library S3/D-H: the bottom action stack is ONE outline row —
 * "Mis rutinas" → /library. "Reemplazar programa", "Eliminar programa" and
 * their four ConfirmSheet variants are DELETED, not commented: management of
 * other entries lives on /library now, and "replace" is incoherent when
 * importing adds instead of overwrites (AC22's spirit applied to Programa).
 * Programa stops being a destructive surface. A one-shot migration notice
 * (gated by the localStorage flag in libraryNoticeStorage.js) tells existing
 * users where those actions went — shown only here, where they used to live.
 */
export function ProgramScreen({ rutina }) {
  const { dayIndex } = useParams();
  if (dayIndex === undefined) {
    return <ProgramOverview rutina={rutina} />;
  }
  return <ProgramDayDetail rutina={rutina} dayIndex={Number(dayIndex)} />;
}

function ProgramOverview({ rutina }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  // One-shot notice: read synchronously at mount; dismissed for good on ack.
  const [showNotice, setShowNotice] = useState(() => !hasSeenLibraryNotice());

  function dismissNotice() {
    markLibraryNoticeSeen(); // never throws (degrades to show-again-next-boot)
    setShowNotice(false);
  }

  const { program, phaseInfo, warmup, cooldown, days, rules, notes } = rutina;

  const phaseStats = [
    [t('program.intensity'), phaseInfo.intensityPercent],
    [t('program.rest'), t('common.secondsFull', { n: phaseInfo.restSeconds })],
    [t('program.frequency'), t('program.perWeek', { n: phaseInfo.frequencyPerWeek })],
  ];

  return (
    <>
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
      <ScreenHeader
        title={<span dir="auto">{program.name}</span>}
        subtitle={
          <>
            <span dir="auto">{program.phaseName}</span>
            {' · ' + t('program.weeksSuffix', { n: program.durationWeeks })}
          </>
        }
        badge={t('program.phaseLabel', { n: program.phaseNumber })}
        onSettings={() => navigate('/settings')}
      />
      <div style={{ ...wrap, paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-10)' }}>
        {showNotice && (
          <div
            role="note"
            style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'grid', gap: 6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '700 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
              <span style={{ color: 'var(--bf-purple)', flexShrink: 0 }}>
                <Icon name="info" size={16} />
              </span>
              {t('library.noticeTitle')}
            </div>
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: 0 }}>{t('library.noticeBody')}</p>
            <Button variant="outline" size="sm" style={{ justifySelf: 'start' }} onClick={dismissNotice}>
              {t('library.noticeAck')}
            </Button>
          </div>
        )}
        <SectionBanner tone="neutral" title={t('program.phaseObjectivesTitle')} subtitle={<span dir="auto">{phaseInfo.objective}</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 10, marginTop: 16 }}>
            {phaseStats.map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bf-white)', borderRadius: 8, padding: 12, boxShadow: 'var(--shadow-card)' }}>
                <div style={{ font: '600 12px/1.3 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>{k}</div>
                <div style={{ font: '700 15px/1.3 var(--font-sans)', marginTop: 2, color: 'var(--bf-ink)' }}>{v}</div>
              </div>
            ))}
          </div>
        </SectionBanner>

        <SectionBanner
          tone="brand"
          title={t('program.warmupTitle')}
          subtitle={t('program.warmupSubtitle', { n: warmup.durationMinutes })}
          items={warmup.steps.map((step, i) => <span key={i} dir="auto">{step}</span>)}
        />

        <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <SectionTitle>{t('program.trainingDaysTitle')}</SectionTitle>
          <div style={{ display: 'grid', gap: 10 }}>
            {days.map((day, i) => (
              <Link
                key={i}
                to={'/program/' + i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: 'var(--bf-white)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div dir="auto" style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
                    {day.label}
                    {day.intro ? ' — ' + day.intro : ''}
                  </div>
                  <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', marginTop: 2 }}>{dayFocusLabels(day.exercises, { t }).join(', ')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', flexShrink: 0 }}>
                  <span style={{ font: 'var(--text-body-sm)' }}>
                    {t('program.exerciseAbbrev', { n: day.exercises.length })}
                  </span>
                  <Icon name="chevron-right" size={18} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <SectionBanner
          tone="ink"
          title={t('program.cooldownTitle')}
          subtitle={t('program.cooldownSubtitle', { n: cooldown.durationMinutes })}
          items={cooldown.steps.map((step, i) => <span key={i} dir="auto">{step}</span>)}
        />

        {rules.length > 0 && (
          <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <SectionTitle>{t('program.rulesTitle')}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              {rules.map((rule, i) => (
                <RuleItem key={i} icon="info">
                  <span dir="auto">{rule}</span>
                </RuleItem>
              ))}
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <SectionTitle>{t('program.notesTitle')}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              {notes.map((note, i) => (
                <NoteItem key={i} title={<span dir="auto">{note.title}</span>}>
                  <span dir="auto">{note.body}</span>
                </NoteItem>
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 'var(--space-8)' }}>
          <hr aria-hidden="true" style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '0 0 var(--space-6)' }} />
          {/* multi-rutina-library S3 — the whole management stack is ONE row.
              Reemplazar/Eliminar and their four sheets live only in git
              history; per-entry activate/delete is /library's job. */}
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Button variant="outline" style={{ width: '100%' }} onClick={() => navigate('/library')}>
              {t('program.libraryAction')}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function ProgramDayDetail({ rutina, dayIndex }) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const day = rutina.days[dayIndex];

  if (!day) {
    return (
      <div style={{ paddingBlock: 'var(--space-6)', paddingInline: 'var(--page-pad-x)' }}>
        <p>{t('program.dayNotFound')}</p>
        <Link to="/program" style={{ color: 'var(--text-link)' }}>
          {t('program.backToProgram')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
      <ScreenHeader
        title={<span dir="auto">{day.label}</span>}
        subtitle={day.intro ? <span dir="auto">{day.intro}</span> : undefined}
        leading={
          <button
            type="button"
            onClick={() => navigate('/program')}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-muted)',
              font: 'var(--text-body-sm)',
              marginBottom: 10,
              minHeight: 44,
            }}
          >
            <Icon name="chevron-left" size={16} /> {t('tab.program')}
          </button>
        }
      />

      <div style={{ ...wrap, paddingTop: 'var(--space-6)' }}>
        <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {day.exercises.map((exercise, i) => {
            const equipment = getEquipmentById(exercise.equipmentId);
            const details = [
              {
                label: t('program.setsReps'),
                value: (
                  <>
                    {exercise.sets} × <span dir="auto">{exercise.reps}</span>
                  </>
                ),
              },
              { label: t('program.rest'), value: t('common.secondsFull', { n: exercise.restSeconds }) },
            ];
            if (exercise.intensity)
              details.push({ label: t('program.intensity'), value: <span dir="auto">{exercise.intensity}</span> });

            const equipmentSeriesPrefix = equipment && equipment.series ? equipment.series + ' ' : '';
            const equipmentLabel = equipment
              ? equipmentSeriesPrefix + equipment.modelCode + ' — ' + equipmentDisplayName(equipment, locale)
              : exercise.equipmentId;
            const videoHref = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(buildVideoQuery(exercise, equipment, locale));

            return (
              <ExerciseCard
                key={i}
                number={i + 1}
                name={exercise.name}
                muscles={muscleGroupLabels(exercise.muscleGroups, t)}
                details={details}
                equipment={equipmentLabel}
                imageUrl={equipment ? mainImageUrl(equipment) : undefined}
                steps={exercise.technique || []}
                videoHref={videoHref}
                videoLabel={t('program.watchTechnique', { name: exercise.name })}
                equipmentLabel={t('program.equipmentLabel')}
                alternativeLabel={t('program.alternativeLabel')}
                techniqueLabel={t('program.techniqueLabel')}
              />
            );
          })}
        </section>
      </div>
    </div>
  );
}
