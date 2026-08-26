import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { ScreenHeader } from './ScreenHeader.jsx';
import { ConfirmSheet } from './ConfirmSheet.jsx';
import { activateRutina, deleteAndActivateRutina, deleteRutina, getActiveSession, listRutinas } from '../lib/db.js';
import { useI18n } from '../i18n/index.js';

/**
 * multi-rutina-library S1 — /library "Mis rutinas" (ux-design.md §2/§4).
 *
 * Lists every stored library entry, marks the active one (purple tint +
 * uppercase ACTIVA micro-label + aria-current — the home-next-workout picker
 * marker convention, deliberately NOT a Badge), and owns the three destructive
 * variants ProgramScreen gave up (D-del-inactive / D-del-active-pick successor
 * radiogroup / D-del-last). Cards are NOT tappable as a whole — they contain
 * two distinct actions, so open-vs-destroy mis-taps are impossible (§2).
 *
 * Ordering (AC9): active first, then program.phaseNumber ascending, then
 * importedAt descending as tie-break. Deterministic; duplicates stay
 * individually addressable because actions target the stable id.
 *
 * Props: `activeId` — the Shell's currently-active entry id; `onActivated` —
 * fired after ANY successful write so App.jsx can reuse loadRutina() (AC10's
 * cross-surface refresh without reload; the empty-library redirect back to
 * /import after D-del-last rides the same refresh).
 *
 * States: loading (null render, no flash) | error (inline alert + retry) |
 * success (1..N cards) | activating (button disabled + label swap + aria-busy
 * list) | three delete-confirm sheets | action-error alert above the Import
 * CTA. Empty is UNREACHABLE by design — the guard below is defensive only
 * (App.jsx already redirects rutina-less sessions to /import, AC5).
 */
export function LibraryScreen({ activeId = null, onActivated }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [entries, setEntries] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(false);
  // Local mirror of the pointer: activation updates it immediately so the
  // tint/marker/order move in place even before the Shell refresh round-trips.
  const [currentId, setCurrentId] = useState(activeId);
  const [activatingId, setActivatingId] = useState(null);
  // null | {kind:'inactive'|'pick'|'last', entry} | {kind:'session', entry}
  const [sheet, setSheet] = useState(null);
  const [pickedSuccessorId, setPickedSuccessorId] = useState(null);
  const [actionError, setActionError] = useState(false);

  useEffect(() => {
    setCurrentId(activeId);
  }, [activeId]);

  function loadEntries() {
    setLoadError(false);
    return listRutinas()
      .then((rows) => setEntries(rows || []))
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    let cancelled = false;
    loadEntries().then(() => {
      /* state settled above; cancelled only skips late setState races */
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
        <ScreenHeader
          title={t('library.title')}
          leading={<BackButton onClick={() => navigate(-1)} />}
        />
        <div style={{ maxWidth: 480, margin: '0 auto', paddingInline: 'var(--page-pad-x)', paddingTop: 'var(--space-8)', textAlign: 'center' }}>
          <p role="alert" style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-5)' }}>
            {t('library.errorBody')}
          </p>
          <Button variant="outline" onClick={loadEntries}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (entries === null) return null; // still loading — avoids flash

  if (entries.length === 0) {
    // Defensive-only (ux-design.md states matrix): the Shell redirects every
    // tab-root route when no rutina is active, so /library is never reached
    // with an empty library through real navigation.
    return <Navigate to="/import" replace />;
  }

  const ordered = [...entries].sort((a, b) => {
    const aActive = a.id === currentId ? 0 : 1;
    const bActive = b.id === currentId ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const pa = (a.rutina && a.rutina.program && a.rutina.program.phaseNumber) || 0;
    const pb = (b.rutina && b.rutina.program && b.rutina.program.phaseNumber) || 0;
    if (pa !== pb) return pa - pb;
    if (a.importedAt === b.importedAt) return ((a.seq || 0) - (b.seq || 0));
    return a.importedAt > b.importedAt ? -1 : 1; // newest import first (AC9 tie-break)
  });

  function program(entry) {
    return (entry.rutina && entry.rutina.program) || {};
  }
  function phaseLabel(entry) {
    return t('program.phaseLabel', { n: (program(entry).phaseNumber || 0) });
  }
  // Card identity used for accessible names and confirm copy: "Name · Fase n".
  function entryLabel(entry) {
    return String(program(entry).name || '') + ' · ' + phaseLabel(entry);
  }
  // ux-design.md §10 — card accessible name: "{program.name}, {phaseName}, Fase {n}".
  function cardName(entry) {
    const p = program(entry);
    return String(p.name || '') + ', ' + String(p.phaseName || '') + ', ' + phaseLabel(entry);
  }

  async function handleActivateClick(entry) {
    setActionError(false);
    try {
      const live = await getActiveSession();
      if (live) {
        setSheet({ kind: 'session', entry }); // AC11 — name the consequence first
        return;
      }
      await runActivate(entry);
    } catch {
      setActionError(true);
    }
  }

  async function runActivate(entry) {
    setActivatingId(entry.id);
    setActionError(false);
    try {
      await activateRutina(entry.id);
      setCurrentId(entry.id);
      setActivatingId(null);
      setSheet(null);
      if (onActivated) onActivated(); // Shell loadRutina() — AC10 refresh
    } catch {
      setActivatingId(null);
      setActionError(true);
    }
  }

  function handleDeleteClick(entry) {
    setActionError(false);
    setPickedSuccessorId(null);
    const successors = entries.filter((e) => e.id !== entry.id);
    if (successors.length === 0) setSheet({ kind: 'last', entry });
    else if (entry.id === currentId) setSheet({ kind: 'pick', entry, successors });
    else setSheet({ kind: 'inactive', entry });
  }

  async function handleConfirmDelete() {
    const s = sheet;
    if (!s) return;
    if (s.kind === 'pick' && !pickedSuccessorId) return; // AC7 — no silent pick, ever
    setSheet(null);
    setActionError(false);
    try {
      if (s.kind === 'pick') await deleteAndActivateRutina(s.entry.id, pickedSuccessorId);
      else await deleteRutina(s.entry.id);
      if (onActivated) onActivated(); // del-last: refresh turns rutina null → Shell redirects (AC5)
      await loadEntries();
    } catch {
      setActionError(true); // card restored — no optimistic UI (§2 delete-error)
    }
  }

  const pickedEntry = sheet && sheet.kind === 'pick'
    ? sheet.successors.find((e) => e.id === pickedSuccessorId)
    : null;

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
      <ScreenHeader
        title={t('library.title')}
        leading={<BackButton onClick={() => navigate(-1)} />}
      />

      <div style={{ maxWidth: 480, margin: '0 auto', paddingInline: 'var(--page-pad-x)', paddingTop: 'var(--space-6)', display: 'grid', gap: 12 }}>
        <ul
          aria-busy={activatingId != null ? 'true' : undefined}
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}
        >
          {ordered.map((entry) => {
            const isActive = entry.id === currentId;
            const p = program(entry);
            const dayCount = (entry.rutina && entry.rutina.days && entry.rutina.days.length) || 0;
            return (
              <li
                key={entry.id}
                aria-label={cardName(entry)}
                aria-current={isActive ? 'true' : undefined}
                style={{
                  background: isActive ? 'var(--bf-purple-tint)' : 'var(--bf-white)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span dir="auto" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
                    {p.name}
                  </span>
                  {isActive && (
                    <span style={{ flexShrink: 0, font: '700 11px/1 var(--font-sans)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--bf-purple-dark)' }}>
                      {t('library.activaLabel')}
                    </span>
                  )}
                </div>
                <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
                  <span dir="auto">{p.phaseName}</span>
                  {' · ' + phaseLabel(entry) + ' · ' + t('library.metaDays', { n: dayCount }) + ' · ' + t('program.weeksSuffix', { n: p.durationWeeks })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 'var(--space-3)' }}>
                  {!isActive && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={activatingId != null}
                      onClick={() => handleActivateClick(entry)}
                    >
                      {activatingId === entry.id ? t('library.activatingLabel') : t('library.activateAction')}
                    </Button>
                  )}
                  <button
                    type="button"
                    disabled={activatingId != null}
                    aria-label={t('library.deleteAria', { name: p.name, phase: phaseLabel(entry) })}
                    onClick={() => handleDeleteClick(entry)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      minHeight: 44,
                      minWidth: 44,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--bf-ink-3)',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="trash-2" size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <hr aria-hidden="true" style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: 'var(--space-4) 0 0' }} />

        {actionError && (
          <p role="alert" style={{ font: 'var(--text-body-sm)', color: 'var(--bf-danger)', margin: 0 }}>
            {t('library.actionErrorBody')}
          </p>
        )}

        <Button variant="outline" style={{ width: '100%' }} onClick={() => navigate('/import')}>
          <Icon name="plus" size={16} /> {t('library.importCta')}
        </Button>
      </div>

      {sheet && sheet.kind === 'inactive' && (
        <ConfirmSheet
          role="dialog"
          title={t('library.deleteTitle')}
          description={t('library.deleteInactiveBody', { entry: entryLabel(sheet.entry) })}
          primaryLabel={t('common.delete')}
          onPrimary={handleConfirmDelete}
          onCancel={() => setSheet(null)}
          danger
        />
      )}

      {sheet && sheet.kind === 'last' && (
        <ConfirmSheet
          role="dialog"
          title={t('library.deleteTitle')}
          description={t('library.deleteLastBody')}
          primaryLabel={t('common.delete')}
          onPrimary={handleConfirmDelete}
          onCancel={() => setSheet(null)}
          danger
        />
      )}

      {sheet && sheet.kind === 'pick' && (
        <ConfirmSheet
          role="dialog"
          title={t('library.deletePickTitle')}
          description={t('library.deletePickBody')}
          primaryLabel={
            pickedEntry
              ? t('library.deletePickAction') + ' ' + entryLabel(pickedEntry)
              : t('library.deletePickAction')
          }
          onPrimary={handleConfirmDelete}
          primaryDisabled={!pickedEntry}
          onCancel={() => setSheet(null)}
          danger
        >
          <div
            role="radiogroup"
            aria-label={t('library.pickSuccessorAria')}
            style={{ display: 'grid', gap: 8, margin: '0 0 var(--space-5)' }}
          >
            {sheet.successors.map((e) => (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={pickedSuccessorId === e.id}
                onClick={() => setPickedSuccessorId(e.id)}
                style={{
                  minHeight: 44,
                  padding: '10px 12px',
                  textAlign: 'left',
                  font: '600 14px/1.3 var(--font-sans)',
                  borderRadius: 'var(--radius-control)',
                  border: pickedSuccessorId === e.id ? '2px solid var(--bf-purple)' : '1px solid var(--border-control)',
                  background: pickedSuccessorId === e.id ? 'var(--bf-purple-tint)' : 'var(--bf-white)',
                  color: pickedSuccessorId === e.id ? 'var(--bf-purple-dark)' : 'var(--bf-ink)',
                  cursor: 'pointer',
                }}
              >
                <span dir="auto">{program(e).name}</span>
                {' · ' + phaseLabel(e)}
              </button>
            ))}
          </div>
        </ConfirmSheet>
      )}

      {sheet && sheet.kind === 'session' && (
        <ConfirmSheet
          role="dialog"
          title={t('library.activateSessionTitle')}
          description={t('library.activateSessionBody', { entry: entryLabel(sheet.entry) })}
          primaryLabel={t('library.activateAnywayAction')}
          onPrimary={() => runActivate(sheet.entry)}
          cancelLabel={t('common.cancel')}
          onCancel={() => setSheet(null)}
          danger={false}
        />
      )}
    </div>
  );
}

/** SettingsScreen's leading-back control, verbatim pattern (navigate(-1)). */
function BackButton({ onClick }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
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
      <Icon name="chevron-left" size={16} /> {t('common.back')}
    </button>
  );
}
