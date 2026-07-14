// Heightmap page (handoff 3.8). Interactive 3D surface over
// bed_mesh.probed_matrix via Plotly, profile load/delete, calibrate, and the
// empty state when no mesh is loaded.

import { useEffect, useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import { useLiveStore } from '../store';
import { sendGcode, confirmRiskyDuringPrint } from '../api/bootstrap';
import { hasWebGL } from '../webgl';

function gcode(script: string): void {
  void sendGcode(script);
}

interface BedMesh {
  probed_matrix?: number[][];
  mesh_matrix?: number[][];
  mesh_min?: [number, number];
  mesh_max?: [number, number];
  profile_name?: string;
  profiles?: Record<string, unknown>;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

function MeshPlot({ mesh }: { mesh: BedMesh }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [plotErr, setPlotErr] = useState<string | null>(null);
  const matrix = mesh.probed_matrix ?? mesh.mesh_matrix ?? [];

  useEffect(() => {
    const el = holder.current;
    if (!el || matrix.length === 0) return;
    let disposed = false;
    let plotly: { purge: (el: HTMLElement) => void } | null = null;
    // Plotly is heavy; load it lazily so the dashboard bundle stays lean.
    import('plotly.js-dist-min').then((mod) => {
      if (disposed || !holder.current) return;
      const Plotly = (mod.default ?? mod) as typeof import('plotly.js-dist-min');
      plotly = Plotly as unknown as { purge: (el: HTMLElement) => void };
      const [minX, minY] = mesh.mesh_min ?? [0, 0];
      const [maxX, maxY] = mesh.mesh_max ?? [matrix[0].length - 1, matrix.length - 1];
      const xs = matrix[0].map((_, i) => minX + (i * (maxX - minX)) / Math.max(1, matrix[0].length - 1));
      const ys = matrix.map((_, i) => minY + (i * (maxY - minY)) / Math.max(1, matrix.length - 1));
      const tx = cssVar('--tx3');
      const grid = cssVar('--b2');
      void Plotly.react(
        holder.current,
        [{
          type: 'surface',
          x: xs,
          y: ys,
          z: matrix,
          colorscale: [[0, '#4c6fff'], [0.35, '#2bcdf2'], [0.5, '#3fcf8e'], [0.7, '#ffb84d'], [1, '#ff6b6b']],
          contours: { z: { show: true, usecolormap: true, project: { z: true } } },
          colorbar: { tickfont: { color: tx, family: 'JetBrains Mono' }, thickness: 12, outlinewidth: 0 },
        }],
        {
          autosize: true,
          height: 440,
          margin: { l: 0, r: 0, t: 0, b: 0 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          scene: {
            xaxis: { color: tx, gridcolor: grid, zerolinecolor: grid },
            yaxis: { color: tx, gridcolor: grid, zerolinecolor: grid },
            zaxis: { color: tx, gridcolor: grid, zerolinecolor: grid, range: [-0.5, 0.5] },
            aspectratio: { x: 1, y: 1, z: 0.4 },
          },
          font: { family: 'Manrope, sans-serif' },
        },
        { displaylogo: false, responsive: true },
      );
    }).catch((e) => {
      // A stale/missing Plotly chunk offline must say so, not leave a blank
      // 440px box (the route boundary cannot catch an async effect rejection).
      setPlotErr(e instanceof Error ? e.message : 'failed to load the 3D renderer');
    });
    return () => {
      // Purge tears down the WebGL context and Plotly's window listeners; this
      // effect re-runs on every mesh change and unmounts on navigation, so a
      // missing purge leaks a context per cycle until Chromium starts killing
      // them.
      disposed = true;
      if (plotly && el) plotly.purge(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(matrix), mesh.profile_name]);

  if (plotErr) {
    return (
      <div style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span className="sl-script" style={{ fontSize: 19, color: 'var(--tx3)' }}>3D view failed to load.</span>
        <span className="sl-mono" style={{ fontSize: 10, color: 'var(--danger)' }}>{plotErr}</span>
        <span style={{ font: "400 11.5px 'Manrope', sans-serif", color: 'var(--txd)' }}>The 2D map below still works.</span>
        <Mesh2D mesh={mesh} />
      </div>
    );
  }
  return <div ref={holder} style={{ width: '100%', minHeight: 440 }} />;
}

// 2D fallback: a colored cell grid, no GPU needed. Default on kiosks without
// WebGL; also the fallback when the Plotly chunk cannot load.
function Mesh2D({ mesh }: { mesh: BedMesh }) {
  const matrix = mesh.probed_matrix ?? mesh.mesh_matrix ?? [];
  if (matrix.length === 0) return null;
  const flat = matrix.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const span = Math.max(1e-6, max - min);
  const color = (z: number) => {
    const f = (z - min) / span;
    if (f < 0.25) return '#4c6fff';
    if (f < 0.45) return '#2bcdf2';
    if (f < 0.6) return '#3fcf8e';
    if (f < 0.8) return '#ffb84d';
    return '#ff6b6b';
  };
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Klipper's row 0 is the bed front; render it at the bottom. */}
      {[...matrix].reverse().map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 2 }}>
          {row.map((z, j) => (
            <span
              key={j}
              title={`${z.toFixed(3)} mm`}
              style={{ flex: 1, aspectRatio: '1.6', borderRadius: 3, background: color(z), opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="sl-mono" style={{ fontSize: 8.5, color: 'rgba(5,6,13,.75)', fontWeight: 700 }}>{z.toFixed(2)}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function HeightMap() {
  const meshObj = useLiveStore((s) => s.objects.bed_mesh) as BedMesh | undefined;
  const [busy, setBusy] = useState(false);
  const matrix = meshObj?.probed_matrix ?? meshObj?.mesh_matrix ?? [];
  const hasMesh = matrix.length > 0 && (matrix[0]?.length ?? 0) > 0;

  const flat = hasMesh ? matrix.flat() : [];
  const range = flat.length > 0 ? Math.max(...flat) - Math.min(...flat) : 0;
  const profiles = Object.keys(meshObj?.profiles ?? {});
  const active = meshObj?.profile_name ?? '';

  const calibrate = () => {
    if (!confirmRiskyDuringPrint('Bed mesh calibration')) return;
    if (!window.confirm('Run BED_MESH_CALIBRATE? The toolhead probes the whole bed; takes a few minutes.')) return;
    setBusy(true);
    // sendGcode surfaces a rejection ('Must home axis first') as a !! console
    // line + notification instead of pretending probing started.
    void sendGcode('BED_MESH_CALIBRATE').finally(() => setBusy(false));
  };

  return (
    <div className="sl-page" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>flat is fast.</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>Heightmap</span>
        </span>
        <span style={{ flex: 1 }} />
        <button className="sl-btn" onClick={() => confirmRiskyDuringPrint('Homing') && gcode('G28')}>Home all</button>
        <button className="sl-btn sl-btn--accent sl-mono" style={{ fontSize: 11 }} disabled={busy} onClick={calibrate}>
          BED_MESH_CALIBRATE
        </button>
      </div>

      <div className="sl-cgrid" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 14, alignItems: 'start' }}>
        <Panel
          title={hasMesh ? `Mesh \u00b7 ${active || 'unnamed'}` : 'Mesh'}
          actions={hasMesh ? (
            <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
              range <span style={{ color: 'var(--accent2)', fontWeight: 700 }}>{range.toFixed(3)} mm</span> &middot; {matrix.length}&times;{matrix[0]?.length ?? 0}
            </span>
          ) : undefined}
        >
          {hasMesh ? (
            hasWebGL() ? <MeshPlot mesh={meshObj!} /> : (
              <>
                <p className="sl-mono" style={{ margin: '0 0 10px', fontSize: 9.5, color: 'var(--txd)' }}>no webgl on this device; showing the 2D map</p>
                <Mesh2D mesh={meshObj!} />
              </>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '52px 16px', textAlign: 'center' }}>
              <span className="sl-script" style={{ fontSize: 22, color: 'var(--tx3)' }}>no bed mesh loaded yet.</span>
              <p style={{ margin: 0, font: "400 12px/1.6 'Manrope', sans-serif", color: 'var(--txd)', maxWidth: 380 }}>
                Home, then calibrate to probe the bed. Saved profiles load from the list.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Profiles">
          {profiles.length === 0 ? (
            <div style={{ font: "400 12px 'Manrope', sans-serif", color: 'var(--tx3)' }}>No saved profiles. Calibrate, then SAVE_CONFIG stores one.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {profiles.map((p, i) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--b0)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p === active ? 'var(--accent)' : 'var(--txf)', flex: 'none', boxShadow: p === active ? '0 0 7px var(--accent)' : 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, font: "800 12.5px 'Manrope', sans-serif", color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p}</span>
                  <button className="sl-btn" style={{ height: 28, fontSize: 10.5 }} disabled={p === active} onClick={() => confirmRiskyDuringPrint('Loading a different bed mesh') && gcode(`BED_MESH_PROFILE LOAD=${p}`)}>
                    {p === active ? 'Loaded' : 'Load'}
                  </button>
                  <button
                    className="sl-btn"
                    style={{ width: 28, height: 28, padding: 0, borderRadius: 8 }}
                    title={`Delete ${p}`}
                    aria-label={`Delete ${p}`}
                    onClick={() => confirmRiskyDuringPrint(`Removing mesh profile ${p}`) && window.confirm(`Delete mesh profile ${p}? SAVE_CONFIG afterward makes it permanent.`) && gcode(`BED_MESH_PROFILE REMOVE=${p}`)}
                  >
                    <span style={{ color: 'var(--danger)', fontWeight: 800 }}>&times;</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="sl-mono" style={{ margin: '10px 0 0', fontSize: 9.5, color: 'var(--txd)', lineHeight: 1.6 }}>
            red high, blue low. z-tilt runs before the probe pass on this build. recalibrate after moving the printer or swapping the sheet.
          </p>
        </Panel>
      </div>
    </div>
  );
}
