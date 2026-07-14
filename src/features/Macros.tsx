// Macros card (handoff 3.3). A dynamic pill grid generated from live macro
// metadata (printer.gcode.help), never hardcoded. Macros whose help text names
// parameters get a chevron and prompt for them before sending. Visibility and
// order per profile is a Settings follow-up; the underscore-prefixed internals
// are filtered out like Mainsail does.

import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { useLiveStore } from '../store';
import { getBackend } from '../api/client';
import { sendGcode } from '../api/bootstrap';
import { Icon } from '../components/icons';

interface Macro {
  name: string;
  help: string;
  hasParams: boolean;
}

export function Macros() {
  const phase = useLiveStore((s) => s.phase);
  const [macros, setMacros] = useState<Macro[]>([]);

  useEffect(() => {
    if (phase !== 'ready') return;
    let cancelled = false;
    getBackend()
      .gcodeHelp()
      .then((help) => {
        if (cancelled) return;
        const list = Object.entries(help)
          .filter(([name]) => !name.startsWith('_'))
          .map(([name, text]) => ({
            name,
            help: text,
            // Heuristic: help text that names KEY= style parameters.
            hasParams: /[A-Z_]+=/.test(text),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setMacros(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const run = (m: Macro) => {
    let script = m.name;
    if (m.hasParams) {
      const params = window.prompt(`${m.name}\n${m.help}\n\nParameters (e.g. UNIT=1 SLOT=2), or blank for none:`, '');
      if (params === null) return;
      if (params.trim()) script = `${m.name} ${params.trim()}`;
    }
    void sendGcode(script);
  };

  return (
    <Panel
      title="Macros"
      actions={
        <span className="sl-mono" style={{ fontSize: 10, color: 'var(--txd)' }}>
          {macros.length} from printer.gcode.help
        </span>
      }
    >
      {macros.length === 0 ? (
        <div style={{ font: "400 12.5px 'Manrope', sans-serif", color: 'var(--tx3)' }}>
          No macros reported yet. They appear once Klipper is ready.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {macros.map((m) => (
            <button
              key={m.name}
              className="sl-chip"
              style={{ height: 30, borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500, color: 'var(--tx2)' }}
              title={m.help}
              onClick={() => run(m)}
            >
              {m.name}
              {m.hasParams && (
                <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                  <Icon name="chevronDown" size={11} strokeWidth={2.2} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
