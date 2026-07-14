// Wizard step 1: pick your printer (handoff 5, step 1).
//
// Profile cards from src/profiles with a firmware pill per bucket. Selecting a
// klipper-fork-locked or buddy-needs-klipper-reflash profile surfaces its
// apiNotes as an inline warning before the user commits.

import { StepFrame, type StepProps } from './StepFrame';
import { useConfig } from '../store';
import { PROFILES } from '../profiles';
import type { FirmwareFamily } from '../profiles/schema';
import { restartBackend } from '../api/bootstrap';

const FW_PILL: Record<FirmwareFamily, { label: string; color: string; bg: string; border: string }> = {
  'klipper-native': { label: 'KLIPPER', color: 'var(--success)', bg: 'var(--ok-d2)', border: 'rgba(var(--success-rgb), .35)' },
  'klipper-fork-locked': { label: 'CREALITY OS', color: 'var(--warning)', bg: 'rgba(var(--warning-rgb), .07)', border: 'rgba(var(--warning-rgb), .4)' },
  'buddy-needs-klipper-reflash': { label: 'NEEDS REFLASH', color: 'var(--danger)', bg: 'var(--danger-d2)', border: 'var(--danger-b)' },
};

export function PrinterSelect(props: StepProps & { index: number; total: number }) {
  const profileId = useConfig((s) => s.profileId);
  const setProfile = useConfig((s) => s.setProfile);
  const moonrakerHost = useConfig((s) => s.moonrakerHost);
  const setMoonrakerHost = useConfig((s) => s.setMoonrakerHost);
  const selected = PROFILES.find((p) => p.id === profileId);

  return (
    <StepFrame title="Pick your printer" {...props}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 9, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
        {PROFILES.map((p) => {
          const on = p.id === profileId;
          const pill = FW_PILL[p.firmware];
          return (
            <button
              key={p.id}
              onClick={() => setProfile(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 13px',
                borderRadius: 12,
                textAlign: 'left',
                cursor: 'pointer',
                border: `1px solid ${on ? 'var(--accentdim)' : 'var(--b1)'}`,
                background: on ? 'var(--ad2)' : 'var(--inset)',
                boxShadow: on ? '0 0 0 1px rgba(var(--accent-rgb), .2)' : 'none',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ font: "800 13px 'Manrope', sans-serif", color: 'var(--tx)' }}>{p.displayName}</span>
                <span className="sl-mono" style={{ fontSize: 9.5, color: 'var(--txd)', whiteSpace: 'nowrap' }}>
                  {p.build.x}&middot;{p.build.y}&middot;{p.build.z} &middot; {p.kinematics} &middot; {p.hotend.maxTemp}&deg;
                  {p.features.cfs ? ' \u00b7 cfs' : ''}
                </span>
              </span>
              <span
                className="sl-mono"
                style={{
                  height: 20,
                  padding: '0 9px',
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  flex: 'none',
                  whiteSpace: 'nowrap',
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: '.04em',
                  color: pill.color,
                  background: pill.bg,
                  border: `1px solid ${pill.border}`,
                }}
              >
                {pill.label}
              </span>
            </button>
          );
        })}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <span className="sl-eyebrow" style={{ width: 110, flex: 'none', fontSize: 9.5 }}>Moonraker host</span>
        <input
          className="sl-input"
          style={{ flex: 1, fontSize: 11.5 }}
          placeholder="http://printer.local:7125 (blank = same origin)"
          value={moonrakerHost}
          onChange={(e) => setMoonrakerHost(e.target.value.trim() && !/^https?:\/\//i.test(e.target.value.trim()) ? `http://${e.target.value.trim()}` : e.target.value.trim())}
          onBlur={() => restartBackend()}
          aria-label="Moonraker host"
        />
      </label>

      {selected && selected.firmware !== 'klipper-native' && (
        <div
          style={{
            display: 'flex',
            gap: 11,
            marginTop: 12,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(var(--warning-rgb), .35)',
            background: 'rgba(var(--warning-rgb), .06)',
            font: "400 12px/1.6 'Manrope', sans-serif",
            color: 'var(--tx2)',
          }}
        >
          {selected.apiNotes}
        </div>
      )}
      {selected && (selected.verifyNotes?.length ?? 0) > 0 && (
        <p className="sl-mono" style={{ margin: '10px 0 0', fontSize: 9.5, color: 'var(--txd)', lineHeight: 1.6 }}>
          verify before trusting the limits: {selected.verifyNotes!.join(' ')}
        </p>
      )}
    </StepFrame>
  );
}
