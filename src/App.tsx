// App shell: routing + the nav that matches the Mainsail pages (handoff 2.4).
//
// HashRouter is used on purpose: the built output is served as static files from
// a Pi or a Moonraker static_files path with no SPA rewrite, so a hash route
// survives a page refresh without a server-side fallback. Switch to
// BrowserRouter only if the host rewrites unknown paths to index.html.
//
// Every route is code-split with React.lazy: the Pi kiosk boots into the
// dashboard without downloading Monaco, Plotly, or the Three.js viewer. Those
// land as separate chunks the first time their page opens.

import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { useConfig } from './store';

import { Dashboard } from './features/Dashboard';

// React.lazy caches a rejected import permanently, so a stale hashed chunk
// (redeploy under an open tab) would fail forever. Retry once after a beat;
// a second failure escalates to the top-level boundary's Reload button.
function lazyRetry<T extends ComponentType<unknown>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch(() => new Promise((r) => window.setTimeout(r, 800)).then(load)),
  );
}

const Webcam = lazyRetry(() => import('./features/Webcam').then((m) => ({ default: m.Webcam })));
const Console = lazyRetry(() => import('./features/Console').then((m) => ({ default: m.Console })));
const HeightMap = lazyRetry(() => import('./features/HeightMap').then((m) => ({ default: m.HeightMap })));
const GcodeFiles = lazyRetry(() => import('./features/GcodeFiles').then((m) => ({ default: m.GcodeFiles })));
const GcodeViewer = lazyRetry(() => import('./features/GcodeViewer').then((m) => ({ default: m.GcodeViewer })));
const PrintHistory = lazyRetry(() => import('./features/PrintHistory').then((m) => ({ default: m.PrintHistory })));
const Machine = lazyRetry(() => import('./features/Machine').then((m) => ({ default: m.Machine })));
const Settings = lazyRetry(() => import('./features/Settings').then((m) => ({ default: m.Settings })));
const FirstRunWizard = lazyRetry(() => import('./wizard/FirstRunWizard').then((m) => ({ default: m.FirstRunWizard })));

// Redirect to the first-run wizard until it is completed (handoff 2.4 / 5).
function RequireWizard({ children }: { children: ReactNode }) {
  const done = useConfig((s) => s.wizardCompleted);
  if (!done) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="sl-page" style={{ padding: 16 }}>
      <span className="sl-mono" style={{ fontSize: 11, color: 'var(--txd)' }}>loading page…</span>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/setup" element={<FirstRunWizard />} />
          <Route
            element={
              <RequireWizard>
                <AppShell />
              </RequireWizard>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/webcam" element={<Suspense fallback={<PageFallback />}><Webcam /></Suspense>} />
            <Route path="/console" element={<Suspense fallback={<PageFallback />}><Console /></Suspense>} />
            <Route path="/heightmap" element={<Suspense fallback={<PageFallback />}><HeightMap /></Suspense>} />
            <Route path="/files" element={<Suspense fallback={<PageFallback />}><GcodeFiles /></Suspense>} />
            <Route path="/viewer" element={<Suspense fallback={<PageFallback />}><GcodeViewer /></Suspense>} />
            <Route path="/history" element={<Suspense fallback={<PageFallback />}><PrintHistory /></Suspense>} />
            <Route path="/machine" element={<Suspense fallback={<PageFallback />}><Machine /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
