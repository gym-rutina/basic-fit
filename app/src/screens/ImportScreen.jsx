import React, { useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { GuideOverlay } from '../components/GuideOverlay.jsx';
import { OnboardingOverlay } from '../components/OnboardingOverlay.jsx';
import { RestoreSheet } from '../components/RestoreSheet.jsx';
import { validateImportedRutina } from '../lib/validateImport.js';
import { activateRutina, listRutinas, saveRutinaEntry } from '../lib/db.js';
import exampleRutina from '../../../data/examples/phase1-monday.json';
import { useI18n } from '../i18n/index.js';

/**
 * First-run empty state, and reachable later (from Home or /library's Import
 * CTA) to add another rutina to the library. States: empty | loading | error |
 * success-auto | success-panel | save-error (ux-design.md §3 states matrix).
 *
 * multi-rutina-library D-G — import ADDS to the library; it never replaces,
 * so the old replace-warning ConfirmSheet and its pendingRutina path are
 * DELETED (AC22 — the warning would lie now). One documented activation rule
 * (AC23), stated in the panel copy: library EMPTY → silent save+activate,
 * byte-identical first-run behaviour (AC25); library NON-EMPTY → success
 * panel offers "Activar ahora" / "Guardar sin activar". The navigation target
 * rides onImported(target): '/' for activations, '/library' for save-only —
 * landing the user next to the entry they just added, visibly NOT active.
 *
 * Validation block untouched (AC24): validateImportedRutina stays the single
 * gate and an invalid payload creates no entry.
 *
 * pwa-ui-language AC8: the guide link follows the ACTIVE UI LOCALE via
 * `useI18n()`.
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
  // full-data-backup S3 (ux-design.md §4) — the empty-state "Restaurar copia…"
  // ghost entry opens the restore flow directly, bypassing the textarea.
  const [showRestore, setShowRestore] = useState(false);
  // Validated payload awaiting the user's activate/save-only choice (the
  // non-empty-library branch of D-G). null = panel hidden.
  const [validatedRutina, setValidatedRutina] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
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

  async function persist(rutina, { activate }) {
    const entry = await saveRutinaEntry(rutina);
    if (activate) await activateRutina(entry.id);
    setValidatedRutina(null);
    onImported && onImported(activate ? '/' : '/library');
  }

  async function handlePanelChoice(activate) {
    if (!validatedRutina || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await persist(validatedRutina, { activate });
    } catch {
      setSaveError(true); // both buttons re-enable; payload kept for retry
    } finally {
      setSaving(false);
    }
  }

  const handleActivateNow = () => handlePanelChoice(true);
  const handleSaveWithoutActivating = () => handlePanelChoice(false);

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
      setSaveError(false);

      // D-G dual path — decided by the LIBRARY, never by session history
      // (importing no longer touches the active rutina or a running session,
      // so no guard is needed anymore; ux-design.md §3 last row).
      let librarySize = 0;
      try {
        const entries = await listRutinas();
        librarySize = Array.isArray(entries) ? entries.length : 0;
      } catch {
        librarySize = 0; // unreadable library behaves like first-run: add + activate
      }

      if (librarySize === 0) {
        setLoading(false);
        try {
          await persist(parsed, { activate: true });
        } catch {
          setSaveError(true);
        }
      } else {
        setLoading(false);
        setValidatedRutina(parsed); // success panel replaces nothing — form stays readable above it
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
            <>
              <Button variant="ghost" style={{ width: '100%' }} onClick={loadExample}>
                {t('import.loadExample')}
              </Button>
              <Button variant="ghost" style={{ width: '100%' }} onClick={() => setShowRestore(true)}>
                {t('import.restoreAction')}
              </Button>
            </>
          )}
        </div>

        {/* multi-rutina-library D-G — success panel (library non-empty only).
            In-form section, NOT a sheet: the user may want to re-read the
            validated JSON above it (ux-design.md §3). States the rule in
            copy, then offers activate vs save-only. */}
        {validatedRutina && (
          <div
            data-testid="import-success-panel"
            style={{
              marginTop: 'var(--space-6)',
              background: 'var(--bf-grey-1)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
              <span style={{ color: 'var(--bf-success)', flexShrink: 0 }}>
                <Icon name="check-circle" size={18} />
              </span>
              {t('import.successTitle')}
            </div>
            <div dir="auto" style={{ font: '700 15px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>
              {(validatedRutina.program && validatedRutina.program.name) || ''}
            </div>
            <div style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>
              {t('library.metaDays', { n: (validatedRutina.days && validatedRutina.days.length) || 0 })}
              {' · '}
              {t('program.weeksSuffix', { n: (validatedRutina.program && validatedRutina.program.durationWeeks) || 0 })}
            </div>
            <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {t('import.successSavedToLibrary')}
              {' '}
              {t('import.successNoChange')}
            </p>
            {saveError && (
              <p role="alert" style={{ font: 'var(--text-body-sm)', color: 'var(--bf-danger)', margin: 0 }}>
                {t('import.successSaveError')}
              </p>
            )}
            <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
              <Button variant="primary" disabled={saving} style={{ width: '100%' }} onClick={handleActivateNow}>
                {t('import.successActivateNow')}
              </Button>
              <Button variant="outline" disabled={saving} style={{ width: '100%' }} onClick={handleSaveWithoutActivating}>
                {t('import.successSaveWithout')}
              </Button>
            </div>
          </div>
        )}

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

      {showRestore && (
        <RestoreSheet
          onClose={() => setShowRestore(false)}
          onRestored={() => window.location.reload()}
        />
      )}
    </div>
  );
}
