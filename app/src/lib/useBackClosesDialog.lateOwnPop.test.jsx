import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useBackClosesDialog } from './useBackClosesDialog.js';
import { settleHistory, resetHashTo } from '../test-utils/history.js';

/**
 * back-closes-dialogs-and-wizard-polish, code-QA fix cycle 1: the popstate of the hook's OWN
 * history.back() can arrive late (loaded phone, busy CI box). It must still be recognised as the
 * hook's own traversal -- never read as a user Back (phantom close of the NEXT dialog) and never
 * answered with a second back() (which would leave the page).
 *
 * The slow traversal is simulated by delaying only the hook's `history.back()` calls; the "user"
 * presses Back through `userBack()`, which uses the real, undelayed function.
 */

const WATCHDOG_MS = 1000; // keep in sync with useBackClosesDialog.js
const LOST_MS = 10000;
const SLOW = WATCHDOG_MS + 100; // the own popstate lands just AFTER the watchdog gave up blocking

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settleFor = (ms) => act(async () => { await wait(ms); });

function Dlg({ onBack, children }) {
  useBackClosesDialog(onBack);
  return <div role="dialog">{children}</div>;
}

/**
 * Replace window.history.back with a version that counts the hook's calls and delays them
 * (`never: true` = the traversal is accepted and then never lands).
 */
function slowBack({ delay = 0, never = false } = {}) {
  const original = window.history.back.bind(window.history);
  const handle = { calls: 0 };
  window.history.back = () => {
    handle.calls += 1;
    if (never) return;
    window.setTimeout(original, delay);
  };
  handle.restore = () => {
    delete window.history.back;
  };
  /** The system Back button: the real traversal, not delayed, not counted. */
  handle.userBack = async () => {
    await act(async () => {
      original();
      await wait(8);
    });
    await settleHistory();
  };
  return handle;
}

let slow = null;

/** History [.., #/a, #/b] with #/b current, no dialog open. */
function startAtB() {
  resetHashTo('#/a');
  window.history.pushState(null, '', '#/b');
}

beforeEach(() => {
  startAtB();
});

afterEach(async () => {
  vi.useRealTimers();
  slow?.restore();
  slow = null;
  cleanup();
  await settleHistory();
});

describe('own popstate arriving late (after the watchdog)', () => {
  it('closing A then opening B: B is NOT closed by A\'s late popstate, is armed afterwards, and the next real Back closes it (AC1/AC3/AC7)', async () => {
    slow = slowBack({ delay: SLOW });
    const a = render(<Dlg onBack={() => {}} />);
    await settleFor(20);
    expect(window.history.state.__bfDialog).toBe(1); // A's marker

    a.unmount(); // A closed by its own control: the hook pops A's marker (slowly)
    await settleFor(0);
    const onBackB = vi.fn();
    const b = render(<Dlg onBack={onBackB} />); // the user opens B right away
    await settleFor(SLOW + 400); // watchdog (1 s) fires first, then the own popstate lands

    expect(onBackB).not.toHaveBeenCalled(); // not a user Back
    expect(slow.calls).toBe(1); // A's marker was popped exactly once
    expect(window.location.hash).toBe('#/b');
    expect(window.history.state.__bfDialog).toBe(1); // B now owns a marker of its own

    slow.restore();
    await slow.userBack(); // genuine Back: closes B, does not leave the page
    expect(onBackB).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/b');

    b.unmount(); // B closed; its marker is popped, nothing stale is left behind
    await settleHistory();
    await slow.userBack();
    expect(window.location.hash).toBe('#/a'); // one Back reaches the previous page (AC3)
  }, 20000);

  it('a slow own pop with nothing else open is not retried: back() is issued once and the page stays (no double pop)', async () => {
    slow = slowBack({ delay: SLOW });
    const a = render(<Dlg onBack={() => {}} />);
    await settleFor(20);

    a.unmount();
    await settleFor(WATCHDOG_MS + 400); // past the watchdog, own pop lands at ~1.1 s
    expect(slow.calls).toBe(1); // a retry would be a second back() -> leaves the page
    expect(window.location.hash).toBe('#/b');

    await settleFor(SLOW + 300); // where a retried back() would have landed by now
    expect(window.location.hash).toBe('#/b');
    expect(slow.calls).toBe(1);
  }, 20000);

  it('nested C and D opened AFTER the watchdog fired, while the slow pop is still in flight: nothing closes, both end up armed, Back closes the top one', async () => {
    slow = slowBack({ delay: WATCHDOG_MS + 500 });
    const a = render(<Dlg onBack={() => {}} />);
    await settleFor(20);

    a.unmount();
    await settleFor(WATCHDOG_MS + 100); // watchdog fired; the own pop is still 400 ms away
    const onBackC = vi.fn();
    const onBackD = vi.fn();
    const c = render(<Dlg onBack={onBackC} />);
    const d = render(<Dlg onBack={onBackD} />);
    await settleFor(800); // the own pop lands

    expect(onBackC).not.toHaveBeenCalled();
    expect(onBackD).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/b');
    expect(window.history.state.__bfDialog).toBe(2); // one marker per open dialog

    slow.restore();
    await slow.userBack();
    expect(onBackD).toHaveBeenCalledTimes(1); // topmost first
    expect(onBackC).not.toHaveBeenCalled();

    d.unmount();
    c.unmount();
    await settleHistory();
    await slow.userBack();
    expect(window.location.hash).toBe('#/a');
  }, 20000);

  it('a traversal that never lands is written off after LOST_MS: dialogs opened meanwhile then get their markers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    slow = slowBack({ never: true });
    const a = render(<Dlg onBack={() => {}} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(window.history.state.__bfDialog).toBe(1);

    a.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(slow.calls).toBe(1); // the hook asked for the pop; the "browser" never does it
    await act(async () => { await vi.advanceTimersByTimeAsync(WATCHDOG_MS + 100); });

    const onBackC = vi.fn();
    const onBackD = vi.fn();
    const c = render(<Dlg onBack={onBackC} />);
    const d = render(<Dlg onBack={onBackD} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    // Not written off yet: nothing is pushed over the entry whose pop may still land.
    expect(window.history.state.__bfDialog).toBe(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(LOST_MS); });
    expect(window.history.state.__bfDialog).toBe(2); // recovered: C and D are armed
    expect(slow.calls).toBe(1); // and no retry of the dead pop was needed

    vi.useRealTimers();
    slow.restore();
    const real = window.history.back.bind(window.history);
    await act(async () => {
      real();
      await wait(8);
    });
    await settleHistory();
    expect(onBackD).toHaveBeenCalledTimes(1);
    expect(onBackC).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/b');

    d.unmount();
    c.unmount();
    await settleHistory();
  }, 20000);
});

describe('own popstate arriving late while stepping over an orphan marker (AC7, real router)', () => {
  function Probe() {
    return <output data-testid="path">{useLocation().pathname}</output>;
  }

  function Landing() {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate('/b')}>go to b</button>;
  }

  function PageB() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>open dialog</button>
        {open && (
          <Dlg onBack={() => setOpen(false)}>
            <button type="button" onClick={() => { setOpen(false); navigate('/c'); }}>close and go to c</button>
          </Dlg>
        )}
      </div>
    );
  }

  const path = () => screen.getByTestId('path').textContent;

  it('/b dialog -> close and navigate to /c, then Back: the orphan is stepped over ONCE even if that pop is slow (c -> b, not c -> a)', async () => {
    resetHashTo('#/a');
    const user = userEvent.setup();
    render(
      <HashRouter>
        <Probe />
        <Routes>
          <Route path="/a" element={<Landing />} />
          <Route path="/b" element={<PageB />} />
          <Route path="/c" element={<div>page C</div>} />
        </Routes>
      </HashRouter>
    );
    await user.click(screen.getByRole('button', { name: 'go to b' }));
    await settleHistory();
    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    await settleHistory();
    await user.click(screen.getByRole('button', { name: 'close and go to c' }));
    await settleHistory();
    expect(path()).toBe('/c'); // history: a, b, [orphan marker], c

    slow = slowBack({ delay: SLOW });
    await slow.userBack(); // lands on the orphan; the hook steps over it with a (slow) back()
    await settleFor(WATCHDOG_MS + 400);
    expect(slow.calls).toBe(1); // a second back() here would skip /b as well
    await settleFor(SLOW + 300);
    expect(path()).toBe('/b');
    expect(slow.calls).toBe(1);
  }, 20000);
});
