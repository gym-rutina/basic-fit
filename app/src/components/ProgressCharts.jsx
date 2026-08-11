/**
 * Hand-rolled SVG chart primitives for the Progress screen (AC6 — no charting
 * library). Three named exports consumed by ProgressScreen.jsx.
 *
 * All <svg> elements carry aria-hidden="true"; readable summaries / aria-labels
 * are provided by sibling DOM or per-cell attributes.
 */
import React from 'react';
import { defaultT } from '../i18n/index.js';

const PURPLE = 'var(--bf-purple-deep, #6200ee)';
const MUTED = 'var(--border-default, #d4d4d4)';

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
const VC_GAP = 6;
const VC_H = 100;
const VC_PAD = 8;

/**
 * Horizontal-scroll bar chart of per-session volume.
 *
 * @param {{ bars: Array<{sessionId: string, date: string, volume: number}> }} props
 */
export function VolumeBarChart({ bars = [] }) {
  if (bars.length === 0) return null;

  const maxVol = Math.max(...bars.map((b) => b.volume), 1);
  // Width follows bar count only — a fixed min (was 280) overflowed cover-display
  // viewports when the scroll parent expanded to fit the SVG.
  const svgW = Math.max(1, bars.length * (VC_BAR_W + VC_GAP) + 2 * VC_PAD);
  const innerH = VC_H - 2 * VC_PAD;

  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${svgW} ${VC_H}`}
        width={svgW}
        height={VC_H}
        style={{ display: 'block', maxWidth: 'none' }}
      >
        {bars.map((bar, i) => {
          const bh = Math.max(4, (bar.volume / maxVol) * innerH);
          const x = VC_PAD + i * (VC_BAR_W + VC_GAP);
          const y = VC_H - VC_PAD - bh;
          return (
            <rect
              key={bar.sessionId}
              x={x}
              y={y}
              width={VC_BAR_W}
              height={bh}
              rx={3}
              fill={PURPLE}
            />
          );
        })}
      </svg>
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
          font: 'var(--text-body-sm, 12px/1.4 sans-serif)',
          color: 'var(--text-muted, #666)',
          margin: '8px 0 0',
          overflowWrap: 'anywhere',
        }}
      >
        {t('progress.last7Days')}: {stats.last7} · {t('progress.last30Days')}: {stats.last30} · {t('progress.currentStreak')}: {stats.streak}
      </p>
    </div>
  );
}
