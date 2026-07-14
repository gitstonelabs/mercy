// Backend bootstrap: builds the adapter, wires its events into the stores,
// subscribes to the Klipper objects the pages read, and samples the heaters
// into the temperature ring buffer once per second.
//
// Called once from main.tsx. Handles the 'auto' fallback: if Moonraker's
// socket cannot open, the demo simulator takes over and the top-bar pill
// shows DEMO. gcode responses fan out to subscribers (Console page).

import { makeBackend, getBackend } from './client';
import type { BackendService, StatusUpdate } from './types';
import { useLiveStore } from '../store';
import { useConfig } from '../store/config';
import type { JobState } from '../store/job';

// Object-name prefixes worth subscribing to. Exact names come from
// printer.objects.list, since sensor/fan/led names vary per config.
const SUB_PREFIXES = [
  'toolhead',
  'gcode_move',
  'motion_report',
  'extruder',
  'heater_bed',
  'temperature_sensor',
  'temperature_host',
  'fan',
  'heater_fan',
  'controller_fan',
  'fan_generic',
  'output_pin',
  'led',
  'neopixel',
  'filament_switch_sensor',
  'filament_motion_sensor',
  'print_stats',
  'display_status',
  'virtual_sdcard',
  'bed_mesh',
  'creality_cfs',
  'save_variables',
  'webhooks',
  'mcu',
];

// ---- gcode response fan-out (Console page subscribes here) ----
type GcodeListener = (line: string) => void;
const gcodeListeners = new Set<GcodeListener>();
// Backlog keeps the arrival time so the Console does not re-stamp history on
// every mount.
const gcodeBacklog: { t: string; text: string }[] = [];

export function onGcodeResponse(fn: GcodeListener): () => void {
  gcodeListeners.add(fn);
  return () => gcodeListeners.delete(fn);
}

export function getGcodeBacklog(): { t: string; text: string }[] {
  return gcodeBacklog;
}

// Send a gcode and surface failures instead of swallowing them: a rejected
// command lands in the console feed as a '!!' line, so the operator gets a
// signal when a motion command bounces.
export function sendGcode(script: string): Promise<void> {
  return getBackend()
    .gcode(script)
    .catch((e) => {
      const msg = `!! send failed: ${script.split('\n')[0]} (${e instanceof Error ? e.message : String(e)})`;
      gcodeBacklog.push({ t: new Date().toTimeString().slice(0, 8), text: msg });
      if (gcodeBacklog.length > 500) gcodeBacklog.splice(0, gcodeBacklog.length - 500);
      useLiveStore.getState().pushNotice('warning', msg.replace(/^!!\s*/, ''));
      gcodeListeners.forEach((fn) => fn(msg));
    });
}

// ---- print-safety guard ----
// One shared gate for actions that ruin or lose a running print: homing,
// calibration, restarts, updates, deletes of the active file.
export function printActive(): boolean {
  const s = useLiveStore.getState();
  return s.state === 'printing' || s.state === 'paused';
}

export function confirmRiskyDuringPrint(what: string): boolean {
  if (!printActive()) return true;
  return window.confirm(`A print is running. ${what} can ruin or abort it. Continue anyway?`);
}

let started = false;
let sampler: number | null = null;
let unwire: (() => void)[] = [];

export function startBackend(): void {
  if (started) return;
  started = true;
  void run();
}

// Rebuild after Settings changes the host or the connection mode.
export function restartBackend(): void {
  started = false;
  unwire.forEach((u) => u());
  unwire = [];
  if (sampler !== null) window.clearInterval(sampler);
  sampler = null;
  // A restart means a different data source (printer switch, host change).
  // Clear the live model first: keeping it shows printer A's objects and job
  // on B and splices A's temperature history into B's chart.
  const live = useLiveStore.getState();
  live.resetObjects();
  live.clearTemps();
  live.resetJob();
  startBackend();
}

async function run(): Promise<void> {
  const mode = useConfig.getState().connectionMode;
  const live = useLiveStore.getState();

  if (mode === 'demo') {
    await attach(makeBackend('demo'), 'demo');
    return;
  }

  const moonraker = makeBackend('moonraker');
  try {
    await attach(moonraker, 'moonraker');
  } catch {
    if (mode === 'auto') {
      live.setError('Moonraker is unreachable; running the demo simulator.');
      await attach(makeBackend('demo'), 'demo');
    } else {
      live.setError('Moonraker is unreachable. Check the host in Settings.');
    }
  }
}

async function attach(backend: BackendService, kind: 'moonraker' | 'demo'): Promise<void> {
  const live = useLiveStore.getState();
  live.setKind(kind);

  unwire.push(
    backend.on('connection', (phase) => {
      const live = useLiveStore.getState();
      const prev = live.phase;
      live.setPhase(phase);
      if (phase === 'ready') {
        // A successful (re)connect clears any stale unreachable banner.
        live.setError(null);
        void subscribeAll(backend);
      }
      if (phase === 'klippy-shutdown' && prev !== 'klippy-shutdown') {
        live.pushNotice('error', 'Klipper is shut down. Heaters and steppers are off; FIRMWARE_RESTART to recover.');
      }
      if (phase === 'klippy-disconnected') live.resetObjects();
    }),
  );
  unwire.push(
    backend.on('status', (update) => {
      useLiveStore.getState().applyStatus(update);
      feedJob(update);
    }),
  );
  unwire.push(
    backend.on('gcodeResponse', (line) => {
      gcodeBacklog.push({ t: new Date().toTimeString().slice(0, 8), text: line });
      if (gcodeBacklog.length > 500) gcodeBacklog.splice(0, gcodeBacklog.length - 500);
      if (line.startsWith('!!')) useLiveStore.getState().pushNotice('error', line.replace(/^!!\s*/, ''));
      gcodeListeners.forEach((fn) => fn(line));
    }),
  );

  await backend.connect();
  if (backend.phase === 'ready') await subscribeAll(backend);

  if (sampler === null) sampler = window.setInterval(sampleTemps, 1000);
}

async function subscribeAll(backend: BackendService): Promise<void> {
  try {
    const names = await backend.listObjects();
    const wanted: Record<string, null> = {};
    for (const name of names) {
      const base = name.split(' ')[0];
      // extruder1/extruder2 have no space in the object name; match them too.
      if (SUB_PREFIXES.includes(base) || /^extruder\d+$/.test(base)) wanted[name] = null;
    }
    await backend.subscribe(wanted as Record<string, string[] | null>);
  } catch {
    // A failed subscribe surfaces as an empty dashboard; the reconnect path
    // retries it on the next notify_klippy_ready.
  }
}

// Map print_stats / virtual_sdcard deltas into the job slice.
function feedJob(update: StatusUpdate): void {
  const job = useLiveStore.getState();
  const ps = update.print_stats;
  if (ps) {
    const info = (ps.info ?? {}) as { current_layer?: number; total_layer?: number };
    job.setJob({
      ...(ps.filename !== undefined ? { filename: (ps.filename as string) || null } : {}),
      ...(ps.state !== undefined ? { state: ps.state as JobState } : {}),
      ...(ps.print_duration !== undefined ? { printDuration: ps.print_duration as number } : {}),
      ...(ps.total_duration !== undefined ? { totalDuration: ps.total_duration as number } : {}),
      ...(info.current_layer !== undefined ? { currentLayer: info.current_layer } : {}),
      ...(info.total_layer !== undefined ? { totalLayers: info.total_layer } : {}),
    });
  }
  const sd = update.virtual_sdcard;
  if (sd && sd.progress !== undefined) {
    job.setJob({ progress: sd.progress as number });
  }
}

// Once per second, push every heater/sensor reading into the ring buffer the
// uPlot chart reads. One shared timeline keeps the series aligned.
function sampleTemps(): void {
  const state = useLiveStore.getState();
  const t = Date.now() / 1000;
  for (const [name, fields] of Object.entries(state.objects)) {
    const base = name.split(' ')[0];
    const isHeater = name === 'extruder' || name === 'heater_bed';
    const isSensor = base === 'temperature_sensor' || base === 'temperature_host';
    if (!isHeater && !isSensor) continue;
    const value = fields.temperature as number | undefined;
    if (value === undefined) continue;
    const target = (fields.target as number | undefined) ?? 0;
    state.pushTemp(name, value, target, t);
  }
}
