// Toolhead RGB card (handoff 3.4, LED part). One row per led/neopixel object:
// preset swatches plus off, sent as SET_LED across all channels. A full color
// picker can replace the presets later; the swatch row covers the v1 use.

import { Panel } from '../components/Panel';
import { useLiveStore } from '../store';
import { sendGcode } from '../api/bootstrap';

const SWATCHES = ['#2bcdf2', '#a855f7', '#ffffff', '#ff8a4c', '#3fcf8e'];

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export function Rgb() {
  const objects = useLiveStore((s) => s.objects);
  const leds = Object.keys(objects).filter((n) => n.startsWith('led ') || n.startsWith('neopixel '));

  if (leds.length === 0) return null;

  const set = (obj: string, hex: string | null) => {
    const led = obj.split(' ')[1];
    if (hex === null) {
      void sendGcode(`SET_LED LED=${led} RED=0 GREEN=0 BLUE=0`);
      return;
    }
    const [r, g, b] = hexToRgb(hex);
    void sendGcode(`SET_LED LED=${led} RED=${r.toFixed(3)} GREEN=${g.toFixed(3)} BLUE=${b.toFixed(3)}`);
  };

  return (
    <Panel title="Lights">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {leds.map((name, i) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--b0)' }}>
            <span style={{ width: 110, flex: 'none', font: "700 12px 'Manrope', sans-serif", color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name.split(' ')[1].replace(/_/g, ' ')}
            </span>
            <span style={{ flex: 1, display: 'flex', gap: 6 }}>
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  onClick={() => set(name, hex)}
                  aria-label={`Set ${hex}`}
                  style={{ width: 18, height: 18, borderRadius: 6, background: hex, border: '1px solid var(--b2)', cursor: 'pointer', boxShadow: `0 0 8px -2px ${hex}`, padding: 0 }}
                />
              ))}
            </span>
            <button className="sl-chip" style={{ height: 24, fontSize: 9.5 }} onClick={() => set(name, null)}>
              off
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
