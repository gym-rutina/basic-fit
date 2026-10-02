import { act } from '@testing-library/react';

/**
 * back-closes-dialogs-and-wizard-polish — drives the REAL jsdom session
 * history, not a faked `popstate`.
 *
 * Why real: the feature's hard guarantees (AC3 "no stale entry", AC7 "no
 * swallowed Back") are statements about how many entries sit on the history
 * stack and where `history.back()` lands. A synthetic `popstate` would let an
 * implementation that leaves a stale entry, or pops the wrong one, pass.
 * jsdom implements pushState / back / forward / popstate (async, two chained
 * zero-delay timeouts), so a test that presses "system Back" and then settles
 * exercises the same traversal a phone does.
 */

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Let every pending history traversal — and any follow-up traversal it
 * triggers (a programmatic back() that chains into another) — run to
 * completion, with React's updates flushed inside act().
 */
export async function settleHistory({ stableRounds = 3, maxRounds = 60 } = {}) {
  // jsdom runs a traversal as two chained zero-delay timeouts, and our own follow-up
  // traversals chain further. Instead of a fixed sleep, wait until URL + history state
  // stay unchanged for `stableRounds` consecutive 10ms ticks (robust on a loaded CI box).
  const signature = () => `${window.location.hash}|${JSON.stringify(window.history.state)}`;
  let last = signature();
  let stable = 0;
  for (let i = 0; i < maxRounds && stable < stableRounds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await tick(10);
    });
    const now = signature();
    if (now === last) stable += 1;
    else {
      stable = 0;
      last = now;
    }
  }
}

/** The Android Back button / iOS edge-swipe / browser Back button. */
export async function pressSystemBack() {
  await act(async () => {
    window.history.back();
    await tick(8);
  });
  await settleHistory();
}

/** The browser Forward button (desktop). */
export async function pressSystemForward() {
  await act(async () => {
    window.history.forward();
    await tick(8);
  });
  await settleHistory();
}

/**
 * Start a test from a known URL without inheriting the previous test's
 * entries: replaces the current entry (does not add one).
 */
export function resetHashTo(hash = '#/a') {
  window.history.replaceState(null, '', hash);
}
