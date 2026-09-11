import React, { useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { SheetShell } from './sheet/SheetShell.jsx';
import { ConfirmSheet } from './ConfirmSheet.jsx';
import { parseBackup } from '../lib/backupFormat.js';
import { validateImportedRutina } from '../lib/validateImport.js';
import { readAllForBackup, restoreFromBackup } from '../lib/db.js';
import { writeAllSettings } from '../lib/settingsRegistry.js';
import { useI18n } from '../i18n/index.js';

/**
 * full-data-backup S2 — the restore flow (ux-design.md §3, mockup C/D/E).
 *
 * Props: { onClose(): void, onRestored(): void }
 *
 * RestoreSheet OWNS its own hidden <input type=file accept=".json">. Phases:
 *  - pick    — a SheetShell role="dialog": heading + "Elegir archivo de copia"
 *              (triggers the input) + Cancelar. This is what the S3 "opens
 *              flow" test asserts.
 *  - reject  — same SheetShell, body swapped to a danger-tint role="alert"
 *              block, message by parseBackup's error.kind. Nothing written.
 *  - confirm — <ConfirmSheet> (role=alertdialog): file summary + loss/empty
 *              line, primary danger, busy while applying, error on failure.
 *  - done    — a polite aria-live region ("Copia restaurada."); the host then
 *              window.location.reload()s (AD-6).
 *
 * Ordering (AD-9): settingsRegistry.writeAllSettings runs ONLY AFTER
 * db.restoreFromBackup resolves — localStorage is not in the IDB transaction,
 * so it can't join AC9's all-or-nothing. writeAllSettings never throws: a
 * per-key failure loses that one setting silently and the restore is still
 * "done" because the DB (the load-bearing part) committed.
 */
export function RestoreSheet({ onClose, onRestored }) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const [phase, setPhase] = useState('pick'); // pick | reject | confirm | done
  const [rejectKind, setRejectKind] = useState(null);
  const [rejectDetail, setRejectDetail] = useState('');
  const [envelope, setEnvelope] = useState(null);
  const [localCounts, setLocalCounts] = useState({ rutinas: 0, sessions: 0 });
  const [applying, setApplying] = useState(false);
  const [applyFailed, setApplyFailed] = useState(false);

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      const result = parseBackup(text, validateImportedRutina);
      if (!result.ok) {
        setRejectKind(result.error.kind);
        setRejectDetail(result.error.detail || '');
        setPhase('reject');
        return;
      }
      let counts = { rutinas: 0, sessions: 0 };
      try {
        const local = await readAllForBackup();
        counts = {
          rutinas: Array.isArray(local && local.rutinas) ? local.rutinas.length : 0,
          sessions: Array.isArray(local && local.sessions) ? local.sessions.length : 0,
        };
      } catch {
        counts = { rutinas: 0, sessions: 0 };
      }
      setEnvelope(result.envelope);
      setLocalCounts(counts);
      setPhase('confirm');
    };
    reader.onerror = () => {
      setRejectKind('invalid-json');
      setRejectDetail('');
      setPhase('reject');
    };
    reader.readAsText(file);
  }

  async function handleConfirm() {
    if (applying) return;
    setApplying(true);
    setApplyFailed(false);
    try {
      await restoreFromBackup(envelope.data);
    } catch {
      setApplyFailed(true);
      setApplying(false);
      return; // AC9 — sheet stays open, primary re-enabled as retry, nothing else ran
    }
    // AD-9 — settings AFTER the IDB tx commits; writeAllSettings never throws.
    writeAllSettings(envelope.data && envelope.data.settings);
    setApplying(false);
    setPhase('done');
    window.setTimeout(onRestored, 800); // host does window.location.reload()
  }

  if (phase === 'done') {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          background: 'var(--bf-white)',
          borderTop: '1px solid var(--border-default)',
          padding: 'var(--space-5) var(--page-pad-x)',
          font: 'var(--text-body-sm)',
          color: 'var(--bf-ink)',
          textAlign: 'center',
          zIndex: 300,
        }}
      >
        {t('backup.doneAnnouncement')}
      </div>
    );
  }

  if (phase === 'confirm') {
    const fileRutinas = Array.isArray(envelope.data.rutinas) ? envelope.data.rutinas.length : 0;
    const fileActive = envelope.data.activeRutinaId != null ? 1 : 0;
    const fileSessions = Array.isArray(envelope.data.sessions) ? envelope.data.sessions.length : 0;
    const fecha = formatExportDate(envelope.exportedAt);
    const hasLocalData = localCounts.rutinas > 0 || localCounts.sessions > 0;

    // Render the file-summary sentence with the sessions COUNT in its own
    // element: `backup.confirmContents` and `backup.confirmLoss` both carry
    // "{n} sesiones", so leaving both as plain text would make a bare
    // getByText(/34 sesiones/i) ambiguous. Splitting on the {sesiones} token
    // (guaranteed present in every locale by catalogs.test.js's token check)
    // keeps the summary count out of that collision.
    const summary = t('backup.confirmContents', { rutinas: fileRutinas, activa: fileActive, fecha });
    const [summaryHead, summaryTail = ''] = summary.split('{sesiones}');

    return (
      <ConfirmSheet
        title={t('backup.confirmTitle')}
        primaryLabel={
          applying
            ? t('backup.applyingLabel')
            : applyFailed
              ? t('backup.retryAction')
              : t('backup.confirmPrimary')
        }
        onPrimary={handleConfirm}
        cancelLabel={t('common.cancel')}
        onCancel={onClose}
        danger
        busy={applying}
        error={applyFailed ? t('backup.errApplyFailed') : undefined}
      >
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '0 0 var(--space-4)' }}>
          {summaryHead}
          <strong>{fileSessions}</strong>
          {summaryTail}
        </p>
        <p
          style={{
            font: 'var(--text-body-sm)',
            color: hasLocalData ? 'var(--bf-danger)' : 'var(--text-muted)',
            margin: '0 0 var(--space-5)',
          }}
        >
          {hasLocalData
            ? t('backup.confirmLoss', { sesiones: localCounts.sessions, rutinas: localCounts.rutinas })
            : t('backup.confirmEmpty', { rutinas: fileRutinas, sesiones: fileSessions })}
        </p>
      </ConfirmSheet>
    );
  }

  return (
    <SheetShell
      role="dialog"
      labelledBy="restore-sheet-title"
      scrimCloses={false}
      onClose={onClose}
      onEscape={onClose}
    >
      <h3 id="restore-sheet-title" style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: '0 0 var(--space-4)' }}>
        {t('backup.confirmTitle')}
      </h3>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {phase === 'reject' ? (
        <>
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginBottom: 'var(--space-5)',
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
              {rejectMessage(t, rejectKind, rejectDetail)}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <Button variant="ghost" style={{ width: '100%', minHeight: 44 }} onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 var(--space-5)' }}>
            {t('backup.disclosureBody')}
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <Button
              variant="primary"
              style={{ width: '100%', minHeight: 44 }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <Icon name="download" size={16} style={{ transform: 'rotate(180deg)' }} /> {t('backup.chooseFileAction')}
            </Button>
            <Button variant="ghost" style={{ width: '100%', minHeight: 44 }} onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      )}
    </SheetShell>
  );
}

/** ISO → DD/MM/YYYY (UTC, locale-independent so the render is deterministic). */
function formatExportDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function rejectMessage(t, kind, detail) {
  if (kind === 'newer-version') return t('backup.errNewerVersion');
  if (kind === 'invalid-rutina') return t('backup.errInvalidRutina', { error: detail || '' });
  return t('backup.errInvalidFile'); // invalid-json | invalid-schema
}
