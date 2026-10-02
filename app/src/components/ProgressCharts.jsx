/**
 * Hand-rolled SVG chart primitives for the Progress screen (AC6 — no charting
 * library). Three named exports consumed by ProgressScreen.jsx.
 *
 * All <svg> elements carry aria-hidden="true"; readable summaries / aria-labels
 * are provided by sibling DOM or per-cell attributes. VolumeBarChart's svg
 * (bars + visible value/date labels) is aria-hidden too; its readable text is
 * the sibling .sr-only list, one "<date> · <value> kg" item per bar.
 */
import React from 'react';
import { defaultT, DEFAULT_LOCALE } from '../i18n/index.js';

// Bare tokens, no hex fallbacks — the DS-wide convention (tech-debt audit
// 2026-08-26 F9): tokens are guaranteed by the shared stylesheet, and a
// fallback would silently mask a rename.
const PURPLE = 'var(--bf-purple-deep)';
const MUTED = 'var(--border-default)';

// ─── WeightProgressChart ─────────────────────────────────────────────────────

const WC_W = 300;
const WC_H = 120;
const WC_PAD = 24;

/**
 * Line chart of weightUsed over time for one exercise.
 * - 1 point  → single circle + weight label (no polyline)
 * - ≥2 points → polyline + dot + label for each point
 *
 * @param {{ points: Array<{date: string, weightUsed: number, completedAt: string}> }} props
 */
export function WeightProgressChart({ points = [] }) {
  if (points.length === 0) return null;

  if (points.length === 1) {
    const p = points[0];
    return (
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${WC_W} ${WC_H}`}
        style={{ width: '100%', height: WC_H, display: 'block' }}
      >
        <circle cx={WC_W / 2} cy={WC_H / 2} r={6} fill={PURPLE} />
        <text
          x={WC_W / 2}
          y={WC_H / 2 + 22}
          textAnchor="middle"
          fontSize={13}
          fill="currentColor"
        >
          {p.weightUsed} kg
        </text>
      </svg>
    );
  }

  const weights = points.map((p) => p.weightUsed);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const innerW = WC_W - 2 * WC_PAD;
  const innerH = WC_H - 2 * WC_PAD;

  const xs = points.map((_, i) => WC_PAD + (i / (points.length - 1)) * innerW);
  const ys = points.map(
    (p) => WC_H - WC_PAD - ((p.weightUsed - minW) / range) * innerH
  );

  const polylinePoints = xs.map((x, i) => `${x},${ys[i]}`).join(' ');

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WC_W} ${WC_H}`}
      style={{ width: '100%', height: WC_H, display: 'block' }}
    >
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={PURPLE}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <g key={`${p.completedAt}-${i}`}>
          <circle cx={xs[i]} cy={ys[i]} r={4} fill={PURPLE} />
          <text
            x={xs[i]}
            y={ys[i] - 8}
            textAnchor="middle"
            fontSize={11}
            fill="currentColor"
          >
            {p.weightUsed} kg
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── VolumeBarChart ───────────────────────────────────────────────────────────

const VC_BAR_W = 28;
// Bar pitch 48 px (28 bar + 20 gap): a 6-char value label and a short date at
// font 10 both fit under / over their own bar without touching the neighbour.
const VC_GAP = 20;
const VC_H = 100; // bar area, as before
const VC_PAD = 8;
const VC_LABEL_TOP = 16; // band above the tallest bar: the value label
const VC_LABEL_BOTTOM = 18; // band under the baseline: the date label
const VC_FONT = 10;

/** Finite number > 0, else 0 — a NaN/Infinity/missing/negative volume draws as a flat zero bar. */
const safeVolume = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Intl formatters for the chart. An unknown/invalid locale tag must not crash
 * the Progress tab, so fall back to the app's default locale.
 */
function makeFormatters(locale) {
  const build = (loc) => ({
    number: new Intl.NumberFormat(loc),
    date: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }),
  });
  try {
    return build(locale);
  } catch {
    return build(DEFAULT_LOCALE);
  }
}

/** "YYYY-MM-DD" → short local date. Local noon (like buildFrequencyGrid): no day shift in any timezone. */
function formatDay(dateFmt, key) {
  const [y, m, d] = String(key).split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return Number.isNaN(date.getTime()) ? '' : dateFmt.format(date);
}

/**
 * Horizontal-scroll bar chart of per-session volume.
 *
 * The <svg> draws the bars with a visible value above and a short date under
 * each one; it stays aria-hidden (the file's convention). The readable copy is
 * the sibling visually-hidden list — one "<date> · <value> kg" item per bar,
 * announced once (progress-volume-fix AC8). A non-finite volume is drawn as a
 * flat zero bar and printed as 0, never NaN (AC7).
 *
 * @param {{ bars: Array<{sessionId: string, date: string, volume: number}>, locale?: string }} props
 */
export function VolumeBarChart({ bars = [], locale = DEFAULT_LOCALE }) {
  if (bars.length === 0) return null;

  const fmt = makeFormatters(locale);
  const items = bars.map((bar) => {
    const volume = safeVolume(bar.volume);
    return {
      key: bar.sessionId,
      volume,
      value: fmt.number.format(volume),
      day: formatDay(fmt.date, bar.date),
    };
  });

  const maxVol = items.reduce((max, it) => Math.max(max, it.volume), 1);
  // Width follows bar count only — a fixed min (was 280) overflowed cover-display
  // viewports when the scroll parent expanded to fit the SVG.
  const pitch = VC_BAR_W + VC_GAP;
  const svgW = Math.max(1, items.length * pitch + 2 * VC_PAD);
  const svgH = VC_LABEL_TOP + VC_H + VC_LABEL_BOTTOM;
  const innerH = VC_H - 2 * VC_PAD;
  const baseline = VC_LABEL_TOP + VC_H - VC_PAD;

  return (
    <div style={{ position: 'relative', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW}
          height={svgH}
          style={{ display: 'block', maxWidth: 'none' }}
        >
          {items.map((it, i) => {
            const bh = Math.max(4, (it.volume / maxVol) * innerH);
            const x = VC_PAD + i * pitch;
            const y = baseline - bh;
            const cx = x + VC_BAR_W / 2;
            return (
              <g key={it.key}>
                <rect x={x} y={y} width={VC_BAR_W} height={bh} rx={3} fill={PURPLE} />
                <text x={cx} y={y - 4} textAnchor="middle" fontSize={VC_FONT} fill="currentColor">
                  {it.value}
                </text>
                <text
                  x={cx}
                  y={baseline + 13}
                  textAnchor="middle"
                  fontSize={VC_FONT}
                  fill="var(--text-muted)"
                >
                  {it.day}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="sr-only">
        {items.map((it) => (
          <li key={it.key}>{`${it.day} · ${it.value} kg`}</li>
        ))}
      </ul>
    </div>
  );
}

// ─── FrequencyHeatmap ─────────────────────────────────────────────────────────

const HC_CELL = 14;
const HC_GAP = 2;

/**
 * 12×7 calendar heatmap.
 * Cells rendered as accessible <div role="img"> elements so aria-label is
 * queryable by assistive technology and testing-library (SVG aria-hidden
 * would suppress them).
 * Stats line rendered as visible text.
 *
 * @param {{ cells: Array<{date: string, filled: boolean, ariaLabel: string}>, stats: {last7: number, last30: number, streak: number}, t?: (key: string, params?: object) => string }} props
 */
export function FrequencyHeatmap({ cells = [], stats = {}, t = defaultT }) {
  const cols = 12;
  const rows = 7;

  return (
    <div style={{ minWidth: 0, maxWidth: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, auto)`,
          gap: HC_GAP,
          width: '100%',
          maxWidth: cols * HC_CELL + (cols - 1) * HC_GAP,
        }}
      >
        {cells.map((cell, i) => (
          <div
            key={`${cell.date}-${i}`}
            aria-label={cell.ariaLabel}
            role="img"
            style={{
              aspectRatio: '1',
              width: '100%',
              background: cell.filled ? PURPLE : MUTED,
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <p
        style={{
          font: 'var(--text-body-sm, 12px/1.4 sans-serif)', // non-colour token: fallback kept (F9 scoped to colour tokens)
          color: 'var(--text-muted)',
          margin: '8px 0 0',
          overflowWrap: 'anywhere',
        }}
      >
        {t('progress.last7Days')}: {stats.last7} · {t('progress.last30Days')}: {stats.last30} · {t('progress.currentStreak')}: {stats.streak}
      </p>
    </div>
  );
}
