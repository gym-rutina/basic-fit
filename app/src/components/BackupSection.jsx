import React, { useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { RestoreSheet } from './RestoreSheet.jsx';
import { readAllForBackup } from '../lib/db.js';
import { readAllSettings } from '../lib/settingsRegistry.js';
import { buildBackup } from '../lib/backupFormat.js';
import { APP_VERSION } from '../lib/appVersion.js';
import { readInviteUrl } from '../lib/inviteStorage.js';
import { useI18n } from '../i18n/index.js';

/**
 * full-data-backup S1 — the /settings "Copia de seguridad" section
 * (ux-design.md §2, mockup frames A/B).
 *
 * Self-contained like ClubAccessSection: heading → actions → conditional
 * bearer warning → disclosure → own trailing <hr>, so SettingsScreen's edit
 * stays a single render line.
 *
 * - "Descargar copia completa" (AC1/AC3/AC4/AC5/AC6): readAllForBackup() +
 *   readAllSettings() → buildBackup({ db, settings, appVersion }) → Blob →
 *   <a download="rutina-backup-YYYY-MM-DD.json"> (the ExportScreen.jsx:59-69
 *   idiom). Zero-sessions export is ALLOWED (no redirect). Busy label
 *   backup.exportingLabel; failure → role="alert" backup.errExportFailed and
 *   the button re-enables.
 * - "Restaurar copia…" mounts <RestoreSheet onClose onRestored={reload}>.
 * - Bearer warning (AC13): rendered iff readInviteUrl() != null, between the
 *   two buttons. Degrades to absent when club-invite-link has not shipped.
 * - NO navigator.share anywhere (OQ-6). Copy never contains "importar" (AC16).
 */
export function BackupSection() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [showRestore, setShowRestore] = useState(false);

  const hasBearerCapability = readInviteUrl() != null;

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    setExportFailed(false);
    try {
      const db = await readAllForBackup();
      const settings = readAllSettings();
      const envelope = buildBackup({ db, settings, appVersion: APP_VERSION });
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rutina-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      <span
        style={{
          font: 'var(--text-label)',
          letterSpacing: 'var(--tracking-label)',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {t('backup.sectionTitle')}
      </span>

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <Button
          variant="outline"
          disabled={busy}
          style={{ width: '100%', minHeight: 44 }}
          onClick={handleExport}
        >
          <Icon name="download" size={16} /> {busy ? t('backup.exportingLabel') : t('backup.exportAction')}
        </Button>

        {hasBearerCapability && (
          <div
            role="note"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              background: 'var(--bf-danger-tint)',
              border: '1px solid var(--bf-danger)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
            }}
          >
            <span style={{ color: 'var(--bf-danger)', flexShrink: 0, marginTop: 1 }}>
              <Icon name="alert-triangle" size={16} />
            </span>
            <span style={{ font: '700 13px/1.4 var(--font-sans)', color: 'var(--bf-danger)' }}>
              {t('backup.bearerWarning')}
            </span>
          </div>
        )}

        <Button
          variant="outline"
          style={{ width: '100%', minHeight: 44 }}
          onClick={() => setShowRestore(true)}
        >
          <Icon name="download" size={16} style={{ transform: 'rotate(180deg)' }} /> {t('backup.restoreAction')}
        </Button>
      </div>

      {exportFailed && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            background: 'var(--bf-danger-tint)',
            border: '1px solid var(--bf-danger)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            font: 'var(--text-body-sm)',
            color: 'var(--bf-danger)',
          }}
        >
          <Icon name="alert-triangle" size={16} style={{ flexShrink: 0 }} /> {t('backup.errExportFailed')}
        </div>
      )}

      <p style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', margin: 'var(--space-5) 0 0' }}>
        {t('backup.disclosureBody')}
      </p>

      <hr aria-hidden="true" style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: 'var(--space-8) 0 0' }} />

      {showRestore && (
        <RestoreSheet
          onClose={() => setShowRestore(false)}
          onRestored={() => window.location.reload()}
        />
      )}
    </section>
  );
}
