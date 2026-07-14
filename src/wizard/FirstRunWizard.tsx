// First-run setup wizard, route '/setup' (handoff section 5).
//
// Shown when config.wizardCompleted is false (App redirects to /setup on load).
// Flow: welcome -> 5 steps -> summary. Two things are stated prominently on the
// first screen and again on the last: every setting here can be changed later in
// Settings. Every step also carries a Skip control and a "?" info button (those
// live in StepFrame so a step cannot omit them).
//
// TODO:
//  - Flesh out the "?" help: replace the inline help string with a real help
//    panel per step (the handoff wants extra help content for each).
//  - Wire the summary to read back the chosen profile/theme/webcam/interface/logo
//    from the config store.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../store';
import { getProfile } from '../profiles';
import { PrinterSelect } from './PrinterSelect';
import { Webcam } from './Webcam';
import { Interface } from './Interface';
import { Theme } from './Theme';
import { Logo } from './Logo';

const EDITABLE_LATER = 'Every setting here can be changed later in Settings.';
const TOTAL_STEPS = 5;

const HELP: Record<number, string> = {
  0: 'This wizard is the first pass through Settings. Nothing here is final; every choice has a permanent home in Settings.',
  1: 'The profile sets build volume, temperature ceilings, leveling hardware, and firmware notes. Klipper-native printers work as shipped. Creality OS printers may need root or a non-default Moonraker port. Prusa Buddy printers need a community Klipper reflash before this UI can drive them.',
  2: 'MJPEG stream URLs (action=stream) render directly. Other URLs are treated as a WebRTC base, like the Creality cam_app on port 8000. Disabling the webcam hides every camera widget.',
  3: 'Touchscreen kiosks boot Chromium full-screen into this UI. A screen on the printer host needs its display output picked. A separate kiosk SBC needs the printer host address instead.',
  4: 'Six accents, each with a dark and a light palette. The choice applies live and persists on this install.',
  5: 'The logo replaces the printer-name mark in the top bar. PNG with a transparent background or SVG looks sharpest.',
};

type Phase = 'welcome' | 1 | 2 | 3 | 4 | 5 | 'summary';

const shell: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'radial-gradient(120% 120% at 50% 0%, var(--bg2) 0%, var(--bg) 60%)',
  color: 'var(--tx)',
};

const primaryBtn: CSSProperties = {
  height: 44,
  padding: '0 22px',
  borderRadius: 10,
  border: '1px solid var(--accent)',
  background: 'var(--ad1)',
  color: 'var(--accentfg)',
  font: "700 14px 'Manrope', system-ui, sans-serif",
  cursor: 'pointer',
};

const ghostBtn: CSSProperties = {
  height: 44,
  padding: '0 18px',
  borderRadius: 10,
  border: '1px solid var(--b2)',
  background: 'var(--control)',
  color: 'var(--tx)',
  font: "700 14px 'Manrope', system-ui, sans-serif",
  cursor: 'pointer',
};

// Read the chosen values back from the config store for the closing summary.
function Summary() {
  const cfg = useConfig();
  const rows: [string, string][] = [
    ['Printer', getProfile(cfg.profileId)?.displayName ?? cfg.profileId],
    ['Webcam', cfg.webcam.enabled ? cfg.webcam.streamUrl || 'enabled' : 'disabled'],
    ['Interface', cfg.ui.kind === 'both' ? 'touchscreen + web' : cfg.ui.kind],
    ['Screen', cfg.ui.kind === 'web' ? 'not used' : `${cfg.ui.resolution ?? 'default'} \u00b7 ${cfg.ui.attachedToHost === false ? `kiosk \u2192 ${cfg.ui.printerIp || 'set address later'}` : cfg.ui.displayOutput ?? 'HDMI0'}`],
    ['Theme', `${cfg.theme} \u00b7 ${cfg.mode}`],
    ['Logo', cfg.logo ? 'custom' : 'printer name'],
  ];
  return (
    <div style={{ textAlign: 'left', border: '1px solid var(--b1)', borderRadius: 13, background: 'var(--inset)', padding: '4px 15px' }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--b0)' }}>
          <span style={{ font: "800 11px 'Manrope', sans-serif", letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--txd)' }}>{k}</span>
          <span className="sl-mono" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx2)', textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function FirstRunWizard() {
  const navigate = useNavigate();
  const completeWizard = useConfig((s) => s.completeWizard);
  const saveCurrentPrinter = useConfig((s) => s.saveCurrentPrinter);
  const [phase, setPhase] = useState<Phase>('welcome');
  const [help, setHelp] = useState<string | null>(null);

  const finish = () => {
    // Each finished setup lands in the top-bar printer switcher.
    saveCurrentPrinter();
    completeWizard();
    navigate('/');
  };

  const stepProps = (index: number) => ({
    index,
    total: TOTAL_STEPS,
    onNext: () => setPhase((index < TOTAL_STEPS ? index + 1 : 'summary') as Phase),
    onSkip: () => setPhase((index < TOTAL_STEPS ? index + 1 : 'summary') as Phase),
    onBack: () => setPhase((index === 1 ? 'welcome' : index - 1) as Phase),
    onInfo: () => setHelp(HELP[index] ?? HELP[0]),
  });

  return (
    <div style={shell}>
      {phase === 'welcome' && (
        <section style={{ width: 'min(680px, 100%)', textAlign: 'center' }}>
          <h1 style={{ font: "700 28px 'Manrope', system-ui, sans-serif", margin: '0 0 8px' }}>
            Welcome to StoneLabs Printer UI
          </h1>
          <p style={{ color: 'var(--accent)', font: "700 15px 'Manrope', system-ui, sans-serif", margin: '0 0 20px' }}>
            {EDITABLE_LATER}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button style={primaryBtn} onClick={() => setPhase(1)}>Start</button>
            <button style={ghostBtn} onClick={finish}>Skip all</button>
          </div>
        </section>
      )}

      {phase === 1 && <PrinterSelect {...stepProps(1)} />}
      {phase === 2 && <Webcam {...stepProps(2)} />}
      {phase === 3 && <Interface {...stepProps(3)} />}
      {phase === 4 && <Theme {...stepProps(4)} />}
      {phase === 5 && <Logo {...stepProps(5)} />}

      {phase === 'summary' && (
        <section style={{ width: 'min(680px, 100%)', textAlign: 'center' }}>
          <h1 style={{ font: "700 26px 'Manrope', system-ui, sans-serif", margin: '0 0 8px' }}>You are set up</h1>
          <p style={{ color: 'var(--accent)', font: "700 15px 'Manrope', system-ui, sans-serif", margin: '0 0 16px' }}>
            {EDITABLE_LATER}
          </p>
          <Summary />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button style={ghostBtn} onClick={() => { saveCurrentPrinter(); setPhase(1); }}>Set up another printer</button>
            <button style={primaryBtn} onClick={finish}>Finish</button>
          </div>
        </section>
      )}

      {help && (
        <div
          role="dialog"
          onClick={() => setHelp(null)}
          style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--bg-rgb), .72)' }}
        >
          <div style={{ maxWidth: 420, padding: 20, borderRadius: 12, border: '1px solid var(--b2)', background: 'var(--surface)' }}>
            {help}
          </div>
        </div>
      )}
    </div>
  );
}
