import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { ConfirmSheet } from '../components/ConfirmSheet.jsx';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { listSessions, deleteSessions } from '../lib/db.js';
import { buildExerciseTrends } from '../lib/trends.js';
import { difficultyLabel } from '../lib/difficulty.js';
import { formatRelativeDays } from '../lib/relativeTime.js';
import { machineLabel } from '../lib/machineLabel.js';

function durationMinutes(session) {
  if (!session.endedAt) return null;
  return Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000));
}

function pluralize(n, singular, plural) {
  return n === 1 ? singular : plural;
}

function sessionIdentity(s) {
  return `${s.dayLabel} · ${formatRelativeDays(s.startedAt)}`;
}

/**
 * session-discard-and-history-delete — spec.md § D (AC17-AC23).
 *
 * Two delete affordances sharing ONE storage call (tech-plan.md Decision 1
 * — deleteSessions handles single and bulk identically): a per-card trash
 * for the fast case, and a "Seleccionar" mode for the bulk case. Selection
 * state is local (tech-plan.md Decision 6) and never outlives the screen —
 * leaving Historial or hitting Cancelar starts clean next time, same as a
 * successful bulk delete. `pastSessions` keeps its `status !== 'active'`
 * filter so the active session is never deletable here (AC22) — discard
 * (spec.md AC1) is the only path for that.
 *
 * States: empty ("Aún no hay sesiones registradas") | success — ux-design.md.
 */
export function HistoryScreen() {
  const navigate = useNavigate();
  const [allSessions, setAllSessions] = useState(null); // null = loading
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // null | {kind:'single', session} | {kind:'multi'}
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function refetch() {
    return listSessions().then((sessions) => setAllSessions(sessions));
  }

  useEffect(() => {
    let cancelled = false;
    listSessions().then((sessions) => {
      if (!cancelled) setAllSessions(sessions);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (allSessions === null) return null;

  const pastSessions = allSessions.filter((s) => s.status !== 'active');
  const trends = buildExerciseTrends(allSessions);

  if (pastSessions.length === 0) {
    return (
      <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBlock: 'var(--page-gutter)', paddingInline: 'var(--page-pad-x)', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
          <Icon name="bar-chart-2" size={36} />
        </div>
        <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 6px' }}>Aún no hay sesiones registradas</h2>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', maxWidth: 280 }}>Empieza un entrenamiento desde Inicio para ver tu historial aquí.</p>
      </div>
    );
  }

  const allSelected = selectedIds.size > 0 && selectedIds.size === pastSessions.length;
  const selectionCount = selectedIds.size;

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(pastSessions.map((s) => s.id)));
  }

  function openSingleConfirm(session) {
    setDeleteError(null);
    setConfirm({ kind: 'single', session });
  }

  function openMultiConfirm() {
    setDeleteError(null);
    setConfirm({ kind: 'multi' });
  }

  function closeConfirm() {
    setConfirm(null);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    const ids = confirm.kind === 'single' ? [confirm.session.id] : Array.from(selectedIds);
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteSessions(ids);
      await refetch();
      setDeleteBusy(false);
      setConfirm(null);
      if (confirm.kind === 'multi') exitSelectionMode();
    } catch {
      setDeleteBusy(false);
      setDeleteError(confirm.kind === 'single' ? 'No se pudo borrar la sesión.' : 'No se pudieron borrar las sesiones.');
    }
  }

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: selectionMode ? 160 : 100 }}>
      <ScreenHeader
        title={selectionMode ? undefined : 'Historial'}
        trailing={
          selectionMode ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
              <button
                type="button"
                onClick={exitSelectionMode}
                style={{ all: 'unset', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', font: '700 14px/1 var(--font-sans)', color: 'var(--bf-purple)' }}
              >
                Cancelar
              </button>
              <span aria-live="polite" style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
                {selectionCount} {pluralize(selectionCount, 'seleccionada', 'seleccionadas')}
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                style={{ all: 'unset', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', font: '700 14px/1 var(--font-sans)', color: 'var(--bf-purple)' }}
              >
                {allSelected ? 'Quitar selección' : 'Seleccionar todo'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelectionMode(true)}
              style={{ all: 'unset', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', font: '700 14px/1 var(--font-sans)', color: 'var(--bf-purple)', flexShrink: 0 }}
            >
              Seleccionar
            </button>
          )
        }
      />

      <div style={{ paddingBlock: 'var(--space-5)', paddingInline: 'var(--page-pad-x)', display: 'grid', gap: 10 }}>
        {pastSessions.map((s) => {
          const done = s.exercises.filter((e) => e.completedAt).length;
          const total = s.exercises.length;
          const minutes = durationMinutes(s);
          const incomplete = s.status === 'abandoned';
          const identity = sessionIdentity(s);
          const meta = (
            <div style={{ font: 'var(--text-body-sm)', color: incomplete ? 'var(--bf-danger)' : 'var(--text-muted)', marginTop: 4 }}>
              {done}/{total} completados{minutes != null ? ` · ${minutes} min` : ''}
              {incomplete ? ' · sesión sin terminar' : ''}
            </div>
          );
          const selected = selectedIds.has(s.id);

          if (selectionMode) {
            return (
              <label
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  background: selected ? 'var(--bf-purple-tint)' : 'var(--bf-white)',
                  border: selected ? '2px solid var(--bf-purple)' : '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSelect(s.id)}
                  aria-label={`Seleccionar sesión ${identity}`}
                  style={{ width: 44, height: 44, flexShrink: 0, margin: 0, accentColor: 'var(--bf-purple)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{s.dayLabel}</span>
                    <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', flexShrink: 0 }}>{formatRelativeDays(s.startedAt)}</span>
                  </div>
                  {meta}
                </div>
              </label>
            );
          }

          return (
            <div key={s.id} style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{s.dayLabel}</span>
                <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', flexShrink: 0 }}>{formatRelativeDays(s.startedAt)}</span>
                <button
                  type="button"
                  aria-label={`Borrar sesión ${identity}`}
                  onClick={() => openSingleConfirm(s)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    minHeight: 44,
                    minWidth: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--bf-ink-3)',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="trash-2" size={16} />
                </button>
              </div>
              {meta}
            </div>
          );
        })}

        {!selectionMode && trends.length > 0 && (
          <>
            <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: 'var(--space-4) 0 0' }}>Por ejercicio</h2>
            {trends.map((t) => {
              // exercise-level-tracking AC9: one row per exercise key, so one
              // machine can now head several rows — the sub-line names WHICH
              // machine (always shown; a line only on collisions would read
              // as a glitch).
              const subLine = machineLabel(t.equipmentId, t.name);
              return (
                <div key={t.exerciseKey} style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <div style={{ font: '700 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)', marginBottom: subLine ? 2 : 6 }}>{t.name}</div>
                  {subLine && (
                    <div
                      style={{
                        font: '600 12px/1.3 var(--font-sans)',
                        color: 'var(--text-muted)',
                        marginBottom: 6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {subLine}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
                    {t.entries.map((e, i) => (
                      <span key={i}>
                        {e.weightUsed != null ? `${e.weightUsed}kg · ` : ''}
                        {difficultyLabel(e.difficulty)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!selectionMode && (
          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/export')}>
            <Icon name="download" size={16} /> Exportar progreso
          </Button>
        )}
      </div>

      {selectionMode && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom, 0px))',
            background: 'var(--bf-white)',
            borderTop: '1px solid var(--border-default)',
            paddingBlock: 'var(--space-4)',
            paddingInline: 'var(--page-pad-x)',
            zIndex: 150,
          }}
        >
          <Button
            variant="primary"
            size="lg"
            disabled={selectionCount === 0}
            style={{
              width: '100%',
              ...(selectionCount > 0 ? { background: 'var(--bf-danger)', borderColor: 'var(--bf-danger)' } : {}),
            }}
            aria-label={
              selectionCount > 0
                ? `Borrar ${selectionCount} ${pluralize(selectionCount, 'sesión seleccionada', 'sesiones seleccionadas')}`
                : undefined
            }
            onClick={openMultiConfirm}
          >
            Borrar ({selectionCount})
          </Button>
        </div>
      )}

      {confirm && confirm.kind === 'single' && (
        <ConfirmSheet
          title="¿Borrar esta sesión?"
          description={`Se borrará «${sessionIdentity(confirm.session)}». También se recalcularán los pesos sugeridos para los ejercicios de esta sesión. No se puede deshacer.`}
          primaryLabel="Borrar"
          onPrimary={handleConfirmDelete}
          cancelLabel="Cancelar"
          onCancel={closeConfirm}
          danger
          busy={deleteBusy}
          error={deleteError}
        />
      )}

      {confirm && confirm.kind === 'multi' && (
        <ConfirmSheet
          title={`¿Borrar ${selectionCount} ${pluralize(selectionCount, 'sesión', 'sesiones')}?`}
          description={`Se ${pluralize(selectionCount, 'borrará', 'borrarán')} ${selectionCount} ${pluralize(selectionCount, 'sesión', 'sesiones')} del historial. También se recalcularán los pesos sugeridos para sus ejercicios. No se puede deshacer.`}
          primaryLabel={`Borrar ${selectionCount}`}
          onPrimary={handleConfirmDelete}
          cancelLabel="Cancelar"
          onCancel={closeConfirm}
          danger
          busy={deleteBusy}
          error={deleteError}
        />
      )}
    </div>
  );
}
