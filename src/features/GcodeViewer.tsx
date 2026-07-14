// G-Code Viewer page (handoff 3.10). Wraps the gcode-preview library
// (Three.js) rather than reimplementing a parser or renderer. Loads the
// currently printing file from Moonraker or a local file, scrubs by layer,
// and follows the live print when the loaded file is the active job.
//
// gcode-preview API used here: init({ canvas, ... }), processGCode(text),
// clear(), and the endLayer/renderTravel options via re-render. Verify against
// the pinned version's docs when bumping the dependency.

import { useEffect, useRef, useState } from 'react';
import * as GCodePreview from 'gcode-preview';
import { useLiveStore } from '../store';
import { getBackend } from '../api/client';
import { hasWebGL } from '../webgl';
import { Icon } from '../components/icons';

type Preview = ReturnType<typeof GCodePreview.init>;

export function GcodeViewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const gcodeRef = useRef<string>('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const printingFile = useLiveStore((s) => s.filename);
  const jobState = useLiveStore((s) => s.state);
  const phase = useLiveStore((s) => s.phase);

  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [layerCount, setLayerCount] = useState(0);
  const [layer, setLayer] = useState(0);
  const [travel, setTravel] = useState(false);
  const [follow, setFollow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the preview once the canvas exists.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Probe first: a clean note beats three.js throwing into the boundary,
    // and it keeps software-GL consoles quiet.
    if (!hasWebGL()) {
      setError('WebGL is not available on this device; the 3D preview is disabled.');
      return;
    }
    // A software-GL kiosk can throw inside three.js init; that must degrade to
    // an error note, never a blank page (the route ErrorBoundary is the last
    // line of defense, this is the first).
    let preview: Preview | null = null;
    try {
      preview = GCodePreview.init({
        canvas,
        buildVolume: { x: 260, y: 260, z: 300 },
        backgroundColor: 'transparent',
        extrusionColor: '#2bcdf2',
        travelColor: '#4b4c53',
        renderTravel: false,
        renderTubes: true,
      });
      previewRef.current = preview;
    } catch (e) {
      setError(`WebGL is not available on this device (${e instanceof Error ? e.message : e}).`);
      return;
    }
    return () => {
      try {
        (preview as unknown as { dispose?: () => void })?.dispose?.();
      } catch {
        // three renderer teardown is best-effort
      }
      previewRef.current = null;
    };
  }, []);

  const render = (text: string, endLayer: number | null, showTravel: boolean) => {
    const preview = previewRef.current;
    if (!preview) return;
    try {
      const p = preview as unknown as { clear?: () => void; endLayer?: number | null; renderTravel?: boolean };
      p.clear?.();
      p.renderTravel = showTravel;
      p.endLayer = endLayer;
      preview.processGCode(text);
      const layers = (preview as unknown as { layers?: unknown[] }).layers;
      if (Array.isArray(layers)) setLayerCount(layers.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'render failed');
    }
  };

  const loadText = (name: string, text: string) => {
    gcodeRef.current = text;
    setLoadedName(name);
    setError(null);
    render(text, null, travel);
    setLayer(0);
    window.setTimeout(() => {
      const layers = (previewRef.current as unknown as { layers?: unknown[] })?.layers;
      const n = Array.isArray(layers) ? layers.length : 0;
      setLayerCount(n);
      setLayer(n);
    }, 50);
  };

  const loadCurrent = async () => {
    if (!printingFile) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await getBackend().files.download('gcodes', printingFile);
      loadText(printingFile, await blob.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'download failed');
    } finally {
      setBusy(false);
    }
  };

  // Auto-load the active job once on entry.
  useEffect(() => {
    if (phase === 'ready' && printingFile && loadedName === null && (jobState === 'printing' || jobState === 'paused')) {
      void loadCurrent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, printingFile, jobState]);

  // Follow the live layer while printing the loaded file.
  const currentLayer = useLiveStore((s) => s.currentLayer);
  useEffect(() => {
    if (!follow || loadedName === null || loadedName !== printingFile || currentLayer === null) return;
    const capped = Math.min(currentLayer, layerCount || currentLayer);
    setLayer(capped);
    if (gcodeRef.current) render(gcodeRef.current, capped, travel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLayer, follow, loadedName, printingFile]);

  const scrub = (n: number) => {
    setFollow(false);
    setLayer(n);
    if (gcodeRef.current) render(gcodeRef.current, n, travel);
  };

  const toggleTravel = () => {
    const next = !travel;
    setTravel(next);
    if (gcodeRef.current) render(gcodeRef.current, layer || null, next);
  };

  return (
    <div className="sl-page" style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>watch it build.</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>G-code viewer</span>
        </span>
        {loadedName && (
          <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--txd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
            {loadedName}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: "700 11.5px 'Manrope', sans-serif", color: 'var(--tx2)', cursor: 'pointer' }}>
          <input type="checkbox" className="sl-range" checked={travel} onChange={toggleTravel} /> travel moves
        </label>
        <button className="sl-btn" disabled={!printingFile || busy} onClick={() => void loadCurrent()}>
          {busy ? 'Loading' : 'Load current print'}
        </button>
        <button className="sl-btn sl-btn--accent" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={15} strokeWidth={2} /> Open file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".gcode,.g,.gco"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) f.text().then((t) => loadText(f.name, t)).catch(() => setError('could not read that file'));
            e.target.value = '';
          }}
        />
      </div>

      <div className="sl-card" style={{ flex: 1, minHeight: 320, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {loadedName === null && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
            <span className="sl-script" style={{ fontSize: 22, color: 'var(--tx3)' }}>nothing loaded.</span>
            <span style={{ font: "400 12px 'Manrope', sans-serif", color: 'var(--txd)' }}>Load the current print or open a .gcode file.</span>
          </div>
        )}
        {error && (
          <span className="sl-mono" style={{ position: 'absolute', left: 12, bottom: 12, fontSize: 10, color: 'var(--danger)' }}>{error}</span>
        )}
      </div>

      <div className="sl-card" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '11px 15px', flexWrap: 'wrap' }}>
        <button
          className="sl-btn"
          style={{ height: 34 }}
          data-on={follow}
          disabled={loadedName === null || loadedName !== printingFile}
          title="Follow the live print layer"
          onClick={() => setFollow((v) => !v)}
        >
          {follow ? 'Following live' : 'Follow live'}
        </button>
        <input
          type="range"
          className="sl-range"
          style={{ flex: 1, minWidth: 140 }}
          min={1}
          max={Math.max(1, layerCount)}
          value={Math.max(1, layer)}
          disabled={layerCount === 0}
          onChange={(e) => scrub(Number(e.target.value))}
          aria-label="Layer scrubber"
        />
        <span className="sl-mono" style={{ width: 92, textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--tx2)', whiteSpace: 'nowrap' }}>
          {layerCount > 0 ? `${Math.max(1, layer)} / ${layerCount}` : '\u2014'}
        </span>
      </div>
    </div>
  );
}
