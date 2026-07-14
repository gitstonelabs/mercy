// Filament sensor card (handoff 3.4, sensor part). One row per
// filament_switch_sensor / filament_motion_sensor: detected state and the
// enable toggle (SET_FILAMENT_SENSOR).

import { Panel } from '../components/Panel';
import { useLiveStore } from '../store';
import { sendGcode } from '../api/bootstrap';

export function FilamentSensor() {
  const objects = useLiveStore((s) => s.objects);
  const sensors = Object.keys(objects).filter(
    (n) => n.startsWith('filament_switch_sensor ') || n.startsWith('filament_motion_sensor '),
  );

  if (sensors.length === 0) return null;

  return (
    <Panel title="Filament sensors">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sensors.map((name, i) => {
          const f = objects[name];
          const detected = (f.filament_detected as boolean) ?? false;
          const enabled = (f.enabled as boolean) ?? true;
          const sensor = name.split(' ')[1];
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--b0)' }}>
              <span style={{ width: 110, flex: 'none', font: "700 12px 'Manrope', sans-serif", color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sensor.replace(/_/g, ' ')}
              </span>
              <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 7, font: "700 11px 'Manrope', sans-serif", color: detected ? 'var(--success)' : 'var(--warning)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: detected ? 'var(--success)' : 'var(--warning)', boxShadow: `0 0 7px ${detected ? 'var(--success)' : 'var(--warning)'}` }} />
                {detected ? 'filament detected' : 'no filament'}
              </span>
              <button
                role="switch"
                aria-checked={enabled}
                title={enabled ? 'Disable sensor' : 'Enable sensor'}
                onClick={() => void sendGcode(`SET_FILAMENT_SENSOR SENSOR=${sensor} ENABLE=${enabled ? 0 : 1}`)}
                style={{
                  width: 34,
                  height: 19,
                  borderRadius: 999,
                  position: 'relative',
                  cursor: 'pointer',
                  border: `1px solid ${enabled ? 'var(--accentdim)' : 'var(--b2)'}`,
                  background: enabled ? 'var(--ad1)' : 'var(--control)',
                  padding: 0,
                  flex: 'none',
                }}
              >
                <span style={{ position: 'absolute', top: 2, [enabled ? 'right' : 'left']: 2, width: 13, height: 13, borderRadius: '50%', background: enabled ? 'var(--accent)' : 'var(--txd)' }} />
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
