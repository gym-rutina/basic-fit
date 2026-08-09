#!/usr/bin/env node

/**
 * Mobile viewport regression check for rutina-pwa.
 *
 * Guards against the two bug classes fixed earlier in this project's static
 * pages and carried forward as an explicit spec requirement for this feature:
 *   1. Page-level horizontal scroll (an unwrapped wide element, e.g. a table
 *      not inside overflow-x:auto).
 *   2. The bottom tab bar wrapping to multiple rows instead of staying a
 *      single row of 5 fixed items.
 *
 * Starts `npm run preview` automatically when nothing is listening on the
 * target port. Run: node tests/viewport-check.js [baseUrl]
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const REPO_ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.argv[2] || 'http://localhost:4173';
const WIDTHS = [280, 360, 390, 412, 768];
const ROUTES = ['/import', '/', '/program', '/catalog', '/history', '/progress', '/session', '/export'];
const HEIGHT = 800;

const EXAMPLE_RUTINA = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'data/examples/phase1-monday.json'), 'utf8')
);

// db.js is an ES module (imports `idb`), so it can't be `require()`d from this
// CommonJS harness, and dynamic `import()` would need the target treated as
// ESM too (no `"type": "module"` in this repo). Rather than duplicate the
// DB_VERSION literal here — which is exactly how this file drifted out of
// sync with app/src/lib/db.js's v1→v2 lastWeights re-key and broke every
// seeded route with a VersionError — read the constant out of the module's
// source text. If db.js's `const DB_VERSION = N;` line ever moves or
// changes shape, this throws immediately instead of silently going stale.
const DB_JS_SOURCE = fs.readFileSync(path.join(REPO_ROOT, 'app/src/lib/db.js'), 'utf8');
const DB_VERSION_MATCH = DB_JS_SOURCE.match(/const DB_VERSION = (\d+);/);
if (!DB_VERSION_MATCH) {
  throw new Error(
    'viewport-check.js: could not find `const DB_VERSION = N;` in app/src/lib/db.js — ' +
      'update the regex above if the constant was renamed or reshaped.'
  );
}
const APP_DB_VERSION = Number(DB_VERSION_MATCH[1]);

const ACTIVE_SESSION = {
  id: 'viewport-test-active',
  dayLabel: EXAMPLE_RUTINA.days[0].label,
  dayIndex: 0,
  status: 'active',
  startedAt: '2026-07-15T10:00:00.000Z',
  endedAt: null,
  exercises: EXAMPLE_RUTINA.days[0].exercises.map((ex) => ({
    equipmentId: ex.equipmentId,
    name: ex.name,
    weightUsed: null,
    difficulty: null,
    completedAt: null,
  })),
};

const COMPLETED_SESSION = {
  ...ACTIVE_SESSION,
  id: 'viewport-test-completed',
  status: 'completed',
  endedAt: '2026-07-15T11:00:00.000Z',
  exercises: ACTIVE_SESSION.exercises.map((ex) => ({
    ...ex,
    weightUsed: 32,
    difficulty: 'normal',
    completedAt: '2026-07-15T10:30:00.000Z',
  })),
};

let previewProc = null;

async function isServerUp(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok || res.status === 304;
  } catch {
    return false;
  }
}

async function waitForServer(url, maxMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isServerUp(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Preview server at ${url} did not become ready within ${maxMs}ms`);
}

async function ensurePreviewServer() {
  if (await isServerUp(BASE_URL)) return;
  previewProc = spawn('npm', ['run', 'preview'], {
    cwd: REPO_ROOT,
    shell: true,
    stdio: 'ignore',
  });
  await waitForServer(BASE_URL);
}

function stopPreviewServer() {
  if (previewProc && !previewProc.killed) {
    if (process.platform === 'win32' && previewProc.pid) {
      // `spawn(..., { shell: true })` on Windows runs the command through
      // cmd.exe, so previewProc is that cmd.exe wrapper, not `vite preview`
      // itself. previewProc.kill() only signals the wrapper — the actual
      // server process it launched (and its own children) survives, keeps
      // holding the port, and silently serves whatever `dist/` existed when
      // it started to the NEXT run. That is exactly the stale-server
      // artifact this harness needs to not produce. Kill the whole tree.
      spawnSync('taskkill', ['/pid', String(previewProc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      previewProc.kill();
    }
    previewProc = null;
  }
}

// Belt-and-suspenders for the same orphan-server problem: `stopPreviewServer`
// only runs if control reaches the `finally` in `main()` or the `.catch` at
// the bottom of this file. A crash mid-flight (an uncaught puppeteer
// ProtocolError from a race, a SIGINT, the process being killed) can skip
// both and leave the spawned `vite preview` server holding port 4173 for the
// NEXT run to silently attach to — exactly the stale-bundle masking this
// file exists to prevent. `stopPreviewServer` is synchronous (spawnSync), so
// it is safe to call from Node's 'exit' handler.
process.on('exit', stopPreviewServer);
process.on('SIGINT', () => {
  stopPreviewServer();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopPreviewServer();
  process.exit(143);
});

async function seedIndexedDB(page, { rutina, sessions }) {
  await page.evaluate(
    async ({ rutinaData, sessionData, dbVersion }) => {
      await new Promise((resolve, reject) => {
        // No explicit version: every seeded route navigates to /#/import
        // first (see checkRoute below), which lets the app itself open (and,
        // on a fresh profile, create) the DB at its own current version.
        // Requesting a specific version here would race that open and throw
        // VersionError the moment the two disagree — which is exactly what
        // hardcoding version 1 did against the app's v2 lastWeights re-key.
        // Opening bare just attaches to whatever version already exists.
        const req = indexedDB.open('basicfit-rutina');
        // Only fires on a truly fresh profile (no route currently seeds
        // without visiting /import first) — kept as a defensive fallback so
        // seeding still works if that ever changes. Schema must match the
        // CURRENT app schema, not a frozen snapshot of it.
        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('activeRutina')) {
            db.createObjectStore('activeRutina', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('sessions')) {
            const store = db.createObjectStore('sessions', { keyPath: 'id' });
            store.createIndex('by-status', 'status');
            store.createIndex('by-startedAt', 'startedAt');
          }
          if (!db.objectStoreNames.contains('lastWeights')) {
            db.createObjectStore('lastWeights', { keyPath: 'exerciseKey' });
          }
        };
        req.onsuccess = (event) => {
          const db = event.target.result;
          // Belt-and-suspenders: if this ever opens at a version the app
          // doesn't expect (e.g. the app failed to run its own upgrade
          // before /import finished loading), fail with a clear message
          // instead of a cryptic downstream write error.
          if (db.version !== dbVersion) {
            db.close();
            reject(
              new Error(
                `viewport-check seed: opened basicfit-rutina at version ${db.version}, ` +
                  `expected ${dbVersion} (app/src/lib/db.js DB_VERSION). The app's schema ` +
                  'and this seed data have drifted apart.'
              )
            );
            return;
          }
          const tx = db.transaction(['activeRutina', 'sessions'], 'readwrite');
          tx.objectStore('activeRutina').put({
            key: 'current',
            rutina: rutinaData,
            importedAt: new Date().toISOString(),
          });
          for (const session of sessionData) {
            tx.objectStore('sessions').put(session);
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    { rutinaData: rutina, sessionData: sessions, dbVersion: APP_DB_VERSION }
  );
}

function seedPlanForRoute(route) {
  if (route === '/session') {
    return { rutina: EXAMPLE_RUTINA, sessions: [ACTIVE_SESSION] };
  }
  if (route === '/export' || route === '/history' || route === '/progress') {
    return { rutina: EXAMPLE_RUTINA, sessions: [COMPLETED_SESSION] };
  }
  // Home / Program need an imported rutina; otherwise the shell redirects to /import
  // and we never paint the screen under test.
  if (route === '/' || route === '/program') {
    return { rutina: EXAMPLE_RUTINA, sessions: [] };
  }
  return null;
}

async function createPageWithRetry(browser, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await browser.newPage();
    } catch (err) {
      lastErr = err;
      // Target.createTarget faults observed in this file's own fix cycle
      // were transient CDP session hiccups under load — a short backoff
      // before retrying is enough for them to clear.
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

// `page` is created ONCE in main() and reused for every check (see main()'s
// comment for why). `errorSink` is a mutable `{ current: fn }` box: the
// page's single 'pageerror' listener (attached once, for the page's whole
// lifetime) calls `errorSink.current(err)`, and each checkRoute call points
// `errorSink.current` at ITS OWN failures array before doing anything else.
// Without this indirection, a pageerror firing asynchronously between
// checks — or attributed to whichever check happens to be running when a
// deferred error surfaces — would bleed into the wrong check's result.
async function checkRoute(page, width, route, errorSink) {
  const failures = [];
  errorSink.current = (err) => failures.push(`console error: ${err.message}`);

  try {
    await page.setViewport({ width, height: HEIGHT });

    const seed = seedPlanForRoute(route);
    if (seed) {
      await page.goto(`${BASE_URL}/#/import`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await seedIndexedDB(page, seed);
      // Full document navigation (new search param) remounts Shell so the
      // one-shot getActiveRutina() reads the seeded IndexedDB. Avoid reload(),
      // which intermittently hangs under the PWA service worker.
      await page.goto(`${BASE_URL}/?vp=${width}-${encodeURIComponent(route)}#${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } else {
      await page.goto(`${BASE_URL}/#${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await new Promise((r) => setTimeout(r, 500));

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (overflow.scrollWidth > overflow.clientWidth + 1) {
      failures.push(
        `horizontal overflow: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`
      );
    }

    const tabBarRows = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[data-testid="tab-item"]'));
      if (items.length === 0) return null;
      const tops = new Set(items.map((el) => el.getBoundingClientRect().top));
      return tops.size;
    });
    if (tabBarRows !== null && tabBarRows > 1) {
      failures.push(`bottom tab bar wrapped to ${tabBarRows} rows (expected 1)`);
    }
  } catch (err) {
    // Fault containment: nothing above this line runs outside this try, so
    // ANY failure in this one check — a bad selector, a goto timeout, a CDP
    // hiccup on setViewport/evaluate — is recorded as this check's own
    // failure and returned normally. It cannot escape to kill the width/route
    // loop in main(), which is what let one flaky check take down the other
    // 39 in every earlier run of this harness.
    failures.push(`navigation error: ${err.message}`);
  }

  return failures;
}

// `browser.close()` has been observed to hang indefinitely (>20s, no
// resolution) even against `about:blank` with no app loaded — a pre-existing
// fault in this harness's Chrome interaction, not the app or its service
// worker, and not something earlier runs of this file ever reached because
// they crashed before getting here. Left unbounded, a hang here means the
// process never exits, `$?` is whatever the caller sees from a killed/timed
// -out process, and a genuinely all-green run reports as a failure — the
// exact inversion this harness must not produce. Race the close against a
// timeout, then force-kill the browser process unconditionally — see the
// comment further down for why "only on timeout" is not enough either.
async function closeBrowserWithTimeout(browser, timeoutMs = 10000) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  // `.then(ok, ok)` — both the success and rejection branches resolve to
  // 'closed', so this promise itself never rejects. Without that, killing
  // the process out from under an in-flight close() (the timeout branch
  // below) can make the ORIGINAL close() promise settle — typically reject
  // — well after Promise.race has already moved on, producing a later
  // unhandled-rejection warning for a close we've already handled.
  const closing = browser.close().then(
    () => 'closed',
    () => 'closed'
  );
  try {
    await Promise.race([closing, timeout]);
  } finally {
    clearTimeout(timer);
    // Force-kill unconditionally, not only when the race above times out.
    // Verified directly in this fix cycle: `browser.close()` can resolve
    // 'closed' well inside the timeout — no hang — while the underlying
    // chrome.exe process tree keeps running for a further one to two
    // minutes afterward (confirmed by checking process CreationDate against
    // wall-clock time, well after this script's own node process had
    // already exited). A kill gated on "only if it timed out" misses that
    // path entirely, so every clean run would still leak a headless Chrome
    // process. `ChildProcess#kill()` on an already-exited process is a
    // documented no-op (returns false, does not throw), so calling it here
    // unconditionally is safe on the genuinely-instant-close path too.
    const proc = browser.process();
    if (proc) proc.kill('SIGKILL');
  }
}

async function main() {
  await ensurePreviewServer();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  let failCount = 0;
  let page = null;

  try {
    // ONE page for the entire run, not one `newPage()`/`close()` cycle per
    // check. checkRoute only ever does setViewport + goto on it — nothing it
    // does needs a fresh browser target — and 40 sequential target
    // create/destroy cycles on a single browser is a known trigger for
    // `Target.createTarget: Session with given id not found` under load,
    // which is exactly the error that aborted this file's last three runs
    // (at a different route each time, consistent with load-dependent target
    // churn rather than a bug tied to one route). Reusing one page removes
    // ~39 of those 40 target creations. The one remaining creation below is
    // still a single point of failure, so it gets a bounded retry.
    //
    // Verified this does not change test semantics: puppeteer's
    // `browser.newPage()` was already opening every page in the browser's
    // one default context (no `createIncognitoBrowserContext()` anywhere in
    // this file), and IndexedDB is partitioned by origin, not by page/tab —
    // so `basicfit-rutina`'s storage was ALREADY shared and accumulating
    // across all 40 checks in every prior run, page-per-check or not.
    // Reuse changes zero storage behavior; it only removes redundant target
    // churn.
    page = await createPageWithRetry(browser);
    const errorSink = { current: () => {} };
    page.on('pageerror', (err) => errorSink.current(err));

    for (const width of WIDTHS) {
      for (const route of ROUTES) {
        const failures = await checkRoute(page, width, route, errorSink);
        const label = `${width}px ${route}`;
        if (failures.length === 0) {
          console.log(`✓ ${label}`);
        } else {
          failCount += failures.length;
          console.log(`✗ ${label}`);
          failures.forEach((f) => console.log(`    ${f}`));
        }
      }
    }
  } finally {
    // page.close() is not implicated (Bagnik's probe: it completes fine even
    // when the following browser.close() hangs), so it stays unbounded but
    // guarded. closeBrowserWithTimeout never throws — success, timeout, and
    // outright rejection are all handled inside it — specifically so
    // stopPreviewServer() below always runs and the preview server can never
    // be left orphaned by a hung close, which would undo the fix already
    // made for that exact problem.
    if (page) await page.close().catch(() => {});
    await closeBrowserWithTimeout(browser);
    stopPreviewServer();
  }

  if (failCount > 0) {
    console.log(`\n${failCount} viewport check(s) failed.`);
    process.exit(1);
  }
  console.log('\n✓ All viewport checks passed!');
  process.exit(0);
}

main().catch((err) => {
  stopPreviewServer();
  console.error(err);
  process.exit(1);
});
