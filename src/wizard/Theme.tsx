// Wizard step 4: theme (handoff 5, step 4). Six accents, dark or light,
// applied live through the config store so the whole wizard re-themes as you
// pick.

import { StepFrame, type StepProps } from './StepFrame';
import { useConfig } from '../store';
import { THEME_META } from '../theme/tokens';

export function Theme(props: StepProps & { index: number; total: number }) {
  const theme = useConfig((s) => s.theme);
  const mode = useConfig((s) => s.mode);
  const setTheme = useConfig((s) => s.setTheme);
  const setMode = useConfig((s) => s.setMode);

  return (
    <StepFrame title="Theme" {...props}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ font: "400 12px 'Manrope', sans-serif", color: 'var(--tx3)' }}>Applies live and persists on this install.</span>
        <div className="sl-seg">
          <button data-on={mode === 'dark'} onClick={() => setMode('dark')}>Dark</button>
          <button data-on={mode === 'light'} onClick={() => setMode('light')}>Light</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 9 }}>
        {THEME_META.map((t) => {
          const on = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '10px 12px',
                borderRadius: 11,
                cursor: 'pointer',
                border: `1px solid ${on ? 'var(--accentdim)' : 'var(--b1)'}`,
                background: on ? 'var(--ad2)' : 'var(--inset)',
                color: on ? 'var(--accent2)' : 'var(--tx2)',
                font: "800 11.5px 'Manrope', sans-serif",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: t.swatch,
                  boxShadow: `0 0 10px -2px ${t.swatch}`,
                  border: '1px solid rgba(255,255,255,.15)',
                  flex: 'none',
                }}
              />
              {t.label}
            </button>
          );
        })}
      </div>
    </StepFrame>
  );
}
