// Toolhead / Move card (handoff 3.1). Position readout, homing, jog grid with
// configurable steps, Z-offset babystepping, and the speed-factor slider.
//
// Gcode contracts:
//   jog        SAVE_GCODE_STATE + G91 + G1 + RESTORE_GCODE_STATE
//   home       G28 [X|Y|Z]
//   z-tilt     Z_TILT_ADJUST (shown when the config has a z_tilt section)
//   z-offset   SET_GCODE_OFFSET Z_ADJUST=<d> MOVE=1
//   speed      M220 S<pct>

import { useState } from 'react';
import { Panel } from '../components/Panel';
import { useLiveStore } from '../store';
import { sendGcode, confirmRiskyDuringPrint } from '../api/bootstrap';
import { Icon } from '../components/icons';

const XY_STEPS = [0.1, 1, 10, 100];
const Z_OFFSET_STEPS = [0.01, 0.05];

function gcode(script: string): void {
  void sendGcode(script);
}

function jog(axis: 'X' | 'Y' | 'Z', delta: number): void {
  if (!confirmRiskyDuringPrint('Jogging the toolhead')) return;
  const feed = axis === 'Z' ? 600 : 6000;
  gcode(`SAVE_GCODE_STATE NAME=sl_jog\nG91\nG1 ${axis}${delta} F${feed}\nRESTORE_GCODE_STATE NAME=sl_jog`);
}

function JogButton({ label, onClick, icon }: { label?: string; onClick: () => void; icon?: 'chevronUp' | 'chevronDown' | 'chevronLeft' | 'chevronRight' | 'home' }) {
  return (
    <button className="sl-btn" style={{ width: 46, height: 46, padding: 0, borderRadius: 10 }} onClick={onClick} aria-label={label}>
      {icon ? <Icon name={icon} size={17} strokeWidth={2} /> : <span className="sl-mono" style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>}
    </button>
  );
}

export function Toolhead() {
  const toolhead = useLiveStore((s) => s.objects.toolhead);
  const gcodeMove = useLiveStore((s) => s.objects.gcode_move);
  const motion = useLiveStore((s) => s.objects.motion_report);
  const hasZTilt = useLiveStore((s) => 'z_tilt' in s.objects);
  const [step, setStep] = useState(1);
  const [speedDraft, setSpeedDraft] = useState<number | null>(null);

  const pos = ((motion?.live_position ?? gcodeMove?.gcode_position ?? toolhead?.position) as number[] | undefined) ?? [0, 0, 0];
  const homed = String(toolhead?.homed_axes ?? '');
  const homedAll = homed.includes('x') && homed.includes('y') && homed.includes('z');
  const zOffset = ((gcodeMove?.homing_origin as number[] | undefined) ?? [0, 0, 0])[2] ?? 0;
  const speedPct = Math.round((((gcodeMove?.speed_factor as number) ?? 1) * 100));
  const speedShown = speedDraft ?? speedPct;

  const readout = (axis: string, v: number, digits: number) => (
    <div className="sl-inset" style={{ padding: '7px 10px' }}>
      <span style={{ font: "800 9.5px 'Manrope', sans-serif", color: 'var(--txd)' }}>{axis}</span>
      <span className="sl-mono" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>
        {v.toFixed(digits)}
      </span>
    </div>
  );

  return (
    <Panel
      title="Toolhead"
      actions={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: "800 10px 'Manrope', sans-serif", letterSpacing: '.08em', color: homedAll ? 'var(--success)' : 'var(--warning)' }}>
          {homedAll ? <Icon name="check" size={12} strokeWidth={2.5} /> : null}
          {homedAll ? 'HOMED XYZ' : homed ? `HOMED ${homed.toUpperCase()}` : 'NOT HOMED'}
        </span>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {readout('X', pos[0] ?? 0, 2)}
        {readout('Y', pos[1] ?? 0, 2)}
        {readout('Z', pos[2] ?? 0, 3)}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="sl-btn sl-btn--accent" style={{ flex: '1.4 1 auto' }} onClick={() => confirmRiskyDuringPrint('Homing') && gcode('G28')}>
          <Icon name="home" size={13} /> Home all
        </button>
        {(['X', 'Y', 'Z'] as const).map((a) => (
          <button key={a} className="sl-btn" style={{ flex: '1 1 auto' }} onClick={() => confirmRiskyDuringPrint('Homing') && gcode(`G28 ${a}`)}>
            {a}
          </button>
        ))}
        {hasZTilt && (
          <button className="sl-btn" style={{ flex: '1.4 1 auto' }} onClick={() => confirmRiskyDuringPrint('Z-tilt') && gcode('Z_TILT_ADJUST')}>
            Z-Tilt
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 46px)', gridTemplateRows: 'repeat(3, 46px)', gap: 6 }}>
          <span />
          <JogButton icon="chevronUp" label="Y plus" onClick={() => jog('Y', step)} />
          <span />
          <JogButton icon="chevronLeft" label="X minus" onClick={() => jog('X', -step)} />
          <JogButton icon="home" label="Home XY" onClick={() => confirmRiskyDuringPrint('Homing') && gcode('G28 X Y')} />
          <JogButton icon="chevronRight" label="X plus" onClick={() => jog('X', step)} />
          <span />
          <JogButton icon="chevronDown" label="Y minus" onClick={() => jog('Y', -step)} />
          <span />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <JogButton label="Z+" onClick={() => jog('Z', Math.min(step, 25))} />
          <JogButton label="Z-" onClick={() => jog('Z', -Math.min(step, 25))} />
        </div>
        <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="sl-eyebrow" style={{ fontSize: 9.5 }}>Step &middot; mm</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {XY_STEPS.map((v) => (
              <button key={v} className="sl-chip" data-on={step === v} style={{ height: 30 }} onClick={() => setStep(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <span className="sl-eyebrow" style={{ fontSize: 10, flex: 'none' }}>Z offset</span>
        {Z_OFFSET_STEPS.map((v) => (
          <button key={`-${v}`} className="sl-chip" onClick={() => gcode(`SET_GCODE_OFFSET Z_ADJUST=-${v} MOVE=1`)}>
            -{v}
          </button>
        ))}
        <span className="sl-mono" style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--accent2)' }}>
          {zOffset.toFixed(3)}
        </span>
        {Z_OFFSET_STEPS.slice().reverse().map((v) => (
          <button key={`+${v}`} className="sl-chip" onClick={() => gcode(`SET_GCODE_OFFSET Z_ADJUST=+${v} MOVE=1`)}>
            +{v}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <span className="sl-eyebrow" style={{ fontSize: 10, width: 74, flex: 'none' }}>Speed</span>
        <input
          type="range"
          className="sl-range"
          style={{ flex: 1 }}
          min={25}
          max={200}
          value={speedShown}
          onChange={(e) => setSpeedDraft(Number(e.target.value))}
          onMouseUp={() => speedDraft !== null && (gcode(`M220 S${speedDraft}`), setSpeedDraft(null))}
          onTouchEnd={() => speedDraft !== null && (gcode(`M220 S${speedDraft}`), setSpeedDraft(null))}
          aria-label="Speed factor"
        />
        <span className="sl-mono" style={{ width: 44, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--tx2)' }}>
          {speedShown}%
        </span>
        <button className="sl-chip" onClick={() => gcode('M220 S100')}>100</button>
      </div>
    </Panel>
  );
}
