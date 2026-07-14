// Panel: the titled card chrome used by every dashboard card and page section.
// Matches the approved prototype: bg2 surface, hairline border, 14px radius,
// uppercase eyebrow title. Styled only with StoneLabs tokens.

import type { ReactNode } from 'react';

export interface PanelProps {
  title: string;
  accent?: boolean;      // accent-colored eyebrow (e.g. NOW PRINTING, CFS)
  actions?: ReactNode;   // right-aligned header controls (toggles, buttons)
  children?: ReactNode;
}

export function Panel({ title, accent = false, actions, children }: PanelProps) {
  return (
    <section className="sl-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '13px 15px 10px',
        }}
      >
        <h2 className="sl-eyebrow" style={{ margin: 0, color: accent ? 'var(--accent)' : undefined }}>
          {title}
        </h2>
        {actions}
      </header>
      <div style={{ padding: '0 15px 14px', minWidth: 0, flex: 1 }}>{children}</div>
    </section>
  );
}

// Placeholder body shown inside a stub panel. Names the work left to do so the
// scaffold reads as a checklist, not a finished screen.
export function TodoBody({ children }: { children: ReactNode }) {
  return (
    <div style={{ font: "400 13px/1.5 'Manrope', system-ui, sans-serif", color: 'var(--tx3)' }}>
      {children}
    </div>
  );
}
