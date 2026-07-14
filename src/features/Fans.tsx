// Fans and outputs card (handoff 3.4). Controllable fans get a slider
// (M106 for the part fan, SET_FAN_SPEED for fan_generic); fans that only
// report (heater_fan, controller_fan) render percent and RPM read-only;
// output_pin objects get a toggle (or a slider when they look PWM).

import { useState } from 'react';
import { Panel } from '../components/Panel';
import { useLiveStore } from '../store';
import { sendGcode } from '../api/bootstrap';

function gcode(script: string): void {
  void sendGcode(script);
}

function label(objName: string): string {
  const i = objName.indexOf(' ');
  return (i < 0 ? objName : objName.slice(i + 1)).replace(/_/g, ' ');
}

function FanSlider({ name, speed, onCommit }: { name: string; speed: number; onCommit: (pct: number) => void }) {
  const [draft, setDraft] = useState<number | null>(null);
  const pct = draft ?? Math.round(speed * 100);
  const commit = () => {
    if (draft !== null) onCommit(draft);
    setDraft(null);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--b0)' }}>
      <span style={{ width: 110, flex: 'none', font: "700 12px 'Manrope', sans-serif", color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      <input
        type="range"
        className="sl-range"
        style={{ flex: 1 }}
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={`${name} speed`}
      />
      <span className="sl-mono" style={{ width: 38, textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: 'var(--tx2)' }}>{pct}%</span>
    </div>
  );
}

export function Fans() {
  const objects = useLiveStore((s) => s.objects);

  const rows: JSX.Element[] = [];
  for (const [name, f] of Object.entries(objects)) {
    const base = name.split(' ')[0];
    if (name === 'fan') {
      rows.push(<FanSlider key={name} name="Part fan" speed={(f.speed as number) ?? 0} onCommit={(pct) => gcode(`M106 S${Math.round((pct / 100) * 255)}`)} />);
    } else if (base === 'fan_generic') {
      rows.push(
        <FanSlider key={name} name={label(name)} speed={(f.speed as number) ?? 0} onCommit={(pct) => gcode(`SET_FAN_SPEED FAN=${name.split(' ')[1]} SPEED=${(pct / 100).toFixed(2)}`)} />,
      );
    } else if (base === 'heater_fan' || base === 'controller_fan') {
      const rpm = f.rpm as number | null | undefined;
      rows.push(
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--b0)' }}>
          <span style={{ width: 110, flex: 'none', font: "700 12px 'Manrope', sans-serif", color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(name)}</span>
          <span className="sl-mono" style={{ flex: 1, fontSize: 10.5, color: 'var(--txd)' }}>
            auto{typeof rpm === 'number' ? ` \u00b7 ${Math.round(rpm).toLocaleString()} rpm` : ''}
          </span>
          <span className="sl-mono" style={{ width: 38, textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: 'var(--tx3)' }}>
            {Math.round(((f.speed as number) ?? 0) * 100)}%
          </span>
        </div>,
      );
    } else if (base === 'output_pin') {
      const value = (f.value as number) ?? 0;
      const pin = name.split(' ')[1];
      rows.push(
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--b0)' }}>
          <span style={{ width: 110, flex: 'none', font: "700 12px 'Manrope', sans-serif", color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(name)}</span>
          <span style={{ flex: 1 }} />
          <button
            role="switch"
            aria-checked={value > 0}
            onClick={() => gcode(`SET_PIN PIN=${pin} VALUE=${value > 0 ? 0 : 1}`)}
            style={{
              width: 34,
              height: 19,
              borderRadius: 999,
              position: 'relative',
              cursor: 'pointer',
              border: `1px solid ${value > 0 ? 'var(--accentdim)' : 'var(--b2)'}`,
              background: value > 0 ? 'var(--ad1)' : 'var(--control)',
              padding: 0,
            }}
          >
            <span style={{ position: 'absolute', top: 2, [value > 0 ? 'right' : 'left']: 2, width: 13, height: 13, borderRadius: '50%', background: value > 0 ? 'var(--accent)' : 'var(--txd)' }} />
          </button>
        </div>,
      );
    }
  }

  return (
    <Panel title="Fans & outputs">
      {rows.length === 0 ? (
        <div style={{ font: "400 12.5px 'Manrope', sans-serif", color: 'var(--tx3)' }}>No fans or output pins reported yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>{rows}</div>
      )}
    </Panel>
  );
}
