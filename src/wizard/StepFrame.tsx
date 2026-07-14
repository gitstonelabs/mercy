// Shared chrome + props for every wizard step.
//
// Two hard requirements from the handoff (section 5) live here so no step can
// forget them: every step has a Skip control, and every step has a "?" info
// button that opens extra help for that step.

import type { CSSProperties, ReactNode } from 'react';

export interface StepProps {
  // Advance to the next step (or finish on the last one).
  onNext: () => void;
  // Skip this step without changing its setting.
  onSkip: () => void;
  // Open the "?" help for this step.
  onInfo: () => void;
  // Go back a step (absent on the first step).
  onBack?: () => void;
}

export interface StepFrameProps extends StepProps {
  title: string;
  // Step index for the "Step N of M" label.
  index: number;
  total: number;
  children: ReactNode;
}

const btn: CSSProperties = {
  height: 40,
  padding: '0 18px',
  borderRadius: 10,
  border: '1px solid var(--b2)',
  background: 'var(--control)',
  color: 'var(--tx)',
  font: "700 13px 'Manrope', system-ui, sans-serif",
  cursor: 'pointer',
};

export function StepFrame({ title, index, total, children, onNext, onSkip, onInfo, onBack }: StepFrameProps) {
  return (
    <section
      style={{
        width: 'min(680px, 100%)',
        background: 'linear-gradient(180deg, var(--surface), var(--bg2))',
        border: '1px solid var(--b2)',
        borderRadius: 16,
        padding: 24,
        color: 'var(--tx)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ font: "500 11px/1 'Manrope', system-ui, sans-serif", letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          Step {index} of {total}
        </span>
        <button
          type="button"
          onClick={onInfo}
          aria-label={`Help for ${title}`}
          title="Help"
          style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--b2)', background: 'var(--control)', color: 'var(--tx2)', cursor: 'pointer', fontWeight: 700 }}
        >
          ?
        </button>
      </header>

      <h1 style={{ margin: '4px 0 16px', font: "700 22px 'Manrope', system-ui, sans-serif" }}>{title}</h1>

      <div style={{ minHeight: 120 }}>{children}</div>

      <footer style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 24 }}>
        {onBack && (
          <button type="button" style={btn} onClick={onBack}>
            Back
          </button>
        )}
        <button type="button" style={btn} onClick={onSkip}>
          Skip
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          style={{ ...btn, border: '1px solid var(--accent)', background: 'var(--ad1)', color: 'var(--accentfg)' }}
          onClick={onNext}
        >
          Next
        </button>
      </footer>
    </section>
  );
}
