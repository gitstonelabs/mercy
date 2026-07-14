// Demo backend: a Klipper simulator behind the same BackendService seam.
//
// Purpose: the screen is never blank. v1 shipped this behavior (header pill
// shows DEMO) and v2 keeps it. The simulator emits the same object shapes the
// Moonraker adapter does, so every panel exercises the identical code path.
// client.ts picks this adapter when connectionMode is 'demo', or as the
// fallback when 'auto' cannot reach Moonraker.

import type {
  BackendService,
  BackendEvents,
  ConnectionPhase,
  FileEntry,
  GcodeMetadata,
  HistoryJob,
  WebcamInfo,
} from './types';

const now = () => Date.now() / 1000;

interface SimState {
  hot: number;
  hotTarget: number;
  bed: number;
  bedTarget: number;
  chamber: number;
  mcu: number;
  progress: number; // 0..1
  printDuration: number;
  paused: boolean;
  shutdown: boolean;
  fan: number; // 0..1
  x: number;
  y: number;
  z: number;
  speedFactor: number;
  extrudeFactor: number;
}

const DEMO_FILES: FileEntry[] = [
  { path: 'mercy_bracket_v3.gcode', modified: now() - 3600, size: 4_400_000, isDir: false },
  { path: 'cfs_hub_cover_x4.gcode', modified: now() - 14_000, size: 10_200_000, isDir: false },
  { path: 'eddy_mount_v8.gcode', modified: now() - 200_000, size: 2_000_000, isDir: false },
  { path: 'calibration_tower_220.gcode', modified: now() - 300_000, size: 2_700_000, isDir: false },
  { path: 'toolhead_fan_duct.gcode', modified: now() - 420_000, size: 3_200_000, isDir: false },
];

const DEMO_MACRO_HELP: Record<string, string> = {
  START_PRINT: 'Start a print: heat, home, z-tilt, mesh, purge',
  Z_TILT_ADJUST: 'Level the gantry against both z steppers',
  BED_MESH_CALIBRATE: 'Probe the bed and build a mesh',
  CLEAN_NOZZLE: 'Purge and wipe at the brush',
  SHAPER_CALIBRATE: 'Run input shaper on X and/or Y',
  CUT_FILAMENT: 'Cut at the stopper',
  CFS_LOAD: 'Load a CFS slot: UNIT= SLOT=',
  CFS_UNLOAD: 'Unload the active slot',
  CFS_INITIALIZE: 'Re-detect CFS boxes on the RS485 bus',
  SET_PAUSE_AT_LAYER: 'Pause when a layer is reached: LAYER=',
  M600: 'Filament change',
};

export class DemoBackend implements BackendService {
  private sim: SimState = {
    hot: 24,
    hotTarget: 215,
    bed: 23,
    bedTarget: 60,
    chamber: 27,
    mcu: 38,
    progress: 0.47,
    printDuration: 4320,
    paused: false,
    shutdown: false,
    fan: 0.4,
    x: 110,
    y: 110,
    z: 16.8,
    speedFactor: 1,
    extrudeFactor: 1,
  };
  private timer: number | null = null;
  private listeners: { [E in keyof BackendEvents]: Set<BackendEvents[E]> } = {
    status: new Set(),
    connection: new Set(),
    gcodeResponse: new Set(),
  };
  private _phase: ConnectionPhase = 'disconnected';

  get phase(): ConnectionPhase {
    return this._phase;
  }

  async connect(): Promise<void> {
    this.setPhase('connecting');
    await new Promise((r) => window.setTimeout(r, 120));
    this.setPhase('ready');
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 1000);
  }

  disconnect(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.setPhase('disconnected');
  }

  async subscribe(): Promise<void> {
    this.tick(); // emit a full snapshot immediately
  }

  on<E extends keyof BackendEvents>(event: E, handler: BackendEvents[E]): () => void {
    this.listeners[event].add(handler);
    return () => this.listeners[event].delete(handler);
  }

  async gcode(script: string): Promise<void> {
    const s = this.sim;
    const up = script.toUpperCase();
    const num = (re: RegExp): number | null => {
      const m = up.match(re);
      return m ? parseFloat(m[1]) : null;
    };
    if (up.startsWith('FIRMWARE_RESTART') || up.startsWith('RESTART')) {
      s.shutdown = false;
      s.hotTarget = 215;
      s.bedTarget = 60;
      this.setPhase('ready');
    } else if (up.startsWith('M104') || (up.startsWith('SET_HEATER_TEMPERATURE') && up.includes('EXTRUDER'))) {
      s.hotTarget = num(/(?:S|TARGET=)(\d+(?:\.\d+)?)/) ?? s.hotTarget;
    } else if (up.startsWith('M140') || (up.startsWith('SET_HEATER_TEMPERATURE') && up.includes('HEATER_BED'))) {
      s.bedTarget = num(/(?:S|TARGET=)(\d+(?:\.\d+)?)/) ?? s.bedTarget;
    } else if (up.startsWith('TURN_OFF_HEATERS')) {
      s.hotTarget = 0;
      s.bedTarget = 0;
    } else if (up.startsWith('M220')) {
      s.speedFactor = (num(/S(\d+)/) ?? 100) / 100;
    } else if (up.startsWith('M221')) {
      s.extrudeFactor = (num(/S(\d+)/) ?? 100) / 100;
    } else if (up.startsWith('M106')) {
      s.fan = (num(/S(\d+)/) ?? 255) / 255;
    } else if (up.startsWith('PAUSE')) {
      s.paused = true;
    } else if (up.startsWith('RESUME')) {
      s.paused = false;
    } else if (up.startsWith('CANCEL_PRINT')) {
      s.progress = 0;
      s.paused = false;
    }
    this.respond('// demo: ' + script.split('\n').join(' · '));
    this.respond('ok');
    this.tick();
  }

  async emergencyStop(): Promise<void> {
    this.sim.shutdown = true;
    this.sim.hotTarget = 0;
    this.sim.bedTarget = 0;
    this.setPhase('klippy-shutdown');
    this.respond('!! emergency stop: klippy is shut down');
  }

  async listObjects(): Promise<string[]> {
    return [
      'toolhead',
      'gcode_move',
      'motion_report',
      'extruder',
      'heater_bed',
      'temperature_sensor chamber',
      'temperature_sensor mcu_toolhead',
      'fan',
      'heater_fan hotend_fan',
      'print_stats',
      'display_status',
      'virtual_sdcard',
      'filament_switch_sensor runout',
      'creality_cfs',
      'save_variables',
      'webhooks',
    ];
  }

  async gcodeHelp(): Promise<Record<string, string>> {
    return DEMO_MACRO_HELP;
  }

  async listWebcams(): Promise<WebcamInfo[]> {
    return [{ name: 'hi', service: 'mjpegstreamer', streamUrl: '/webcam/?action=stream', snapshotUrl: '/webcam/?action=snapshot', aspect: '16:9' }];
  }

  print = {
    start: async (filename: string): Promise<void> => {
      this.sim.progress = 0.001;
      this.sim.printDuration = 0;
      this.sim.paused = false;
      this.printingFile = filename;
      this.tick();
    },
    pause: async (): Promise<void> => {
      this.sim.paused = true;
      this.tick();
    },
    resume: async (): Promise<void> => {
      this.sim.paused = false;
      this.tick();
    },
    cancel: async (): Promise<void> => {
      this.sim.progress = 0;
      this.printingFile = null;
      this.tick();
    },
  };

  private printingFile: string | null = 'mercy_bracket_v3.gcode';

  files = {
    list: async (): Promise<FileEntry[]> => DEMO_FILES,
    metadata: async (filename: string): Promise<GcodeMetadata> => ({
      estimatedTime: 9240,
      filamentTotal: 8400,
      slicer: 'OrcaSlicer',
      thumbnails: [],
      filename,
    }),
    upload: async (): Promise<void> => undefined,
    download: async (): Promise<Blob> => new Blob(['; demo gcode\n']),
    delete: async (): Promise<void> => undefined,
    read: async (_root: string, path: string): Promise<string> =>
      `# demo config: ${path}\n[printer]\nkinematics: cartesian\nmax_velocity: 500\nmax_accel: 12000\n`,
    write: async (): Promise<void> => undefined,
  };

  history = {
    list: async (): Promise<HistoryJob[]> => [
      { jobId: '1', filename: 'cfs_hub_cover_x4.gcode', startTime: now() - 40_000, printDuration: 18_540, filamentUsed: 22_000, status: 'completed' },
      { jobId: '2', filename: 'eddy_mount_v8.gcode', startTime: now() - 220_000, printDuration: 4_020, filamentUsed: 3_600, status: 'completed' },
      { jobId: '3', filename: 'calibration_tower_220.gcode', startTime: now() - 320_000, printDuration: 1_320, filamentUsed: 1_100, status: 'cancelled' },
      { jobId: '4', filename: 'toolhead_fan_duct.gcode', startTime: now() - 400_000, printDuration: 7_440, filamentUsed: 6_800, status: 'completed' },
    ],
    totals: async (): Promise<Record<string, number>> => ({
      total_jobs: 76,
      total_time: 761_520,
      total_print_time: 745_800,
      total_filament_used: 2_410_000,
      longest_job: 50_760,
    }),
  };

  machine = {
    systemInfo: async (): Promise<Record<string, unknown>> => ({
      system_info: {
        cpu_info: { cpu_desc: 'Raspberry Pi 4 Model B (demo)', total_memory: 7_812_000 },
        distribution: { name: 'Debian GNU/Linux 12 (demo)' },
      },
    }),
    procStats: async (): Promise<Record<string, unknown>> => ({
      system_cpu_usage: { cpu: 31 },
      system_memory: { total: 7_812_000, used: 1_950_000 },
    }),
    updateStatus: async (): Promise<Record<string, unknown>> => ({
      version_info: {
        klipper: { version: 'v0.13.0-701', remote_version: 'v0.13.0-701' },
        moonraker: { version: 'v0.10.0', remote_version: 'v0.10.0' },
        crowsnest: { version: 'v4.1.9', remote_version: 'v4.1.9' },
        system: { configured_type: 'system', package_count: 0, package_list: [] },
      },
    }),
    // Simulates the rig finding: the cached status above says everything is
    // current, but a real remote refresh discovers a klipper bump and pending
    // apt packages. Slow on purpose so the spinner path is exercised.
    updateRefresh: async (): Promise<Record<string, unknown>> => {
      await new Promise((r) => window.setTimeout(r, 1500));
      return {
        version_info: {
          klipper: { version: 'v0.13.0-701', remote_version: 'v0.13.0-707' },
          moonraker: { version: 'v0.10.0', remote_version: 'v0.10.0' },
          crowsnest: { version: 'v4.1.9', remote_version: 'v4.1.9' },
          system: { configured_type: 'system', package_count: 65, package_list: [] },
        },
      };
    },
    updateAction: async (): Promise<void> => undefined,
    shutdown: async (): Promise<void> => undefined,
    reboot: async (): Promise<void> => undefined,
    queryEndstops: async (): Promise<Record<string, string>> => ({
      x: 'open',
      y: 'open',
      z: 'open',
      z2: 'TRIGGERED',
    }),
  };

  // ---- simulator ----
  private tick(): void {
    const s = this.sim;
    const approach = (v: number, target: number, rate: number, jitter: number) =>
      target <= 0 ? Math.max(24, v - 2.2) : v + (target - v) * rate + (Math.random() - 0.5) * jitter;
    s.hot = approach(s.hot, s.shutdown ? 0 : s.hotTarget, 0.12, 0.7);
    s.bed = approach(s.bed, s.shutdown ? 0 : s.bedTarget, 0.06, 0.25);
    s.chamber = 38 + Math.sin(Date.now() / 9000) * 0.6;
    s.mcu = 47 + Math.sin(Date.now() / 7000) * 0.9;

    const printing = this.printingFile !== null && !s.paused && !s.shutdown && s.progress > 0 && s.progress < 1;
    if (printing) {
      s.progress = Math.min(0.999, s.progress + 0.00018);
      s.printDuration += 1;
      const t = Date.now() / 1000;
      s.x = 110 + Math.sin(t * 1.9) * 70;
      s.y = 110 + Math.cos(t * 1.3) * 70;
      s.z = Math.round(180 * s.progress) * 0.2;
    }

    const state = s.shutdown ? 'error' : this.printingFile === null || s.progress <= 0 ? 'standby' : s.paused ? 'paused' : 'printing';

    this.emit('status', {
      toolhead: {
        position: [s.x, s.y, s.z, 0],
        homed_axes: 'xyz',
        max_velocity: 500,
        max_accel: 12000,
      },
      gcode_move: {
        gcode_position: [s.x, s.y, s.z, 0],
        speed_factor: s.speedFactor,
        extrude_factor: s.extrudeFactor,
        homing_origin: [0, 0, 0.125, 0],
      },
      motion_report: { live_position: [s.x, s.y, s.z, 0] },
      extruder: { temperature: s.hot, target: s.shutdown ? 0 : s.hotTarget, power: s.hotTarget > 0 ? 0.62 : 0, pressure_advance: 0.042, smooth_time: 0.04 },
      heater_bed: { temperature: s.bed, target: s.shutdown ? 0 : s.bedTarget, power: s.bedTarget > 0 ? 0.38 : 0 },
      'temperature_sensor chamber': { temperature: s.chamber },
      'temperature_sensor mcu_toolhead': { temperature: s.mcu },
      fan: { speed: s.fan, rpm: null },
      'heater_fan hotend_fan': { speed: 1, rpm: 5820 },
      'filament_switch_sensor runout': { filament_detected: true, enabled: true },
      print_stats: {
        filename: this.printingFile ?? '',
        state,
        print_duration: s.printDuration,
        total_duration: s.printDuration + 600,
        info: { current_layer: Math.max(1, Math.round(180 * s.progress)), total_layer: 180 },
      },
      display_status: { progress: s.progress, message: '' },
      virtual_sdcard: { progress: s.progress, is_active: printing },
      creality_cfs: {
        is_connected: true,
        box_count: 1,
        active_tool: 0,
        slots: {
          '0': { present: true, material: 'PLA', remain: 62 },
          '1': { present: true, material: 'PETG', remain: 88 },
          '2': { present: true, material: 'PLA', remain: 34 },
          '3': { present: true, material: 'PLA', remain: 91 },
        },
      },
      save_variables: {
        variables: {
          cfs1_slot1_name: 'Mercy Cyan',
          cfs1_slot1_color: '#2bcdf2',
          cfs1_slot2_name: 'Carbon Black',
          cfs1_slot2_color: '#4a4d55',
          cfs1_slot3_name: 'Ember Orange',
          cfs1_slot3_color: '#ff8a4c',
          cfs1_slot4_name: 'Ghost White',
          cfs1_slot4_color: '#e8eaf0',
        },
      },
    });
  }

  private respond(line: string): void {
    this.listeners.gcodeResponse.forEach((h) => h(line));
  }

  private setPhase(phase: ConnectionPhase): void {
    this._phase = phase;
    this.listeners.connection.forEach((h) => h(phase));
  }

  private emit<E extends keyof BackendEvents>(event: E, ...args: Parameters<BackendEvents[E]>): void {
    this.listeners[event].forEach((h) => (h as (...a: unknown[]) => void)(...args));
  }
}

export function createDemoBackend(): BackendService {
  return new DemoBackend();
}
