import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { SectionBanner } from '../../../design-system/components/composite/SectionBanner.jsx';
import { ExerciseCard } from '../../../design-system/components/composite/ExerciseCard.jsx';
import { SummaryTable } from '../../../design-system/components/composite/SummaryTable.jsx';
import { RuleItem } from '../../../design-system/components/primitives/RuleItem.jsx';
import { NoteItem } from '../../../design-system/components/primitives/NoteItem.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { ConfirmSheet } from '../components/ConfirmSheet.jsx';
import { getEquipmentById, mainImageUrl, equipmentDisplayName } from '../data/equipment.js';
import { dayFocusLabels, muscleGroupLabels } from '../lib/muscleGroups.js';
import { getActiveSession, listSessions, clearActiveRutina } from '../lib/db.js';
import { buildVideoQuery } from '../lib/videoQuery.js';

const wrap = { maxWidth: 760, margin: '0 auto', paddingInline: 'var(--page-pad-x)', display: 'grid', gap: 'var(--space-8)' };

function SectionTitle({ children }) {
  return <h2 style={{ font: 'var(--text-h2)', textTransform: 'uppercase', color: 'var(--bf-ink)', margin: '0 0 4px' }}>{children}</h2>;
}

/**
 * Data-driven rewrite of the mockup's RoutineScreen.jsx (tech-plan.md's
 * Porting Plan). ONE component, branching on whether :dayIndex is present
 * in the route — ProgramScreen({ rutina, dayIndex }) per tech-plan.md's
 * literal file layout (a single ProgramScreen.jsx, not two files): "/program"
 * is the day-list overview (phase info, warmup/cooldown, derived summary
 * table, rules, notes); "/program/:dayIndex" drills into one day's full
 * exercise render. Mirrors ux-design.md's "Program → Day list → Day detail"
 * flow, replacing the original single-page anchor-nav document.
 */
export function ProgramScreen({ rutina, onGoImport, onRutinaCleared }) {
  const { dayIndex } = useParams();
  if (dayIndex === undefined) {
    return <ProgramOverview rutina={rutina} onGoImport={onGoImport} onRutinaCleared={onRutinaCleared} />;
  }
  return <ProgramDayDetail rutina={rutina} dayIndex={Number(dayIndex)} />;
}

function ProgramOverview({ rutina, onGoImport, onRutinaCleared }) {
  const [sheet, setSheet] = useState(null); // null | 'replace-warn' | 'remove-b' | 'remove-c' | 'remove-d'
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  const handleReplaceClick = async () => {
    const activeSession = await getActiveSession();
    if (activeSession) {
      setSheet('replace-warn');
    } else {
      onGoImport();
    }
  };

  const handleRemoveClick = async () => {
    const [activeSession, sessions] = await Promise.all([getActiveSession(), listSessions()]);
    if (activeSession) {
      setSheet('remove-d');
    } else if (sessions.length > 0) {
      setSheet('remove-c');
    } else {
      setSheet('remove-b');
    }
  };

  const handleRemoveConfirm = async () => {
    setSheet(null);
    setRemoving(true);
    setRemoveError(false);
    try {
      await clearActiveRutina();
      onRutinaCleared();
    } catch {
      setRemoving(false);
      setRemoveError(true);
    }
  };

  const { program, phaseInfo, warmup, cooldown, days, rules, notes } = rutina;

  const phaseStats = [
    ['Intensidad', phaseInfo.intensityPercent],
    ['Descanso', `${phaseInfo.restSeconds} segundos`],
    ['Frecuencia', `${phaseInfo.frequencyPerWeek} días/semana`],
  ];

  // Generated from `days` at render time — never a separately authored
  // field (rutina.schema.json deliberately has no summaryTable property;
  // spec.md's Render AC requires this be derived, not authored).
  const summaryRows = days.map((day) => [
    day.label + (day.intro ? ` — ${day.intro}` : ''),
    dayFocusLabels(day.exercises).join(', ') || '—',
    String(day.exercises.length),
  ]);

  return (
    <>
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
      <ScreenHeader
        title={program.name}
        subtitle={`${program.phaseName} · ${program.durationWeeks} semanas`}
        badge={`Fase ${program.phaseNumber}`}
      />
      <div style={{ ...wrap, paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-10)' }}>
        <SectionBanner tone="neutral" title="Objetivos de esta fase" subtitle={phaseInfo.objective}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 10, marginTop: 16 }}>
            {phaseStats.map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bf-white)', borderRadius: 8, padding: 12, boxShadow: 'var(--shadow-card)' }}>
                <div style={{ font: '600 12px/1.3 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>{k}</div>
                <div style={{ font: '700 15px/1.3 var(--font-sans)', marginTop: 2, color: 'var(--bf-ink)' }}>{v}</div>
              </div>
            ))}
          </div>
        </SectionBanner>

        <SectionBanner tone="brand" title="Calentamiento" subtitle={`Obligatorio · ${warmup.durationMinutes} minutos`} items={warmup.steps} />

        <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <SectionTitle>Días de entrenamiento</SectionTitle>
          <div style={{ display: 'grid', gap: 10 }}>
            {days.map((day, i) => (
              <Link
                key={i}
                to={`/program/${i}`}
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
                  <div style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
                    {day.label}
                    {day.intro ? ` — ${day.intro}` : ''}
                  </div>
                  <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', marginTop: 2 }}>{dayFocusLabels(day.exercises).join(', ')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', flexShrink: 0 }}>
                  <span style={{ font: 'var(--text-body-sm)' }}>
                    {day.exercises.length} ej.
                  </span>
                  <Icon name="chevron-right" size={18} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <SectionBanner tone="ink" title="Enfriamiento" subtitle={`${cooldown.durationMinutes} minutos al final de cada sesión`} items={cooldown.steps} />

        <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <SectionTitle>Resumen semanal</SectionTitle>
          <div style={{ overflowX: 'auto' }}>
            <SummaryTable columns={['Día', 'Enfoque', 'Ejercicios']} rows={summaryRows} />
          </div>
        </section>

        {rules.length > 0 && (
          <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <SectionTitle>Reglas generales</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              {rules.map((rule, i) => (
                <RuleItem key={i} icon="info">
                  {rule}
                </RuleItem>
              ))}
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <SectionTitle>Notas</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              {notes.map((note, i) => (
                <NoteItem key={i} title={note.title}>
                  {note.body}
                </NoteItem>
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 'var(--space-8)' }}>
          <hr aria-hidden="true" style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '0 0 var(--space-6)' }} />
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Button
              variant="outline"
              style={{ width: '100%' }}
              disabled={removing}
              onClick={handleReplaceClick}
            >
              Reemplazar programa
            </Button>
            {(!sheet || sheet === 'replace-warn') && (
              <Button
                variant="ghost"
                style={{ width: '100%', color: 'var(--bf-danger)' }}
                disabled={removing}
                onClick={handleRemoveClick}
              >
                {removing ? 'Eliminando...' : 'Eliminar programa'}
              </Button>
            )}
            {removeError && (
              <p role="alert" style={{ font: 'var(--text-body-sm)', color: 'var(--bf-danger)', margin: 'var(--space-3) 0 0' }}>
                Error al eliminar el programa. Inténtalo de nuevo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>

    {sheet === 'replace-warn' && (
      <ConfirmSheet
        title="Sesión en curso"
        description="Tienes una sesión en curso. Si reemplazas el programa ahora, la sesión podría quedar desactualizada. ¿Continuar de todas formas?"
        primaryLabel="Ir a importar"
        onPrimary={() => onGoImport()}
        cancelLabel="Cancelar"
        onCancel={() => setSheet(null)}
        danger={false}
      />
    )}
    {sheet === 'remove-b' && (
      <ConfirmSheet
        title="Eliminar programa"
        description="Se eliminará el programa activo. Podrás importar uno nuevo en cualquier momento."
        primaryLabel="Eliminar"
        onPrimary={handleRemoveConfirm}
        cancelLabel="Cancelar"
        onCancel={() => setSheet(null)}
        danger={true}
      />
    )}
    {sheet === 'remove-c' && (
      <ConfirmSheet
        title="Eliminar programa"
        description="Se eliminará el programa activo. Tu historial de sesiones se conserva, pero ya no estará vinculado a un programa."
        primaryLabel="Eliminar de todas formas"
        onPrimary={handleRemoveConfirm}
        cancelLabel="Cancelar"
        onCancel={() => setSheet(null)}
        danger={true}
      />
    )}
    {sheet === 'remove-d' && (
      <ConfirmSheet
        title="Sesión en curso"
        description="Tienes una sesión en curso. Si eliminas el programa ahora, la sesión podría quedar desactualizada. ¿Continuar de todas formas?"
        primaryLabel="Eliminar de todas formas"
        onPrimary={handleRemoveConfirm}
        cancelLabel="Cancelar"
        onCancel={() => setSheet(null)}
        danger={true}
      />
    )}
    </>
  );
}

function ProgramDayDetail({ rutina, dayIndex }) {
  const navigate = useNavigate();
  const day = rutina.days[dayIndex];

  if (!day) {
    return (
      <div style={{ paddingBlock: 'var(--space-6)', paddingInline: 'var(--page-pad-x)' }}>
        <p>Día no encontrado.</p>
        <Link to="/program" style={{ color: 'var(--text-link)' }}>
          Volver al programa
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
      <ScreenHeader
        title={day.label}
        subtitle={day.intro || undefined}
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
            <Icon name="chevron-left" size={16} /> Programa
          </button>
        }
      />

      <div style={{ ...wrap, paddingTop: 'var(--space-6)' }}>
        <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {day.exercises.map((exercise, i) => {
            const equipment = getEquipmentById(exercise.equipmentId);
            const details = [
              { label: 'Series × Repeticiones', value: `${exercise.sets} × ${exercise.reps}` },
              { label: 'Descanso', value: `${exercise.restSeconds} segundos` },
            ];
            if (exercise.intensity) details.push({ label: 'Intensidad', value: exercise.intensity });

            return (
              <ExerciseCard
                key={i}
                number={i + 1}
                name={exercise.name}
                muscles={muscleGroupLabels(exercise.muscleGroups)}
                details={details}
                equipment={equipment ? `${equipment.series ? `Matrix ${equipment.series} ` : ''}${equipment.modelCode} — ${equipmentDisplayName(equipment)}` : exercise.equipmentId}
                imageUrl={equipment ? mainImageUrl(equipment) : undefined}
                steps={exercise.technique || []}
                videoHref={`https://www.youtube.com/results?search_query=${encodeURIComponent(buildVideoQuery(exercise, equipment))}`}
                videoLabel={`Ver técnica de «${exercise.name}» en YouTube`}
              />
            );
          })}
        </section>
      </div>
    </div>
  );
}
