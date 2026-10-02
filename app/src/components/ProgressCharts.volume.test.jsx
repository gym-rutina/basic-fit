import { describe, it, expect } from 'vitest';
import { render, screen, isInaccessible } from '@testing-library/react';
import { VolumeBarChart } from './ProgressCharts.jsx';
import { UI_LOCALES } from '../i18n/index.js';

/**
 * progress-volume-fix (spec.md AC7, AC8, AC10, AC11) — VolumeBarChart.
 *
 * Decided display (coordinator Q3, tech-plan.md D3):
 *   - ONE aria-hidden <svg> keeps drawing the bars (progress ProgressCharts.test
 *     pins that), now with a visible VALUE above and a DATE under every bar.
 *   - A visually-hidden (`.sr-only`) list carries one "<date> · <value> kg"
 *     item per bar, OUTSIDE any aria-hidden subtree, so the number is readable
 *     by assistive tech and announced exactly once.
 *   - New prop `locale` (default 'es', the app's authoring locale, like every
 *     lib default) drives Intl.NumberFormat / Intl.DateTimeFormat.
 *   - Unit "kg" is in the accessible text and the caption; the visible per-bar
 *     value is the bare number (a 5-digit "12 345 kg" does not fit a bar slot).
 *
 * Expected strings are derived from Intl with the same options the spec names
 * (day + short month; grouped integer). A few literal en/de/es checks keep the
 * derivation honest: a chart that ignores `locale` prints "12,345" everywhere.
 */

const norm = (s) => String(s).replace(/[\s  ]+/g, ' ').trim();
const byText = (expected) => (content) => norm(content) === norm(expected);

const num = (locale, n) => new Intl.NumberFormat(locale).format(n);
const shortDate = (locale, key) => {
  const [y, m, d] = key.split('-').map(Number);
  // local noon, like buildFrequencyGrid — never shifts across a day in any timezone
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d, 12));
};
const ariaText = (locale, bar) => `${shortDate(locale, bar.date)} · ${num(locale, bar.volume)} kg`;

const BARS = [
  { sessionId: 's1', date: '2026-07-06', volume: 2500 },
  { sessionId: 's2', date: '2026-07-10', volume: 1250 },
];

/** jsdom has no layout, but it does honour display:none / visibility:hidden / [hidden]. */
function isRendered(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

/** Elements whose own text is exactly `expected`, painted, and not the sr-only copy. */
function visibleLabels(expected) {
  return screen
    .queryAllByText(byText(expected))
    .filter((el) => !el.closest('.sr-only') && isRendered(el));
}

describe('VolumeBarChart — accessible per-bar text (AC8)', () => {
  it('exposes "<date> · <value> kg" for every bar, in the accessibility tree', () => {
    render(<VolumeBarChart bars={BARS} locale="en" />);
    for (const bar of BARS) {
      const matches = screen.getAllByText(byText(ariaText('en', bar)));
      expect(matches).toHaveLength(1);
      // not aria-hidden, not display:none, not [hidden] — a screen reader can reach it
      expect(isInaccessible(matches[0])).toBe(false);
    }
    // literal anchor: en groups thousands with a comma and names the unit
    expect(screen.getByText(byText(`${shortDate('en', '2026-07-06')} · 2,500 kg`))).toBeInTheDocument();
  });

  it('announces each bar exactly once — the drawing and its visible labels are aria-hidden duplicates', () => {
    const { container } = render(<VolumeBarChart bars={BARS} locale="en" />);
    expect(screen.getAllByText(/ · .* kg$/)).toHaveLength(BARS.length);

    // the svg itself stays hidden from AT (progress ProgressCharts.test pins this too)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    // every visible label must be hidden from AT, otherwise the list is read twice
    for (const bar of BARS) {
      for (const label of [num('en', bar.volume), shortDate('en', bar.date)]) {
        const found = visibleLabels(label);
        expect(found.length).toBeGreaterThanOrEqual(1);
        for (const el of found) expect(el.closest('[aria-hidden="true"]')).not.toBeNull();
      }
    }
  });
});

describe('VolumeBarChart — visible value and date under each bar (AC8, coordinator Q3)', () => {
  it('prints the value and the short date for every bar, not an unlabeled drawing', () => {
    render(<VolumeBarChart bars={BARS} locale="en" />);
    for (const bar of BARS) {
      expect(visibleLabels(num('en', bar.volume)).length).toBeGreaterThanOrEqual(1);
      expect(visibleLabels(shortDate('en', bar.date)).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('VolumeBarChart — follows the UI locale (AC8)', () => {
  const BIG = [{ sessionId: 'big', date: '2026-07-06', volume: 12345 }];

  it('groups digits per locale: en "12,345", de "12.345"', () => {
    const { unmount } = render(<VolumeBarChart bars={BIG} locale="en" />);
    expect(screen.getByText(/12,345 kg$/)).toBeInTheDocument();
    unmount();

    render(<VolumeBarChart bars={BIG} locale="de" />);
    expect(screen.getByText(/12\.345 kg$/)).toBeInTheDocument();
    expect(screen.queryByText(/12,345/)).toBeNull();
  });

  it('defaults to es when no locale is passed, like every lib default', () => {
    render(<VolumeBarChart bars={BIG} />);
    expect(screen.getByText(byText(ariaText('es', BIG[0])))).toBeInTheDocument();
    // es prints day-before-month ("6 jul"); en would print "Jul 6" — the locales differ
    expect(shortDate('es', BIG[0].date)).not.toBe(shortDate('en', BIG[0].date));
  });

  it.each(UI_LOCALES)('renders the per-bar text in %s', (locale) => {
    render(<VolumeBarChart bars={BIG} locale={locale} />);
    expect(screen.getByText(byText(ariaText(locale, BIG[0])))).toBeInTheDocument();
  });
});

describe('VolumeBarChart — never renders NaN, scales against a finite max (AC7)', () => {
  const heights = (container) => [...container.querySelectorAll('rect')].map((r) => Number(r.getAttribute('height')));

  it('an all-zero series renders flat, visible minimum bars — not blanks', () => {
    const { container } = render(
      <VolumeBarChart
        bars={[
          { sessionId: 'a', date: '2026-07-06', volume: 0 },
          { sessionId: 'b', date: '2026-07-10', volume: 0 },
        ]}
        locale="en"
      />
    );
    const h = heights(container);
    expect(h).toHaveLength(2);
    expect(h.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    expect(h[0]).toBe(h[1]);
    expect(container.innerHTML.match(/NaN|Infinity|undefined/g)).toBeNull();
  });

  it('a NaN / Infinity / missing volume is drawn as a zero bar and never poisons the other bars', () => {
    const zero = render(
      <VolumeBarChart bars={[{ sessionId: 'z', date: '2026-07-01', volume: 0 }]} locale="en" />
    );
    const flat = heights(zero.container)[0];
    zero.unmount();

    const bars = [
      { sessionId: 'nan', date: '2026-07-01', volume: NaN },
      { sessionId: 'big', date: '2026-07-02', volume: 1000 },
      { sessionId: 'half', date: '2026-07-03', volume: 500 },
      { sessionId: 'inf', date: '2026-07-04', volume: Infinity },
      { sessionId: 'none', date: '2026-07-05', volume: undefined },
    ];
    const { container } = render(<VolumeBarChart bars={bars} locale="en" />);
    const h = heights(container);

    expect(h).toHaveLength(5);
    expect(h.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    expect([h[0], h[3], h[4]]).toEqual([flat, flat, flat]); // the bad ones are flat bars
    expect(h[1]).toBeGreaterThan(h[2]); // the finite bars keep their proportions...
    expect(h[2]).toBeGreaterThan(flat); // ...instead of collapsing to NaN

    // no attribute AND no text may carry a non-number — including the accessible text
    expect(container.innerHTML.match(/NaN|Infinity|undefined/g)).toBeNull();
    expect(screen.getByText(byText(ariaText('en', { date: '2026-07-01', volume: 0 })))).toBeInTheDocument();
  });

  it('scales bars against the series maximum: half the volume is half the height', () => {
    const { container } = render(<VolumeBarChart bars={BARS} locale="en" />);
    const [tall, short] = heights(container);
    expect(short / tall).toBeCloseTo(0.5, 1);
  });
});

describe('VolumeBarChart — layout contract at 360 px (AC10, AC11)', () => {
  it('renders nothing for an empty series — the screen shows noVolumeData instead', () => {
    const { container } = render(<VolumeBarChart bars={[]} locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps a horizontally scrolling wrapper that can shrink inside its grid parent', () => {
    const { container } = render(<VolumeBarChart bars={BARS} locale="en" />);
    let el = container.querySelector('svg').parentElement;
    let scroller = null;
    while (el && el !== container.parentElement) {
      if (el.style.overflowX === 'auto') {
        scroller = el;
        break;
      }
      el = el.parentElement;
    }
    expect(scroller, 'an ancestor of the svg must scroll horizontally').not.toBeNull();
    expect(['0', '0px']).toContain(scroller.style.minWidth);
    expect(scroller.style.maxWidth).toBe('100%');
  });
});
