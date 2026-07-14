// Settings page ('/settings'). The permanent home for every wizard choice,
// grouped the same way (handoff 5, closing paragraph), plus connection mode,
// dashboard layout reset, export / import / factory reset.

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { useConfig, useLiveStore } from '../store';
import { PROFILES, getProfile } from '../profiles';
import { THEME_META } from '../theme/tokens';
import { restartBackend, printActive } from '../api/bootstrap';
import { getBackend } from '../api/client';
import { Icon } from '../components/icons';
import { mapMoonrakerService } from '../components/WebcamView';
import type { ConnectionMode, DashPreset, InterfaceKind, WebcamConfig } from '../store/config';

const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];

export function Settings() {
  const navigate = useNavigate();
  const cfg = useConfig();
  const phase = useLiveStore((s) => s.phase);
  const kind = useLiveStore((s) => s.kind);
  const logoRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [hostDraft, setHostDraft] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const profile = getProfile(cfg.profileId);
  const host = hostDraft ?? cfg.moonrakerHost;

  const applyConnection = (mode?: ConnectionMode) => {
    // Gate on the EFFECTIVE connection, not the mode label: 'auto' is just as
    // live-connected as 'live' once the Moonraker adapter is up.
    if (mode && mode === 'demo' && kind === 'moonraker' && printActive() && !window.confirm('A print is running. Leaving live mode drops visibility of it (the print itself keeps going). Continue?')) {
      return;
    }
    if (hostDraft !== null) {
      // Accept natural entries like printer.local:7125; the client needs a
      // scheme to build http and ws URLs.
      const trimmed = hostDraft.trim();
      cfg.setMoonrakerHost(trimmed && !/^https?:\/\//i.test(trimmed) ? `http://${trimmed}` : trimmed);
    }
    if (mode) cfg.setConnectionMode(mode);
    setHostDraft(null);
    restartBackend();
    setNote('Reconnecting with the new settings.');
  };

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > 1_048_576) {
      setNote('Logo must be a PNG, SVG, WebP, or JPG under 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => cfg.setLogo(String(reader.result));
    reader.onerror = () => setNote('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const exportSettings = () => {
    const state = useConfig.getState();
    const data = {
      moonrakerHost: state.moonrakerHost,
      connectionMode: state.connectionMode,
      profileId: state.profileId,
      theme: state.theme,
      mode: state.mode,
      logo: state.logo,
      webcam: state.webcam,
      ui: state.ui,
      dashboard: state.dashboard,
      console: state.console,
      printers: state.printers,
      cameras: state.cameras,
      wizardCompleted: state.wizardCompleted,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mercy.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const importSettings = (file: File | undefined) => {
    if (!file) return;
    file.text().then((text) => {
      try {
        const raw = JSON.parse(text) as Record<string, unknown>;
        if (typeof raw !== 'object' || raw === null || typeof raw.profileId !== 'string') {
          setNote('That does not look like a mercy.json export.');
          return;
        }
        // Whitelist and type-check every field, deep-merging objects onto the
        // current state. Arbitrary keys or wrong shapes (dashboard: null) would
        // persist to localStorage and crash every render with no in-app
        // recovery, so nothing passes through unchecked.
        const cur = useConfig.getState();
        const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
        const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
        const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
        // Coerce every camera field to its type. An object-valued name/service
        // in a corrupt export used to pass the streamUrl-only filter and crash
        // the Settings render ("Objects are not valid as a React child") — the
        // page that holds Factory reset, so recovery was unreachable.
        const camOf = (v: unknown, fallback: WebcamConfig): WebcamConfig => {
          const o = obj(v);
          return {
            enabled: bool(o.enabled, fallback.enabled),
            name: str(o.name, fallback.name),
            streamUrl: str(o.streamUrl, fallback.streamUrl),
            snapshotUrl: str(o.snapshotUrl, fallback.snapshotUrl),
            service: (['mjpeg', 'snapshot', 'webrtc'] as const).find((sv) => sv === o.service) ?? fallback.service,
            aspect: str(o.aspect, fallback.aspect),
          };
        };
        const blankCam: WebcamConfig = { enabled: true, name: 'camera', streamUrl: '', snapshotUrl: '', service: 'mjpeg', aspect: '16:9' };
        const camList = (v: unknown): WebcamConfig[] | undefined =>
          Array.isArray(v) ? (v as unknown[]).map((c) => camOf(c, blankCam)).filter((c) => c.streamUrl !== '') : undefined;
        const theme = (['cyan', 'crimson', 'amber', 'mono', 'grey', 'sage'] as const).find((t) => t === raw.theme) ?? cur.theme;
        const mode = raw.mode === 'light' ? 'light' as const : raw.mode === 'dark' ? 'dark' as const : cur.mode;
        const dash = obj(raw.dashboard);
        const preset = (['parity', 'cockpit', 'deck', 'custom'] as const).find((p) => p === dash.preset) ?? cur.dashboard.preset;
        useConfig.setState({
          moonrakerHost: str(raw.moonrakerHost, cur.moonrakerHost),
          connectionMode: (['auto', 'live', 'demo'] as const).find((m) => m === raw.connectionMode) ?? cur.connectionMode,
          profileId: PROFILES.some((p) => p.id === raw.profileId) ? (raw.profileId as string) : cur.profileId,
          theme,
          mode,
          logo: typeof raw.logo === 'string' && raw.logo.startsWith('data:image/') ? raw.logo : cur.logo,
          webcam: camOf(raw.webcam, cur.webcam),
          ui: { ...cur.ui, ...obj(raw.ui) },
          dashboard: { preset, base: (['parity', 'cockpit', 'deck'] as const).find((p) => p === dash.base), hidden: obj(dash.hidden) as Record<string, boolean>, sizes: obj(dash.sizes) as Record<string, 'S' | 'M' | 'L' | 'W'> },
          console: { ...cur.console, ...obj(raw.console) },
          printers: Array.isArray(raw.printers)
            ? (raw.printers as unknown[])
                .map((p) => obj(p))
                .filter((p) => typeof p.host === 'string' && typeof p.profileId === 'string')
                .map((p) => ({
                  name: str(p.name, p.profileId as string),
                  host: p.host as string,
                  profileId: p.profileId as string,
                  ...(p.webcam !== undefined ? { webcam: camOf(p.webcam, blankCam) } : {}),
                  ...(camList(p.cameras) !== undefined ? { cameras: camList(p.cameras) } : {}),
                }))
            : cur.printers,
          cameras: camList(raw.cameras) ?? cur.cameras,
          wizardCompleted: bool(raw.wizardCompleted, cur.wizardCompleted),
        });
        cfg.setTheme(theme);
        cfg.setMode(mode);
        setNote('Settings restored. Reconnecting.');
        restartBackend();
      } catch {
        setNote('Could not parse that file.');
      }
    }).catch(() => setNote('Could not read that file.'));
  };

  const factoryReset = () => {
    if (!window.confirm('Factory reset this app? Clears theme, layouts, webcam, logo, and the wizard flag on this install, then re-runs setup. The printer and its Klipper config are not touched.')) return;
    useConfig.persist.clearStorage();
    window.location.reload();
  };

  return (
    <div className="sl-page" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>dial it in.</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>Settings</span>
        </span>
        <span className="sl-mono" style={{ fontSize: 10, color: 'var(--txd)' }}>every wizard step lives here too</span>
        <span style={{ flex: 1 }} />
        {note && <span className="sl-mono" style={{ fontSize: 10, color: 'var(--accent2)' }}>{note}</span>}
        <button className="sl-btn" onClick={() => { cfg.resetWizard(); navigate('/setup'); }}>
          <Icon name="restart" size={14} /> Re-run setup wizard
        </button>
      </div>

      <div className="sl-cgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Printer profile">
            <select
              className="sl-input"
              style={{ width: '100%', height: 38 }}
              value={cfg.profileId}
              onChange={(e) => cfg.setProfile(e.target.value)}
              aria-label="Printer profile"
            >
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
            {profile && (
              <p className="sl-mono" style={{ margin: '9px 0 0', fontSize: 9.5, color: 'var(--txd)', lineHeight: 1.6 }}>
                {profile.build.x}&middot;{profile.build.y}&middot;{profile.build.z} &middot; {profile.kinematics} &middot; hotend {profile.hotend.maxTemp}&deg; &middot; bed {profile.bed.maxTemp}&deg;
                {profile.features.cfs ? ' \u00b7 cfs' : ''}
              </p>
            )}
            {profile && profile.firmware !== 'klipper-native' && (
              <p style={{ margin: '9px 0 0', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(var(--warning-rgb), .35)', background: 'rgba(var(--warning-rgb), .06)', font: "400 11.5px/1.6 'Manrope', sans-serif", color: 'var(--tx2)' }}>
                {profile.apiNotes}
              </p>
            )}
          </Panel>

          <Panel
            title="Connection"
            actions={
              <span className="sl-seg">
                {(['auto', 'live', 'demo'] as ConnectionMode[]).map((m) => (
                  <button key={m} data-on={cfg.connectionMode === m} onClick={() => applyConnection(m)}>{m}</button>
                ))}
              </span>
            }
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="sl-input"
                style={{ flex: 1, fontSize: 11.5 }}
                placeholder="http://printer.local:7125 (blank = same origin)"
                value={host}
                onChange={(e) => setHostDraft(e.target.value)}
                aria-label="Moonraker host"
              />
              <button className="sl-btn sl-btn--accent" disabled={hostDraft === null} onClick={() => applyConnection()}>Apply</button>
            </div>
            <p className="sl-mono" style={{ margin: '9px 0 0', fontSize: 9.5, color: 'var(--txd)', lineHeight: 1.6 }}>
              {kind === 'demo' ? 'demo simulator running' : `moonraker ${phase}`} &middot; add the served origin to moonraker cors_domains, then reload moonraker. auto falls back to the simulator so the screen is never blank.
            </p>
          </Panel>

          <Panel
            title="Webcam"
            actions={
              <span className="sl-seg">
                <button data-on={cfg.webcam.enabled} onClick={() => cfg.setWebcam({ enabled: true })}>On</button>
                <button data-on={!cfg.webcam.enabled} onClick={() => cfg.setWebcam({ enabled: false })}>Off</button>
              </span>
            }
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['mjpeg', 'snapshot', 'webrtc'] as const).map((sv) => (
                <button key={sv} className="sl-chip" data-on={(cfg.webcam.service ?? 'mjpeg') === sv} style={{ height: 30 }} onClick={() => cfg.setWebcam({ service: sv })}>
                  {sv}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button
                className="sl-btn"
                style={{ height: 30, fontSize: 11 }}
                onClick={() => {
                  getBackend().listWebcams().then((cams) => {
                    if (cams.length === 0) {
                      setNote('Moonraker reports no cameras.');
                      return;
                    }
                    const mapped = cams.map((c) => ({
                      enabled: true,
                      name: c.name,
                      streamUrl: c.streamUrl,
                      snapshotUrl: c.snapshotUrl,
                      // Explicit service map (webrtc / snapshot / mjpeg); a
                      // detected snapshot-only camera must not become an
                      // unplayable webrtc placeholder.
                      service: mapMoonrakerService(c.service),
                      aspect: c.aspect,
                    }));
                    cfg.setCameras(mapped);
                    // Keep the user's on/off choice; Detect must not force-enable.
                    cfg.setWebcam({ ...mapped[0], enabled: cfg.webcam.enabled });
                    setNote(`Found ${mapped.length} camera${mapped.length === 1 ? '' : 's'} from Moonraker.`);
                  }).catch(() => setNote('Camera list not available.'));
                }}
              >
                Detect cameras
              </button>
            </div>
            <input
              className="sl-input"
              style={{ width: '100%', fontSize: 11.5 }}
              placeholder="http://printer.local/webcam/?action=stream"
              value={cfg.webcam.streamUrl}
              onChange={(e) => cfg.setWebcam({ streamUrl: e.target.value })}
              aria-label="Webcam stream URL"
            />
            {(cfg.webcam.service ?? 'mjpeg') === 'snapshot' && (
              <input
                className="sl-input"
                style={{ width: '100%', fontSize: 11.5, marginTop: 8 }}
                placeholder="snapshot url (blank derives from the stream url)"
                value={cfg.webcam.snapshotUrl ?? ''}
                onChange={(e) => cfg.setWebcam({ snapshotUrl: e.target.value })}
                aria-label="Webcam snapshot URL"
              />
            )}
            {cfg.cameras.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
                {cfg.cameras.map((c, i) => {
                  const active = c.streamUrl === cfg.webcam.streamUrl;
                  return (
                    <div key={`${c.name}|${c.streamUrl}`} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderTop: '1px solid var(--b0)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: active ? 'var(--accent)' : 'var(--txf)' }} />
                      <span style={{ flex: 1, minWidth: 0, font: "700 12px 'Manrope', sans-serif", color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name} <span className="sl-mono" style={{ fontSize: 9, color: 'var(--txd)' }}>{c.service}</span>
                      </span>
                      <button className="sl-btn" style={{ height: 26, fontSize: 10 }} disabled={active} onClick={() => cfg.selectCamera(i)}>
                        {active ? 'Active' : 'Use'}
                      </button>
                      <button className="sl-btn" style={{ width: 26, height: 26, padding: 0, borderRadius: 8 }} aria-label={`Remove ${c.name}`} onClick={() => cfg.removeCamera(i)}>
                        <span style={{ color: 'var(--danger)', fontWeight: 800 }}>&times;</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Interface & display">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['touchscreen', 'web', 'both'] as InterfaceKind[]).map((k) => (
                <button key={k} className="sl-chip" data-on={cfg.ui.kind === k} style={{ height: 32 }} onClick={() => cfg.setInterface({ kind: k })}>
                  {k}
                </button>
              ))}
            </div>
            {cfg.ui.kind !== 'web' && (
              <p className="sl-mono" style={{ margin: '9px 0 0', fontSize: 9.5, color: 'var(--txd)' }}>
                {cfg.ui.resolution ?? 'screen not chosen'} &middot; {cfg.ui.attachedToHost === false ? `kiosk \u2192 ${cfg.ui.printerIp || 'no address'}` : cfg.ui.displayOutput ?? 'HDMI0'} &middot; details in the wizard
              </p>
            )}
          </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel
            title="Theme"
            actions={
              <span className="sl-seg">
                <button data-on={cfg.mode === 'dark'} onClick={() => cfg.setMode('dark')}>Dark</button>
                <button data-on={cfg.mode === 'light'} onClick={() => cfg.setMode('light')}>Light</button>
              </span>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {THEME_META.map((t) => (
                <button
                  key={t.id}
                  onClick={() => cfg.setTheme(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 11, cursor: 'pointer', border: `1px solid ${cfg.theme === t.id ? 'var(--accentdim)' : 'var(--b1)'}`, background: cfg.theme === t.id ? 'var(--ad2)' : 'var(--inset)', color: cfg.theme === t.id ? 'var(--accent2)' : 'var(--tx2)', font: "800 11.5px 'Manrope', sans-serif" }}
                >
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: t.swatch, boxShadow: `0 0 10px -2px ${t.swatch}`, border: '1px solid rgba(255,255,255,.15)', flex: 'none' }} />
                  {t.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Custom logo" actions={cfg.logo ? <button className="sl-btn" style={{ height: 26, fontSize: 10.5, borderRadius: 999 }} onClick={() => cfg.setLogo(null)}>Remove</button> : undefined}>
            <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
              <button
                onClick={() => logoRef.current?.click()}
                aria-label="Pick a logo image"
                style={{ width: 84, height: 84, flex: 'none', borderRadius: 14, border: `1px ${cfg.logo ? 'solid var(--b2)' : 'dashed var(--b3)'}`, background: 'var(--inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
              >
                {cfg.logo ? <img src={cfg.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ font: "700 11px 'Manrope', sans-serif", color: 'var(--txd)' }}>Pick</span>}
              </button>
              <input ref={logoRef} type="file" accept={LOGO_TYPES.join(',')} style={{ display: 'none' }} onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
              <p style={{ margin: 0, font: "400 11.5px/1.6 'Manrope', sans-serif", color: 'var(--txd)' }}>
                Replaces the printer-name mark in the top bar. PNG with transparency or SVG looks sharpest; under 1 MB.
              </p>
            </div>
          </Panel>

          <Panel
            title="Dashboard layout"
            actions={<span className="sl-mono" style={{ fontSize: 10, color: 'var(--txd)' }}>preset: {cfg.dashboard.preset}{cfg.dashboard.base ? ` (${cfg.dashboard.base})` : ''}</span>}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['parity', 'cockpit', 'deck'] as DashPreset[]).map((p) => (
                <button key={p} className="sl-chip" data-on={cfg.dashboard.preset === p} style={{ height: 32 }} onClick={() => cfg.setDashboard({ preset: p, base: undefined, hidden: {}, sizes: {} })}>
                  {{ parity: 'Parity grid', cockpit: 'Cockpit hero', deck: 'Command deck' }[p as 'parity']}
                </button>
              ))}
            </div>
            <p className="sl-mono" style={{ margin: '9px 0 0', fontSize: 9.5, color: 'var(--txd)' }}>
              rearrange, resize, and hide modules in place with Edit layout on the dashboard.
            </p>
          </Panel>

          <Panel title="Settings data">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="sl-btn" onClick={exportSettings}><Icon name="upload" size={13} strokeWidth={2} /> Save settings</button>
              <button className="sl-btn" onClick={() => importRef.current?.click()}>Load settings</button>
              <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { importSettings(e.target.files?.[0]); e.target.value = ''; }} />
              <button className="sl-btn sl-btn--danger" onClick={factoryReset}>Factory reset</button>
            </div>
            <p className="sl-mono" style={{ margin: '9px 0 0', fontSize: 9.5, color: 'var(--txd)', lineHeight: 1.6 }}>
              exports mercy.json: connection, profile, theme, layouts, console, webcam, logo. factory reset clears this install and re-runs the wizard.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
