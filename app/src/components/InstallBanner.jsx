import React from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { useI18n } from '../i18n/index.js';

/**
 * Shown when Chromium fires `beforeinstallprompt` and the app is not yet
 * installed. Gives users an explicit "Add to Home Screen" path (spec.md
 * Render AC) instead of hiding behind the browser menu.
 */
export function InstallBanner() {
  const { t } = useI18n();
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div
      role="region"
      aria-label={t('install.ariaLabel')}
      style={{
        background: 'var(--bf-purple-tint)',
        borderBottom: '1px solid var(--border-default)',
        paddingBlock: '10px',
        paddingInline: 'var(--page-pad-x)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <Icon name="smartphone" size={20} style={{ color: 'var(--bf-purple)', flexShrink: 0 }} />
      <p style={{ flex: 1, margin: 0, font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', minWidth: 0 }}>
        {t('install.body')}
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button variant="primary" onClick={promptInstall} style={{ minHeight: 44 }}>
          {t('install.action')}
        </Button>
        <Button variant="ghost" onClick={dismiss} style={{ minHeight: 44 }}>
          {t('install.dismiss')}
        </Button>
      </div>
    </div>
  );
}
