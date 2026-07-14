// Dashboard route ('/'). The prototype's configurable module layout:
// presets (parity / cockpit / deck / custom), per-module hide and size
// overrides, all persisted in config.dashboard. Edit layout enters an
// in-place mode with remove buttons, S/M/L/W size chips, and a restore
// drawer for hidden modules. Module order follows the preset; the stack
// collapses to one column under 900px (order preserved).

import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { useConfig, useLiveStore } from '../store';
import { getProfile } from '../profiles';
import { getBackend } from '../api/client';
import type { DashboardLayout, DashPreset, ModuleSize } from '../store/config';
import { Toolhead } from './Toolhead';
import { Temperatures } from './Temperatures';
import { Macros } from './Macros';
import { Extruder } from './Extruder';
import { Fans } from './Fans';
import { Rgb } from './Rgb';
import { FilamentSensor } from './FilamentSensor';
import { CfsPanel } from './CfsPanel';

// ---- job card ----

function fmtHM(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function JobCard() {
  const navigate = useNavigate();
  const filename = useLiveStore((s) => s.filename);
  const state = useLiveStore((s) => s.state);
  const progress = useLiveStore((s) => s.progress);
  const printDuration = useLiveStore((s) => s.printDuration);
  const currentLayer = useLiveStore((s) => s.currentLayer);
  const totalLayers = useLiveStore((s) => s.totalLayers);

  const active = state === 'printing' || state === 'paused';
  const pct = Math.round(progress * 100);
  const eta = active && progress > 0.001 ? (printDuration * (1 - progress)) / progress : null;

  const control = (action: 'pause' | 'resume' | 'cancel') => {
    const p = getBackend().print;
    if (action === 'cancel') {
      if (!window.confirm(`Cancel ${filename ?? 'this print'}?`)) return;
      p.cancel().catch(() => {});
      return;
    }
    (action === 'pause' ? p.pause() : p.resume()).catch(() => {});
  };

  if (!active) {
    return (
      <Panel title={state === 'complete' ? 'Print complete' : 'Idle'} accent>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '6px 0' }}>
          <span className="sl-script" style={{ fontSize: 21, color: 'var(--tx3)' }}>nothing on the bed.</span>
          <span style={{ flex: 1 }} />
          <button className="sl-btn sl-btn--accent" onClick={() => navigate('/files')}>Pick a file</button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title={state === 'paused' ? 'Paused' : 'Now printing'}
      accent
      actions={
        currentLayer !== null ? (
          <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--txd)', whiteSpace: 'nowrap' }}>
            layer {currentLayer}{totalLayers ? ` / ${totalLayers}` : ''}
          </span>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 300px', minWidth: 0 }}>
          <span style={{ font: "800 14.5px 'Manrope', sans-serif", color: 'var(--tx)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {filename}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accentdim), var(--accent))', boxShadow: '0 0 10px rgba(var(--accent-rgb), .6)' }} />
            </div>
            <span className="sl-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent2)' }}>{pct}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="sl-inset" style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ font: "700 9.5px 'Manrope', sans-serif", color: 'var(--txd)' }}>elapsed</span>
            <span className="sl-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', whiteSpace: 'nowrap' }}>{fmtHM(printDuration)}</span>
          </span>
          <span className="sl-inset" style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ font: "700 9.5px 'Manrope', sans-serif", color: 'var(--txd)' }}>remaining</span>
            <span className="sl-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', whiteSpace: 'nowrap' }}>
              {eta === null ? '\u2014' : fmtHM(eta)}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {state === 'paused' ? (
            <button className="sl-btn sl-btn--accent" style={{ height: 40 }} onClick={() => control('resume')}>Resume</button>
          ) : (
            <button className="sl-btn" style={{ height: 40 }} onClick={() => control('pause')}>Pause</button>
          )}
          <button className="sl-btn sl-btn--danger" style={{ height: 40 }} onClick={() => control('cancel')}>Cancel</button>
        </div>
      </div>
    </Panel>
  );
}

// ---- module layout system ----

const GAP = 14;
const SIZE_W: Record<ModuleSize, string> = {
  S: `calc(25% - ${(GAP * 3) / 4}px)`,
  M: `calc(33.333% - ${(GAP * 2) / 3}px)`,
  L: `calc(50% - ${GAP / 2}px)`,
  W: '100%',
};

interface ModuleDef {
  key: string;
  label: string;
  node: ReactNode;
}

interface PresetDef {
  order: string[];
  sizes: Record<string, ModuleSize>;
  hidden: string[];
}

const PRESETS: Record<Exclude<DashPreset, 'custom'>, PresetDef> = {
  parity: {
    order: ['status', 'toolhead', 'temps', 'extruder', 'macros', 'fans', 'cfs', 'rgb', 'sensor'],
    sizes: { status: 'W', toolhead: 'M', temps: 'M', extruder: 'M', macros: 'M', fans: 'M', cfs: 'M', rgb: 'M', sensor: 'M' },
    hidden: [],
  },
  cockpit: {
    order: ['status', 'temps', 'cfs', 'toolhead', 'extruder', 'macros', 'fans', 'rgb', 'sensor'],
    sizes: { status: 'L', temps: 'L', cfs: 'L', toolhead: 'L', extruder: 'M', macros: 'M', fans: 'M', rgb: 'M', sensor: 'M' },
    hidden: ['rgb', 'sensor'],
  },
  deck: {
    order: ['temps', 'status', 'toolhead', 'extruder', 'cfs', 'macros', 'fans'],
    sizes: { temps: 'L', status: 'L', toolhead: 'M', extruder: 'M', cfs: 'M', macros: 'L', fans: 'L' },
    hidden: ['rgb', 'sensor'],
  },
};

function ModuleChrome({ label, onHide, size, onSize }: { label: string; onHide: () => void; size: ModuleSize; onSize: (s: ModuleSize) => void }) {
  return (
    <>
      <span
        style={{ position: 'absolute', top: -11, left: 10, zIndex: 2, height: 22, padding: '0 9px', borderRadius: 999, border: '1px solid var(--b2)', background: 'var(--surface)', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', font: "800 9.5px 'Manrope', sans-serif", color: 'var(--tx3)' }}
      >
        {label}
      </span>
      <button
        aria-label={`Remove ${label}`}
        onClick={onHide}
        style={{ position: 'absolute', top: -11, right: 10, zIndex: 2, width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--danger-b)', background: 'var(--danger-d1)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, font: '800 11px sans-serif' }}
      >
        &times;
      </button>
      <span style={{ position: 'absolute', bottom: -11, right: 12, zIndex: 2, display: 'flex', gap: 3, padding: 2, borderRadius: 999, border: '1px solid var(--b2)', background: 'var(--surface)' }}>
        {(['S', 'M', 'L', 'W'] as ModuleSize[]).map((s) => (
          <button
            key={s}
            onClick={() => onSize(s)}
            style={{ width: 20, height: 18, borderRadius: 999, cursor: 'pointer', padding: 0, font: "800 9px 'Manrope', sans-serif", border: `1px solid ${size === s ? 'var(--accentdim)' : 'transparent'}`, background: size === s ? 'var(--ad1)' : 'transparent', color: size === s ? 'var(--accent2)' : 'var(--txd)' }}
          >
            {s}
          </button>
        ))}
      </span>
    </>
  );
}

export function Dashboard() {
  const dashboard = useConfig((s) => s.dashboard);
  const setDashboard = useConfig((s) => s.setDashboard);
  const profileId = useConfig((s) => s.profileId);
  const objects = useLiveStore((s) => s.objects);

  const [editing, setEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardLayout | null>(null);

  const hasCfs = getProfile(profileId)?.features.cfs === true;
  const hasLeds = Object.keys(objects).some((n) => n.startsWith('led ') || n.startsWith('neopixel '));
  const hasSensors = Object.keys(objects).some((n) => n.startsWith('filament_switch_sensor ') || n.startsWith('filament_motion_sensor '));

  const modules: ModuleDef[] = useMemo(() => {
    const all: ModuleDef[] = [
      { key: 'status', label: 'Now printing', node: <JobCard /> },
      { key: 'toolhead', label: 'Toolhead', node: <Toolhead /> },
      { key: 'temps', label: 'Temperatures', node: <Temperatures /> },
      { key: 'extruder', label: 'Extruder', node: <Extruder /> },
      { key: 'macros', label: 'Macros', node: <Macros /> },
      { key: 'fans', label: 'Fans & outputs', node: <Fans /> },
      { key: 'cfs', label: 'CFS filament', node: <CfsPanel /> },
      { key: 'rgb', label: 'Lights', node: <Rgb /> },
      { key: 'sensor', label: 'Filament sensors', node: <FilamentSensor /> },
    ];
    return all.filter((m) => {
      if (m.key === 'cfs') return hasCfs;
      if (m.key === 'rgb') return hasLeds;
      if (m.key === 'sensor') return hasSensors;
      return true;
    });
  }, [hasCfs, hasLeds, hasSensors]);

  const baseKey = dashboard.preset === 'custom' ? dashboard.base ?? 'parity' : dashboard.preset;
  const preset = PRESETS[baseKey] ?? PRESETS.parity;
  const isHidden = (key: string) => dashboard.hidden[key] ?? preset.hidden.includes(key);
  const sizeOf = (key: string): ModuleSize => dashboard.sizes[key] ?? preset.sizes[key] ?? 'M';
  const orderOf = (key: string) => {
    const i = preset.order.indexOf(key);
    return i < 0 ? 99 : i;
  };

  // Any per-module edit turns the arrangement custom while remembering which
  // preset it grew from, so untouched modules keep that preset's layout.
  const customize = (patch: Partial<DashboardLayout>) =>
    setDashboard({ preset: 'custom', base: baseKey, ...patch });

  const hiddenModules = modules.filter((m) => isHidden(m.key));

  const startEdit = () => {
    setSnapshot({ preset: dashboard.preset, base: dashboard.base, hidden: { ...dashboard.hidden }, sizes: { ...dashboard.sizes } });
    setEditing(true);
  };
  const cancelEdit = () => {
    if (snapshot) setDashboard(snapshot);
    setEditing(false);
  };
  const pickPreset = (p: DashPreset) => {
    if (p === 'custom') setDashboard({ preset: 'custom', base: baseKey });
    else setDashboard({ preset: p, base: undefined, hidden: {}, sizes: {} });
  };

  return (
    <div className="sl-page" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>{editing ? 'make it yours.' : 'mission control'}</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>{editing ? 'Editing dashboard' : 'Dashboard'}</span>
        </span>
        {editing && (
          <div className="sl-seg">
            {(['parity', 'cockpit', 'deck', 'custom'] as DashPreset[]).map((p) => (
              <button key={p} data-on={dashboard.preset === p} onClick={() => pickPreset(p)}>
                {{ parity: 'Parity grid', cockpit: 'Cockpit hero', deck: 'Command deck', custom: 'Custom' }[p]}
              </button>
            ))}
          </div>
        )}
        <span style={{ flex: 1 }} />
        {editing ? (
          <>
            <button className="sl-btn sl-btn--ghost" onClick={cancelEdit}>Cancel</button>
            <button className="sl-btn sl-btn--accent" onClick={() => setEditing(false)}>Done</button>
          </>
        ) : (
          <button className="sl-btn" style={{ height: 32, fontSize: 11.5 }} onClick={startEdit}>Edit layout</button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP, alignItems: 'stretch' }}>
        {modules.filter((m) => !isHidden(m.key)).map((m) => (
          <div
            key={m.key}
            className="sl-mod"
            style={{
              position: 'relative',
              width: SIZE_W[sizeOf(m.key)],
              order: orderOf(m.key),
              outline: editing ? '1.5px dashed rgba(var(--accent-rgb), .45)' : 'none',
              outlineOffset: 3,
              borderRadius: 14,
              paddingTop: editing ? 13 : 0,
            }}
          >
            {m.node}
            {editing && (
              <ModuleChrome
                label={m.label}
                size={sizeOf(m.key)}
                onHide={() => customize({ hidden: { ...dashboard.hidden, [m.key]: true } })}
                onSize={(s) => customize({ sizes: { ...dashboard.sizes, [m.key]: s } })}
              />
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div
          style={{ position: 'sticky', bottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 14, border: '1px solid var(--accentdim)', background: 'rgba(var(--bg2-rgb), .92)', backdropFilter: 'blur(6px)', boxShadow: '0 -12px 40px rgba(0,0,0,.4)' }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, flex: 'none' }}>
            <span className="sl-eyebrow" style={{ fontSize: 10 }}>Module library</span>
            <span className="sl-mono" style={{ fontSize: 9, color: 'var(--txd)' }}>tap to add back</span>
          </span>
          {hiddenModules.length === 0 ? (
            <span className="sl-script" style={{ fontSize: 17, color: 'var(--tx3)' }}>everything is on the board.</span>
          ) : (
            hiddenModules.map((m) => (
              <button key={m.key} className="sl-btn" onClick={() => setDashboard({ hidden: { ...dashboard.hidden, [m.key]: false } })}>
                {m.label} +
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
