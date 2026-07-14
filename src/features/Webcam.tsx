// Webcam page (handoff 3.6). Renders the configured stream full width. Streams
// listed by Moonraker (/server/webcams/list) join the picker in a follow-up;
// the config URL covers the v1 single-camera use today.

import { WebcamView } from '../components/WebcamView';
import { useConfig } from '../store';

export function Webcam() {
  const webcam = useConfig((s) => s.webcam);
  const cameras = useConfig((s) => s.cameras);
  const selectCamera = useConfig((s) => s.selectCamera);

  return (
    <div className="sl-page" style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>eyes on it.</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>Webcam</span>
        </span>
        {cameras.length > 1 && (
          <span style={{ display: 'inline-flex', gap: 6, marginLeft: 6 }}>
            {cameras.map((c, i) => (
              <button
                key={`${c.name}|${c.streamUrl}`}
                className="sl-chip"
                data-on={c.streamUrl === webcam.streamUrl}
                style={{ height: 30 }}
                onClick={() => selectCamera(i)}
              >
                {c.name}
              </button>
            ))}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="sl-mono" style={{ fontSize: 10, color: 'var(--txd)' }}>
          {webcam.enabled ? `${webcam.name} \u00b7 ${webcam.service ?? 'mjpeg'}` : 'disabled in Settings'}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <WebcamView minHeight={280} />
      </div>
    </div>
  );
}
