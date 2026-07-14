// Wizard step 3: interface type (handoff 5, step 3). Touchscreen, web, or
// both. Touchscreen asks for the screen and where it is attached: a display on
// the printer host needs its output (HDMI0/HDMI1/DSI); a separate kiosk SBC
// needs the printer's address instead.

import { StepFrame, type StepProps } from './StepFrame';
import { useConfig } from '../store';
import type { InterfaceKind } from '../store/config';

const KINDS: { id: InterfaceKind; label: string }[] = [
  { id: 'touchscreen', label: 'Touchscreen' },
  { id: 'web', label: 'Web interface' },
  { id: 'both', label: 'Both' },
];

const SCREENS = ['1024x600 (7in)', '1280x800 (10in)', '1920x1080 (HDMI)'];
const OUTPUTS = ['HDMI0', 'HDMI1', 'DSI'];

export function Interface(props: StepProps & { index: number; total: number }) {
  const ui = useConfig((s) => s.ui);
  const setInterface = useConfig((s) => s.setInterface);
  const hasScreen = ui.kind !== 'web';
  const attachedToHost = ui.attachedToHost ?? true;

  return (
    <StepFrame title="Interface type" {...props}>
      <div className="sl-seg">
        {KINDS.map((k) => (
          <button key={k.id} data-on={ui.kind === k.id} style={{ height: 34, padding: '0 16px' }} onClick={() => setInterface({ kind: k.id })}>
            {k.label}
          </button>
        ))}
      </div>

      {hasScreen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <div>
            <span className="sl-eyebrow" style={{ fontSize: 9.5, display: 'block', marginBottom: 7 }}>Screen</span>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {SCREENS.map((s) => (
                <button key={s} className="sl-chip" data-on={ui.resolution === s} style={{ height: 32 }} onClick={() => setInterface({ resolution: s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="sl-eyebrow" style={{ fontSize: 9.5, display: 'block', marginBottom: 7 }}>Where is the screen attached?</span>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button className="sl-chip" data-on={attachedToHost} style={{ height: 32 }} onClick={() => setInterface({ attachedToHost: true })}>
                On the printer host
              </button>
              <button className="sl-chip" data-on={!attachedToHost} style={{ height: 32 }} onClick={() => setInterface({ attachedToHost: false })}>
                Separate kiosk SBC
              </button>
            </div>
          </div>
          {attachedToHost ? (
            <div>
              <span className="sl-eyebrow" style={{ fontSize: 9.5, display: 'block', marginBottom: 7 }}>Display output</span>
              <div style={{ display: 'flex', gap: 7 }}>
                {OUTPUTS.map((o) => (
                  <button key={o} className="sl-chip" data-on={ui.displayOutput === o} style={{ height: 32 }} onClick={() => setInterface({ displayOutput: o })}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 360 }}>
              <span className="sl-eyebrow" style={{ fontSize: 9.5, flex: 'none' }}>Printer address</span>
              <input
                className="sl-input"
                style={{ flex: 1 }}
                placeholder="192.168.1.42"
                inputMode="decimal"
                value={ui.printerIp ?? ''}
                onChange={(e) => setInterface({ printerIp: e.target.value })}
              />
            </label>
          )}
        </div>
      )}
    </StepFrame>
  );
}
