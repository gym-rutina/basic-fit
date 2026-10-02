import { useEffect, useRef } from 'react';

/**
 * The system Back (Android button / gesture, iOS edge swipe, desktop browser Back) closes the
 * topmost open dialog instead of leaving the page. Shared by `SheetShell` (every sheet) and
 * `OnboardingOverlay`, so a new dialog gets the behaviour with no per-dialog code.
 *
 * HOW — history MARKER entries, router-agnostic (feature 2026-10-02, ADR in its tech-plan §1):
 *   - Every open dialog owns exactly one extra history entry (a "marker"): a copy of the entry it
 *     was opened on plus `__bfDialog: depth`. Same URL, so the router sees no location change and
 *     the page underneath is never re-rendered or scrolled. `usr`/`key`/`idx` are copied so the
 *     router's `location.key` / monotonic `idx` bookkeeping stays coherent (`goBack` in App.jsx
 *     reads `location.key === 'default'`) — keep that copy even though no screen reads it.
 *   - Back pops the marker -> `popstate` -> the depth of the landed entry is lower than the number
 *     of open dialogs -> the TOPMOST dialog's handler runs (Back == ✕; N nested dialogs = N presses).
 *   - Closing a dialog any other way (✕, scrim, Escape, its own action) unregisters it; if its
 *     marker is still the current entry we pop it with history.back(), so the stack is as if the
 *     dialog had never opened (no stale entry).
 *   - If the route changed under the dialog (e.g. confirm-discard -> navigate('/')), the current
 *     entry is a router entry, not our marker: we must NOT back() (that would pop the new page).
 *     The marker is now an ORPHAN below the new page; when the user later lands on it (depth >
 *     open dialogs) we step over it in the direction of travel, so one Back = one real page step
 *     and nothing is swallowed. "Is my marker still current?" is decided in a MICROTASK after
 *     unmount (see `unregister`): a navigation fired by an effect in the same commit must land first.
 *   - Our own history.back()/forward() calls are counted (`pending`) so their popstate is never
 *     mistaken for a user Back, and no marker is pushed while one is in flight (history.back()
 *     resolves relative to the entry current WHEN IT RUNS, so a pushState issued before it runs
 *     would be popped instead). Opening dialog B in the same commit that closes dialog A therefore
 *     waits for A's pop to land, then pushes.
 *   - "Own" is decided by WHERE the popstate lands, not by how long it took. Each traversal records
 *     the entry it expects to land on (`expected`). The watchdog only stops BLOCKING on a slow
 *     traversal after WATCHDOG_MS; it does not forget it: the first popstate after that is still
 *     matched against `expected`, and a match is our own late landing, never a user Back (a loaded
 *     device or CI box can deliver it seconds late). Until it lands, or LOST_MS passes, we neither
 *     push a marker over the entry we are leaving nor issue a second back() for it (that would
 *     pop twice and leave the page).
 *   - No react-router import: SheetShell is rendered without a Router in many suites, and the
 *     mechanism needs only `window.history`. No device sniffing either: desktop browser Back works
 *     through the same path.
 *
 * Contract for `onBack`: return `false` to keep the dialog open (Back was consumed in place:
 * ConfirmSheet while busy, the onboarding carousel stepping back, a confirm opening over it) ->
 * the marker is re-pushed immediately. Any other return means "I am going away". As a safety net,
 * a dialog still mounted one macrotask after a Back is re-armed anyway.
 *
 * Known limits (documented, not hidden): Chrome's history-manipulation intervention may skip a
 * marker pushed with no prior user activation (first-run carousel before the first tap: degrades
 * to today's "Back leaves the page"); reload with a dialog open leaves one stale marker that the
 * next dialog adopts (<= 1 extra Back press); a dialog that stays open across a router push is
 * unsupported; `history.go(-n)` with n > 1 only runs the top dialog's handler; parent and child
 * dialogs mounting in the SAME commit would invert the stack (children's effects run first).
 * What remains of the slow-traversal risk: if our own traversal NEVER lands (the browser refused
 * it) and, within LOST_MS of the watchdog, the user presses Back and that lands exactly on the
 * entry we expected, that one Back is taken for ours and swallowed (the dialog is re-armed, so the
 * next Back works). After LOST_MS we give up on the traversal and recover (re-arm / retry).
 * Likewise, if our own traversal lands MORE than WATCHDOG_MS + LOST_MS (11s) late — past the point
 * where we wrote it off — it is read as a user Back and the topmost dialog closes by mistake. Only a
 * badly stalled device/CI box gets there; no code path can tell the two apart from the popstate alone.
 * Not yet verified on real hardware: the Android/iOS manual Back check is still open.
 */

const KEY = '__bfDialog';
// How long we BLOCK waiting for the popstate of one of OUR OWN back()/forward() calls before we
// stop treating it as in flight for bookkeeping (a traversal that cannot happen never fires
// popstate; do not stay blocked forever). It does not reclassify the popstate if it shows up later:
// see `expected`.
const WATCHDOG_MS = 1000;
// How long after the watchdog we still accept a late landing on the expected entry as our own and
// hold off touching the entry we left. Past this the traversal is written off as dead.
const LOST_MS = 10000;

/** Open dialogs, bottom -> top. */
const stack = [];
/** Our own history traversals (back/forward) whose popstate has not arrived. */
let pending = 0;
let listening = false;
let lastIdx = null;
let lastDirection = 'back';
let watchdog = null;
/**
 * Where our in-flight (or watchdog-released but unresolved) traversal must land, and the entry it
 * leaves: `{ depth, idx, fromDepth, fromIdx }` (`depth`/`idx` null = unknown, not compared).
 */
let expected = null;
let lostTimer = null;

const hasWindow = () => typeof window !== 'undefined' && window.history;
const isObject = (v) => v !== null && typeof v === 'object';
const depthOf = (state) => (isObject(state) && Number.isInteger(state[KEY]) && state[KEY] > 0 ? state[KEY] : 0);
const idxOf = (state) => (isObject(state) && Number.isInteger(state.idx) ? state.idx : null);

function pushMarker(depth) {
  try {
    const state = window.history.state;
    const idx = idxOf(state);
    const next = { ...(isObject(state) ? state : {}), [KEY]: depth };
    if (idx !== null) next.idx = idx + 1; // keep react-router's monotonic index coherent
    window.history.pushState(next, '');
    lastIdx = idxOf(next);
  } catch {
    /* pushState refused (sandboxed / rate-limited): this dialog just has no Back support */
  }
}

/** Did a popstate that landed on (depth, idx) complete the traversal `exp` describes? */
function landedOn(exp, depth, idx) {
  if (exp.depth === null && exp.idx === null) return false; // nothing to compare: never claim it
  return (exp.depth === null || depth === exp.depth) && (exp.idx === null || idx === exp.idx);
}

/** Stop tracking the expected landing (it arrived, was superseded, or was written off). */
function forget() {
  expected = null;
  window.clearTimeout(lostTimer);
  lostTimer = null;
}

/** The watchdog released our traversal, it has not landed, and we are still on the entry it leaves. */
function unsettled() {
  if (expected === null) return false;
  const state = window.history.state;
  return depthOf(state) === expected.fromDepth && idxOf(state) === expected.fromIdx;
}

function traverse(direction) {
  const from = window.history.state;
  const fromIdx = idxOf(from);
  forget();
  expected = {
    depth: direction === 'forward' ? null : Math.max(depthOf(from) - 1, 0),
    idx: fromIdx === null ? null : fromIdx + (direction === 'forward' ? 1 : -1),
    fromDepth: depthOf(from),
    fromIdx,
  };
  pending += 1;
  lastDirection = direction;
  window.clearTimeout(watchdog);
  // A traversal that cannot happen (nothing to go to) never fires popstate; do not stay blocked.
  // On expiry we stop blocking but KEEP `expected`, so a late landing is still recognised as ours;
  // LOST_MS later we write it off and recover. See WATCHDOG_MS / LOST_MS above.
  watchdog = window.setTimeout(() => {
    pending = 0;
    window.clearTimeout(lostTimer);
    lostTimer = window.setTimeout(() => {
      forget();
      sync();
    }, LOST_MS);
    sync();
  }, WATCHDOG_MS);
  if (direction === 'forward') window.history.forward();
  else window.history.back();
}

/** Make the history match the open dialogs after a register/unregister/landing. */
function sync() {
  if (pending > 0 || unsettled()) return; // wait for our own traversal to land
  let depth = depthOf(window.history.state);
  if (depth > stack.length) {
    traverse('back'); // a closed dialog's marker is still on top, or a stale one after reload
    return;
  }
  while (depth < stack.length) {
    depth += 1;
    pushMarker(depth);
  }
}

/** Re-push markers for dialogs that are still open but lost theirs. */
function rearm() {
  if (pending > 0 || unsettled()) return;
  let depth = depthOf(window.history.state);
  while (depth < stack.length) {
    depth += 1;
    pushMarker(depth);
  }
}

function onPopState() {
  const state = window.history.state;
  const depth = depthOf(state);
  const idx = idxOf(state);
  // Direction of travel. Router pushes are invisible to us, so lastIdx can only be STALE-LOW:
  // claim "forward" only on positive evidence (strictly higher index), otherwise assume Back.
  const movedForward = lastIdx !== null && idx !== null && idx > lastIdx;
  if (idx !== null) lastIdx = idx;

  if (pending > 0) {
    pending -= 1;
    if (pending === 0) {
      window.clearTimeout(watchdog);
      forget();
      // Landed on another unowned marker (two orphans in a row): keep going the same way.
      if (depth > stack.length) traverse(lastDirection);
      else sync();
    }
    return;
  }

  if (expected !== null) {
    // The watchdog stopped blocking on our traversal, but it may just have been slow. The first
    // popstate after that settles it: landing on the expected entry = ours, finally arrived (not a
    // user Back, so no dialog may close); anywhere else = ours is not coming, carry on as a user move.
    const own = landedOn(expected, depth, idx);
    forget();
    if (own) {
      if (depth > stack.length) traverse(lastDirection);
      else sync();
      return;
    }
  }

  if (depth > stack.length) {
    // Landed on a marker nobody owns (orphan left by a route change under a dialog).
    traverse(movedForward ? 'forward' : 'back');
    return;
  }

  if (depth < stack.length) {
    // Back popped the topmost dialog's marker.
    const top = stack[stack.length - 1];
    const result = top.handle();
    if (result === false) rearm();
    else window.setTimeout(rearm, 0); // safety net: still mounted after the flush -> re-arm
  }
}

function register(entry) {
  if (!hasWindow()) return;
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    listening = true;
  }
  stack.push(entry);
  sync();
}

function unregister(entry) {
  if (!hasWindow()) return;
  const i = stack.indexOf(entry);
  if (i === -1) return;
  stack.splice(i, 1);
  const idx = idxOf(window.history.state);
  if (idx !== null) lastIdx = idx;
  // Deferred to a microtask: a navigation fired by an effect in the SAME commit that unmounted
  // this dialog (push) must have landed before we decide whether our marker is still the current
  // entry — history.back() runs relative to whatever is current when it executes, so popping
  // after the push would pop the NEW page. Also lets a dialog that is replaced in the same commit
  // (StrictMode remount, end-session -> discard-confirm) simply adopt the marker already there.
  queueMicrotask(sync);
}

/**
 * @param {() => (boolean|void)} onBack  what Back does for this dialog; return `false` to stay
 *   open. Read through a ref: a new closure each render is fine.
 * @param {boolean} [enabled=true]
 */
export function useBackClosesDialog(onBack, enabled = true) {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    if (!enabled) return undefined;
    const entry = { handle: () => (handlerRef.current ? handlerRef.current() : undefined) };
    register(entry);
    return () => unregister(entry);
  }, [enabled]);
}
