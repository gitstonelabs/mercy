// G-Code Files page (handoff 3.9). Browser over the gcodes root with folder
// navigation, metadata + thumbnails from /server/files/metadata, upload,
// delete, and print. The top bar's Upload and print routes here.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import { useConfig, useLiveStore } from '../store';
import { getBackend } from '../api/client';
import { printActive } from '../api/bootstrap';
import type { FileEntry, GcodeMetadata } from '../api/types';
import { Icon } from '../components/icons';

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

// One extension gate for upload, metadata, and the print button, so anything
// the browser can pick can also be printed.
const PRINTABLE = /\.(gcode|g|gco)$/i;

function fmtDur(sec: number | undefined): string {
  if (!sec) return '\u2014';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function fmtWhen(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function GcodeFiles() {
  const host = useConfig((s) => s.moonrakerHost);
  const phase = useLiveStore((s) => s.phase);
  const printingFile = useLiveStore((s) => s.filename);
  const [path, setPath] = useState('');
  const [rows, setRows] = useState<FileEntry[]>([]);
  const [meta, setMeta] = useState<Record<string, GcodeMetadata>>({});
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    // Latest-wins: fast folder hops must not let an older listing resolve
    // after a newer one and clobber the rows for the wrong path.
    const token = ++requestId.current;
    try {
      const list = await getBackend().files.list('gcodes', path || undefined);
      if (token !== requestId.current) return;
      list.sort((a, b) => Number(b.isDir) - Number(a.isDir) || b.modified - a.modified);
      setRows(list);
      const gcodes = list.filter((f) => !f.isDir && PRINTABLE.test(f.path)).slice(0, 60);
      const entries = await Promise.all(
        gcodes.map(async (f) => {
          const full = path ? `${path}/${f.path}` : f.path;
          try {
            return [full, await getBackend().files.metadata(full)] as const;
          } catch {
            return [full, {} as GcodeMetadata] as const;
          }
        }),
      );
      if (token !== requestId.current) return;
      setMeta(Object.fromEntries(entries));
    } catch (e) {
      if (token === requestId.current) setError(e instanceof Error ? e.message : 'listing failed');
    } finally {
      if (token === requestId.current) setBusy(false);
    }
  }, [path]);

  useEffect(() => {
    if (phase === 'ready') void refresh();
  }, [phase, refresh]);

  const startPrint = (name: string) => {
    const full = path ? `${path}/${name}` : name;
    const m = meta[full];
    const detail = m?.estimatedTime ? ` (est ${fmtDur(m.estimatedTime)})` : '';
    if (!window.confirm(`Start printing ${name}${detail}?`)) return;
    getBackend().print.start(full).catch((e) => setError(String(e)));
  };

  const remove = (f: FileEntry) => {
    const full = path ? `${path}/${f.path}` : f.path;
    if (printActive() && printingFile === full) return; // button is hidden too
    if (!window.confirm(`Delete ${f.path}? This cannot be undone.`)) return;
    getBackend().files.delete('gcodes', full).then(refresh).catch((e) => setError(String(e)));
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const dest = path ? `${path}/${file.name}` : file.name;
    getBackend().files.upload('gcodes', dest, file).then(refresh).catch((e) => { setError(String(e)); setBusy(false); });
  };

  const thumbUrl = (full: string): string | null => {
    const t = meta[full]?.thumbnails?.slice(-1)[0];
    if (!t?.relativePath) return null;
    const dir = full.includes('/') ? full.slice(0, full.lastIndexOf('/') + 1) : '';
    return `${host.replace(/\/$/, '')}/server/files/gcodes/${dir}${t.relativePath}`;
  };

  const q = query.trim().toLowerCase();
  const visible = rows.filter((f) => !q || f.path.toLowerCase().includes(q));
  const crumbs = path ? path.split('/') : [];

  return (
    <div className="sl-page" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>the queue.</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>G-code files</span>
        </span>
        <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--txd)', display: 'inline-flex', gap: 6 }}>
          <button className="sl-btn sl-btn--ghost sl-mono" style={{ height: 22, padding: '0 4px', fontSize: 10.5, color: path ? 'var(--accent2)' : 'var(--tx3)' }} onClick={() => setPath('')}>gcodes</button>
          {crumbs.map((c, i) => (
            <button
              key={i}
              className="sl-btn sl-btn--ghost sl-mono"
              style={{ height: 22, padding: '0 4px', fontSize: 10.5, color: i === crumbs.length - 1 ? 'var(--accent2)' : 'var(--tx3)' }}
              onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}
            >
              / {c}
            </button>
          ))}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid var(--b2)', background: 'var(--control)', minWidth: 200 }}>
          <input
            style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--tx)', font: "500 12.5px 'Manrope', sans-serif", outline: 'none', minWidth: 0 }}
            placeholder="search files"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search files"
          />
        </span>
        <button className="sl-btn" style={{ width: 36, padding: 0 }} title="Refresh" onClick={() => void refresh()}>
          <Icon name="restart" size={15} />
        </button>
        <button className="sl-btn sl-btn--accent" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={15} strokeWidth={2} /> Upload
        </button>
        <input ref={fileRef} type="file" accept=".gcode,.g,.gco" style={{ display: 'none' }} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <Panel title={busy ? 'Loading' : `${visible.length} item${visible.length === 1 ? '' : 's'}`} actions={error ? <span className="sl-mono" style={{ fontSize: 10, color: 'var(--danger)' }}>{error}</span> : undefined}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 680 }}>
            {path && (
              <button className="sl-btn sl-btn--ghost" style={{ width: '100%', justifyContent: 'flex-start', height: 40 }} onClick={() => setPath(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')}>
                <Icon name="files" size={16} /> ..
              </button>
            )}
            {visible.map((f) => {
              const full = path ? `${path}/${f.path}` : f.path;
              const m = meta[full];
              const thumb = f.isDir ? null : thumbUrl(full);
              const isPrinting = !f.isDir && printingFile === full;
              return (
                <div
                  key={f.path}
                  style={{ display: 'grid', gridTemplateColumns: '44px minmax(180px, 1fr) 90px 90px 100px 90px 130px 88px', gap: 10, alignItems: 'center', padding: '8px 4px', borderTop: '1px solid var(--b0)', cursor: f.isDir ? 'pointer' : 'default' }}
                  onClick={f.isDir ? () => setPath(full) : undefined}
                >
                  <span className="sl-inset" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 8 }}>
                    {f.isDir ? (
                      <span style={{ color: 'var(--tx3)' }}><Icon name="files" size={17} /></span>
                    ) : thumb ? (
                      <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: 'var(--accent)' }}><Icon name="viewer" size={17} strokeWidth={1.5} /></span>
                    )}
                  </span>
                  <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: "700 12.5px 'Manrope', sans-serif", color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.path}</span>
                    {isPrinting && (
                      <span className="sl-mono" style={{ height: 18, padding: '0 8px', borderRadius: 999, border: '1px solid var(--accentdim)', background: 'var(--ad2)', display: 'inline-flex', alignItems: 'center', fontSize: 8.5, fontWeight: 800, letterSpacing: '.08em', color: 'var(--accent2)', whiteSpace: 'nowrap' }}>
                        PRINTING
                      </span>
                    )}
                  </span>
                  <span className="sl-mono" style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'right' }}>{f.isDir ? '\u2014' : fmtSize(f.size)}</span>
                  <span className="sl-mono" style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'right' }}>{f.isDir ? '' : fmtDur(m?.estimatedTime)}</span>
                  <span className="sl-mono" style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'right' }}>
                    {f.isDir || !m?.filamentTotal ? '' : `${(m.filamentTotal / 1000).toFixed(1)} m`}
                  </span>
                  <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--txd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.isDir ? '' : m?.slicer ?? ''}</span>
                  <span className="sl-mono" style={{ fontSize: 10.5, color: 'var(--txd)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtWhen(f.modified)}</span>
                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {!f.isDir && PRINTABLE.test(f.path) && (
                      <button
                        className="sl-btn sl-btn--accent"
                        style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }}
                        title="Print"
                        aria-label={`Print ${f.path}`}
                        onClick={(e) => { e.stopPropagation(); startPrint(f.path); }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5v14l12-7Z" /></svg>
                      </button>
                    )}
                    {!f.isDir && !isPrinting && (
                      <button className="sl-btn" style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }} title="Delete" aria-label={`Delete ${f.path}`} onClick={(e) => { e.stopPropagation(); remove(f); }}>
                        <Icon name="x" size={13} strokeWidth={2} />
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
            {visible.length === 0 && !busy && (
              <div style={{ padding: '18px 4px', font: "400 12.5px 'Manrope', sans-serif", color: 'var(--tx3)' }}>
                Nothing here. Upload a .gcode or drop into a slicer's Moonraker upload.
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
