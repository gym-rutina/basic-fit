import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { Button } from '../../../design-system/components/primitives/Button.jsx';
import { listSessions } from '../lib/db.js';
import { buildExportPayload } from '../lib/exportFormat.js';
import { useI18n } from '../i18n/index.js';

function isoDateDaysAgo(days, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** States: success | error (clipboard write failure) — ux-design.md. Unreachable with zero sessions (History hides the button); redirects defensively if reached anyway. */
export function ExportScreen() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [sessions, setSessions] = useState(null); // null = loading
  const [range, setRange] = useState('all');
  const [clipboardError, setClipboardError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSessions().then((s) => {
      if (!cancelled) setSessions(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sessions !== null && sessions.length === 0) navigate('/history', { replace: true });
  }, [sessions, navigate]);

  const { json, markdown } = useMemo(() => {
    if (!sessions) return { json: { exercises: {} }, markdown: '' };
    const from = range === '30d' ? isoDateDaysAgo(30) : undefined;
    return buildExportPayload(sessions, { from }, { t, locale });
  }, [sessions, range, t, locale]);

  if (!sessions || sessions.length === 0) return null;

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setClipboardError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setClipboardError(true);
    }
  }

  function handleDownload() {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rutina-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleShare() {
    try {
      await navigator.share({ title: t('export.shareTitle'), text: markdown });
    } catch {
      // user cancelled the share sheet or it failed silently — not an error state worth surfacing
    }
  }

  return (
    <div style={{ background: 'var(--bf-grey-1)', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: 'var(--bf-white)', borderBottom: '1px solid var(--border-default)', paddingBlock: 'var(--space-6) var(--space-5)', paddingInline: 'var(--page-pad-x)' }}>
        <h1 style={{ font: 'var(--text-h2)', textTransform: 'uppercase', color: 'var(--bf-ink)', margin: 0 }}>{t('export.title')}</h1>
        <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '6px 0 0' }}>{t('export.subtitle')}</p>
      </div>

      <div style={{ paddingBlock: 'var(--space-5)', paddingInline: 'var(--page-pad-x)', display: 'grid', gap: 'var(--space-5)' }}>
        <div>
          <label htmlFor="export-range" style={{ display: 'block', font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            {t('export.rangeLabel')}
          </label>
          <select
            id="export-range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', font: '600 14px/1.4 var(--font-sans)', color: 'var(--bf-ink)', border: '1px solid var(--border-control)', borderRadius: 'var(--radius-control)', padding: '10px 12px' }}
          >
            <option value="all">{t('export.rangeAll')}</option>
            <option value="30d">{t('export.range30d')}</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', font: 'var(--text-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{t('export.previewLabel')}</label>
          <pre
            dir="auto"
            style={{
              margin: 0,
              background: 'var(--bf-white)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              font: '13px/1.5 monospace',
              color: 'var(--bf-ink-2)',
              overflowX: 'auto',
              whiteSpace: 'pre',
            }}
          >
            {markdown}
          </pre>
        </div>

        {clipboardError && (
          <div role="alert" style={{ background: 'var(--bf-danger-tint)', border: '1px solid var(--bf-danger)', borderRadius: 'var(--radius-md)', padding: '10px 14px', font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)' }}>
            {t('export.clipboardError')}
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          <Button variant="primary" style={{ width: '100%' }} onClick={handleCopy}>
            {copied ? t('export.copiedLabel') : t('export.copyAction')}
          </Button>
          <Button variant="outline" style={{ width: '100%' }} onClick={handleDownload}>
            <Icon name="download" size={16} /> {t('export.downloadAction')}
          </Button>
          {canShare && (
            <Button variant="ghost" style={{ width: '100%' }} onClick={handleShare}>
              <Icon name="external-link" size={16} /> {t('export.shareAction')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
