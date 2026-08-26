import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { Badge } from '../../../design-system/components/primitives/Badge.jsx';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { resolveNextDayIndex } from '../lib/nextDay.js';
import { createSession } from '../lib/sessionMachine.js';
import { getActiveSession, listSessions, saveSession } from '../lib/db.js';
import { formatRelativeDays } from '../lib/relativeTime.js';
import { validateInviteUrl } from '../lib/inviteUrl.js';
import { readInviteUrl } from '../lib/inviteStorage.js';
import { useI18n } from '../i18n/index.js';

/**
 * Active-session ownership moved up to the shell (spec.md AC10-AC13,
 * tech-plan.md Decision 3): `activeSessionStatus`/`activeSession` come from
 * `useActiveSession()` in `App.jsx`, not from a local read here. This is
 * what makes AC10 structural — this screen literally cannot paint a start
 * CTA before the shell knows the answer, because `'loading'` renders a
 * skeleton with no CTA text at all.
 *
 * Day proposal (home-next-workout-and-picker): pure rotation from completed
 * history via `resolveNextDayIndex` — calendar-blind (AC3), always labelled
 * "Próximo" (AC4). The idle card carries an inline day-picker disclosure for
 * ≥2-day rutinas (AC8; hidden at 1 day per UAT amendment), and the recent-
 * sessions section shows up to 2 non-active cards (AC15).
 *
 * States: loading (skeleton, no CTA/picker) | active | idle (+picker) |
 * error+retry | starting (CTA + every row disabled) | empty history (no
 * recent section) | full-screen `loadError` (corrupt rutina, AC24 baseline)
 * — ux-design.md states matrix.
 */
export function HomeScreen({ rutina, loadError, onGoImport, activeSessionStatus, activeSession, onRetryActiveSession }) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [recentSessions, setRecentSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [starting, setStarting] = useState(false);
  // AC11 — picker expansion is component-local only; navigation unmounts
  // Home, so nothing is persisted and no reset logic is needed.
  const [pickerExpanded, setPickerExpanded] = useState(false);

  // club-invite-link D-C — defense-in-depth: the stored string is re-validated
  // at OPEN time through the same pure choke point Settings saves with, so a
  // value planted by any path other than our save flow (hand-edited
  // localStorage, a future import, a bug) can never become an href. Read-once
  // per mount is correct (D-E): every path from Settings back to Inicio goes
  // through the router, which unmounts Home — staleness via UI flow is
  // impossible, so no storage listener belongs here.
  const invite = useMemo(() => {
    const v = readInviteUrl();
    return v && validateInviteUrl(v).ok ? v : null;
  }, []);

  useEffect(() => {
    if (loadError) return;
    let cancelled = false;
    listSessions().then((sessions) => {
      if (cancelled) return;
      setRecentSessions(sessions.filter((s) => s.status !== 'active').slice(0, 2));
      setPastSessions(sessions.map((s) => ({ dayIndex: s.dayIndex, status: s.status })));
    });
    return () => {
      cancelled = true;
    };
  }, [loadError, rutina]);

  if (loadError) {
    return (
      <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBlock: 'var(--page-gutter)', paddingInline: 'var(--page-pad-x)', textAlign: 'center' }}>
        <div style={{ color: 'var(--bf-danger)', marginBottom: 12 }}>
          <Icon name="alert-triangle" size={36} />
        </div>
        <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 8px' }}>{t('home.loadErrorTitle')}</h2>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', maxWidth: 320, margin: '0 0 20px' }}>
          {t('home.loadErrorBody')}
        </p>
        <Button variant="primary" onClick={onGoImport}>
          {t('home.importAction')}
        </Button>
      </div>
    );
  }

  const proposedIndex = resolveNextDayIndex(rutina.days.length, pastSessions);
  const proposedDay = rutina.days[proposedIndex];
  const exerciseCount = proposedDay.exercises.length;

  async function handleStart(dayIndex) {
    // AC11 — data-integrity backstop: the render-level guard (AC10) alone is
    // racy, so re-check for an active session immediately before creating
    // one, rather than trusting the props snapshot at tap time.
    const existing = await getActiveSession();
    if (existing) {
      onRetryActiveSession();
      navigate('/session');
      return;
    }
    setStarting(true);
    const day = rutina.days[dayIndex];
    const session = createSession(day.label, dayIndex, day.exercises, new Date().toISOString());
    await saveSession(session);
    setStarting(false);
    // Shell owns activeSession (AC10-AC13) — without this, Inicio/other tabs
    // keep showing "no active session" until a hard reload re-mounts the hook.
    onRetryActiveSession();
    navigate('/session');
  }

  return (
    // club-invite-amendments A2 — root clearance compensates for the pinned
    // Acceso layer (158 ≈ 48px button row + bottom offset above tab bar) so
    // ÚLTIMAS SESIONES is never permanently covered; unset keeps today's 90px.
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: invite ? 158 : 90 }}>
      <ScreenHeader
        title={<span dir="auto">{rutina.program.name}</span>}
        trailing={<Badge tone="brand">{t('program.phaseLabel', { n: rutina.program.phaseNumber })}</Badge>}
        onSettings={() => navigate('/settings')}
      />

      <div style={{ paddingBlock: 'var(--space-6)', paddingInline: 'var(--page-pad-x)', display: 'grid', gap: 'var(--space-5)' }}>
        {activeSessionStatus === 'loading' && (
          <div
            aria-busy="true"
            style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-card)', display: 'grid', gap: 10 }}
          >
            <div style={{ width: '35%', height: 12, borderRadius: 4, background: 'var(--bf-grey-2)' }} />
            <div style={{ width: '70%', height: 20, borderRadius: 4, background: 'var(--bf-grey-2)' }} />
            <div style={{ width: '50%', height: 14, borderRadius: 4, background: 'var(--bf-grey-2)' }} />
            <div style={{ width: '100%', height: 48, borderRadius: 'var(--radius-btn)', background: 'var(--bf-grey-2)', marginTop: 8 }} />
          </div>
        )}

        {activeSessionStatus === 'error' && (
          <div style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-card)', textAlign: 'center' }}>
            <div style={{ color: 'var(--bf-danger)', marginBottom: 8 }}>
              <Icon name="alert-triangle" size={20} />
            </div>
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '0 0 var(--space-5)' }}>
              {t('home.activeSessionErrorBody')}
            </p>
            <Button variant="outline" style={{ width: '100%' }} onClick={onRetryActiveSession}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {activeSessionStatus === 'ready' && activeSession && (
          <div style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--bf-purple)', marginBottom: 4 }}>
              {t('home.inProgressLabel')}
            </div>
            <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 4px' }} dir="auto">{activeSession.dayLabel}</h2>
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-5)' }}>
              {t('common.completedOfSpaced', {
                done: activeSession.exercises.filter((e) => e.completedAt).length,
                total: activeSession.exercises.length,
              })}
            </p>
            <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => navigate('/session')}>
              <Icon name="play" size={18} /> {t('home.resumeAction')}
            </Button>
          </div>
        )}

        {activeSessionStatus === 'ready' && !activeSession && (
          <div style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
              {t('home.nextLabel')}
            </div>
            <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 4px' }} dir="auto">{proposedDay.label}</h2>
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-5)' }}>
              {proposedDay.intro ? (
                <span dir="auto">{proposedDay.intro} · </span>
              ) : (
                ''
              )}
              {t(exerciseCount === 1 ? 'home.exerciseCountOne' : 'home.exerciseCountOther', { n: exerciseCount })}
            </p>
            <Button variant="primary" size="lg" style={{ width: '100%' }} disabled={starting} onClick={() => handleStart(proposedIndex)}>
              <Icon name="play" size={18} /> {t('home.startAction')}
            </Button>

            {rutina.days.length >= 2 && (
              <>
                <Button
                  variant="ghost"
                  style={{ width: '100%', minHeight: 44, marginTop: 4 }}
                  aria-expanded={pickerExpanded}
                  aria-controls="home-day-picker"
                  onClick={() => setPickerExpanded((v) => !v)}
                >
                  {t('home.chooseDayAction')}
                  <Icon name={pickerExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
                </Button>
                {pickerExpanded && (
                  <div id="home-day-picker" style={{ marginTop: 'var(--space-4)', display: 'grid', borderTop: '1px solid var(--border-default)' }}>
                    {rutina.days.map((day, i) => {
                      const isProposed = i === proposedIndex;
                      // Explicit accessible name: identity + count must read as one
                      // phrase, and the proposed marker must not be visual-only
                      // (AC12). Whitespace-only separation before the count keeps
                      // screen-reader phrasing natural. Built by concatenation,
                      // NOT a template literal — strayLiterals' naive backtick
                      // pairing reads the span up to the next template as one
                      // giant "string" and trips its Spanish heuristic.
                      const rowName =
                        day.label +
                        (day.intro ? ' — ' + day.intro : '') +
                        ' ' +
                        t('program.exerciseAbbrev', { n: day.exercises.length }) +
                        (isProposed ? ', ' + t('home.nextLabel') : '');
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={starting}
                          aria-label={rowName}
                          onClick={() => handleStart(i)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            width: '100%',
                            minHeight: 44,
                            textAlign: 'left',
                            padding: '10px 12px',
                            background: isProposed ? 'var(--bf-purple-tint)' : 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--border-default)',
                            borderBottomStyle: i === rutina.days.length - 1 ? 'none' : undefined,
                            cursor: starting ? 'default' : 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ minWidth: 0 }}>
                            <span dir="auto" style={{ display: 'block', font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
                              {day.label}
                              {day.intro ? ' — ' + day.intro : ''}
                            </span>
                            <span style={{ display: 'block', font: 'var(--text-body-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
                              {t('program.exerciseAbbrev', { n: day.exercises.length })}
                            </span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {isProposed && (
                              <span style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--bf-purple)' }}>
                                {t('home.nextLabel')}
                              </span>
                            )}
                            <span style={{ color: 'var(--text-muted)' }}>
                              <Icon name="chevron-right" size={18} />
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {recentSessions.length > 0 && (
          <div style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
            <div style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{t('home.recentSessionsLabel')}</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {recentSessions.map((session) => (
                <div key={session.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: session.status === 'abandoned' ? 'var(--text-muted)' : 'var(--bf-success)' }}>
                    <Icon name={session.status === 'abandoned' ? 'x' : 'check'} size={20} />
                  </span>
                  <div>
                    <div style={{ font: '700 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
                      <span dir="auto">{session.dayLabel}</span> · {formatRelativeDays(session.startedAt, new Date(), { locale, t })}
                    </div>
                    <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
                      {t('common.completedOf', {
                        done: session.exercises.filter((e) => e.completedAt).length,
                        total: session.exercises.length,
                      })}
                      {session.status === 'abandoned' ? ` · ${t('common.unfinishedSuffix')}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* club-invite-link D-D / club-invite-amendments A2 — a plain anchor
          (Button renders <a> when href is passed) with zero click handlers:
          AC11/AC13 hold by construction, the browser hands off externally and
          React never hears about it. Rendered for EVERY main-card branch
          (loading/error/active/idle) — gate access does not depend on
          session-db health — and structurally absent when nothing valid is
          stored (AC8). The full-screen loadError early return above stays
          untouched. The FIXED wrapper attaches the button above the tab bar
          (90px clearance + safe-area inset, z 150 below the bar's 200): gate
          access is Inicio's terminal action, not an inline row. The wrapper is
          pointerEvents:none so its dead side-gutters never eat taps; the
          button re-enables hits for itself. */}
      {invite && (
        <div
          data-club-access-pinned="true"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
            zIndex: 150,
            paddingInline: 'var(--page-pad-x)',
            pointerEvents: 'none',
          }}
        >
          <Button variant="outline" style={{ width: '100%', pointerEvents: 'auto' }} href={invite} target="_blank" rel="noopener noreferrer">
            <Icon name="qr-code" size={18} aria-hidden /> {t('home.accessAction')}
          </Button>
        </div>
      )}
    </div>
  );
}
