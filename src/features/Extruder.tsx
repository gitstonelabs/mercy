// Extruder card (handoff 3.5). Tool tabs when the profile has more than one
// tool, extrusion factor (M221), live Pressure Advance / Smooth Time
// (SET_PRESSURE_ADVANCE), quick-length chips, Retract / Extrude with the
// cold-extrude guard from extruder.can_extrude.

import { useState } from 'react';
import { Panel } from '../components/Panel';
import { useConfig, useLiveStore } from '../store';
import { getProfile } from '../profiles';
import { sendGcode, confirmRiskyDuringPrint } from '../api/bootstrap';
import { Icon } from '../components/icons';

const LENGTHS = [5, 10, 25, 50];

function gcode(script: string): void {
  void sendGcode(script);
}

function NumberField({ label, value, digits, onCommit }: { label: string; value: number; digits: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="sl-inset" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
      <span style={{ font: "700 9.5px 'Manrope', sans-serif", color: 'var(--txd)' }}>{label}</span>
      <input
        className="sl-mono"
        style={{ border: 'none', background: 'transparent', color: 'var(--tx)', fontSize: 13, fontWeight: 700, outline: 'none', width: '100%' }}
        inputMode="decimal"
        value={draft ?? value.toFixed(digits)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const v = parseFloat(draft);
            if (!Number.isNaN(v)) onCommit(v);
          }
          setDraft(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

export function Extruder() {
  const profileId = useConfig((s) => s.profileId);
  const objects = useLiveStore((s) => s.objects);
  const [tool, setTool] = useState(0);
  const [length, setLength] = useState(10);
  const [feed, setFeed] = useState(5);

  const toolCount = getProfile(profileId)?.features.toolCount ?? 1;
  const key = tool === 0 ? 'extruder' : `extruder${tool}`;
  // No fallback across tools: a missing objects[key] means the tool is not
  // reporting, so can_extrude stays false rather than gating on tool 0.
  const ext = objects[key] ?? {};
  const gm = objects.gcode_move ?? {};

  const pa = (ext.pressure_advance as number) ?? 0;
  const smooth = (ext.smooth_time as number) ?? 0.04;
  const canExtrude = (ext.can_extrude as boolean) ?? false;
  const extrudeFactor = Math.round((((gm.extrude_factor as number) ?? 1) * 100));

  const move = (sign: 1 | -1) => {
    if (!confirmRiskyDuringPrint('Manual extrusion')) return;
    gcode(`M83\nG1 E${sign * length} F${Math.max(60, feed * 60)}`);
  };

  return (
    <Panel
      title="Extruder"
      actions={
        toolCount > 1 ? (
          <span style={{ display: 'inline-flex', gap: 4 }}>
            {Array.from({ length: Math.min(toolCount, 4) }, (_, t) => (
              <button
                key={t}
                className="sl-chip"
                data-on={tool === t}
                style={{ height: 26, borderRadius: 999 }}
                onClick={() => {
                  // Same choreography as a CFS load: cut, retrude, extrude.
                  // Skip the no-op and guard it like CfsPanel does.
                  if (t === tool) return;
                  if (!confirmRiskyDuringPrint('A tool change')) return;
                  setTool(t);
                  gcode(`T${t}`);
                }}
              >
                T{t}
              </button>
            ))}
          </span>
        ) : (
          <span className="sl-mono" style={{ fontSize: 10, color: 'var(--txd)' }}>flow {extrudeFactor}%</span>
        )
      }
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <NumberField label="pressure advance" value={pa} digits={3} onCommit={(v) => gcode(`SET_PRESSURE_ADVANCE ADVANCE=${v.toFixed(3)}`)} />
        <NumberField label="smooth time" value={smooth} digits={3} onCommit={(v) => gcode(`SET_PRESSURE_ADVANCE SMOOTH_TIME=${v.toFixed(3)}`)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span className="sl-eyebrow" style={{ fontSize: 10, flex: 'none' }}>Length</span>
        {LENGTHS.map((v) => (
          <button key={v} className="sl-chip" data-on={length === v} onClick={() => setLength(v)}>
            {v}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--txd)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          @
          <input
            className="sl-input"
            style={{ width: 44, height: 26, fontSize: 11, textAlign: 'right' }}
            inputMode="decimal"
            value={feed}
            onChange={(e) => setFeed(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Feedrate mm per second"
          />
          mm/s
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <button
          className="sl-btn"
          style={{ flex: 1, height: 36 }}
          disabled={!canExtrude}
          title={canExtrude ? undefined : 'Hotend is below min_extrude_temp'}
          onClick={() => move(-1)}
        >
          <Icon name="chevronUp" size={14} strokeWidth={2} /> Retract
        </button>
        <button
          className="sl-btn sl-btn--accent"
          style={{ flex: 1, height: 36 }}
          disabled={!canExtrude}
          title={canExtrude ? undefined : 'Hotend is below min_extrude_temp'}
          onClick={() => move(1)}
        >
          <Icon name="chevronDown" size={14} strokeWidth={2} /> Extrude
        </button>
      </div>
      {!canExtrude && (
        <p style={{ margin: '9px 0 0', font: "700 11px 'Manrope', sans-serif", color: 'var(--warning)' }}>
          Cold extrude blocked: heat the hotend past min_extrude_temp first.
        </p>
      )}
    </Panel>
  );
}
