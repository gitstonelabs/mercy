// CFS / filament panel (handoff 3.15). The StoneLabs differentiator.
//
// Data model (ground truth from the v1 CFS state builder):
//   Live module state: printer object `creality_cfs`
//     is_connected : boolean; false -> "No CFS detected", not an error
//     box_count    : number of boxes (clamp 0..4)
//     active_tool  : index of the loaded slot (0-based), -1/undefined = none
//     slots        : keyed "0".."3", each { present, material, remain }
//   Slot names + colors: `save_variables`.variables, written by CFS_SET_SLOT:
//     cfs{unit}_slot{n}_name / _material / _color   (unit and n are 1-based)
//
// Macros sent (owned by the CFS project; rendered, not reimplemented):
//   T{n} tool change (cut -> hall verify -> retrude -> extrude), CUT_FILAMENT +
//   CFS_RETRUDE for unload, CFS_SET_SLOT for the edit dialog, CFS_INITIALIZE
//   for the empty state.

import { useState } from 'react';
import { Panel } from '../components/Panel';
import { useConfig, useLiveStore } from '../store';
import { getProfile } from '../profiles';
import { sendGcode, confirmRiskyDuringPrint } from '../api/bootstrap';

const MATERIALS = ['PLA', 'PETG', 'ABS', 'TPU'];
const COLORS = ['#2bcdf2', '#ff8a4c', '#e8eaf0', '#4a4d55', '#e23b4e', '#8ab48a', '#a855f7', '#ffb84d'];

interface Slot {
  index: number;      // 0-based tool index
  present: boolean;
  name: string;
  material: string;
  color: string;
  remain: number;     // percent
}

function gcode(script: string): void {
  void sendGcode(script);
}

function useSlots(unit: number): { connected: boolean; boxCount: number; activeTool: number; slots: Slot[] } {
  const cfs = useLiveStore((s) => s.objects.creality_cfs);
  const saveVars = useLiveStore((s) => s.objects.save_variables);
  const vars = ((saveVars?.variables ?? {}) as Record<string, unknown>);

  const connected = (cfs?.is_connected as boolean) ?? false;
  const boxCount = Math.max(0, Math.min(4, (cfs?.box_count as number) ?? 0));
  const activeTool = (cfs?.active_tool as number) ?? -1;
  const raw = (cfs?.slots ?? {}) as Record<string, { present?: boolean; material?: string; remain?: number }>;

  const slots: Slot[] = [0, 1, 2, 3].map((i) => {
    const r = raw[String(i)] ?? {};
    const n = i + 1;
    // CFS_SET_SLOT strips the leading '#' before persisting (Klipper treats
    // '#' as a comment); re-add it so SVG strokes and swatch compares work.
    const storedColor = (vars[`cfs${unit}_slot${n}_color`] as string) ?? '#4a4d55';
    return {
      index: (unit - 1) * 4 + i,
      present: r.present ?? false,
      name: (vars[`cfs${unit}_slot${n}_name`] as string) ?? `Slot ${n}`,
      material: (vars[`cfs${unit}_slot${n}_material`] as string) ?? r.material ?? '?',
      color: storedColor.startsWith('#') ? storedColor : `#${storedColor}`,
      remain: Math.max(0, Math.min(100, r.remain ?? 0)),
    };
  });

  return { connected, boxCount, activeTool, slots };
}

function SlotEditDialog({ unit, slotN, slot, onClose }: { unit: number; slotN: number; slot: Slot; onClose: () => void }) {
  const [name, setName] = useState(slot.name);
  const [material, setMaterial] = useState(slot.material);
  const [color, setColor] = useState(slot.color);

  const save = () => {
    gcode(`CFS_SET_SLOT UNIT=${unit} SLOT=${slotN} NAME="${name.replace(/"/g, '')}" MATERIAL=${material} COLOR=${color.replace('#', '')}`);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label={`Edit slot ${slotN}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(var(--bg-rgb), .72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(430px, 92vw)', background: 'linear-gradient(180deg, var(--surface), var(--bg2))', border: '1px solid var(--b2)', borderRadius: 16, boxShadow: '0 40px 90px rgba(0,0,0,.7)', padding: 22 }}
      >
        <span className="sl-eyebrow" style={{ fontSize: 10 }}>Edit slot {slotN}</span>
        <input className="sl-input" style={{ width: '100%', marginTop: 12, fontFamily: "'Manrope', sans-serif" }} value={name} onChange={(e) => setName(e.target.value)} aria-label="Slot name" />
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {MATERIALS.map((m) => (
            <button key={m} className="sl-chip" data-on={material === m} style={{ height: 32, flex: 1 }} onClick={() => setMaterial(m)}>
              {m}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              style={{ width: 30, height: 30, borderRadius: 9, background: c, cursor: 'pointer', border: `2px solid ${color.toLowerCase() === c ? 'var(--accent2)' : 'var(--b2)'}`, boxShadow: color.toLowerCase() === c ? `0 0 10px -2px ${c}` : 'none', padding: 0 }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
          <button className="sl-btn" style={{ flex: 1, height: 38 }} onClick={onClose}>Cancel</button>
          <button className="sl-btn sl-btn--accent sl-mono" style={{ flex: 1, height: 38, fontSize: 11 }} onClick={save}>CFS_SET_SLOT</button>
        </div>
      </div>
    </div>
  );
}

export function CfsPanel() {
  const profileId = useConfig((s) => s.profileId);
  const expectsCfs = getProfile(profileId)?.features.cfs === true;
  const [unit] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);
  const { connected, boxCount, activeTool, slots } = useSlots(unit);

  if (!expectsCfs) return null;

  if (!connected || boxCount === 0) {
    return (
      <Panel title="CFS filament" accent>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 8px', textAlign: 'center' }}>
          <span className="sl-script" style={{ fontSize: 21, color: 'var(--tx3)' }}>no CFS detected.</span>
          <p style={{ margin: 0, font: "400 12px/1.6 'Manrope', sans-serif", color: 'var(--txd)', maxWidth: 380 }}>
            This profile expects a filament system and none is reachable. Check the USB dongle, then re-detect.
          </p>
          <button className="sl-btn sl-btn--accent sl-mono" style={{ fontSize: 11 }} onClick={() => gcode('CFS_INITIALIZE')}>
            CFS_INITIALIZE
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title={`CFS \u00b7 unit ${unit}`}
      accent
      actions={
        <span className="sl-mono" style={{ fontSize: 10, color: 'var(--txd)', whiteSpace: 'nowrap' }}>
          {activeTool >= 0 ? `T${activeTool} active` : 'nothing loaded'} &middot; {boxCount} box{boxCount === 1 ? '' : 'es'}
        </span>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9 }}>
        {slots.map((slot, i) => {
          const n = i + 1;
          const active = activeTool === slot.index;
          const circumference = 2 * Math.PI * 29;
          return (
            <div
              key={n}
              style={{
                position: 'relative',
                border: `1px solid ${active ? 'var(--accentdim)' : 'var(--b1)'}`,
                borderRadius: 12,
                background: 'var(--inset)',
                boxShadow: active ? '0 0 0 1px rgba(var(--accent-rgb), .25), 0 0 18px -6px rgba(var(--accent-rgb), .5)' : 'none',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                opacity: slot.present ? 1 : 0.55,
              }}
            >
              {active && (
                <span
                  className="sl-mono"
                  style={{ position: 'absolute', top: -10, right: 10, height: 20, padding: '0 9px', borderRadius: 999, border: '1px solid var(--accentdim)', background: 'var(--ad2)', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 8.5, fontWeight: 800, letterSpacing: '.08em', color: 'var(--accent2)', whiteSpace: 'nowrap' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'slPulse 2s infinite' }} />
                  FEEDING T{activeTool}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="52" height="52" viewBox="0 0 72 72" style={{ flex: 'none' }} aria-hidden>
                  <circle cx="36" cy="36" r="29" fill="var(--bg)" stroke="var(--b1)" strokeWidth="2" />
                  <circle
                    cx="36" cy="36" r="29" fill="none"
                    stroke={slot.color} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - slot.remain / 100)}
                    transform="rotate(-90 36 36)"
                    style={{ filter: `drop-shadow(0 0 5px ${slot.color})` }}
                  />
                  <circle cx="36" cy="36" r="10" fill="var(--inset)" stroke="var(--b2)" strokeWidth="1.5" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ font: "800 12.5px 'Manrope', sans-serif", color: 'var(--tx)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {slot.name}
                  </span>
                  <span className="sl-mono" style={{ fontSize: 9, color: 'var(--txd)', whiteSpace: 'nowrap' }}>
                    slot {n} &middot; {slot.material} &middot; {slot.present ? `${slot.remain}%` : 'empty'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {active ? (
                  <button className="sl-btn" style={{ flex: 1, height: 32, fontSize: 11 }} onClick={() => confirmRiskyDuringPrint('Unloading filament') && gcode('CUT_FILAMENT\nCFS_RETRUDE')}>
                    Unload
                  </button>
                ) : (
                  <button className="sl-btn sl-btn--accent" style={{ flex: 1, height: 32, fontSize: 11 }} disabled={!slot.present} onClick={() => confirmRiskyDuringPrint('A tool change') && gcode(`T${slot.index}`)}>
                    Load
                  </button>
                )}
                <button className="sl-btn" style={{ height: 32, fontSize: 11 }} onClick={() => setEditing(n)}>
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {editing !== null && (
        <SlotEditDialog unit={unit} slotN={editing} slot={slots[editing - 1]} onClose={() => setEditing(null)} />
      )}
    </Panel>
  );
}
