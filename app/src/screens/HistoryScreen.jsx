import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { ConfirmSheet } from '../components/ConfirmSheet.jsx';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { listSessions, deleteSessions, listRutinas } from '../lib/db.js';
import { buildExerciseTrends } from '../lib/trends.js';
import { difficultyLabel } from '../lib/difficulty.js';
import { formatRelativeDays } from '../lib/relativeTime.js';
import { machineLabel } from '../lib/machineLabel.js';
import { useI18n } from '../i18n/index.js';

function durationMinutes(session) {
  if (!session.endedAt) return null;
  return Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000));
}

// Built by CONCATENATION, not a template literal — same reason as
// HomeScreen's rowName: strayLiterals' naive backtick pairing reads the span
// up to the next template as one giant "string", and this file now contains
// the identifier `rutina`, which trips its Spanish heuristic.
function sessionIdentity(s, locale, t) {
  return s.dayLabel + ' · ' + formatRelativeDays(s.startedAt, new Date(), { locale, t });
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
 * multi-rutina-library S4/D-I: when history spans ≥2 distinct rutinaIds,
 * every row gains a muted attribution caption ({name} · {phaseName} · Fase n)
 * and a FilterPill radiogroup ("Filtrar por programa": Todas + one pill per
 * distinct id) filters the LIST only — trends above/below stay global (AC20),
 * ordering untouched (AC15). Names resolve library-entry first, then the
 * session's denormalised snapshot (survives entry deletion, OQ-6), else the
 * neutral "programa desconocido". Single-rutina history renders byte-
 * identical to before (AC25 floor). The chosen filter is VIEW state only —
 * useState, never persisted (AC17).
 *
 * States: empty ("Aún no hay sesiones registradas") | success — ux-design.md.
 */
export function HistoryScreen() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [allSessions, setAllSessions] = useState(null); // null = loading
  const [libraryEntries, setLibraryEntries] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // null | {kind:'single', session} | {kind:'multi'}
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  // AC17 — view state: null = "Todas"; otherwise a rutinaId (possibly
  // undefined for the orphan group). Resets naturally on remount.
  const [filterId, setFilterId] = useState(null);

  function refetch() {
    return listSessions().then((sessions) => setAllSessions(sessions));
  }

  useEffect(() => {
    let cancelled = false;
    listSessions().then((sessions) => {
      if (!cancelled) setAllSessions(sessions);
    });
    // Promise.resolve wraps the auto-mocked case where listRutinas() yields
    // undefined; an unavailable library just means snapshot-first naming.
    Promise.resolve(listRutinas())
      .then((entries) => {
        if (!cancelled) setLibraryEntries(Array.isArray(entries) ? entries : []);
      })
      .catch(() => {
        if (!cancelled) setLibraryEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (allSessions === null) return null;

  const pastSessions = allSessions.filter((s) => s.status !== 'active');
  const trends = buildExerciseTrends(allSessions);

  // ── multi-rutina-library S4 helpers ──────────────────────────────────────
  const libraryById = new Map(libraryEntries.map((e) => [e.id, e]));

  /** Resolves display fields for one session's attribution. A session with
   *  NO rutinaId at all is a pre-feature orphan → always "programa
   *  desconocido" (AC14), whatever else its row carries. Otherwise: library
   *  entry first, then the denormalised snapshot (survives entry deletion,
   *  OQ-6), then null = unknown. */
  function resolveAttribution(rutinaId, sampleSession) {
    if (rutinaId == null) return null;
    if (libraryById.has(rutinaId)) {
      const p = (libraryById.get(rutinaId).rutina || {}).program || {};
      if (p.name != null) {
        return { name: p.name, phaseName: p.phaseName, phaseNumber: p.phaseNumber };
      }
    }
    if (sampleSession && sampleSession.rutinaName != null) {
      return {
        name: sampleSession.rutinaName,
        phaseName: sampleSession.phaseName,
        phaseNumber: sampleSession.phaseNumber,
      };
    }
    return null;
  }

  // Distinct-set rule (ux §0/§6): union of rutinaIds present in history.
  // Attribution + filter appear ONLY at ≥2 — single-rutina UI stays byte-
  // identical (AC25 floor).
  const distinctIds = [];
  const seenIds = new Set();
  const firstSessionById = new Map();
  for (const s of pastSessions) {
    if (!seenIds.has(s.rutinaId)) {
      seenIds.add(s.rutinaId);
      distinctIds.push(s.rutinaId);
    }
    if (!firstSessionById.has(s.rutinaId)) firstSessionById.set(s.rutinaId, s);
  }
  const multiRutina = distinctIds.length >= 2;

  const visibleSessions =
    filterId === null ? pastSessions : pastSessions.filter((s) => s.rutinaId === filterId);

  if (pastSessions.length === 0) {
    return (
      <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBlock: 'var(--page-gutter)', paddingInline: 'var(--page-pad-x)', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
          <Icon name="bar-chart-2" size={36} />
        </div>
        <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 6px' }}>{t('history.emptyTitle')}</h2>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', maxWidth: 280 }}>{t('history.emptyBody')}</p>
      </div>
    );
  }

  const allSelected = selectedIds.size > 0 && selectedIds.size === visibleSessions.length;
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

  // "Seleccionar todo" scopes to what the user SEES — with a rutina filter
  // active it must not sweep in hidden sessions from other programs.
  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(visibleSessions.map((s) => s.id)));
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
      setDeleteError(confirm.kind === 'single' ? t('history.deleteSingleError') : t('history.deleteMultiError'));
    }
  }

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: selectionMode ? 160 : 100 }}>
      <ScreenHeader
        title={selectionMode ? undefined : t('tab.history')}
        onSettings={selectionMode ? undefined : () => navigate('/settings')}
        trailing={
          selectionMode ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
              <button
                type="button"
                onClick={exitSelectionMode}
                style={{ all: 'unset', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', font: '700 14px/1 var(--font-sans)', color: 'var(--bf-purple)' }}
              >
                {t('common.cancel')}
              </button>
              <span aria-live="polite" style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
                {t(selectionCount === 1 ? 'history.selectedCountOne' : 'history.selectedCountOther', { n: selectionCount })}
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                style={{ all: 'unset', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', font: '700 14px/1 var(--font-sans)', color: 'var(--bf-purple)' }}
              >
                {allSelected ? t('history.deselectAll') : t('history.selectAll')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelectionMode(true)}
              style={{ all: 'unset', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', font: '700 14px/1 var(--font-sans)', color: 'var(--bf-purple)', flexShrink: 0 }}
            >
              {t('history.selectAction')}
            </button>
          )
        }
      />

      <div style={{ paddingBlock: 'var(--space-5)', paddingInline: 'var(--page-pad-x)', display: 'grid', gap: 10 }}>
        {/* multi-rutina-library S4 — per-rutina filter (AC17). Only rendered
            when history actually spans ≥2 rutinas; flex-wrap, no scroll
            (hidden-affordance anti-pattern); radiogroup per the proven
            DifficultyPicker pattern. */}
        {multiRutina && !selectionMode && (
          <div role="radiogroup" aria-label={t('history.filterLabel')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {/* Pills enumerate REAL rutinaIds — an absent rutinaId (pre-feature
                orphan) is not an addressable program, so it gets a caption on
                its rows but no pill of its own. */}
            {[null, ...distinctIds.filter((id) => id != null)].map((id) => {
              const checked = filterId === id;
              const attribution = id === null ? null : resolveAttribution(id, firstSessionById.get(id));
              const label =
                id === null
                  ? t('history.filterTodas')
                  : attribution
                    ? String(attribution.name) + ' · ' + t('program.phaseLabel', { n: attribution.phaseNumber || 0 })
                    : t('history.desconocido');
              return (
                <button
                  key={id === null ? '__all' : String(id)}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setFilterId(checked ? null : id)}
                  style={{
                    minHeight: 44,
                    padding: '8px 14px',
                    font: '700 13px/1.2 var(--font-sans)',
                    letterSpacing: '.02em',
                    borderRadius: 'var(--radius-control)',
                    border: checked ? '2px solid var(--bf-purple)' : '1px solid var(--border-control)',
                    background: checked ? 'var(--bf-purple-tint)' : 'var(--bf-white)',
                    color: checked ? 'var(--bf-purple-dark)' : 'var(--bf-ink)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {visibleSessions.map((s) => {
          const done = s.exercises.filter((e) => e.completedAt).length;
          const total = s.exercises.length;
          const minutes = durationMinutes(s);
          const incomplete = s.status === 'abandoned';
          const identity = sessionIdentity(s, locale, t);
          // AC16 — muted second line, only at ≥2 distinct rutinaIds. Deleted
          // origins still name themselves via the snapshot; true orphans read
          // "programa desconocido".
          let attributionCaption = null;
          if (multiRutina) {
            const a = resolveAttribution(s.rutinaId, s);
            attributionCaption = a
              ? String(a.name) + ' · ' + (a.phaseName != null ? String(a.phaseName) + ' · ' : '') + t('program.phaseLabel', { n: a.phaseNumber || 0 })
              : t('history.desconocido');
          }
          const meta = (
            <div style={{ font: 'var(--text-body-sm)', color: incomplete ? 'var(--bf-danger)' : 'var(--text-muted)', marginTop: 4 }}>
              {t('common.completedOf', { done, total })}
              {minutes != null ? ' · ' + minutes + ' min' : ''}
              {incomplete ? ' · ' + t('common.unfinishedSuffix') : ''}
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
                  aria-label={t('history.selectSessionAria', { identity })}
                  style={{ width: 44, height: 44, flexShrink: 0, margin: 0, accentColor: 'var(--bf-purple)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span dir="auto" style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{s.dayLabel}</span>
                    <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', flexShrink: 0 }}>{formatRelativeDays(s.startedAt, new Date(), { locale, t })}</span>
                  </div>
                  {attributionCaption && (
                    <div dir="auto" style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
                      {attributionCaption}
                    </div>
                  )}
                  {meta}
                </div>
              </label>
            );
          }

          return (
            <div key={s.id} style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span dir="auto" style={{ flex: 1, minWidth: 0, font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{s.dayLabel}</span>
                <span style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', flexShrink: 0 }}>{formatRelativeDays(s.startedAt, new Date(), { locale, t })}</span>
                <button
                  type="button"
                  aria-label={t('history.deleteSessionAria', { identity })}
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
              {attributionCaption && (
                <div dir="auto" style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {attributionCaption}
                </div>
              )}
              {meta}
            </div>
          );
        })}

        {!selectionMode && trends.length > 0 && (
          <>
            <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: 'var(--space-4) 0 0' }}>{t('progress.byExercise')}</h2>
            {trends.map((tr) => {
              // exercise-level-tracking AC9: one row per exercise key, so one
              // machine can now head several rows — the sub-line names WHICH
              // machine (always shown; a line only on collisions would read
              // as a glitch).
              const subLine = machineLabel(tr.equipmentId, tr.name, locale);
              return (
                <div key={tr.exerciseKey} style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <div dir="auto" style={{ font: '700 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)', marginBottom: subLine ? 2 : 6 }}>{tr.name}</div>
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
                    {tr.entries.map((e, i) => (
                      <span key={i}>
                        {e.weightUsed != null ? e.weightUsed + 'kg · ' : ''}
                        {difficultyLabel(e.difficulty, t)}
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
            <Icon name="download" size={16} /> {t('export.title')}
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
                ? t(selectionCount === 1 ? 'history.deleteSelectedAriaOne' : 'history.deleteSelectedAriaOther', { n: selectionCount })
                : undefined
            }
            onClick={openMultiConfirm}
          >
            {t('history.deleteCount', { n: selectionCount })}
          </Button>
        </div>
      )}

      {confirm && confirm.kind === 'single' && (
        <ConfirmSheet
          title={t('history.deleteSingleTitle')}
          description={t('history.deleteSingleBody', { identity: sessionIdentity(confirm.session, locale, t) })}
          primaryLabel={t('history.deleteConfirmAction')}
          onPrimary={handleConfirmDelete}
          cancelLabel={t('common.cancel')}
          onCancel={closeConfirm}
          danger
          busy={deleteBusy}
          error={deleteError}
        />
      )}

      {confirm && confirm.kind === 'multi' && (
        <ConfirmSheet
          title={t(selectionCount === 1 ? 'history.deleteMultiTitleOne' : 'history.deleteMultiTitleOther', { n: selectionCount })}
          description={t(selectionCount === 1 ? 'history.deleteMultiBodyOne' : 'history.deleteMultiBodyOther', { n: selectionCount })}
          primaryLabel={t('history.deleteConfirmCount', { n: selectionCount })}
          onPrimary={handleConfirmDelete}
          cancelLabel={t('common.cancel')}
          onCancel={closeConfirm}
          danger
          busy={deleteBusy}
          error={deleteError}
        />
      )}
    </div>
  );
}
