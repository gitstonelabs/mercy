// Wizard step 2: webcam (handoff 5, step 2). Enabled or disabled; when enabled,
// the stream source. MJPEG URLs (action=stream) render directly; anything else
// is treated as a WebRTC base, matching v1.

import { StepFrame, type StepProps } from './StepFrame';
import { useConfig } from '../store';

export function Webcam(props: StepProps & { index: number; total: number }) {
  const webcam = useConfig((s) => s.webcam);
  const setWebcam = useConfig((s) => s.setWebcam);

  return (
    <StepFrame title="Webcam" {...props}>
      <div className="sl-seg" style={{ marginBottom: 14 }}>
        <button data-on={webcam.enabled} onClick={() => setWebcam({ enabled: true })} style={{ height: 34, padding: '0 18px' }}>
          Enabled
        </button>
        <button data-on={!webcam.enabled} onClick={() => setWebcam({ enabled: false })} style={{ height: 34, padding: '0 18px' }}>
          Disabled
        </button>
      </div>

      {webcam.enabled ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sl-eyebrow" style={{ width: 84, flex: 'none', fontSize: 9.5 }}>Name</span>
            <input className="sl-input" style={{ flex: 1 }} value={webcam.name} onChange={(e) => setWebcam({ name: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sl-eyebrow" style={{ width: 84, flex: 'none', fontSize: 9.5 }}>Stream URL</span>
            <input
              className="sl-input"
              style={{ flex: 1, fontSize: 11.5 }}
              placeholder="http://printer.local/webcam/?action=stream"
              value={webcam.streamUrl}
              onChange={(e) => setWebcam({ streamUrl: e.target.value })}
            />
          </label>
          <p className="sl-mono" style={{ margin: 0, fontSize: 9.5, color: 'var(--txd)', lineHeight: 1.7 }}>
            mjpeg (action=stream) renders directly. other urls are treated as a webrtc base, like the
            creality cam_app on port 8000. crowsnest streams listed by moonraker appear automatically.
          </p>
        </div>
      ) : (
        <p style={{ margin: 0, font: "400 12.5px/1.6 'Manrope', sans-serif", color: 'var(--tx3)' }}>
          Camera widgets stay hidden everywhere. Turn this back on in Settings anytime.
        </p>
      )}
    </StepFrame>
  );
}
