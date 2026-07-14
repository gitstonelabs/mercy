// Backend service interface: the swappable seam.
//
// Components never call fetch() or touch a socket. They call typed methods on a
// BackendService. Today the only implementation is the Moonraker client
// (src/api/moonraker.ts). A PrusaLink/Marlin adapter would implement this same
// interface and be selected by the active profile's `remoteApi` field
// (src/profiles/schema.ts). No component changes when that adapter lands.
//
// Keep this interface transport-agnostic. Moonraker's WebSocket-vs-REST split
// is an implementation detail of the adapter, not something callers see.

export type ConnectionPhase =
  | 'connecting'
  | 'ready'
  | 'klippy-shutdown'
  | 'klippy-disconnected'
  | 'disconnected';

// One live status delta merged into the printer-state store. Keyed by Klipper
// object name (e.g. 'toolhead', 'extruder', 'heater_bed', 'creality_cfs'), each
// value a partial of that object's fields.
export type StatusUpdate = Record<string, Record<string, unknown>>;

// Events the adapter emits to the store. The Moonraker adapter maps its
// notify_* JSON-RPC methods onto these.
export interface BackendEvents {
  status: (update: StatusUpdate) => void;         // notify_status_update
  connection: (phase: ConnectionPhase) => void;   // klippy ready/shutdown/disconnected
  gcodeResponse: (line: string) => void;          // notify_gcode_response
}

export interface FileEntry {
  path: string;
  modified: number;
  size: number;
  isDir: boolean;
}

export interface GcodeMetadata {
  estimatedTime?: number;
  filamentTotal?: number;
  slicer?: string;
  thumbnails?: { relativePath: string; width: number; height: number }[];
  [k: string]: unknown;
}

export interface HistoryJob {
  jobId: string;
  filename: string;
  startTime: number;
  printDuration: number;
  filamentUsed: number;
  status: string;
  [k: string]: unknown;
}

// One camera from /server/webcams/list (crowsnest et al).
export interface WebcamInfo {
  name: string;
  service: string;      // e.g. 'mjpegstreamer', 'mjpegstreamer-adaptive', 'webrtc-camerastreamer'
  streamUrl: string;
  snapshotUrl: string;
  aspect: string;
}

// The service surface. Every method here is a stub in the Moonraker adapter for
// now; the signatures are the contract the panels build against.
export interface BackendService {
  // ---- lifecycle ----
  connect(): Promise<void>;
  disconnect(): void;
  readonly phase: ConnectionPhase;

  // ---- live state ----
  // Subscribe to a set of Klipper objects. Adapter sends the initial query and
  // then streams deltas via BackendEvents.status. `null` value means "all
  // fields of this object".
  subscribe(objects: Record<string, string[] | null>): Promise<void>;
  on<E extends keyof BackendEvents>(event: E, handler: BackendEvents[E]): () => void;

  // ---- commands ----
  gcode(script: string): Promise<void>;
  emergencyStop(): Promise<void>;
  // Names of every Klipper object (printer.objects.list). Used to build the
  // subscription set, since temperature_sensor/fan/led names vary per config.
  listObjects(): Promise<string[]>;
  // Macro name -> help string (printer.gcode.help). Drives the Macros card and
  // console autocomplete.
  gcodeHelp(): Promise<Record<string, string>>;

  // ---- print job ----
  // Cameras Moonraker knows about (/server/webcams/list). Settings uses this
  // to auto-populate the camera list so nobody types stream URLs.
  listWebcams(): Promise<WebcamInfo[]>;

  print: {
    start(filename: string): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    cancel(): Promise<void>;
  };

  // ---- files ----
  files: {
    list(root: string, path?: string): Promise<FileEntry[]>;
    metadata(filename: string): Promise<GcodeMetadata>;
    upload(root: string, path: string, data: Blob): Promise<void>;
    download(root: string, path: string): Promise<Blob>;
    delete(root: string, path: string): Promise<void>;
    read(root: string, path: string): Promise<string>;   // config-editor read
    write(root: string, path: string, text: string): Promise<void>; // config-editor save
  };

  // ---- history ----
  history: {
    list(): Promise<HistoryJob[]>;
    totals(): Promise<Record<string, number>>;
  };

  // ---- machine ----
  machine: {
    systemInfo(): Promise<Record<string, unknown>>;
    procStats(): Promise<Record<string, unknown>>;
    updateStatus(): Promise<Record<string, unknown>>;
    // Ask Moonraker to actually poll the remotes (POST /machine/update/refresh).
    // Slow (~8s) and rejected during a print; returns the refreshed status.
    updateRefresh(): Promise<Record<string, unknown>>;
    updateAction(name: string): Promise<void>;
    shutdown(): Promise<void>;
    reboot(): Promise<void>;
    queryEndstops(): Promise<Record<string, string>>;
  };
}
