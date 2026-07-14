// Entry point. Applies the saved theme before first paint, starts the backend
// (Moonraker, with the demo simulator as the 'auto' fallback), then mounts.

import React from 'react';
import ReactDOM from 'react-dom/client';
import './theme/fonts';
import './theme/ui.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useConfig } from './store';
import { applyTheme } from './theme/tokens';
import { startBackend } from './api/bootstrap';

// Apply the persisted theme/mode immediately so there is no light-mode flash.
// (persist also does this on rehydrate; this covers the very first render.)
const cfg = useConfig.getState();
applyTheme(cfg.theme, cfg.mode);

startBackend();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Top-level boundary: covers /setup (which never mounts AppShell) and
        permanently-failed lazy chunks. Its fallback offers a full reload,
        the only recovery a kiosk has. */}
    <ErrorBoundary reload>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
