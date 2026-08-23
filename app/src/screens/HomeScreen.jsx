import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { Badge } from '../../../design-system/components/primitives/Badge.jsx';
import { ScreenHeader } from '../components/ScreenHeader.jsx';
import { resolveTodayDay } from '../lib/today.js';
import { createSession } from '../lib/sessionMachine.js';
import { getActiveSession, listSessions, saveSession } from '../lib/db.js';
import { formatRelativeDays } from '../lib/relativeTime.js';
import { useI18n } from '../i18n/index.js';

/**
 * Active-session ownership moved up to the shell (spec.md AC10-AC13,
 * tech-plan.md Decision 3): `activeSessionStatus`/`activeSession` come from
 * `useActiveSession()` in `App.jsx`, not from a local read here. This is
 * what makes AC10 structural — this screen literally cannot paint a start
 * CTA before the shell knows the answer, because `'loading'` renders a
 * skeleton with no CTA text at all.
 *
 * States: loading (skeleton, no CTA) | active | idle | error+retry
 * (ux-design.md), plus the pre-existing full-screen `loadError` (corrupt
 * rutina, AC24 regression baseline).
 */
export function HomeScreen({ rutina, loadError, onGoImport, activeSessionStatus, activeSession, onRetryActiveSession }) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [lastSession, setLastSession] = useState(null);
  const [pastSessions, setPastSessions] = useState([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (loadError) return;
    let cancelled = false;
    listSessions().then((sessions) => {
      if (cancelled) return;
      setLastSession(sessions.find((s) => s.status !== 'active') || null);
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

  const today = resolveTodayDay(rutina.days, new Date(), pastSessions);
  const exerciseCount = today.day.exercises.length;

  async function handleStart() {
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
    const session = createSession(today.day.label, today.index, today.day.exercises, new Date().toISOString());
    await saveSession(session);
    setStarting(false);
    // Shell owns activeSession (AC10-AC13) — without this, Inicio/other tabs
    // keep showing "no active session" until a hard reload re-mounts the hook.
    onRetryActiveSession();
    navigate('/session');
  }

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 90 }}>
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
              {today.mode === 'today' ? t('home.todayLabel') : t('home.nextLabel')}
            </div>
            <h2 style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 4px' }} dir="auto">{today.day.label}</h2>
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-5)' }}>
              {today.day.intro ? (
                <span dir="auto">{today.day.intro} · </span>
              ) : (
                ''
              )}
              {t(exerciseCount === 1 ? 'home.exerciseCountOne' : 'home.exerciseCountOther', { n: exerciseCount })}
            </p>
            <Button variant="primary" size="lg" style={{ width: '100%' }} disabled={starting} onClick={handleStart}>
              <Icon name="play" size={18} /> {t('home.startAction')}
            </Button>
          </div>
        )}

        {lastSession && (
          <div style={{ background: 'var(--bf-white)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
            <div style={{ font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{t('home.lastSessionLabel')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: lastSession.status === 'abandoned' ? 'var(--text-muted)' : 'var(--bf-success)' }}>
                <Icon name={lastSession.status === 'abandoned' ? 'x' : 'check'} size={20} />
              </span>
              <div>
                <div style={{ font: '700 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
                  <span dir="auto">{lastSession.dayLabel}</span> · {formatRelativeDays(lastSession.startedAt, new Date(), { locale, t })}
                </div>
                <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
                  {t('common.completedOf', {
                    done: lastSession.exercises.filter((e) => e.completedAt).length,
                    total: lastSession.exercises.length,
                  })}
                  {lastSession.status === 'abandoned' ? ` · ${t('common.unfinishedSuffix')}` : ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
