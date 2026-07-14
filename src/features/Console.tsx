// Console page (handoff 3.7 + the approved console configurator). Live
// gcode-response feed, command input with autocomplete from printer.gcode.help,
// temperature-poll filter, and the five page layouts (console alone, 1x2, 1x3,
// console 50 with two stacked, four quarters). Display prefs persist in
// config.console.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfig, useLiveStore } from '../store';
import { getBackend } from '../api/client';
import { onGcodeResponse, getGcodeBacklog, sendGcode } from '../api/bootstrap';
import { WebcamView } from '../components/WebcamView';
import { Toolhead } from './Toolhead';
import { Temperatures } from './Temperatures';

interface Line {
  t: string;      // HH:MM:SS
  text: string;
  kind: 'sent' | 'response' | 'warning';
  tempPoll: boolean;
}

const TEMP_POLL = /^(?:ok\s+)?(?:T\d*|B):\d/;

// v1.9's curated command palette rows, overlaid on the live printer.gcode.help
// list: desc replaces the raw help text, kw is HIDDEN search keywords so
// search-by-intent ("cut", "level", "cfs") still works. Only commands the
// running Klipper actually reports get a row, so the palette never offers a
// macro this build does not have. cmd overrides add ready-to-edit parameters.
const CURATED: Record<string, { cmd?: string; desc: string; kw: string }> = {
  POP_FILAMENT_OUT: { desc: 'Jog X in/out of extrude position to free a jam', kw: 'jog wiggle free jam stuck unstick' },
  BED_MESH_CLEAR: { desc: 'Clear the active bed mesh', kw: 'bed mesh clear remove reset off' },
  CLEAR_NOZZLE: { cmd: 'CLEAR_NOZZLE HOTEND=250', desc: 'Heat + extrude + multi-pass wiper-tower nozzle clean', kw: 'clean nozzle purge wipe' },
  CLEAN_NOZZLE: { desc: 'Purge and wipe at the brush', kw: 'clean nozzle purge wipe brush' },
  CUT_FILAMENT: { desc: 'Cut the filament at the stopper', kw: 'cut cutter blade snip cfs' },
  CFS_LOAD: { desc: 'Load a CFS slot: UNIT= SLOT=', kw: 'cfs load feed slot ams multicolor filament' },
  CFS_UNLOAD: { desc: 'Unload the active CFS slot', kw: 'cfs unload eject retract slot filament' },
  CFS_INITIALIZE: { desc: 'Re-detect CFS boxes on the RS485 bus', kw: 'cfs detect rescan init box' },
  Z_TILT_ADJUST: { desc: 'Level the gantry against both Z steppers', kw: 'level gantry tilt square z' },
  BED_MESH_CALIBRATE: { desc: 'Probe the bed and build a mesh', kw: 'level mesh probe bed calibrate' },
  SHAPER_CALIBRATE: { desc: 'Run input shaper on X and/or Y', kw: 'resonance vibration tune shaper calibrate' },
  FIRMWARE_RESTART: { desc: 'Restart Klipper after a shutdown or config save', kw: 'restart recover reset klippy' },
  SET_PAUSE_AT_LAYER: { desc: 'Pause when a layer is reached: LAYER=', kw: 'pause layer stop at' },
  M600: { desc: 'Filament change', kw: 'filament change swap color' },
};

function toLine(text: string, kind: Line['kind'] = 'response'): Line {
  return {
    t: new Date().toTimeString().slice(0, 8),
    text,
    kind: text.startsWith('!!') || text.startsWith('// warning') ? 'warning' : kind,
    tempPoll: TEMP_POLL.test(text),
  };
}

const LAYOUTS: { id: 'full' | '1x2' | '1x3' | 'combo' | 'quad'; name: string; cells: string[][] }[] = [
  { id: 'full', name: 'Console only', cells: [['c']] },
  { id: '1x2', name: 'Console + module', cells: [['c', 'm']] },
  { id: '1x3', name: 'Three across', cells: [['c', 'm', 'm']] },
  { id: 'combo', name: 'Console 50 + two stacked', cells: [['c', 'm'], ['c', 'm']] },
  { id: 'quad', name: 'Four quarters', cells: [['c', 'm'], ['m', 'm']] },
];

function LayoutDiagram({ cells, active }: { cells: string[][]; active: boolean }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', height: '100%' }}>
      {cells.map((row, i) => (
        <span key={i} style={{ display: 'flex', gap: 2, flex: 1 }}>
          {row.map((c, j) => (
            <span
              key={j}
              style={{
                flex: c === 'c' ? 1.4 : 1,
                borderRadius: 2,
                background: c === 'c' ? (active ? 'var(--accent)' : 'var(--b3)') : active ? 'var(--accentdim)' : 'var(--b2)',
              }}
            />
          ))}
        </span>
      ))}
    </span>
  );
}

export function Console() {
  const prefs = useConfig((s) => s.console);
  const setPrefs = useConfig((s) => s.setConsolePrefs);
  const phase = useLiveStore((s) => s.phase);

  const [lines, setLines] = useState<Line[]>(() => getGcodeBacklog().map(({ t, text }) => ({ ...toLine(text), t })));
  const [input, setInput] = useState('');
  const [dispOpen, setDispOpen] = useState(false);
  const [palOpen, setPalOpen] = useState(false);
  const [palQuery, setPalQuery] = useState('');
  const [macroHelp, setMacroHelp] = useState<Record<string, string>>({});
  const feedRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Per-session command history ring for ↑/↓ on the input (v1.9 parity).
  // idx -1 = live draft; draft holds whatever was typed before browsing.
  const histRef = useRef<{ list: string[]; idx: number; draft: string }>({ list: [], idx: -1, draft: '' });

  useEffect(() => onGcodeResponse((text) => setLines((prev) => [...prev.slice(-499), toLine(text)])), []);

  useEffect(() => {
    if (phase !== 'ready') return;
    getBackend().gcodeHelp().then(setMacroHelp).catch(() => {});
  }, [phase]);

  const macroNames = useMemo(
    () => Object.keys(macroHelp).filter((n) => !n.startsWith('_')).sort(),
    [macroHelp],
  );

  // Keep the newest line in view for both directions.
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = prefs.newestTop ? 0 : el.scrollHeight;
  }, [lines, prefs.newestTop]);

  const visible = useMemo(() => {
    let v = prefs.hideTempPolls ? lines.filter((l) => !l.tempPoll) : lines;
    if (prefs.newestTop) v = [...v].reverse();
    return v;
  }, [lines, prefs.hideTempPolls, prefs.newestTop]);

  const suggestions = useMemo(() => {
    const q = input.trim().toUpperCase();
    if (!q) return [];
    return macroNames.filter((n) => n.startsWith(q) && n !== q).slice(0, 3);
  }, [input, macroNames]);

  // Palette rows: live help list merged with the curated overlay, filtered by
  // the search box across command, description, and hidden keywords.
  const paletteRows = useMemo(() => {
    const rows = macroNames.map((n) => {
      const c = CURATED[n];
      return { cmd: c?.cmd ?? n, desc: c?.desc ?? macroHelp[n] ?? '', kw: c?.kw ?? '' };
    });
    const q = palQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.cmd} ${r.desc} ${r.kw}`.toLowerCase().includes(q));
  }, [macroNames, macroHelp, palQuery]);

  const pickCommand = (cmd: string) => {
    setInput(cmd + (cmd.includes('=') || cmd.includes(' ') ? '' : ' '));
    setPalOpen(false);
    inputRef.current?.focus();
  };

  const send = () => {
    const cmd = input.trim();
    if (!cmd) return;
    setLines((prev) => [...prev.slice(-499), toLine(`$ ${cmd}`, 'sent')]);
    void sendGcode(cmd);
    const h = histRef.current;
    if (h.list[h.list.length - 1] !== cmd) h.list.push(cmd);
    if (h.list.length > 100) h.list.splice(0, h.list.length - 100);
    h.idx = -1;
    h.draft = '';
    setInput('');
  };

  const inputRow = (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        margin: prefs.inputTop ? '12px 15px 4px' : '0 15px 14px',
        border: '1px solid var(--accentdim)',
        borderRadius: 11,
        background: 'var(--inset)',
        padding: '0 13px',
        boxShadow: '0 0 0 1px rgba(var(--accent-rgb), .12)',
      }}
    >
      <span className="sl-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>$</span>
      <input
        ref={inputRef}
        className="sl-mono"
        style={{ flex: 1, height: 42, border: 'none', background: 'transparent', color: 'var(--tx)', fontSize: 12, outline: 'none', minWidth: 0 }}
        placeholder="type G-code · ↑↓ history · tab completes"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          histRef.current.idx = -1;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') send();
          if (e.key === 'Tab' && suggestions[0]) {
            e.preventDefault();
            setInput(suggestions[0] + ' ');
          }
          if (e.key === 'ArrowUp') {
            const h = histRef.current;
            if (h.list.length === 0) return;
            e.preventDefault();
            if (h.idx === -1) {
              h.draft = input;
              h.idx = h.list.length - 1;
            } else if (h.idx > 0) {
              h.idx -= 1;
            }
            setInput(h.list[h.idx]);
          }
          if (e.key === 'ArrowDown') {
            const h = histRef.current;
            if (h.idx === -1) return;
            e.preventDefault();
            if (h.idx < h.list.length - 1) {
              h.idx += 1;
              setInput(h.list[h.idx]);
            } else {
              h.idx = -1;
              setInput(h.draft);
            }
          }
        }}
        aria-label="G-code command"
      />
      <button className="sl-btn sl-btn--accent" style={{ height: 30, fontSize: 11 }} onClick={send}>Send</button>
    </div>
  );

  const consoleCard = (
    <div className="sl-card" style={{ gridRow: prefs.layout === 'combo' ? '1 / 3' : undefined, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px 9px', borderBottom: '1px solid var(--b0)' }}>
        <span className="sl-eyebrow">Console</span>
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button className="sl-btn sl-mono" style={{ height: 24, fontSize: 10 }} data-open={palOpen} onClick={() => { setPalOpen((v) => !v); setPalQuery(''); }}>
            Macros
          </button>
          <button className="sl-btn sl-btn--ghost sl-mono" style={{ height: 24, fontSize: 10 }} onClick={() => setLines([])}>clear</button>
          {palOpen && (
            <>
              <span style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setPalOpen(false)} />
              <span style={{ position: 'absolute', top: 30, right: 0, zIndex: 41, width: 340, display: 'flex', flexDirection: 'column', borderRadius: 13, border: '1px solid var(--b2)', background: 'linear-gradient(180deg, var(--surface), var(--bg2))', boxShadow: '0 24px 60px rgba(0,0,0,.7)', overflow: 'hidden' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 10, borderBottom: '1px solid var(--b0)' }}>
                  <input
                    className="sl-input sl-mono"
                    style={{ flex: 1, height: 32, fontSize: 11 }}
                    placeholder="search commands · e.g. cut, level, cfs"
                    value={palQuery}
                    autoFocus
                    onChange={(e) => setPalQuery(e.target.value)}
                    aria-label="Search commands"
                  />
                  {palQuery && (
                    <button className="sl-btn" style={{ height: 28, fontSize: 10 }} onClick={() => setPalQuery('')}>
                      Clear search
                    </button>
                  )}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto', padding: 6 }}>
                  {paletteRows.map((r) => (
                    <button
                      key={r.cmd}
                      className="sl-btn sl-btn--ghost"
                      style={{ justifyContent: 'flex-start', minHeight: 40, height: 'auto', padding: '7px 9px', borderRadius: 8, textAlign: 'left' }}
                      onClick={() => pickCommand(r.cmd)}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                        <span className="sl-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.cmd}</span>
                        {r.desc && <span style={{ font: "400 10.5px/1.4 'Manrope', sans-serif", color: 'var(--txd)', whiteSpace: 'normal' }}>{r.desc}</span>}
                      </span>
                    </button>
                  ))}
                  {paletteRows.length === 0 && (
                    <span style={{ padding: '14px 10px', font: "400 12px 'Manrope', sans-serif", color: 'var(--tx3)' }}>no commands match.</span>
                  )}
                </span>
              </span>
            </>
          )}
        </span>
      </div>
      {prefs.inputTop && inputRow}
      <div ref={feedRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 15px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {visible.map((l, i) => (
          <span key={i} style={{ display: 'flex', gap: 10, font: "400 11px/1.5 'JetBrains Mono', monospace" }}>
            {prefs.timestamps && <span style={{ color: 'var(--txf)', flex: 'none' }}>{l.t}</span>}
            <span style={{ color: l.kind === 'sent' ? 'var(--accent2)' : l.kind === 'warning' ? 'var(--warning)' : 'var(--tx3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {l.text}
            </span>
          </span>
        ))}
        {visible.length === 0 && <span style={{ font: "400 12px 'Manrope', sans-serif", color: 'var(--txd)' }}>Nothing yet. Responses stream in here.</span>}
      </div>
      {suggestions.length > 0 && (
        <div style={{ flex: 'none', padding: '0 15px 6px', display: 'flex', gap: 6, overflow: 'hidden' }}>
          {suggestions.map((s) => (
            <button key={s} className="sl-chip" style={{ height: 24, fontSize: 10, flex: 'none' }} onClick={() => setInput(s + ' ')}>
              {s}
            </button>
          ))}
        </div>
      )}
      {!prefs.inputTop && inputRow}
    </div>
  );

  const grid: Record<string, string> = {
    full: '1fr',
    '1x2': '1fr 1fr',
    '1x3': '1fr 1fr 1fr',
    combo: '1fr 1fr',
    quad: '1fr 1fr',
  };
  const twoRows = prefs.layout === 'combo' || prefs.layout === 'quad';
  const showCam = prefs.layout !== 'full';
  const showTool = prefs.layout === '1x3' || prefs.layout === 'combo' || prefs.layout === 'quad';
  const showTemps = prefs.layout === 'quad';

  return (
    <div className="sl-page" style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="sl-script" style={{ fontSize: 15 }}>talk to her.</span>
          <span style={{ font: "800 18px 'Manrope', sans-serif", color: 'var(--tx)' }}>Console</span>
        </span>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 5, padding: 4, border: '1px solid var(--b2)', borderRadius: 11, background: 'var(--control)' }}>
          {LAYOUTS.map((L) => (
            <button
              key={L.id}
              title={L.name}
              aria-label={L.name}
              onClick={() => setPrefs({ layout: L.id })}
              style={{
                width: 46,
                height: 32,
                borderRadius: 7,
                padding: 5,
                cursor: 'pointer',
                border: `1px solid ${prefs.layout === L.id ? 'var(--accentdim)' : 'var(--b2)'}`,
                background: prefs.layout === L.id ? 'var(--ad2)' : 'var(--bg2)',
                boxShadow: prefs.layout === L.id ? '0 0 8px -2px rgba(var(--accent-rgb), .5)' : 'none',
              }}
            >
              <LayoutDiagram cells={L.cells} active={prefs.layout === L.id} />
            </button>
          ))}
        </div>
        <span style={{ position: 'relative' }}>
          <button className="sl-btn" data-open={dispOpen} onClick={() => setDispOpen((v) => !v)}>Display</button>
          {dispOpen && (
            <>
              <span style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setDispOpen(false)} />
              <span
                style={{ position: 'absolute', top: 42, right: 0, zIndex: 41, width: 280, display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 13, border: '1px solid var(--b2)', background: 'linear-gradient(180deg, var(--surface), var(--bg2))', boxShadow: '0 24px 60px rgba(0,0,0,.7)' }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="sl-eyebrow" style={{ fontSize: 9.5 }}>Newest line</span>
                  <span className="sl-seg" style={{ display: 'flex' }}>
                    <button style={{ flex: 1 }} data-on={!prefs.newestTop} onClick={() => setPrefs({ newestTop: false })}>At the bottom</button>
                    <button style={{ flex: 1 }} data-on={prefs.newestTop} onClick={() => setPrefs({ newestTop: true })}>At the top</button>
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="sl-eyebrow" style={{ fontSize: 9.5 }}>Input box</span>
                  <span className="sl-seg" style={{ display: 'flex' }}>
                    <button style={{ flex: 1 }} data-on={!prefs.inputTop} onClick={() => setPrefs({ inputTop: false })}>Bottom</button>
                    <button style={{ flex: 1 }} data-on={prefs.inputTop} onClick={() => setPrefs({ inputTop: true })}>Top</button>
                  </span>
                </span>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: "700 11.5px 'Manrope', sans-serif", color: 'var(--tx2)', cursor: 'pointer' }}>
                  Hide temperature polls
                  <input type="checkbox" className="sl-range" checked={prefs.hideTempPolls} onChange={(e) => setPrefs({ hideTempPolls: e.target.checked })} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: "700 11.5px 'Manrope', sans-serif", color: 'var(--tx2)', cursor: 'pointer' }}>
                  Timestamps
                  <input type="checkbox" className="sl-range" checked={prefs.timestamps} onChange={(e) => setPrefs({ timestamps: e.target.checked })} />
                </label>
              </span>
            </>
          )}
        </span>
      </div>

      <div
        className="sl-cgrid"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gap: 14,
          gridTemplateColumns: grid[prefs.layout],
          gridTemplateRows: twoRows ? '1fr 1fr' : '1fr',
        }}
      >
        {consoleCard}
        {showCam && (
          <div className="sl-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px 8px' }}>
              <span className="sl-eyebrow" style={{ fontSize: 10 }}>Webcam</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', margin: '0 14px 13px' }}>
              <WebcamView minHeight={120} />
            </div>
          </div>
        )}
        {showTool && <div style={{ minHeight: 0, overflowY: 'auto' }}><Toolhead /></div>}
        {showTemps && <div style={{ minHeight: 0, overflowY: 'auto' }}><Temperatures /></div>}
      </div>
    </div>
  );
}
