import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BottomTabBar } from './components/BottomTabBar.jsx';
import { InstallBanner } from './components/InstallBanner.jsx';
import { SessionInProgressBanner } from './components/SessionInProgressBanner.jsx';
import { ImportScreen } from './screens/ImportScreen.jsx';
import { ImportFork } from './screens/ImportFork.jsx';
import { PromptPreferencesScreen } from './screens/PromptPreferencesScreen.jsx';
import { PromptCopyScreen } from './screens/PromptCopyScreen.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { ProgramScreen } from './screens/ProgramScreen.jsx';
import { ActiveSessionScreen } from './screens/ActiveSessionScreen.jsx';
import { HistoryScreen } from './screens/HistoryScreen.jsx';
import { ProgressScreen } from './screens/ProgressScreen.jsx';
import { ExportScreen } from './screens/ExportScreen.jsx';
import { CatalogScreen } from './screens/CatalogScreen.jsx';
import { SettingsScreen } from './screens/SettingsScreen.jsx';
import { OnboardingOverlay } from './components/OnboardingOverlay.jsx';
import { LibraryScreen } from './components/LibraryScreen.jsx';
import { getActiveRutina, listRutinas } from './lib/db.js';
import { hasSeenOnboarding } from './lib/onboardingStorage.js';
import { startOpportunisticFlush } from './lib/reportFlush.js';
import { useActiveSession } from './hooks/useActiveSession.js';
import { I18nProvider } from './i18n/index.js';

/**
 * `/import` entry (import-flow-guided-first D2, AC1/AC8, tech-plan AD-2): the
 * fork on first run (library empty), otherwise straight to the JSON screen.
 * Reads the library once; while loading renders nothing (like Shell's own
 * loading gate); a read failure behaves as an empty library (same rule as
 * ImportScreen's dual-path check).
 */
function ImportEntry({ onPrepare, onImport }) {
  const [empty, setEmpty] = useState(undefined); // undefined = loading
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => listRutinas())
      .then((entries) => { if (!cancelled) setEmpty(!Array.isArray(entries) || entries.length === 0); })
      .catch(() => { if (!cancelled) setEmpty(true); });
    return () => { cancelled = true; };
  }, []);
  if (empty === undefined) return null;
  return empty
    ? <ImportFork onPrepare={onPrepare} onImport={onImport} />
    : <Navigate to="/import/json" replace />;
}

/**
 * Inner shell that has access to location (must be inside HashRouter).
 * Loads the active rutina from IndexedDB once on mount; screens that need it
 * receive it as a prop. ImportScreen calls onImported() to refresh.
 */
function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [rutina, setRutina] = useState(undefined); // undefined = loading, null = not imported yet
  const [loadError, setLoadError] = useState(false);
  // Read synchronously at mount (tech-plan.md) — independent of the async
  // getActiveRutina() load below, so onboarding's gate doesn't wait on IDB.
  const [onboardingSeen, setOnboardingSeen] = useState(() => hasSeenOnboarding());
  // Single source of truth for the active session (spec.md AC15) — mounted
  // once here so Inicio and the banner can never drift out of agreement.
  const activeSession = useActiveSession();

  const loadRutina = () => {
    return getActiveRutina()
      // multi-rutina-library D-B: getActiveRutina() returns the JOINED entry
      // ({key, rutinaId, id, rutina, importedAt}). The shell's single-rutina
      // shape survives (spec D3) — screens now receive rutina WITH its stable
      // library id attached, which is what Home's rotation filter and
      // Progress' volume tiers key on.
      .then((r) => setRutina(r ? { ...r.rutina, id: r.id } : null))
      .catch(() => { setLoadError(true); setRutina(null); });
  };

  useEffect(() => { loadRutina(); }, []);

  // One-shot redirect flag: ImportScreen has no navigation of its own (it
  // just calls onImported(target) to refresh `rutina` and name the landing
  // route), so without this a successful import silently saves and leaves
  // the user staring at the same import form. Holds the TARGET ('/' after a
  // silent/panel activation, '/library' after "Guardar sin activar" — UX §3),
  // cleared once we've actually left /import — so a later intentional revisit
  // still lands on the real ImportScreen instead of bouncing straight back.
  const [justImportedTarget, setJustImportedTarget] = useState(null);
  useEffect(() => {
    if (justImportedTarget && !location.pathname.startsWith('/import')) setJustImportedTarget(null);
  }, [location.pathname, justImportedTarget]);

  // Every /import/* screen (fork, wizard, JSON) is full-screen: no tab bar.
  const hideNav = location.pathname.startsWith('/import');

  // "Atrás" pops one history entry; a deep link / refresh has nothing to pop
  // (router location.key === 'default'), so it falls back to a sensible root.
  const goBack = (fallback) => {
    if (location.key === 'default') navigate(fallback, { replace: true });
    else navigate(-1);
  };

  if (rutina === undefined) return null; // still loading — avoids flash

  // Existing users with a saved rutina never see onboarding, even though
  // their onboardingSeen flag is necessarily unset (tech-plan.md Decision 2
  // — deliberate, not a bug).
  const showOnboarding = !onboardingSeen && rutina === null;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <InstallBanner />
        <SessionInProgressBanner status={activeSession.status} session={activeSession.session} />
        {/* position: relative — the containing block for absolutely positioned descendants. Without it
            the `.sr-only` spans (position: absolute) resolve against the viewport, escape this scroller
            and the shell's overflow: hidden, and stretch the DOCUMENT to the page's full length: a second
            scrollbar beside this one on long screens (Program day detail). */}
        <main style={{ position: 'relative', flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <Routes>
            <Route
              path="/import"
              element={<ImportEntry onPrepare={() => navigate('/import/prompt')} onImport={() => navigate('/import/json')} />}
            />
            <Route
              path="/import/prompt"
              element={<PromptPreferencesScreen onNext={() => navigate('/import/prompt/copy')} onBack={() => goBack('/import')} />}
            />
            <Route
              path="/import/prompt/copy"
              element={<PromptCopyScreen onBack={() => goBack('/import/prompt')} onHaveJson={() => navigate('/import/json')} />}
            />
            <Route
              path="/import/json"
              element={
                justImportedTarget
                  ? <Navigate to={justImportedTarget} replace />
                  : (
                    <ImportScreen
                      onImported={(target) => { loadRutina().then(() => setJustImportedTarget(target || '/')); }}
                      onBack={() => goBack(rutina ? '/' : '/import')}
                      onPreparePrompt={() => navigate('/import/prompt')}
                    />
                  )
              }
            />
            <Route
              path="/library"
              element={
                rutina
                  ? <LibraryScreen activeId={rutina.id} onActivated={() => { loadRutina(); }} />
                  : <Navigate to="/import" replace />
              }
            />
            <Route
              path="/"
              element={
                rutina
                  ? (
                    <HomeScreen
                      rutina={rutina}
                      loadError={loadError}
                      onGoImport={() => { window.location.hash = '/import'; }}
                      activeSessionStatus={activeSession.status}
                      activeSession={activeSession.session}
                      onRetryActiveSession={activeSession.refresh}
                    />
                  )
                  : <Navigate to="/import" replace />
              }
            />
            <Route
              path="/program"
              element={rutina ? <ProgramScreen rutina={rutina} /> : <Navigate to="/import" replace />}
            />
            <Route
              path="/program/:dayIndex"
              element={rutina ? <ProgramScreen rutina={rutina} /> : <Navigate to="/import" replace />}
            />
            <Route path="/session" element={<ActiveSessionScreen onSessionEnded={activeSession.refresh} />} />
            <Route path="/history" element={<HistoryScreen />} />
            <Route
              path="/progress"
              element={rutina ? <ProgressScreen rutina={rutina} /> : <Navigate to="/import" replace />}
            />
            <Route path="/export" element={<ExportScreen />} />
            <Route path="/catalog" element={<CatalogScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {!hideNav && <BottomTabBar />}
      </div>
      {showOnboarding && <OnboardingOverlay onClose={() => setOnboardingSeen(true)} />}
    </>
  );
}

export default function App() {
  // club-equipment-reporting: flush the anonymous report outbox on mount and
  // whenever the browser comes back online. Inert (no timer, no listener, no
  // network) while VITE_BACKEND_URL is unset.
  useEffect(() => startOpportunisticFlush(), []);
  return (
    <I18nProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Shell />
      </HashRouter>
    </I18nProvider>
  );
}
