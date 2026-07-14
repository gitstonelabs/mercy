// Wizard step 5: logo, optional (handoff 5, step 5). A picked image becomes a
// data URL in config.logo and replaces the printer-name mark in the top bar.
// Kept under 1 MB so the persisted config stays sane.

import { useRef, useState } from 'react';
import { StepFrame, type StepProps } from './StepFrame';
import { useConfig } from '../store';

const MAX_BYTES = 1_048_576;
const ALLOWED_TYPES = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];

export function Logo(props: StepProps & { index: number; total: number }) {
  const logo = useConfig((s) => s.logo);
  const setLogo = useConfig((s) => s.setLogo);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('That is not an image. PNG, SVG, WebP, or JPG only.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That file is over 1 MB. Export a smaller PNG or an SVG.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.onerror = () => setError('Could not read that file. Try another export.');
    reader.readAsDataURL(file);
  };

  return (
    <StepFrame title="Logo (optional)" {...props}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: 130,
            height: 130,
            flex: 'none',
            borderRadius: 16,
            border: `1px ${logo ? 'solid var(--b2)' : 'dashed var(--b3)'}`,
            background: 'var(--inset)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
          aria-label="Pick a logo image"
        >
          {logo ? (
            <img src={logo} alt="Logo preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <span style={{ font: "700 12px 'Manrope', sans-serif", color: 'var(--txd)' }}>Pick an image</span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/svg+xml,image/webp,image/jpeg"
          style={{ display: 'none' }}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ margin: 0, font: "400 12px/1.6 'Manrope', sans-serif", color: 'var(--tx3)' }}>
            Replaces the printer-name mark in the top bar on this install.
          </p>
          <p className="sl-mono" style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--txd)', lineHeight: 1.7 }}>
            png &middot; transparent background recommended<br />
            svg &middot; sharpest, any density<br />
            webp / jpg &middot; fine too<br />
            about 512&times;512 px, under 1 mb
          </p>
          {error && <p style={{ margin: '8px 0 0', font: "700 11.5px 'Manrope', sans-serif", color: 'var(--danger)' }}>{error}</p>}
          {logo && (
            <button className="sl-btn" style={{ marginTop: 10, height: 30, fontSize: 11 }} onClick={() => setLogo(null)}>
              Remove logo
            </button>
          )}
        </div>
      </div>
    </StepFrame>
  );
}
