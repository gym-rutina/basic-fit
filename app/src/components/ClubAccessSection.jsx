import React, { useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { validateInviteUrl } from '../lib/inviteUrl.js';
import { readInviteUrl, writeInviteUrl, clearInviteUrl } from '../lib/inviteStorage.js';
import { useI18n } from '../i18n/index.js';

/**
 * club-invite-link S1 (tech-plan.md D-H) — the /settings "Acceso al club"
 * section. Self-contained: heading, input, Guardar, conditional
 * Eliminar/Guardado line, disclosure-or-degraded line and its own trailing
 * `<hr>`, so SettingsScreen's edit stays a single render line and the section
 * can be absorbed into a future Club grouping without redesign (OQ-5).
 *
 * States (ux-design.md §2 matrix):
 * - unset        — nothing stored: empty input, no Eliminar, no Guardado line.
 * - saved        — stored value pre-fills the draft; the Guardado line mirrors
 *                  the LAST SAVED value, never the draft (it is the
 *                  authoritative answer to "what will Acceso open?").
 * - error·unsafe-scheme / error·invalid-url — role="alert" row names the
 *   problem; the draft is kept for correction and a previously saved URL is
 *   left intact (AC5 — a failed save never destroys a working invite).
 * - remove-done  — returns to unset atomically; focus moves back to the input.
 * - storage-degraded — writeInviteUrl() returned false (D-B): the honest
 *   failure line replaces the disclosure; nothing pretends success.
 *
 * No saving-busy state exists (D-G): validation + localStorage.setItem are
 * synchronous, so a busy tick would never paint — Guardar stays enabled
 * throughout and double-taps are idempotent writes of the same trimmed string.
 */
export function ClubAccessSection() {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => readInviteUrl() ?? '');
  const [savedValue, setSavedValue] = useState(() => readInviteUrl());
  const [error, setError] = useState(null); // { reason, scheme? } | null
  const [storageFailed, setStorageFailed] = useState(false);
  const inputRef = useRef(null);

  function handleSave() {
    const result = validateInviteUrl(draft);
    if (!result.ok) {
      setError(result); // draft kept, stored value untouched (AC5)
      return;
    }
    setError(null);
    if (!writeInviteUrl(result.url)) {
      setStorageFailed(true); // D-B honest degraded state — no fake success
      return;
    }
    setStorageFailed(false);
    setSavedValue(result.url);
  }

  function handleRemove() {
    clearInviteUrl();
    setDraft('');
    setSavedValue(null);
    setError(null);
    setStorageFailed(false);
    if (inputRef.current) inputRef.current.focus(); // ux-design §7 remove-done row
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
        {t('access.sectionTitle')}
      </span>

      <label
        htmlFor="club-invite-url"
        style={{ display: 'block', font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)', margin: '12px 0 6px' }}
      >
        {t('access.inputLabel')}
      </label>
      <input
        ref={inputRef}
        id="club-invite-url"
        type="url"
        dir="auto"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('access.inputPlaceholder')}
        spellCheck="false"
        autoComplete="off"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          font: '14px/1.5 monospace',
          color: 'var(--bf-ink)',
          border: `1px solid ${error ? 'var(--bf-danger)' : 'var(--border-control)'}`,
          borderRadius: 'var(--radius-control)',
          padding: 12,
          background: 'var(--bf-white)',
        }}
      />

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <Button variant="primary" style={{ width: '100%', minHeight: 44 }} onClick={handleSave}>
          {t('access.saveAction')}
        </Button>
        {savedValue && (
          <Button
            variant="ghost"
            style={{ width: '100%', minHeight: 44, color: 'var(--bf-danger)' }}
            onClick={handleRemove}
          >
            {t('access.removeAction')}
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, background: 'var(--bf-danger-tint)', border: '1px solid var(--bf-danger)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}
        >
          <span style={{ color: 'var(--bf-danger)', flexShrink: 0, marginTop: 1 }}>
            <Icon name="alert-triangle" size={16} />
          </span>
          <span style={{ font: '700 13px/1.4 var(--font-sans)', color: 'var(--bf-danger)' }}>
            {error.reason === 'unsafe-scheme'
              ? t('access.errorUnsafeScheme', { scheme: error.scheme })
              : t('access.errorInvalidUrl')}
          </span>
        </div>
      )}

      {savedValue && (
        <div style={{ marginTop: 'var(--space-5)', minWidth: 0 }}>
          <div
            style={{
              font: 'var(--text-label)',
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}
          >
            {t('access.savedPrefix')}
          </div>
          {/* Truncation is visual-only (ellipsis): the full text stays in the
              DOM for screen readers, plus title for hover (ux-design §7). */}
          <span
            dir="auto"
            title={savedValue}
            style={{
              display: 'block',
              font: '13px/1.4 monospace',
              color: 'var(--bf-ink-2)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {savedValue}
          </span>
        </div>
      )}

      {storageFailed ? (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 'var(--space-5)', background: 'var(--bf-danger-tint)', border: '1px solid var(--bf-danger)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}
        >
          <span style={{ color: 'var(--bf-danger)', flexShrink: 0, marginTop: 1 }}>
            <Icon name="alert-triangle" size={16} />
          </span>
          <span style={{ font: 'var(--text-caption)', color: 'var(--bf-ink-2)' }}>{t('access.storageErrorBody')}</span>
        </div>
      ) : (
        <p style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', margin: 'var(--space-5) 0 0' }}>
          {t('access.disclosureBody')}
        </p>
      )}

      <hr aria-hidden="true" style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: 'var(--space-8) 0 0' }} />
    </section>
  );
}
