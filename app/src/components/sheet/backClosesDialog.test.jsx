import React, { useRef, useState } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SheetShell, SheetCloseButton } from './SheetShell.jsx';
import { ConfirmSheet } from '../ConfirmSheet.jsx';
import { pressSystemBack, pressSystemForward, settleHistory, resetHashTo } from '../../test-utils/history.js';

/**
 * back-closes-dialogs-and-wizard-polish, item A (AC1-AC4, AC6, AC7, AC9, AC10).
 *
 * The system Back (Android button / gesture / iOS edge swipe / desktop browser
 * Back) must close the topmost dialog instead of leaving the page. These tests
 * drive the REAL jsdom session history through a REAL react-router HashRouter
 * (see test-utils/history.js): the guarantees under test — no stale entry (AC3)
 * and no swallowed Back (AC7) — are statements about where `history.back()`
 * lands, which a faked popstate cannot prove.
 *
 * Every scenario walks /a -> /b first so "previous page" is observable: a Back
 * that wrongly leaves the page lands on /a, a Back that is wrongly swallowed
 * stays on /b when it should have reached /a.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

function PathProbe() {
  const { pathname } = useLocation();
  return <output data-testid="path">{pathname}</output>;
}

const currentPath = () => screen.getByTestId('path').textContent;

/** The ✕ / named button inside one specific dialog. */
function buttonIn(dialogName, buttonName) {
  const dialog = screen.getByRole('dialog', { name: dialogName });
  const match = Array.from(dialog.querySelectorAll('button')).find((b) =>
    buttonName.test(b.getAttribute('aria-label') || b.textContent)
  );
  if (!match) throw new Error(`no button ${buttonName} in dialog ${dialogName}`);
  return match;
}

/** A page with a text input (page state that must survive a dialog Back), one
 * SheetShell dialog A, a nested dialog B opened from A, and a close-and-navigate action. */
function DialogPage({ spies }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  React.useEffect(() => {
    spies.pageMounted();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeA = () => {
    spies.closeA();
    setOpen(false);
  };
  const closeB = () => {
    spies.closeB();
    setNested(false);
  };

  return (
    <div>
      <input aria-label="page draft" />
      <button type="button" onClick={() => setOpen(true)}>open A</button>
      {open && (
        <SheetShell labelledBy="a-title" onClose={closeA}>
          <h3 id="a-title">Dialog A</h3>
          <SheetCloseButton onClick={closeA} />
          <button type="button" onClick={() => setNested(true)}>open B</button>
          <button type="button" onClick={() => setOpen(false)}>own action A</button>
          <button type="button" onClick={() => { setOpen(false); navigate('/c'); }}>close A and go to C</button>
        </SheetShell>
      )}
      {nested && (
        <SheetShell labelledBy="b-title" onClose={closeB}>
          <h3 id="b-title">Dialog B</h3>
          <SheetCloseButton onClick={closeB} />
        </SheetShell>
      )}
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate('/b')}>go to b</button>;
}

function freshSpies() {
  return { closeA: vi.fn(), closeB: vi.fn(), pageMounted: vi.fn() };
}

/** Mount the app at /a and walk to /b, so the history is [.., /a, /b]. */
async function mountAtB({ spies = freshSpies(), bPage, cPage } = {}) {
  resetHashTo('#/a');
  const user = userEvent.setup();
  render(
    <HashRouter>
      <PathProbe />
      <Routes>
        <Route path="/a" element={<Landing />} />
        <Route path="/b" element={bPage ?? <DialogPage spies={spies} />} />
        <Route path="/c" element={cPage ?? <div>page C</div>} />
      </Routes>
    </HashRouter>
  );
  await user.click(screen.getByRole('button', { name: 'go to b' }));
  await settleHistory();
  expect(currentPath()).toBe('/b');
  return { user, spies };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  cleanup();
  await settleHistory();
});

describe('AC2 — with no dialog open Back behaves exactly as today', () => {
  it('goes to the previous page in one press', async () => {
    await mountAtB();
    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });
});

describe('AC1 — Back closes the open dialog instead of leaving the page', () => {
  it('closes the sheet, keeps the route, keeps the page under it alive, and returns focus to the trigger', async () => {
    const { user, spies } = await mountAtB();
    await user.type(screen.getByLabelText('page draft'), 'typed-before-dialog');
    const trigger = screen.getByRole('button', { name: 'open A' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Dialog A' })).toBeInTheDocument();

    await pressSystemBack();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');
    expect(spies.closeA).toHaveBeenCalledTimes(1);
    expect(spies.pageMounted).toHaveBeenCalledTimes(1); // the page underneath was not remounted
    expect(screen.getByLabelText('page draft')).toHaveValue('typed-before-dialog');
    expect(trigger).toHaveFocus();
  });

  it('after the dialog is closed by Back, the NEXT Back goes to the previous page (one press)', async () => {
    const { user } = await mountAtB();
    await user.click(screen.getByRole('button', { name: 'open A' }));
    await pressSystemBack();
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('works the second time too: open, Back, open, Back, then Back leaves the page', async () => {
    const { user } = await mountAtB();
    for (let i = 0; i < 2; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole('button', { name: 'open A' }));
      // eslint-disable-next-line no-await-in-loop
      await pressSystemBack();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(currentPath()).toBe('/b');
    }
    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });
});

describe('AC3 — closing by any other means leaves history as if it had never opened', () => {
  const CLOSERS = [
    ['the ✕ button', (user) => user.click(screen.getByRole('button', { name: /^cerrar$/i }))],
    ['a scrim tap', (user) => user.click(screen.getByRole('dialog').parentElement)],
    ['Escape', (user) => user.keyboard('{Escape}')],
    ["the dialog's own action", (user) => user.click(screen.getByRole('button', { name: 'own action A' }))],
  ];

  it.each(CLOSERS)('%s: the route is unchanged and ONE Back reaches the previous page', async (_label, close) => {
    const { user } = await mountAtB();
    await user.click(screen.getByRole('button', { name: 'open A' }));
    await close(user);
    await settleHistory();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');

    await pressSystemBack();

    expect(currentPath()).toBe('/a');
  });

  it('a Back pressed immediately after closing (before the history settles) still lands on the previous page', async () => {
    const { user } = await mountAtB();
    await user.click(screen.getByRole('button', { name: 'open A' }));
    await user.click(screen.getByRole('button', { name: /^cerrar$/i }));
    // No settle: the close's own history work may still be in flight.
    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('opening and closing many times does not accumulate entries: one Back still reaches /a', async () => {
    const { user } = await mountAtB();
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole('button', { name: 'open A' }));
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole('button', { name: /^cerrar$/i }));
      // eslint-disable-next-line no-await-in-loop
      await settleHistory();
    }
    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('unmount + mount of a dialog in ONE commit (StrictMode-style remount) leaves exactly one entry', async () => {
    function Flip() {
      const [open, setOpen] = useState(false);
      const [gen, setGen] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>open</button>
          <button type="button" onClick={() => setGen((g) => g + 1)}>remount</button>
          {open && (
            <SheetShell key={gen} labelledBy="f-title" onClose={() => setOpen(false)}>
              <h3 id="f-title">Flip</h3>
              <SheetCloseButton onClick={() => setOpen(false)} />
            </SheetShell>
          )}
        </div>
      );
    }
    const { user } = await mountAtB({ bPage: <Flip /> });
    await user.click(screen.getByRole('button', { name: 'open' }));
    await user.click(screen.getByRole('button', { name: 'remount' }));
    await settleHistory();
    expect(screen.getByRole('dialog', { name: 'Flip' })).toBeInTheDocument();

    await pressSystemBack(); // closes the re-mounted dialog, not the page
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');
    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });
});

describe('AC4 — nested dialogs close one per Back, topmost first', () => {
  async function openBoth(user) {
    await user.click(screen.getByRole('button', { name: 'open A' }));
    await user.click(screen.getByRole('button', { name: 'open B' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
  }

  it('Back closes only the top dialog; the next Back closes the one below; the next leaves the page', async () => {
    const { user, spies } = await mountAtB();
    await openBoth(user);

    await pressSystemBack();
    expect(screen.queryByRole('dialog', { name: 'Dialog B' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Dialog A' })).toBeInTheDocument();
    expect(spies.closeB).toHaveBeenCalledTimes(1);
    expect(spies.closeA).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(spies.closeA).toHaveBeenCalledTimes(1);
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('closing the top dialog with its ✕ leaves the one below armed: the next Back closes IT, not the page', async () => {
    const { user, spies } = await mountAtB();
    await openBoth(user);

    await user.click(buttonIn('Dialog B', /cerrar|close/i));
    await settleHistory();
    expect(screen.queryByRole('dialog', { name: 'Dialog B' })).not.toBeInTheDocument();

    await pressSystemBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(spies.closeA).toHaveBeenCalledTimes(1);
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('both dialogs closed by their own controls, then Back goes straight to the previous page', async () => {
    const { user } = await mountAtB();
    await openBoth(user);
    await user.click(buttonIn('Dialog B', /cerrar|close/i));
    await user.click(screen.getByRole('button', { name: 'own action A' }));
    await settleHistory();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });
});

describe('one dialog replaced by another in the same commit (end-session -> discard-confirm pattern)', () => {
  function Swap({ spies }) {
    const [which, setWhich] = useState(null); // null | 'end' | 'discard'
    return (
      <div>
        <button type="button" onClick={() => setWhich('end')}>end session</button>
        {which === 'end' && (
          <ConfirmSheet
            title="End session"
            primaryLabel="Finish"
            onPrimary={() => {}}
            cancelLabel="Keep going"
            onCancel={() => { spies.endCancel(); setWhich(null); }}
            destructiveAction={{ label: 'Discard', onClick: () => setWhich('discard') }}
          />
        )}
        {which === 'discard' && (
          <ConfirmSheet
            title="Discard session"
            primaryLabel="Yes, discard"
            onPrimary={() => {}}
            cancelLabel="Back to end dialog"
            onCancel={() => { spies.discardCancel(); setWhich('end'); }}
            danger
          />
        )}
      </div>
    );
  }

  it('the replacement is armed exactly once: Back cancels it (re-opening the first), Back again closes that, Back leaves the page', async () => {
    const spies = { endCancel: vi.fn(), discardCancel: vi.fn() };
    const { user } = await mountAtB({ bPage: <Swap spies={spies} /> });
    await user.click(screen.getByRole('button', { name: 'end session' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await settleHistory();
    expect(screen.getByRole('alertdialog', { name: 'Discard session' })).toBeInTheDocument();

    await pressSystemBack();
    expect(spies.discardCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog', { name: 'End session' })).toBeInTheDocument();
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(spies.endCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });
});

describe('AC6 — ConfirmSheet: Back is Cancel, never the primary action; ignored while busy', () => {
  function ConfirmPage({ spies, control }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    control.setBusy = setBusy;
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>ask</button>
        {open && (
          <ConfirmSheet
            title="Delete it?"
            primaryLabel="Delete"
            onPrimary={spies.primary}
            cancelLabel="Keep"
            onCancel={() => { spies.cancel(); setOpen(false); }}
            danger
            busy={busy}
          />
        )}
      </div>
    );
  }

  it('Back calls onCancel once, never onPrimary, and leaves the route alone', async () => {
    const spies = { primary: vi.fn(), cancel: vi.fn() };
    const { user } = await mountAtB({ bPage: <ConfirmPage spies={spies} control={{}} /> });
    await user.click(screen.getByRole('button', { name: 'ask' }));

    await pressSystemBack();

    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(spies.primary).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('while busy, Back is ignored: the user stays on the dialog AND on the page; once idle, Back cancels', async () => {
    const spies = { primary: vi.fn(), cancel: vi.fn() };
    const control = {};
    const { user } = await mountAtB({ bPage: <ConfirmPage spies={spies} control={control} /> });
    await user.click(screen.getByRole('button', { name: 'ask' }));
    act(() => control.setBusy(true));

    await pressSystemBack();

    expect(spies.cancel).not.toHaveBeenCalled();
    expect(spies.primary).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Delete it?' })).toBeInTheDocument();
    expect(currentPath()).toBe('/b'); // did NOT leave the page

    // Still armed: a second Back while busy is ignored again...
    await pressSystemBack();
    expect(screen.getByRole('alertdialog', { name: 'Delete it?' })).toBeInTheDocument();
    expect(currentPath()).toBe('/b');

    // ...and once the work is done, Back behaves like Cancel.
    act(() => control.setBusy(false));
    await pressSystemBack();
    expect(spies.cancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');

    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('a ConfirmSheet with no onCancel cannot be dismissed by Back either (same as Escape today)', async () => {
    const primary = vi.fn();
    await mountAtB({ bPage: <ConfirmSheet title="Only one way out" primaryLabel="OK" onPrimary={primary} /> });
    await pressSystemBack();
    expect(screen.getByRole('alertdialog', { name: 'Only one way out' })).toBeInTheDocument();
    expect(currentPath()).toBe('/b');
    expect(primary).not.toHaveBeenCalled();
  });
});

describe('AC7 — a dialog that closes because the route changes under it leaves no orphan entry', () => {
  function NavigatingConfirm({ spies, replace = false }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>discard</button>
        {open && (
          <ConfirmSheet
            title="Discard session"
            primaryLabel="Yes, discard"
            onPrimary={() => navigate('/c', { replace })}
            cancelLabel="No"
            onCancel={() => { spies.cancel(); setOpen(false); }}
            danger
          />
        )}
      </div>
    );
  }

  it("navigate(push) from the dialog's own action: lands on /c, then each Back is a real step (c -> b -> a), nothing swallowed", async () => {
    const spies = { cancel: vi.fn() };
    const { user } = await mountAtB({ bPage: <NavigatingConfirm spies={spies} /> });
    await user.click(screen.getByRole('button', { name: 'discard' }));
    await user.click(screen.getByRole('button', { name: 'Yes, discard' }));
    await settleHistory();
    expect(currentPath()).toBe('/c'); // the dialog's cleanup must not pop the new page off

    await pressSystemBack();
    expect(currentPath()).toBe('/b');

    await pressSystemBack(); // would still be /b if an orphan entry swallowed a press
    expect(currentPath()).toBe('/a');
    expect(spies.cancel).not.toHaveBeenCalled(); // no phantom close fired
  });

  it("navigate(replace) from the dialog's own action: lands on /c; Back goes to /b then /a", async () => {
    const spies = { cancel: vi.fn() };
    const { user } = await mountAtB({ bPage: <NavigatingConfirm spies={spies} replace /> });
    await user.click(screen.getByRole('button', { name: 'discard' }));
    await user.click(screen.getByRole('button', { name: 'Yes, discard' }));
    await settleHistory();
    expect(currentPath()).toBe('/c');

    await pressSystemBack();
    expect(currentPath()).toBe('/b');
    await pressSystemBack();
    expect(currentPath()).toBe('/a');
    expect(spies.cancel).not.toHaveBeenCalled();
  });

  it('after the orphan, a NEW dialog on the next page still works: Back closes it once, then goes to the previous pages', async () => {
    const spies = freshSpies();
    function OnC() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>open on c</button>
          {open && (
            <SheetShell labelledBy="c-title" onClose={() => { spies.closeB(); setOpen(false); }}>
              <h3 id="c-title">Dialog on C</h3>
              <SheetCloseButton onClick={() => setOpen(false)} />
            </SheetShell>
          )}
        </div>
      );
    }
    const { user } = await mountAtB({ spies, cPage: <OnC /> });
    await user.click(screen.getByRole('button', { name: 'open A' }));
    await user.click(screen.getByRole('button', { name: 'close A and go to C' }));
    await settleHistory();
    expect(currentPath()).toBe('/c');

    await user.click(screen.getByRole('button', { name: 'open on c' }));
    await pressSystemBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(spies.closeB).toHaveBeenCalledTimes(1);
    expect(currentPath()).toBe('/c');

    await pressSystemBack();
    expect(currentPath()).toBe('/b');
    await pressSystemBack();
    expect(currentPath()).toBe('/a');
    expect(spies.closeB).toHaveBeenCalledTimes(1); // no phantom second close
    expect(spies.closeA).not.toHaveBeenCalled();
  });

  // Worst ordering for a "pop my entry on unmount" implementation: React runs the dialog's
  // cleanup first, then the page's effect navigates; a history.back() issued (synchronously) by
  // the cleanup would execute against the NEW entry and silently undo the navigation. (jsdom
  // drops a queued traversal when pushState runs, so the push variant cannot fail there — it
  // documents the ordering; the replace variant is the one that discriminates in jsdom.)
  it.each([['push', false], ['replace', true]])('a navigation (%s) fired by an EFFECT in the same commit that unmounts the dialog is not popped off by the dialog cleanup', async (_mode, replace) => {
    function EffectNav() {
      const navigate = useNavigate();
      const [open, setOpen] = useState(false);
      const [go, setGo] = useState(false);
      React.useEffect(() => {
        if (go) navigate('/c', { replace });
      }, [go, navigate]);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>discard</button>
          {open && (
            <ConfirmSheet
              title="Discard session"
              primaryLabel="Yes, discard"
              onPrimary={() => {
                setOpen(false);
                setGo(true);
              }}
              cancelLabel="No"
              onCancel={() => setOpen(false)}
              danger
            />
          )}
        </div>
      );
    }
    const { user } = await mountAtB({ bPage: <EffectNav /> });
    await user.click(screen.getByRole('button', { name: 'discard' }));
    await user.click(screen.getByRole('button', { name: 'Yes, discard' }));
    await settleHistory();
    expect(currentPath()).toBe('/c');

    await pressSystemBack();
    expect(currentPath()).toBe('/b');
    await pressSystemBack();
    expect(currentPath()).toBe('/a');
  });

  it('desktop Forward over the skipped entry still reaches the page that was left (Back then Forward)', async () => {
    const { user } = await mountAtB();
    await user.click(screen.getByRole('button', { name: 'open A' }));
    await user.click(screen.getByRole('button', { name: 'close A and go to C' }));
    await settleHistory();
    expect(currentPath()).toBe('/c');
    await pressSystemBack();
    expect(currentPath()).toBe('/b');

    await pressSystemForward();
    expect(currentPath()).toBe('/c');
  });
});

describe('AC9 — one shared implementation, no per-sheet code', () => {
  it('a brand-new sheet that is nothing but <SheetShell> closes on Back with no extra wiring', async () => {
    const onClose = vi.fn();
    function Bare() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>open bare</button>
          {open && (
            <SheetShell labelledBy="bare-title" onClose={() => { onClose(); setOpen(false); }}>
              <h3 id="bare-title">Bare</h3>
              <button type="button">noop</button>
            </SheetShell>
          )}
        </div>
      );
    }
    const { user } = await mountAtB({ bPage: <Bare /> });
    await user.click(screen.getByRole('button', { name: 'open bare' }));
    await pressSystemBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(currentPath()).toBe('/b');
  });

  it('Back closes the sheet even where Escape has a different nuance (ClubPickerSheet-style onEscape)', async () => {
    const onClose = vi.fn();
    const onEscape = vi.fn();
    function Custom() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>open custom</button>
          {open && (
            <SheetShell labelledBy="x-title" onClose={() => { onClose(); setOpen(false); }} onEscape={onEscape}>
              <h3 id="x-title">Custom</h3>
              <button type="button">noop</button>
            </SheetShell>
          )}
        </div>
      );
    }
    const { user } = await mountAtB({ bPage: <Custom /> });
    await user.click(screen.getByRole('button', { name: 'open custom' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await pressSystemBack(); // Back == close (Q4): it does not go through onEscape
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');
  });

  it('SheetShell.jsx and OnboardingOverlay.jsx both use the shared useBackClosesDialog hook (same primitive, not a copy)', () => {
    const importRe =
      /import\s*\{[^}]*\buseBackClosesDialog\b[^}]*\}\s*from\s*['"][^'"]*useBackClosesDialog(\.js)?['"]/;
    const shell = fs.readFileSync(path.join(HERE, 'SheetShell.jsx'), 'utf8');
    const overlay = fs.readFileSync(path.join(HERE, '..', 'OnboardingOverlay.jsx'), 'utf8');
    expect(shell).toMatch(importRe);
    expect(shell).toMatch(/useBackClosesDialog\(/);
    expect(overlay).toMatch(importRe);
    expect(overlay).toMatch(/useBackClosesDialog\(/);
  });
});

describe('AC10 — desktop: same mechanism, no device detection', () => {
  it('the shared hook decides nothing from the user agent or pointer type', () => {
    const file = path.join(HERE, '..', '..', 'lib', 'useBackClosesDialog.js');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).not.toMatch(/userAgent|matchMedia|pointer:\s*coarse|maxTouchPoints|ontouchstart/);
  });

  it('browser Back (the same history.back() a desktop user triggers) closes the dialog and the page stays', async () => {
    const { user } = await mountAtB();
    await user.click(screen.getByRole('button', { name: 'open A' }));
    await pressSystemBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentPath()).toBe('/b');
  });
});
