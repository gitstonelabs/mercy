// App chrome: left nav rail, top bar with the always-reachable Emergency Stop,
// mobile bottom tab bar, and the connection/status banner (handoff 2.4 / 3.14 /
// 6). Styled to the approved v2 prototype. Page content renders via <Outlet />.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useConfig, useLiveStore } from '../store';
import { getProfile } from '../profiles';
import { getBackend } from '../api/client';
import { sendGcode, printActive, restartBackend } from '../api/bootstrap';
import { ErrorBoundary } from './ErrorBoundary';
import { Icon, type IconName } from './icons';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/webcam', label: 'Webcam', icon: 'webcam' },
  { to: '/console', label: 'Console', icon: 'console' },
  { to: '/heightmap', label: 'Heightmap', icon: 'heightmap' },
  { to: '/files', label: 'Files', icon: 'files' },
  { to: '/viewer', label: 'Viewer', icon: 'viewer' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/machine', label: 'Machine', icon: 'machine' },
];

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Dash', icon: 'dashboard', end: true },
  { to: '/console', label: 'Console', icon: 'console' },
  { to: '/files', label: 'Files', icon: 'files' },
  { to: '/machine', label: 'Machine', icon: 'machine' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function ConnectionBanner() {
  const phase = useLiveStore((s) => s.phase);
  const lastError = useLiveStore((s) => s.lastError);
  if (phase === 'ready' && !lastError) return null;

  if (phase === 'klippy-shutdown') {
    return (
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: 'linear-gradient(180deg, var(--danger-d1), var(--danger-d2))',
          borderBottom: '1px solid var(--danger-b)',
        }}
      >
        <span style={{ flex: 1, font: "700 13px 'Manrope', system-ui, sans-serif", color: 'var(--danger)' }}>
          Klipper is shut down. Heaters and steppers are off.
        </span>
        <button
          className="sl-btn sl-btn--danger sl-mono"
          style={{ height: 30, fontSize: 11 }}
          onClick={() => void sendGcode('FIRMWARE_RESTART')}
        >
          FIRMWARE_RESTART
        </button>
      </div>
    );
  }

  const text: Record<string, string> = {
    connecting: 'Connecting to Moonraker.',
    'klippy-disconnected': 'Klipper is disconnected. Waiting for it to come back.',
    disconnected: 'Disconnected from Moonraker. Retrying with backoff.',
  };
  const msg = lastError ?? text[phase] ?? '';
  if (!msg) return null;
  return (
    <div
      style={{
        flex: 'none',
        padding: '8px 16px',
        background: 'var(--ad2)',
        color: 'var(--accentfg)',
        font: "700 12.5px 'Manrope', system-ui, sans-serif",
        borderBottom: '1px solid var(--b2)',
      }}
    >
      {msg}
    </div>
  );
}

function ConnPill() {
  const phase = useLiveStore((s) => s.phase);
  const kind = useLiveStore((s) => s.kind);
  let label = 'LINKING';
  let color = 'var(--warning)';
  let bg = 'rgba(var(--warning-rgb), .06)';
  if (phase === 'ready' && kind === 'moonraker') {
    label = 'LIVE';
    color = 'var(--success)';
    bg = 'var(--ok-d2)';
  } else if (phase === 'ready' && kind === 'demo') {
    label = 'DEMO';
    color = 'var(--warning)';
  } else if (phase === 'klippy-shutdown' || phase === 'disconnected') {
    label = phase === 'klippy-shutdown' ? 'SHUTDOWN' : 'OFFLINE';
    color = 'var(--danger)';
    bg = 'var(--danger-d2)';
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 30,
        padding: '0 11px',
        borderRadius: 999,
        border: '1px solid var(--b2)',
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 8px ${color}`,
          animation: 'slPulse 2s infinite',
        }}
      />
      <span className="sl-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', color }}>
        {label}
      </span>
    </span>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const profileId = useConfig((s) => s.profileId);
  const logo = useConfig((s) => s.logo);
  const phase = useLiveStore((s) => s.phase);
  const notices = useLiveStore((s) => s.notices);
  const unread = useLiveStore((s) => s.unread);
  const markNoticesRead = useLiveStore((s) => s.markNoticesRead);
  const clearNotices = useLiveStore((s) => s.clearNotices);
  const printers = useConfig((s) => s.printers);
  const moonrakerHost = useConfig((s) => s.moonrakerHost);
  const switchPrinter = useConfig((s) => s.switchPrinter);
  const resetWizard = useConfig((s) => s.resetWizard);
  const [powerOpen, setPowerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [printerOpen, setPrinterOpen] = useState(false);
  const name = getProfile(profileId)?.displayName ?? 'Mercy';
  const dot = phase === 'ready' ? 'var(--success)' : phase === 'connecting' ? 'var(--warning)' : 'var(--danger)';

  // E-STOP fires immediately: a confirm dialog defeats an emergency stop.
  // Recovery is one FIRMWARE_RESTART away; a crash into the bed is not.
  const estop = () => {
    getBackend().emergencyStop().catch(() => {});
  };
  const power = (action: 'klipper' | 'reboot' | 'shutdown') => {
    setPowerOpen(false);
    const backend = getBackend();
    if (action === 'klipper') {
      if (printActive() && !window.confirm('A print is running. FIRMWARE_RESTART aborts it. Continue?')) return;
      void sendGcode('FIRMWARE_RESTART');
      return;
    }
    const verb = action === 'reboot' ? 'Reboot' : 'Shut down';
    const printNote = printActive() ? ' A running print is lost.' : '';
    if (window.confirm(`${verb} the host?${printNote}`)) {
      (action === 'reboot' ? backend.machine.reboot() : backend.machine.shutdown()).catch(() => {});
    }
  };

  const iconBtn: CSSProperties = { width: 36, height: 36, padding: 0, borderRadius: 10 };

  return (
    <header
      style={{
        height: 56,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '0 14px',
        borderBottom: '1px solid var(--b0)',
        background: 'rgba(var(--bg2-rgb), .6)',
        position: 'relative',
        zIndex: 30,
      }}
    >
      <span style={{ position: 'relative' }}>
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            height: 36,
            padding: '0 13px',
            borderRadius: 999,
            border: '1px solid var(--b2)',
            background: 'var(--control)',
            minWidth: 0,
            cursor: 'pointer',
          }}
          onClick={() => setPrinterOpen((v) => !v)}
          aria-label="Switch printer"
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, boxShadow: `0 0 8px ${dot}`, flex: 'none' }} />
          {logo ? (
            <img src={logo} alt={name} style={{ height: 22, width: 'auto' }} />
          ) : (
            <span style={{ font: "800 13.5px 'Manrope', system-ui, sans-serif", color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </span>
          )}
          <span className="sl-mono sl-hide-narrow" style={{ fontSize: 10.5, color: 'var(--txd)', whiteSpace: 'nowrap' }}>
            {profileId}
          </span>
          <Icon name="chevronDown" size={13} strokeWidth={2} />
        </button>
        {printerOpen && (
          <>
            <span style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setPrinterOpen(false)} />
            <span style={{ position: 'absolute', top: 42, left: 0, zIndex: 41, width: 280, display: 'flex', flexDirection: 'column', gap: 4, padding: 8, borderRadius: 13, border: '1px solid var(--b2)', background: 'linear-gradient(180deg, var(--surface), var(--bg2))', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}>
              <span className="sl-eyebrow" style={{ fontSize: 10, padding: '4px 8px' }}>Switch printer</span>
              {printers.length === 0 && (
                <span style={{ padding: '4px 8px 8px', font: "400 11.5px/1.5 'Manrope', sans-serif", color: 'var(--tx3)' }}>
                  Only this printer so far. Finishing the wizard saves each one here.
                </span>
              )}
              {printers.map((p, i) => {
                const active = p.host === moonrakerHost && p.profileId === profileId;
                return (
                  <button
                    key={`${p.host}|${p.profileId}`}
                    className="sl-btn sl-btn--ghost"
                    style={{ justifyContent: 'flex-start', height: 44, borderRadius: 9, border: `1px solid ${active ? 'var(--accentdim)' : 'transparent'}`, background: active ? 'var(--ad2)' : 'transparent' }}
                    onClick={() => {
                      setPrinterOpen(false);
                      if (active) return;
                      if (printActive() && !window.confirm('A print is running here. Switching printers drops visibility of it (the print keeps going). Continue?')) return;
                      switchPrinter(i);
                      restartBackend();
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                      <span style={{ font: "800 12.5px 'Manrope', sans-serif", color: active ? 'var(--accent2)' : 'var(--tx)' }}>
                        {getProfile(p.profileId)?.displayName ?? p.name}
                      </span>
                      <span className="sl-mono" style={{ fontSize: 9, color: 'var(--txd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.host || 'same origin'}
                      </span>
                    </span>
                  </button>
                );
              })}
              <button
                className="sl-btn"
                style={{ justifyContent: 'flex-start', borderStyle: 'dashed', background: 'transparent' }}
                onClick={() => {
                  setPrinterOpen(false);
                  resetWizard();
                  navigate('/setup');
                }}
              >
                + Add a printer
              </button>
            </span>
          </>
        )}
      </span>

      <span style={{ flex: 1 }} />

      <button className="sl-btn sl-btn--accent sl-hide-narrow" style={{ height: 36 }} onClick={() => navigate('/files')}>
        <Icon name="upload" size={16} strokeWidth={2} />
        Upload &amp; print
      </button>
      <ConnPill />
      <span style={{ position: 'relative' }}>
        <button
          className="sl-btn"
          style={iconBtn}
          title="Notifications"
          aria-label="Notifications"
          onClick={() => {
            setBellOpen((v) => !v);
            if (!bellOpen) markNoticesRead();
          }}
        >
          <Icon name="bell" size={17} />
          {unread > 0 && (
            <span className="sl-mono" style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999, background: 'var(--accent)', color: 'var(--ad2)', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        {bellOpen && (
          <>
            <span style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setBellOpen(false)} />
            <span style={{ position: 'absolute', top: 42, right: 0, zIndex: 41, width: 320, display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 13, border: '1px solid var(--b2)', background: 'linear-gradient(180deg, var(--surface), var(--bg2))', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                <span className="sl-eyebrow" style={{ fontSize: 10 }}>Notifications</span>
                {notices.length > 0 && (
                  <button className="sl-btn sl-btn--ghost sl-mono" style={{ height: 22, fontSize: 9.5 }} onClick={clearNotices}>clear</button>
                )}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                {notices.length === 0 && (
                  <span style={{ padding: '8px 4px', font: "400 12px 'Manrope', sans-serif", color: 'var(--tx3)' }}>All quiet. Klipper faults and failed sends land here.</span>
                )}
                {notices.map((n) => (
                  <span key={n.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 9, border: `1px solid ${n.kind === 'error' ? 'var(--danger-b)' : 'var(--b1)'}`, background: n.kind === 'error' ? 'var(--danger-d2)' : 'transparent' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', marginTop: 5, background: n.kind === 'error' ? 'var(--danger)' : n.kind === 'warning' ? 'var(--warning)' : 'var(--accent)' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', font: "400 11.5px/1.5 'Manrope', sans-serif", color: 'var(--tx2)', wordBreak: 'break-word' }}>{n.text}</span>
                      <span className="sl-mono" style={{ fontSize: 9, color: 'var(--txd)' }}>{n.t}</span>
                    </span>
                  </span>
                ))}
              </span>
            </span>
          </>
        )}
      </span>
      <button className="sl-btn" style={iconBtn} onClick={() => navigate('/settings')} title="Settings" aria-label="Settings">
        <Icon name="settings" size={17} />
      </button>
      <span style={{ position: 'relative' }}>
        <button className="sl-btn" style={iconBtn} onClick={() => setPowerOpen((v) => !v)} title="Power" aria-label="Power">
          <Icon name="power" size={17} />
        </button>
        {powerOpen && (
          <>
            <span style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setPowerOpen(false)} />
            <span
              style={{
                position: 'absolute',
                top: 42,
                right: 0,
                zIndex: 41,
                width: 220,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 8,
                borderRadius: 13,
                border: '1px solid var(--b2)',
                background: 'linear-gradient(180deg, var(--surface), var(--bg2))',
                boxShadow: '0 24px 60px rgba(0,0,0,.6)',
              }}
            >
              <button className="sl-btn sl-btn--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => power('klipper')}>
                <Icon name="restart" size={15} /> Restart Klipper
              </button>
              <button className="sl-btn sl-btn--ghost" style={{ justifyContent: 'flex-start' }} onClick={() => power('reboot')}>
                <Icon name="restart" size={15} /> Reboot host
              </button>
              <button className="sl-btn sl-btn--ghost" style={{ justifyContent: 'flex-start', color: 'var(--danger)' }} onClick={() => power('shutdown')}>
                <Icon name="power" size={15} /> Shut down host
              </button>
            </span>
          </>
        )}
      </span>
      <button className="sl-btn sl-btn--danger" style={{ height: 36, fontSize: 11.5 }} onClick={estop} title="Emergency Stop">
        <Icon name="stop" size={16} strokeWidth={2} />
        <span className="sl-hide-narrow">E-STOP</span>
      </button>
    </header>
  );
}

function NavRail() {
  const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '9px 0',
    borderRadius: 10,
    border: `1px solid ${isActive ? 'var(--accentdim)' : 'transparent'}`,
    background: isActive ? 'linear-gradient(180deg, var(--ad1), var(--ad2))' : 'transparent',
    color: isActive ? 'var(--accent2)' : 'var(--tx3)',
    textDecoration: 'none',
    font: "800 9.5px 'Manrope', system-ui, sans-serif",
  });
  return (
    <nav
      className="sl-rail"
      style={{
        width: 86,
        flex: 'none',
        background: 'var(--bg2)',
        borderRight: '1px solid var(--b1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 56,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid var(--b0)',
        }}
      >
        <span
          className="sl-script"
          style={{ fontSize: 22, filter: 'drop-shadow(0 0 8px rgba(var(--accent-rgb), .45))' }}
        >
          SL
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 6px', overflowY: 'auto', scrollbarWidth: 'none' }}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} style={linkStyle}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </NavLink>
        ))}
      </div>
      <div style={{ padding: 8, flex: 'none' }}>
        <button
          className="sl-btn sl-btn--danger"
          style={{ width: '100%', height: 54, flexDirection: 'column', gap: 2, fontSize: 10, letterSpacing: '.12em', borderRadius: 12 }}
          title="Emergency stop: immediate, no confirm"
          onClick={() => getBackend().emergencyStop().catch(() => {})}
        >
          <Icon name="stop" size={20} strokeWidth={2} />
          STOP
        </button>
      </div>
    </nav>
  );
}

function MobileTabs() {
  const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    color: isActive ? 'var(--accent2)' : 'var(--txd)',
    textDecoration: 'none',
    font: "800 9px 'Manrope', system-ui, sans-serif",
  });
  return (
    <nav className="sl-tabs">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} style={linkStyle}>
          <Icon name={t.icon} size={20} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const location = useLocation();
  const touch = useConfig((s) => s.ui.kind) !== 'web';
  return (
    <div data-touch={touch || undefined} style={{ height: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <NavRail />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'radial-gradient(140% 100% at 100% 0%, var(--inset) 0%, var(--bg) 55%)',
        }}
      >
        <TopBar />
        <ConnectionBanner />
        <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <MobileTabs />
      </div>
    </div>
  );
}
