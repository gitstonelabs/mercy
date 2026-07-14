// Print history page (handoff 3.12). Statistics from /server/history/totals,
// a completed/cancelled donut, weekly bars with a print-time / filament
// toggle, and a searchable job table with CSV export.

import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { useLiveStore } from '../store';
import { getBackend } from '../api/client';
import type { HistoryJob } from '../api/types';

function fmtHM(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function statusPill(status: string): { label: string; color: string; bg: string; border: string } {
  const s = status.toLowerCase();
  if (s === 'completed') return { label: 'DONE', color: 'var(--success)', bg: 'var(--ok-d2)', border: 'rgba(var(--success-rgb), .35)' };
  if (s === 'in_progress' || s === 'printing') return { label: 'PRINTING', color: 'var(--accent2)', bg: 'var(--ad2)', border: 'var(--accentdim)' };
  if (s === 'cancelled' || s === 'klippy_shutdown' || s === 'error') return { label: s.toUpperCase(), color: 'var(--danger)', bg: 'var(--danger-d2)', border: 'var(--danger-b)' };
  return { label: s.toUpperCase(), color: 'var(--tx3)', bg: 'var(--inset)', border: 'var(--b2)' };
}

export function PrintHistory() {
  const phase = useLiveStore((s) => s.phase);
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [barMode, setBarMode] = useState<'time' | 'filament'>('time');

  useEffect(() => {
    if (phase !== 'ready') return;
    const backend = getBackend();
    backend.history.list().then(setJobs).catch(() => {});
    backend.history.totals().then(setTotals).catch(() => {});
  }, [phase]);

  const q = query.trim().toLowerCase();
  const visible = jobs.filter((j) => !q || j.filename.toLowerCase().includes(q));

  const completed = jobs.filter((j) => j.status.toLowerCase() === 'completed').length;
  const other = Math.max(0, jobs.length - completed);
  const donutPct = jobs.length > 0 ? Math.round((completed / jobs.length) * 100) : 0;
  const C = 2 * Math.PI * 50;

  // Weekly buckets, newest 12 weeks, from the fetched jobs.
  const bars = useMemo(() => {
    const WEEK = 7 * 86400;
    const now = Date.now() / 1000;
    const buckets = new Array(12).fill(0);
    for (const j of jobs) {
      const age = now - j.startTime;
      const w = Math.floor(age / WEEK);
      if (w >= 0 && w < 12) buckets[11 - w] += barMode === 'time' ? j.printDuration : j.filamentUsed;
    }
    const max = Math.max(1, ...buckets);
    return buckets.map((v) => ({ v, h: Math.round((v / max) * 130) }));
  }, [jobs, barMode]);

  const exportCsv = () => {
    // Guard against spreadsheet formula injection: a cell starting with
    // = + - @ TAB or CR executes in Excel/LibreOffice even when quoted.
    const cell = (v: string) => {
      const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const head = 'filename,start_time,print_duration_s,filament_used_mm,status';
    const lines = jobs.map((j) => `${cell(j.filename)},${new Date(j.startTime * 1000).toISOString()},${Math.round(j.printDuration)},${Math.round(j.filamentUsed)},${j.status}`);
    const blob = new Blob([head + '\n' + lines.join('\n') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stonelabs-print-history.csv';
    a.click();
    // Revoking on the same tick can hand some browsers an empty file.
    window.setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const totalJobs = totals.total_jobs ?? jobs.length;
  const totalPrint = totals.total_print_time ?? 0;
  const longest = totals.longest_job ?? 0;
  const filamentKm = (totals.total_filament_used ?? 0) / 1_000_000;
  const avg = totalJobs > 0 ? totalPrint / totalJobs : 0;

  return (
    <div className="sl-page" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>receipts.</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>Print history</span>
        </span>
        <span style={{ flex: 1 }} />
        <button className="sl-btn" onClick={exportCsv}>Export csv</button>
      </div>

      <div className="sl-cgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 14 }}>
        <Panel title="Statistics">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <svg width="128" height="128" viewBox="0 0 128 128" style={{ flex: 'none' }} aria-hidden>
              <circle cx="64" cy="64" r="50" fill="none" stroke="var(--track)" strokeWidth="15" />
              <circle cx="64" cy="64" r="50" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="15" strokeDasharray={`${(C * donutPct) / 100} ${C}`} transform="rotate(-90 64 64)" />
              <text x="64" y="60" textAnchor="middle" fill="var(--tx)" fontSize="21" fontWeight="800" fontFamily="JetBrains Mono">{donutPct}%</text>
              <text x="64" y="77" textAnchor="middle" fill="var(--txd)" fontSize="9" fontFamily="JetBrains Mono">completed</text>
            </svg>
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {([
                ['total print time', fmtHM(totalPrint)],
                ['longest', fmtHM(longest)],
                ['average', fmtHM(avg)],
                ['total filament', `${filamentKm.toFixed(2)} km`],
                ['jobs', String(totalJobs)],
              ] as const).map(([k, v]) => (
                <span key={k} className="sl-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                  <span style={{ color: 'var(--txd)' }}>{k}</span>
                  <span style={{ color: 'var(--tx)', fontWeight: 700 }}>{v}</span>
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <span className="sl-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: 'var(--tx3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} /> completed {completed}
            </span>
            <span className="sl-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: 'var(--tx3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--danger)' }} /> other {other}
            </span>
          </div>
        </Panel>

        <Panel
          title="Last 12 weeks"
          actions={
            <span className="sl-seg">
              <button data-on={barMode === 'time'} onClick={() => setBarMode('time')}>Print time</button>
              <button data-on={barMode === 'filament'} onClick={() => setBarMode('filament')}>Filament</button>
            </span>
          }
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, minHeight: 150, padding: '8px 2px 0' }}>
            {bars.map((b, i) => (
              <span key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ width: '100%', height: b.h, minHeight: 3, borderRadius: '6px 6px 3px 3px', background: 'linear-gradient(180deg, var(--accent), var(--accentdim))', opacity: b.v > 0 ? 0.9 : 0.25 }} />
                <span className="sl-mono" style={{ fontSize: 8.5, color: 'var(--txf)' }}>{i === 11 ? 'now' : `-${11 - i}w`}</span>
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Jobs"
        actions={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 11px', borderRadius: 9, border: '1px solid var(--b2)', background: 'var(--control)', minWidth: 180 }}>
            <input
              style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--tx)', font: "500 12px 'Manrope', sans-serif", outline: 'none', minWidth: 0 }}
              placeholder="search jobs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search jobs"
            />
          </span>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            {visible.map((j) => {
              const pill = statusPill(j.status);
              return (
                <div key={j.jobId} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 150px 100px 100px 110px', gap: 10, alignItems: 'center', padding: '9px 4px', borderTop: '1px solid var(--b0)' }}>
                  <span style={{ font: "700 12.5px 'Manrope', sans-serif", color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.filename}</span>
                  <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
                    {new Date(j.startTime * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--tx3)', textAlign: 'right' }}>{fmtHM(j.printDuration)}</span>
                  <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--tx3)', textAlign: 'right' }}>{(j.filamentUsed / 1000).toFixed(1)} m</span>
                  <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span className="sl-mono" style={{ height: 20, padding: '0 9px', borderRadius: 999, border: `1px solid ${pill.border}`, background: pill.bg, display: 'inline-flex', alignItems: 'center', fontSize: 8.5, fontWeight: 800, letterSpacing: '.06em', color: pill.color, whiteSpace: 'nowrap' }}>
                      {pill.label}
                    </span>
                  </span>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div style={{ padding: '16px 4px', font: "400 12.5px 'Manrope', sans-serif", color: 'var(--tx3)' }}>
                No jobs match. History fills in as prints finish.
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
