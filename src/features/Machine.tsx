// Machine page (handoff 3.13). Config file browser + Monaco editor with the
// FIRMWARE_RESTART prompt (this rig's Octopus is a USB-to-CAN bridge with no
// restart_method), update manager, system loads, endstops, log downloads, and
// live motion limits over SET_VELOCITY_LIMIT.

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { useConfig, useLiveStore } from '../store';
import { getBackend } from '../api/client';
import { sendGcode, confirmRiskyDuringPrint, printActive } from '../api/bootstrap';
import { getProfile } from '../profiles';
import type { FileEntry } from '../api/types';
import { Icon } from '../components/icons';

// Monaco is the one big editor dependency; keep it out of the initial bundle.
// monaco-setup bundles the editor + worker locally (offline kiosk), then the
// react wrapper loads against that instance instead of its CDN loader.
const MonacoEditor = lazy(() => import('../monaco-setup').then(() => import('@monaco-editor/react')));

type Root = 'config' | 'logs' | 'gcodes';

function gcode(script: string): void {
  void sendGcode(script);
}

// ---- config files + editor ----

function ConfigFiles() {
  const phase = useLiveStore((s) => s.phase);
  const [root, setRoot] = useState<Root>('config');
  const [rows, setRows] = useState<FileEntry[]>([]);
  const [editing, setEditing] = useState<{ path: string; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getBackend().files.list(root).then((list) => {
      list.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.path.localeCompare(b.path));
      setRows(list);
    }).catch(() => setRows([]));
  }, [root]);

  useEffect(() => {
    if (phase === 'ready') refresh();
  }, [phase, refresh]);

  const open = (f: FileEntry) => {
    if (f.isDir) return;
    getBackend().files.read(root, f.path).then((text) => {
      setEditing({ path: f.path, text });
      setDirty(false);
    }).catch(() => {});
  };

  const save = async (thenRestart: boolean) => {
    if (!editing) return;
    if (thenRestart && !confirmRiskyDuringPrint('FIRMWARE_RESTART')) return;
    setSaving(true);
    setSaveError(null);
    try {
      await getBackend().files.write(root, editing.path, editing.text);
      setDirty(false);
      if (thenRestart) {
        gcode('FIRMWARE_RESTART');
        setEditing(null);
      }
    } catch (e) {
      // A silent failure here means the operator believes a config saved when
      // it did not; keep dirty set and say what happened.
      setSaveError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Config files"
      actions={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="sl-seg">
            {(['config', 'logs', 'gcodes'] as Root[]).map((r) => (
              <button key={r} data-on={root === r} onClick={() => setRoot(r)}>{r}</button>
            ))}
          </span>
          <button className="sl-btn" style={{ width: 28, height: 28, padding: 0, borderRadius: 8 }} title="Refresh" onClick={refresh}>
            <Icon name="restart" size={13} />
          </button>
        </span>
      }
    >
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {rows.map((f) => (
          <button
            key={f.path}
            className="sl-btn sl-btn--ghost"
            style={{ width: '100%', justifyContent: 'flex-start', height: 36, gap: 10, borderRadius: 8 }}
            onClick={() => open(f)}
            disabled={f.isDir}
          >
            <span style={{ color: f.isDir ? 'var(--tx3)' : 'var(--accent)' }}>
              <Icon name="files" size={15} />
            </span>
            <span className="sl-mono" style={{ flex: 1, textAlign: 'left', fontSize: 12, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.path}</span>
            <span className="sl-mono" style={{ fontSize: 10, color: 'var(--txd)' }}>
              {f.isDir ? 'folder' : `${Math.max(1, Math.round(f.size / 1024))} KB`}
            </span>
          </button>
        ))}
        {rows.length === 0 && <div style={{ padding: 8, font: "400 12px 'Manrope', sans-serif", color: 'var(--tx3)' }}>Nothing listed yet.</div>}
      </div>

      {editing && (
        <div
          role="dialog"
          aria-label={`Edit ${editing.path}`}
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(var(--bg-rgb), .78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}
          onClick={() => !dirty && setEditing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(900px, 96vw)', height: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 16, border: '1px solid var(--b2)', background: 'linear-gradient(180deg, var(--surface), var(--bg2))', boxShadow: '0 40px 90px rgba(0,0,0,.7)' }}
          >
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 18px', borderBottom: '1px solid var(--b0)' }}>
              <span className="sl-mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx)' }}>{editing.path}</span>
              {dirty && (
                <span className="sl-mono" style={{ height: 20, padding: '0 9px', borderRadius: 999, border: '1px solid rgba(var(--warning-rgb), .35)', background: 'rgba(var(--warning-rgb), .07)', display: 'inline-flex', alignItems: 'center', fontSize: 8.5, fontWeight: 800, color: 'var(--warning)' }}>
                  MODIFIED
                </span>
              )}
              <span style={{ flex: 1 }} />
              <button className="sl-btn" style={{ width: 30, height: 30, padding: 0, borderRadius: 9 }} aria-label="Close editor" onClick={() => (!dirty || window.confirm('Discard unsaved changes?')) && setEditing(null)}>
                <Icon name="x" size={13} strokeWidth={2} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Suspense fallback={<div style={{ padding: 18, color: 'var(--tx3)', font: "400 12.5px 'Manrope', sans-serif" }}>Loading editor.</div>}>
                <MonacoEditor
                  height="100%"
                  theme="vs-dark"
                  language="ini"
                  value={editing.text}
                  options={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, monospace', minimap: { enabled: false }, wordWrap: 'on' }}
                  onChange={(v) => { setEditing((e) => (e ? { ...e, text: v ?? '' } : e)); setDirty(true); }}
                />
              </Suspense>
            </div>
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '12px 18px', borderTop: '1px solid var(--b0)' }}>
              <span className="sl-mono" style={{ fontSize: 10, color: saveError ? 'var(--danger)' : 'var(--txd)' }}>
                {saveError ? `save failed: ${saveError}` : 'no restart_method on the usb-can bridge; use FIRMWARE_RESTART after saving'}
              </span>
              <span style={{ flex: 1 }} />
              <button className="sl-btn" disabled={saving || !dirty} onClick={() => void save(false)}>Save</button>
              <button className="sl-btn sl-btn--accent sl-mono" style={{ fontSize: 11 }} disabled={saving} onClick={() => void save(true)}>
                Save &amp; FIRMWARE_RESTART
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ---- update manager ----

interface UpdateRow {
  name: string;
  version: string;
  remote: string;
  canUpdate: boolean;
  isSystem: boolean;
  packageCount: number;
  configuredType: string;
}

function rowsFrom(res: Record<string, unknown>): UpdateRow[] {
  const info = (res.version_info ?? {}) as Record<
    string,
    { version?: string; remote_version?: string; configured_type?: string; package_count?: number }
  >;
  return Object.entries(info).map(([name, v]) => {
    const configuredType = v.configured_type ?? (name === 'system' ? 'system' : '');
    const isSystem = configuredType === 'system';
    const packageCount = Number(v.package_count ?? 0);
    return {
      name,
      version: v.version ?? '?',
      remote: v.remote_version ?? v.version ?? '?',
      // The system (apt) entry has no version pair; it reports package_count.
      // Comparing undefined versions rendered 65 pending packages as
      // "UP-TO-DATE".
      canUpdate: isSystem ? packageCount > 0 : Boolean(v.version && v.remote_version && v.version !== v.remote_version),
      isSystem,
      packageCount,
      configuredType,
    };
  });
}

function UpdateManager() {
  const phase = useLiveStore((s) => s.phase);
  const profileId = useConfig((s) => s.profileId);
  const profile = getProfile(profileId);
  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);

  const readStatus = useCallback(() => {
    getBackend().machine.updateStatus().then((res) => setRows(rowsFrom(res))).catch(() => setRows([]));
  }, []);

  // "Check now" is a REAL remote refresh (POST /machine/update/refresh), not a
  // cached re-read: the cache can report "up to date" long after the remotes
  // moved (seen on the rig: cache clean, refresh found klipper 701→707 + 65
  // apt packages). ~8s; Moonraker rejects it mid-print, so fall back to the
  // cache then and say so.
  const checkNow = useCallback(() => {
    if (printActive()) {
      setNote('print running · showing cached status (Moonraker refuses a remote refresh mid-print)');
      readStatus();
      return;
    }
    setChecking(true);
    setNote(null);
    getBackend().machine.updateRefresh()
      .then(() => setNote(`remotes checked ${new Date().toTimeString().slice(0, 8)}`))
      .catch(() => setNote('remote refresh failed · showing cached status'))
      .finally(() => {
        readStatus();
        setChecking(false);
      });
  }, [readStatus]);

  useEffect(() => {
    if (phase === 'ready') readStatus();
  }, [phase, readStatus]);

  const reflashKlipper = Boolean(profile?.reflashOnFirmwareUpdate);

  const update = (row: UpdateRow) => {
    if (!confirmRiskyDuringPrint(`Updating ${row.name}`)) return;
    if (row.name === 'klipper' && reflashKlipper) {
      // On custom-firmware builds a Klipper bump is not git pull + restart:
      // every MCU must be recompiled + reflashed to match the new klippy or
      // Klipper refuses to start (MCU version mismatch). Blocking warning,
      // driven by the profile, not hardcoded to the Hi.
      const mcus = (profile?.firmwareMcus ?? [])
        .map((m) => `${m.name} (${m.bus}${m.tool ? ', toolhead' : ''})`)
        .join(', ');
      const warning =
        `Updating Klipper on this printer also requires reflashing its firmware.\n\n` +
        `Afterward you must recompile and reflash ${mcus || 'every MCU on this machine'} via Katapult, or Klipper will not start (MCU version mismatch).` +
        (profile?.id === 'modded-hi-cfs'
          ? '\n\nThis rig also has a soft-restart regression: the restart after an update crashes klippy and needs a physical cold power cycle.'
          : '') +
        `\n\nDo this only when you are at the printer. Continue?`;
      if (!window.confirm(warning)) return;
    } else if (!window.confirm(`Update ${row.name}? The service restarts during the update.`)) {
      return;
    }
    getBackend().machine.updateAction(row.name)
      .then(() => {
        // A web-client update (e.g. mercy itself, once registered with
        // [update_manager mercy]) swaps the served files but not the
        // running app; the kiosk must reload to finish. The service-worker
        // precache on the roadmap supersedes this affordance.
        if (row.configuredType === 'web') setNeedsReload(true);
        readStatus();
      })
      .catch(() => {});
  };

  return (
    <Panel
      title="Update manager"
      actions={
        <button className="sl-btn" style={{ height: 26, fontSize: 10.5, borderRadius: 999 }} disabled={checking} onClick={checkNow}>
          {checking ? 'Checking remotes…' : 'Check now'}
        </button>
      }
    >
      {needsReload && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--accentdim)', background: 'var(--ad2)' }}>
          <span style={{ flex: 1, font: "700 11.5px/1.5 'Manrope', sans-serif", color: 'var(--accent2)' }}>
            New UI files are on disk. Reload to finish updating.
          </span>
          <button className="sl-btn sl-btn--accent" style={{ height: 28, fontSize: 10.5 }} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((u, i) => (
          <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--b0)' }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ font: "800 12.5px 'Manrope', sans-serif", color: 'var(--tx)' }}>{u.name}</span>
              <span className="sl-mono" style={{ fontSize: 9.5, color: 'var(--txd)' }}>
                {u.isSystem
                  ? u.canUpdate
                    ? `${u.packageCount} apt package${u.packageCount === 1 ? '' : 's'} pending`
                    : 'apt packages current'
                  : u.canUpdate
                    ? `${u.version} \u2192 ${u.remote}`
                    : u.version}
              </span>
              {u.name === 'klipper' && reflashKlipper && u.canUpdate && (
                <span className="sl-mono" style={{ fontSize: 9, color: 'var(--warning)' }}>
                  update requires an MCU reflash on this printer · details on Update
                </span>
              )}
            </span>
            <span
              className="sl-mono"
              style={{ height: 20, padding: '0 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: 8.5, fontWeight: 800, letterSpacing: '.06em', color: u.canUpdate ? 'var(--warning)' : 'var(--success)', background: u.canUpdate ? 'rgba(var(--warning-rgb), .07)' : 'var(--ok-d2)', border: `1px solid ${u.canUpdate ? 'rgba(var(--warning-rgb), .4)' : 'rgba(var(--success-rgb), .35)'}` }}
            >
              {u.canUpdate ? 'UPDATE READY' : 'UP-TO-DATE'}
            </span>
            {u.canUpdate && (
              <button className="sl-btn sl-btn--accent" style={{ height: 28, fontSize: 10.5 }} onClick={() => update(u)}>Update</button>
            )}
          </div>
        ))}
        {rows.length === 0 && <div style={{ font: "400 12.5px 'Manrope', sans-serif", color: 'var(--tx3)' }}>Update status not available.</div>}
      </div>
      {note && <p className="sl-mono" style={{ margin: '9px 0 0', fontSize: 9.5, color: 'var(--txd)' }}>{note}</p>}
    </Panel>
  );
}

// ---- system loads ----

function SystemLoads() {
  const phase = useLiveStore((s) => s.phase);
  const objects = useLiveStore((s) => s.objects);
  const [sys, setSys] = useState<Record<string, unknown> | null>(null);
  const [proc, setProc] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (phase !== 'ready') return;
    getBackend().machine.systemInfo().then(setSys).catch(() => {});
    const t = window.setInterval(() => getBackend().machine.procStats().then(setProc).catch(() => {}), 3000);
    getBackend().machine.procStats().then(setProc).catch(() => {});
    return () => window.clearInterval(t);
  }, [phase]);

  const cpu = Math.round(Number((proc?.system_cpu_usage as Record<string, unknown> | undefined)?.cpu ?? 0));
  const mem = (proc?.system_memory ?? {}) as { total?: number; used?: number };
  const memPct = mem.total ? Math.round(((mem.used ?? 0) / mem.total) * 100) : 0;
  const info = ((sys?.system_info ?? {}) as Record<string, Record<string, unknown>>);
  const cpuDesc = String(info.cpu_info?.cpu_desc ?? 'host');
  const distro = String(info.distribution?.name ?? '');

  const mcus = Object.keys(objects).filter((n) => n === 'mcu' || n.startsWith('mcu '));

  const Gauge = ({ pct, label }: { pct: number; label: string }) => {
    const C2 = 2 * Math.PI * 17;
    return (
      <svg width="44" height="44" viewBox="0 0 44 44" style={{ flex: 'none' }} aria-hidden>
        <circle cx="22" cy="22" r="17" fill="none" stroke="var(--track)" strokeWidth="5" />
        <circle cx="22" cy="22" r="17" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(C2 * Math.min(100, pct)) / 100} ${C2}`} transform="rotate(-90 22 22)" />
        <text x="22" y="26" textAnchor="middle" fill="var(--tx)" fontSize="10.5" fontWeight="800" fontFamily="JetBrains Mono">{label}</text>
      </svg>
    );
  };

  return (
    <Panel title="System loads">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="sl-inset" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 11 }}>
          <Gauge pct={cpu} label={`${cpu}%`} />
          <Gauge pct={memPct} label={`${memPct}%`} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ font: "800 12.5px 'Manrope', sans-serif", color: 'var(--tx)' }}>host</span>
            <span className="sl-mono" style={{ fontSize: 9, color: 'var(--txd)', lineHeight: 1.5 }}>
              {cpuDesc}<br />{distro} &middot; cpu / mem gauges
            </span>
          </span>
        </div>
        {mcus.map((name) => {
          const m = objects[name] as { mcu_version?: string; last_stats?: { mcu_awake?: number; freq?: number } };
          const awake = Math.round(((m.last_stats?.mcu_awake ?? 0) as number) * 100);
          const freq = m.last_stats?.freq ? `${Math.round((m.last_stats.freq as number) / 1e6)} MHz` : '';
          return (
            <div key={name} className="sl-inset" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 11 }}>
              <Gauge pct={awake} label={`${awake}%`} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ font: "800 12.5px 'Manrope', sans-serif", color: 'var(--tx)' }}>{name === 'mcu' ? 'mcu' : name.slice(4)}</span>
                <span className="sl-mono" style={{ fontSize: 9, color: 'var(--txd)', lineHeight: 1.5 }}>
                  {m.mcu_version ?? ''}{freq ? ` \u00b7 ${freq}` : ''} &middot; awake {awake}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---- endstops / logs / motion ----

function Endstops() {
  const [states, setStates] = useState<Record<string, string> | null>(null);
  const sync = () => getBackend().machine.queryEndstops().then(setStates).catch(() => {});
  return (
    <Panel title="Endstops" actions={<button className="sl-btn sl-mono" style={{ height: 26, fontSize: 10, borderRadius: 999 }} onClick={sync}>QUERY_ENDSTOPS</button>}>
      {states === null ? (
        <div style={{ font: "400 12px 'Manrope', sans-serif", color: 'var(--tx3)' }}>Not queried yet. Run the query to read every endstop.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {Object.entries(states).map(([n, s]) => (
            <span key={n} className="sl-inset" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px' }}>
              <span className="sl-mono" style={{ fontSize: 11, color: 'var(--tx2)' }}>{n}</span>
              <span className="sl-mono" style={{ fontSize: 9.5, fontWeight: 800, color: s.toUpperCase() === 'TRIGGERED' ? 'var(--warning)' : 'var(--success)' }}>{s.toUpperCase()}</span>
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Logs() {
  const host = useConfig((s) => s.moonrakerHost).replace(/\/$/, '');
  // crowsnest's log lives under the logs root; only klippy/moonraker have the
  // top-level alias route.
  const logs: [string, string][] = [['klippy.log', 'klippy.log'], ['moonraker.log', 'moonraker.log'], ['crowsnest.log', 'logs/crowsnest.log']];
  return (
    <Panel title="Log files">
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {logs.map(([label, path]) => (
          <a key={label} className="sl-btn sl-mono" style={{ height: 30, fontSize: 10, textDecoration: 'none' }} href={`${host}/server/files/${path}`} download>
            <Icon name="upload" size={12} strokeWidth={2} /> {label}
          </a>
        ))}
      </div>
    </Panel>
  );
}

function MotionLimits() {
  const toolhead = useLiveStore((s) => s.objects.toolhead) ?? {};
  const fields: { label: string; key: string; arg: string; step: number; unit: string; min: number; max: number }[] = [
    { label: 'Velocity', key: 'max_velocity', arg: 'VELOCITY', step: 25, unit: 'mm/s', min: 5, max: 1000 },
    { label: 'Acceleration', key: 'max_accel', arg: 'ACCEL', step: 1000, unit: 'mm/s\u00b2', min: 100, max: 50000 },
    { label: 'Square corner velocity', key: 'square_corner_velocity', arg: 'SQUARE_CORNER_VELOCITY', step: 1, unit: 'mm/s', min: 0, max: 20 },
    { label: 'Min cruise ratio', key: 'minimum_cruise_ratio', arg: 'MINIMUM_CRUISE_RATIO', step: 0.05, unit: '0 to 1', min: 0, max: 0.99 },
  ];
  const bump = (f: (typeof fields)[number], cur: number, delta: number) => {
    // Clamp: these apply live, mid-print included; an unbounded accel bump is
    // a crash, not a setting.
    const v = Math.min(f.max, Math.max(f.min, Math.round((cur + delta) * 100) / 100));
    if (v === cur) return;
    gcode(`SET_VELOCITY_LIMIT ${f.arg}=${v}`);
  };
  return (
    <Panel title="Motion limits">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
        {fields.map((f) => {
          const cur = Number(toolhead[f.key] ?? 0);
          return (
            <div key={f.key} className="sl-inset" style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 5, borderRadius: 10 }}>
              <span style={{ font: "700 9px 'Manrope', sans-serif", color: 'var(--txd)' }}>{f.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <button className="sl-chip" style={{ width: 24, height: 24, padding: 0 }} onClick={() => bump(f, cur, -f.step)} aria-label={`Decrease ${f.label}`}>&minus;</button>
                <span className="sl-mono" style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--tx)' }}>{cur}</span>
                <button className="sl-chip" style={{ width: 24, height: 24, padding: 0 }} onClick={() => bump(f, cur, f.step)} aria-label={`Increase ${f.label}`}>+</button>
              </span>
              <span className="sl-mono" style={{ fontSize: 8.5, color: 'var(--txf)' }}>{f.unit}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function Machine() {
  return (
    <div className="sl-page" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>under the hood.</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>Machine</span>
        </span>
      </div>
      <div className="sl-cgrid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ConfigFiles />
          <UpdateManager />
          <MotionLimits />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SystemLoads />
          <Endstops />
          <Logs />
        </div>
      </div>
    </div>
  );
}
