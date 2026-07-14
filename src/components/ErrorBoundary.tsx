// Route-level error boundary. One crashing page must never white-screen the
// kiosk: the rail, top bar, and E-STOP stay up, the page shows a fallback
// card. Keyed by route in AppShell so navigating away retries cleanly.

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // Top-level use (main.tsx): offer a full reload instead of a retry. React
  // caches a rejected lazy import forever, so only a reload recovers a stale
  // chunk on a kiosk.
  reload?: boolean;
}

interface State {
  error: Error | null;
}

// A dead lazy chunk after a redeploy is not a code crash: the old build's
// hashed chunk 404s, the one-retry wrapper fails, and React caches the
// rejected import forever — so "Try again" re-renders into the same cached
// rejection and is a dead button. Only a reload (which fetches the new
// index.html and chunk names) recovers. Detect the browsers' phrasings of a
// failed dynamic import.
function isStaleChunkError(error: Error | null): boolean {
  if (!error) return false;
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|chunkloaderror/i.test(
    `${error.name} ${error.message}`,
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      const stale = !this.props.reload && isStaleChunkError(this.state.error);
      const reload = this.props.reload || stale;
      return (
        <div className="sl-page" style={{ padding: 16 }}>
          <div className="sl-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <span className="sl-script" style={{ fontSize: 21, color: 'var(--tx3)' }}>{stale ? 'this page is from an older build.' : 'this page crashed.'}</span>
            <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--danger)', wordBreak: 'break-word' }}>
              {this.state.error.message}
            </span>
            <span style={{ font: "400 12px/1.6 'Manrope', sans-serif", color: 'var(--txd)' }}>
              {stale
                ? 'A newer build was deployed and this page\u2019s old chunk is gone. Reloading picks up the new build.'
                : 'The rest of the app is still running; E-STOP stays available in the top bar.'}
            </span>
            <button className="sl-btn" onClick={() => (reload ? window.location.reload() : this.setState({ error: null }))}>
              {reload ? 'Reload app' : 'Try again'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
