import React, { useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { ConfirmSheet } from '../components/ConfirmSheet.jsx';
import { GuideOverlay } from '../components/GuideOverlay.jsx';
import { OnboardingOverlay } from '../components/OnboardingOverlay.jsx';
import { validateImportedRutina } from '../lib/validateImport.js';
import { saveActiveRutina, getActiveRutina, getActiveSession, listSessions } from '../lib/db.js';
import exampleRutina from '../../../data/examples/phase1-monday.json';
import { useI18n } from '../i18n/index.js';

/**
 * First-run empty state, and reachable later (from Home, not wired as a
 * bottom tab — ux-design.md) to replace the active program. States: empty |
 * loading | error | success (ux-design.md's States Matrix).
 *
 * pwa-ui-language AC8: the guide link now reads the active UI locale via
 * `useI18n()` rather than `detectGuideLocale(navigator.language)` directly —
 * a user who switched the app to English gets the English guide regardless
 * of what the browser reports.
 */
export function ImportScreen({ onImported }) {
  const { t, locale } = useI18n();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  // Onboarding on-demand revisit (spec AC7) — mirrors showGuide exactly:
  // same OnboardingOverlay component, reopened here without touching the
  // persisted seen-flag (that's the overlay's own internal concern).
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingRutina, setPendingRutina] = useState(null); // parsed+valid, awaiting discard-warning confirmation
  const fileInputRef = useRef(null);
  const guideLinkRef = useRef(null);
  const onboardingLinkRef = useRef(null);

  function handleFilePick(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ''));
      setErrors([]);
    };
    reader.readAsText(file);
    e.target.value = ''; // allow re-picking the same filename later
  }

  function loadExample() {
    setText(JSON.stringify(exampleRutina, null, 2));
    setErrors([]);
  }

  async function commitImport(rutina) {
    await saveActiveRutina(rutina);
    setPendingRutina(null);
    onImported && onImported();
  }

  function handleImport() {
    setLoading(true);
    // Deferred one tick so the "Validando..." state actually paints before
    // this (synchronous, fast) validation resolves — ux-design.md asks for
    // a brief spinner specifically to avoid a perceived double-tap, even
    // though the check itself has no real latency.
    setTimeout(async () => {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        setErrors([t('import.invalidJson', { message: err.message })]);
        setLoading(false);
        return;
      }

      const result = validateImportedRutina(parsed);
      if (!result.valid) {
        setErrors(result.errors);
        setLoading(false);
        return;
      }
      setErrors([]);

      // Re-import discard warning (spec.md Render AC): only relevant if
      // there's already an active rutina with a stake in it — an
      // in-progress session, or any session history at all.
      const [existing, activeSession, sessions] = await Promise.all([
        getActiveRutina(),
        getActiveSession(),
        listSessions(),
      ]);
      const hasStake = Boolean(activeSession) || sessions.length > 0;
      setLoading(false);

      if (existing && hasStake) {
        setPendingRutina(parsed);
      } else {
        await commitImport(parsed);
      }
    }, 0);
  }

  return (
    <div style={{ background: 'var(--bf-white)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBlock: 'var(--space-10) 100px', paddingInline: 'var(--page-pad-x)' }}>
      <div style={{ font: '800 15px/1 var(--font-display)', color: 'var(--bf-orange)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 'var(--space-6)' }}>Basic-Fit</div>
      <div style={{ color: 'var(--bf-purple)', marginBottom: 12 }}>
        <Icon name="dumbbell" size={40} strokeWidth={1.6} />
      </div>
      <h1 style={{ font: 'var(--text-h2)', textTransform: 'uppercase', color: 'var(--bf-ink)', textAlign: 'center', margin: '0 0 6px' }}>{t('import.title')}</h1>
      <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 var(--space-6)', maxWidth: 340 }}>
        {t('import.subtitle')}
      </p>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <label htmlFor="rutina-json" style={{ display: 'block', font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
          rutina.json
        </label>
        <textarea
          id="rutina-json"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={t('import.placeholder')}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            font: '14px/1.5 monospace',
            color: 'var(--bf-ink)',
            border: `1px solid ${errors.length ? 'var(--bf-danger)' : 'var(--border-control)'}`,
            borderRadius: 'var(--radius-control)',
            padding: 12,
            resize: 'vertical',
          }}
        />

        {errors.length > 0 && (
          <div role="alert" style={{ marginTop: 10, background: 'var(--bf-danger-tint)', border: '1px solid var(--bf-danger)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '700 13px/1.3 var(--font-sans)', color: 'var(--bf-danger)', marginBottom: 6 }}>
              <Icon name="alert-triangle" size={16} />
              {t(errors.length === 1 ? 'import.errorCountOne' : 'import.errorCountOther', { n: errors.length })}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              {errors.map((e, i) => (
                <li key={i} style={{ font: '13px/1.4 monospace', color: 'var(--bf-ink-2)' }}>
                  {e}
                </li>
              ))}
            </ul>
            <p style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', margin: '8px 0 0' }}>
              {t('import.errorHint')}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFilePick} style={{ display: 'none' }} />
          <Button variant="outline" style={{ width: '100%' }} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            <Icon name="download" size={16} style={{ transform: 'rotate(180deg)' }} /> {t('import.chooseFile')}
          </Button>
          <Button variant="primary" disabled={!text || loading} style={{ width: '100%' }} onClick={handleImport}>
            {loading ? t('import.validating') : t('import.importAction')}
          </Button>
          {!text && (
            <Button variant="ghost" style={{ width: '100%' }} onClick={loadExample}>
              {t('import.loadExample')}
            </Button>
          )}
        </div>

        <p style={{ textAlign: 'center', font: 'var(--text-body-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-6)' }}>
          {t('onboarding.firstTime')}
          <br />
          <a
            ref={onboardingLinkRef}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setShowOnboarding(true);
            }}
            style={{ color: 'var(--text-link)', fontWeight: 600 }}
          >
            {t('onboarding.howItWorksLink')}
          </a>
        </p>

        <p style={{ textAlign: 'center', font: 'var(--text-body-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-6)' }}>
          {t('guide.noRutina')}
          <br />
          <a
            ref={guideLinkRef}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setShowGuide(true);
            }}
            style={{ color: 'var(--text-link)', fontWeight: 600 }}
          >
            {t('guide.linkText')}
          </a>
        </p>
      </div>

      {showGuide && (
        <GuideOverlay
          onClose={() => {
            setShowGuide(false);
            guideLinkRef.current?.focus();
          }}
        />
      )}

      {showOnboarding && (
        <OnboardingOverlay
          onClose={() => {
            setShowOnboarding(false);
            onboardingLinkRef.current?.focus();
          }}
        />
      )}

      {pendingRutina && (
        <ConfirmSheet
          title={t('import.replaceTitle')}
          description={t('import.replaceBody')}
          primaryLabel={t('import.replaceAction')}
          onPrimary={() => commitImport(pendingRutina)}
          cancelLabel={t('common.cancel')}
          onCancel={() => setPendingRutina(null)}
        />
      )}
    </div>
  );
}
