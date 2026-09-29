import React, { useRef, useState } from 'react';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { ChoiceCard } from '../../../design-system/components/primitives/ChoiceCard.jsx';
import { OnboardingOverlay } from '../components/OnboardingOverlay.jsx';
import { RestoreSheet } from '../components/RestoreSheet.jsx';
import { useHeadingFocus } from '../lib/useHeadingFocus.js';
import { useI18n } from '../i18n/index.js';

/**
 * First-run fork (import-flow-guided-first F1/F2, AC1/AC2/AC9/AC12): the
 * guided path (prepare a prompt) is the recommended card, "I already have a
 * rutina.json" the secondary one. Owns the restore-backup sheet and the
 * onboarding revisit link (moved here from ImportScreen — D4, AC12).
 * Router-free: App.jsx wires `onPrepare` / `onImport` to routes (tech-plan AD-2).
 *
 * Props: { onPrepare: () => void, onImport: () => void }
 */
export function ImportFork({ onPrepare, onImport }) {
  const { t } = useI18n();
  const headingRef = useHeadingFocus();
  const [showOnboarding, setShowOnboarding] = useState(false);
  // full-data-backup S3 — the restore entry opens the restore flow directly.
  const [showRestore, setShowRestore] = useState(false);
  const onboardingLinkRef = useRef(null);

  return (
    <div style={{ background: 'var(--bf-white)', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box', paddingBlock: 'var(--space-10) var(--space-8)', paddingInline: 'var(--page-pad-x)' }}>
      <div style={{ font: '800 15px/1 var(--font-display)', color: 'var(--bf-orange)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 'var(--space-6)' }}>Basic-Fit</div>
      <h1 ref={headingRef} tabIndex={-1} style={{ font: 'var(--text-h2)', textTransform: 'uppercase', color: 'var(--bf-ink)', textAlign: 'center', margin: '0 0 6px', outline: 'none' }}>
        {t('import.forkTitle')}
      </h1>
      <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 var(--space-6)', maxWidth: 340 }}>
        {t('import.forkSubtitle')}
      </p>

      <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 14 }}>
        <ChoiceCard
          recommended
          badge={t('import.forkBadge')}
          title={t('import.forkPrepareTitle')}
          body={t('import.forkPrepareBody')}
          meta={t('import.forkPrepareMeta')}
          ctaLabel={t('import.forkPrepareCta')}
          onSelect={onPrepare}
        />
        <ChoiceCard
          title={t('import.forkImportTitle')}
          body={t('import.forkImportBody')}
          ctaLabel={t('import.forkImportCta')}
          onSelect={onImport}
        />

        <div style={{ display: 'grid', justifyItems: 'center', gap: 4, marginTop: 'var(--space-2)' }}>
          <Button variant="ghost" style={{ minHeight: 44 }} onClick={() => setShowRestore(true)}>
            {t('import.restoreAction')}
          </Button>
          <p style={{ textAlign: 'center', font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: 0 }}>
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
        </div>
      </div>

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
