// Temperatures card (handoff 3.2). Sensor table + streaming uPlot chart.
//
// The chart reads the ring buffer in src/store/temps.ts (fed once per second
// by src/api/bootstrap.ts). Heaters get an editable target with preset chips
// from the active profile; pure sensors render read-only. Cooldown sends
// TURN_OFF_HEATERS. Targets go through SET_HEATER_TEMPERATURE.

import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { Panel } from '../components/Panel';
import { useConfig, useLiveStore } from '../store';
import { getProfile } from '../profiles';
import { sendGcode } from '../api/bootstrap';

const SENSOR_PALETTE = ['#9aa3b2', '#8ab48a', '#c3cad6', '#ffb84d', '#4c6fff'];

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

interface Row {
  key: string;          // klipper object name, e.g. 'extruder', 'temperature_sensor chamber'
  label: string;
  color: string;
  heater: boolean;
  temperature: number;
  target: number;
  power: number | null;
}

function useSensorRows(): Row[] {
  const objects = useLiveStore((s) => s.objects);
  return useMemo(() => {
    const rows: Row[] = [];
    let sensorIdx = 0;
    for (const [name, f] of Object.entries(objects)) {
      const base = name.split(' ')[0];
      const temperature = f.temperature as number | undefined;
      if (temperature === undefined) continue;
      if (name === 'extruder' || base === 'extruder') {
        rows.push({ key: name, label: name === 'extruder' ? 'Hotend' : name, color: '#ff8a4c', heater: true, temperature, target: (f.target as number) ?? 0, power: (f.power as number) ?? null });
      } else if (name === 'heater_bed') {
        rows.push({ key: name, label: 'Bed', color: cssVar('--accent'), heater: true, temperature, target: (f.target as number) ?? 0, power: (f.power as number) ?? null });
      } else if (base === 'temperature_sensor' || base === 'temperature_host') {
        const label = base === 'temperature_host' ? 'Host' : name.slice(base.length + 1).replace(/_/g, ' ');
        rows.push({ key: name, label, color: SENSOR_PALETTE[sensorIdx++ % SENSOR_PALETTE.length], heater: false, temperature, target: 0, power: null });
      }
    }
    // Heaters first, then sensors, stable by name.
    return rows.sort((a, b) => Number(b.heater) - Number(a.heater) || a.key.localeCompare(b.key));
  }, [objects]);
}

function TempChart({ rows }: { rows: Row[] }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const readout = useRef<HTMLDivElement | null>(null);
  const plot = useRef<uPlot | null>(null);
  const temps = useLiveStore((s) => s.temps);
  const signature = rows.map((r) => r.key).join('|');

  // (Re)build the chart when the sensor set changes.
  useEffect(() => {
    if (!holder.current || rows.length === 0) return;
    const el = holder.current;
    const axisColor = cssVar('--tx3');
    const gridColor = cssVar('--b1');
    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: 200,
      legend: { show: false },
      cursor: { drag: { x: false, y: false } },
      scales: { x: { time: true }, y: { range: [0, 310] } },
      axes: [
        { stroke: axisColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: gridColor } },
        { stroke: axisColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: gridColor }, size: 36 },
      ],
      series: [
        {},
        ...rows.map((r) => ({ label: r.label, stroke: r.color, width: 2, spanGaps: true })),
      ],
      hooks: {
        // Cursor value readout under the chart. uPlot maps touch to cursor, so
        // this doubles as the touch tooltip from the mobile spec.
        setCursor: [
          (u: uPlot) => {
            const el = readout.current;
            if (!el) return;
            const i = u.cursor.idx;
            if (i === null || i === undefined || !u.data[0][i]) {
              el.textContent = '';
              return;
            }
            const time = new Date((u.data[0][i] as number) * 1000).toTimeString().slice(0, 8);
            const parts = rows.map((r, k) => {
              const v = u.data[k + 1]?.[i];
              return v === null || v === undefined ? null : `${r.label.toLowerCase()} ${(v as number).toFixed(1)}\u00b0`;
            }).filter(Boolean);
            el.textContent = `${time} \u00b7 ${parts.join(' \u00b7 ')}`;
          },
        ],
      },
    };
    plot.current?.destroy();
    plot.current = new uPlot(opts, [[], ...rows.map(() => [])], el);

    const onResize = () => plot.current?.setSize({ width: el.clientWidth, height: 200 });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      plot.current?.destroy();
      plot.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Stream new samples into the chart.
  useEffect(() => {
    if (!plot.current || rows.length === 0) return;
    const first = temps[rows[0].key];
    if (!first || first.time.length === 0) return;
    const x = first.time;
    const data: uPlot.AlignedData = [
      x,
      ...rows.map((r) => {
        const series = temps[r.key];
        if (!series) return new Array(x.length).fill(null);
        const v = series.value;
        if (v.length === x.length) return v;
        if (v.length > x.length) return v.slice(v.length - x.length);
        return [...new Array(x.length - v.length).fill(null), ...v];
      }),
    ] as uPlot.AlignedData;
    plot.current.setData(data);
  }, [temps, rows, signature]);

  return (
    <>
      <div ref={holder} className="sl-inset" style={{ padding: '8px 4px 2px', overflow: 'hidden' }} />
      <div ref={readout} className="sl-mono" style={{ minHeight: 16, padding: '4px 2px 0', fontSize: 9.5, color: 'var(--txd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
    </>
  );
}

function TargetEditor({ row }: { row: Row }) {
  const [draft, setDraft] = useState<string | null>(null);
  const profileId = useConfig((s) => s.profileId);
  const profile = getProfile(profileId);
  const heaterCfg = row.key === 'heater_bed' ? profile?.bed : profile?.hotend;
  const presets = [...(heaterCfg?.presets ?? []), 0];
  const max = heaterCfg?.maxTemp ?? 300;

  const send = (value: number) => {
    const v = Math.max(0, Math.min(max, Math.round(value)));
    void sendGcode(`SET_HEATER_TEMPERATURE HEATER=${row.key} TARGET=${v}`);
    setDraft(null);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {presets.map((p) => (
        <button key={p} className="sl-chip" data-on={row.target === p && p !== 0} onClick={() => send(p)} title={p === 0 ? 'off' : `${p} deg`}>
          {p === 0 ? 'off' : p}
        </button>
      ))}
      <input
        className="sl-input"
        style={{ width: 62, height: 28, textAlign: 'right' }}
        inputMode="decimal"
        value={draft ?? String(Math.round(row.target))}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== null && send(parseFloat(draft) || 0)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(null);
        }}
        aria-label={`${row.label} target`}
      />
    </span>
  );
}

export function Temperatures() {
  const rows = useSensorRows();

  const cooldown = () => void sendGcode('TURN_OFF_HEATERS');

  return (
    <Panel
      title="Temperatures"
      actions={
        <button className="sl-btn" style={{ height: 26, fontSize: 10.5, borderRadius: 999 }} onClick={cooldown}>
          Cooldown
        </button>
      }
    >
      <TempChart rows={rows} />
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .6fr 1.2fr', gap: 8, padding: '7px 2px' }}>
          <span className="sl-eyebrow" style={{ fontSize: 9.5 }}>Sensor</span>
          <span className="sl-eyebrow" style={{ fontSize: 9.5, textAlign: 'right' }}>Current</span>
          <span className="sl-eyebrow" style={{ fontSize: 9.5, textAlign: 'right' }}>Target</span>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: '10px 2px', font: "400 12.5px 'Manrope', sans-serif", color: 'var(--tx3)' }}>
            Waiting for the first status update.
          </div>
        )}
        {rows.map((r) => (
          <div
            key={r.key}
            style={{ display: 'grid', gridTemplateColumns: '1.4fr .6fr 1.2fr', gap: 8, alignItems: 'center', padding: '6px 2px', borderTop: '1px solid var(--b0)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, boxShadow: `0 0 7px ${r.color}`, flex: 'none' }} />
              <span style={{ font: "700 12.5px 'Manrope', sans-serif", color: 'var(--tx2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.label}
              </span>
              {r.power !== null && (
                <span className="sl-mono" style={{ fontSize: 9.5, color: 'var(--txd)' }}>
                  {Math.round(r.power * 100)}%
                </span>
              )}
            </span>
            <span className="sl-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)', textAlign: 'right' }}>
              {r.temperature.toFixed(1)}&deg;
            </span>
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {r.heater ? (
                <TargetEditor row={r} />
              ) : (
                <span className="sl-mono" style={{ fontSize: 11, color: 'var(--txf)', paddingRight: 10 }}>&mdash;</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
