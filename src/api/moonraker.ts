// Moonraker client. Implements the BackendService interface from ./types.ts
// over Moonraker's two transports:
//
//   WebSocket (JSON-RPC 2.0)  -> ws(s)://<host>/websocket   : live state.
//   REST (HTTP)               -> http(s)://<host>/...        : one-shot + files.
//
// Reconnect: exponential backoff (1s doubling to a 15s cap), phase pushed to
// the connection slice via the 'connection' event. Subscriptions re-issue on
// every reconnect and on notify_klippy_ready. Gcode scripts issued while the
// socket is down go into a queue and flush on reopen; every other call rejects
// so the caller can surface the failure.
//
// CORS reminder: the served origin must be in Moonraker's cors_domains or
// every REST call fails. In dev, vite.config.ts proxies these prefixes so the
// browser talks same-origin (host '' means same-origin here).

import type {
  BackendService,
  BackendEvents,
  ConnectionPhase,
  FileEntry,
  GcodeMetadata,
  HistoryJob,
  WebcamInfo,
} from './types';

export interface MoonrakerConfig {
  // Base host, e.g. 'http://printer.local:7125'. '' = same-origin.
  host: string;
  apiKey?: string;
}

interface RpcPending {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: number;
}

// Encode each path segment: filenames with #, ?, or % otherwise target the
// wrong URL and delete/download silently 404.
function encPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

const RPC_TIMEOUT_MS = 10_000;
const BACKOFF_START_MS = 1_000;
const BACKOFF_CAP_MS = 15_000;

export class MoonrakerClient implements BackendService {
  private cfg: MoonrakerConfig;
  private socket: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, RpcPending>();
  private queue: string[] = [];
  private subs: Record<string, string[] | null> = {};
  private closedByUser = false;
  private backoffMs = BACKOFF_START_MS;
  private reconnectTimer: number | null = null;
  private listeners: { [E in keyof BackendEvents]: Set<BackendEvents[E]> } = {
    status: new Set(),
    connection: new Set(),
    gcodeResponse: new Set(),
  };
  private _phase: ConnectionPhase = 'disconnected';

  constructor(cfg: MoonrakerConfig) {
    this.cfg = cfg;
  }

  get phase(): ConnectionPhase {
    return this._phase;
  }

  // ---- lifecycle ----
  async connect(): Promise<void> {
    this.closedByUser = false;
    this.setPhase('connecting');
    await this.openSocket();
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
    this.setPhase('disconnected');
  }

  private wsUrl(): string {
    if (!this.cfg.host) {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://${window.location.host}/websocket`;
    }
    return this.cfg.host.replace(/^http/, 'ws').replace(/\/$/, '') + '/websocket';
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(this.wsUrl());
      this.socket = ws;

      ws.onopen = async () => {
        settled = true;
        this.backoffMs = BACKOFF_START_MS;
        try {
          const info = (await this.rpc('server.info')) as { klippy_state?: string };
          this.applyKlippyState(info?.klippy_state);
        } catch {
          this.setPhase('connecting');
        }
        // Re-issue subscriptions from before the drop, then flush queued gcode.
        if (Object.keys(this.subs).length > 0) {
          this.subscribe(this.subs).catch(() => {});
        }
        const q = this.queue.splice(0);
        for (const script of q) this.gcode(script).catch(() => {});
        resolve();
      };

      ws.onmessage = (ev) => this.onMessage(ev);

      ws.onclose = () => {
        this.failPending(new Error('moonraker: socket closed'));
        if (this.closedByUser) return;
        this.setPhase('disconnected');
        this.scheduleReconnect();
        if (!settled) {
          settled = true;
          reject(new Error('moonraker: could not open the websocket'));
        }
      };

      ws.onerror = () => {
        // onclose follows and handles reconnect + rejection.
      };
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_CAP_MS);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.setPhase('connecting');
      this.openSocket().catch(() => {});
    }, delay);
  }

  private applyKlippyState(state: string | undefined): void {
    if (state === 'ready') this.setPhase('ready');
    else if (state === 'shutdown') this.setPhase('klippy-shutdown');
    // Klipper's "error" state (config/MCU/heater fault) behaves like shutdown
    // for the UI: show the banner + FIRMWARE_RESTART, not a spinner. Matters
    // when the socket opens while Klipper is already errored, since klippy
    // notifications only fire on transitions.
    else if (state === 'error') this.setPhase('klippy-shutdown');
    else if (state === 'disconnected') this.setPhase('klippy-disconnected');
    else this.setPhase('connecting');
  }

  private onMessage(ev: MessageEvent): void {
    let msg: {
      id?: number;
      result?: unknown;
      error?: { message?: string };
      method?: string;
      params?: unknown[];
    };
    try {
      msg = JSON.parse(ev.data as string);
    } catch {
      return;
    }

    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      window.clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message ?? 'moonraker rpc error'));
      else p.resolve(msg.result);
      return;
    }

    switch (msg.method) {
      case 'notify_status_update': {
        const update = (msg.params?.[0] ?? {}) as Record<string, Record<string, unknown>>;
        this.emit('status', update);
        break;
      }
      case 'notify_gcode_response':
        this.emit('gcodeResponse', String(msg.params?.[0] ?? ''));
        break;
      case 'notify_klippy_ready':
        this.setPhase('ready');
        if (Object.keys(this.subs).length > 0) this.subscribe(this.subs).catch(() => {});
        break;
      case 'notify_klippy_shutdown':
        this.setPhase('klippy-shutdown');
        break;
      case 'notify_klippy_disconnected':
        this.setPhase('klippy-disconnected');
        break;
      default:
        break;
    }
  }

  private failPending(err: Error): void {
    for (const p of this.pending.values()) {
      window.clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  private rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('moonraker: not connected'));
        return;
      }
      const id = this.nextId++;
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`moonraker: ${method} timed out after ${RPC_TIMEOUT_MS / 1000}s`));
      }, RPC_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ jsonrpc: '2.0', method, params: params ?? {}, id }));
    });
  }

  // ---- REST ----
  private httpBase(): string {
    return this.cfg.host.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    return this.cfg.apiKey ? { 'X-Api-Key': this.cfg.apiKey } : {};
  }

  private async http<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.httpBase() + path, { ...init, headers: { ...this.headers(), ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(`moonraker: ${path} returned ${res.status}`);
    const body = (await res.json()) as { result: T };
    return body.result;
  }

  // ---- live state ----
  async subscribe(objects: Record<string, string[] | null>): Promise<void> {
    this.subs = { ...this.subs, ...objects };
    const result = (await this.rpc('printer.objects.subscribe', { objects: this.subs })) as {
      status?: Record<string, Record<string, unknown>>;
    };
    if (result?.status) this.emit('status', result.status);
  }

  on<E extends keyof BackendEvents>(event: E, handler: BackendEvents[E]): () => void {
    this.listeners[event].add(handler);
    return () => this.listeners[event].delete(handler);
  }

  // ---- commands ----
  async gcode(script: string): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Survive a brief drop: queue and flush on reconnect.
      this.queue.push(script);
      return;
    }
    await this.rpc('printer.gcode.script', { script });
  }

  async emergencyStop(): Promise<void> {
    await this.rpc('printer.emergency_stop');
  }

  async listObjects(): Promise<string[]> {
    const result = (await this.rpc('printer.objects.list')) as { objects?: string[] };
    return result?.objects ?? [];
  }

  async gcodeHelp(): Promise<Record<string, string>> {
    return ((await this.rpc('printer.gcode.help')) ?? {}) as Record<string, string>;
  }

  async listWebcams(): Promise<WebcamInfo[]> {
    const result = await this.http<{ webcams?: Record<string, unknown>[] }>('/server/webcams/list');
    // Moonraker returns RELATIVE stream URLs (e.g. /webcam/?action=stream)
    // that are only valid on the PRINTER's origin. Stored verbatim they end up
    // resolving against the UI origin (kiosk on :8088, dev server on :5173)
    // and break on any cross-origin deployment. Absolutize against the
    // configured host; keep relative only when host is blank (same-origin
    // install, or the vite dev proxy's /webcam route).
    const abs = (url: string): string => {
      const base = this.httpBase();
      if (!base || !url || /^(?:https?|wss?):\/\//i.test(url)) return url;
      return url.startsWith('/') ? base + url : `${base}/${url}`;
    };
    return (result.webcams ?? []).map((w) => ({
      name: String(w.name ?? 'camera'),
      service: String(w.service ?? ''),
      streamUrl: abs(String(w.stream_url ?? '')),
      snapshotUrl: abs(String(w.snapshot_url ?? '')),
      aspect: String(w.aspect_ratio ?? '16:9'),
    }));
  }

  print = {
    start: async (filename: string): Promise<void> => {
      await this.rpc('printer.print.start', { filename });
    },
    pause: async (): Promise<void> => {
      await this.rpc('printer.print.pause');
    },
    resume: async (): Promise<void> => {
      await this.rpc('printer.print.resume');
    },
    cancel: async (): Promise<void> => {
      await this.rpc('printer.print.cancel');
    },
  };

  files = {
    // Directory listing with folders, via /server/files/directory.
    list: async (root: string, path?: string): Promise<FileEntry[]> => {
      const dir = path ? `${root}/${path}` : root;
      const result = await this.http<{
        dirs?: { dirname: string; modified: number; size: number }[];
        files?: { filename: string; modified: number; size: number }[];
      }>(`/server/files/directory?path=${encodeURIComponent(dir)}&extended=false`);
      const dirs: FileEntry[] = (result.dirs ?? [])
        .filter((d) => !d.dirname.startsWith('.'))
        .map((d) => ({ path: d.dirname, modified: d.modified, size: d.size, isDir: true }));
      const files: FileEntry[] = (result.files ?? []).map((f) => ({
        path: f.filename,
        modified: f.modified,
        size: f.size,
        isDir: false,
      }));
      return [...dirs, ...files];
    },
    metadata: async (filename: string): Promise<GcodeMetadata> => {
      const m = await this.http<Record<string, unknown>>(
        `/server/files/metadata?filename=${encodeURIComponent(filename)}`,
      );
      const thumbs = (m.thumbnails as { relative_path: string; width: number; height: number }[] | undefined) ?? [];
      return {
        ...m,
        estimatedTime: m.estimated_time as number | undefined,
        filamentTotal: m.filament_total as number | undefined,
        slicer: m.slicer as string | undefined,
        thumbnails: thumbs.map((t) => ({ relativePath: t.relative_path, width: t.width, height: t.height })),
      };
    },
    upload: async (root: string, path: string, data: Blob): Promise<void> => {
      const form = new FormData();
      form.append('root', root);
      form.append('file', new File([data], path.split('/').pop() ?? path));
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (dir) form.append('path', dir);
      const res = await fetch(this.httpBase() + '/server/files/upload', {
        method: 'POST',
        headers: this.headers(),
        body: form,
      });
      if (!res.ok) throw new Error(`moonraker: upload failed with ${res.status}`);
    },
    download: async (root: string, path: string): Promise<Blob> => {
      const res = await fetch(`${this.httpBase()}/server/files/${root}/${encPath(path)}`, { headers: this.headers() });
      if (!res.ok) throw new Error(`moonraker: download failed with ${res.status}`);
      return res.blob();
    },
    delete: async (root: string, path: string): Promise<void> => {
      const res = await fetch(`${this.httpBase()}/server/files/${root}/${encPath(path)}`, {
        method: 'DELETE',
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`moonraker: delete failed with ${res.status}`);
    },
    read: async (root: string, path: string): Promise<string> => {
      const res = await fetch(`${this.httpBase()}/server/files/${root}/${encPath(path)}`, { headers: this.headers() });
      if (!res.ok) throw new Error(`moonraker: read failed with ${res.status}`);
      return res.text();
    },
    write: async (root: string, path: string, text: string): Promise<void> => {
      await this.files.upload(root, path, new Blob([text], { type: 'text/plain' }));
    },
  };

  history = {
    list: async (): Promise<HistoryJob[]> => {
      const result = await this.http<{ jobs?: Record<string, unknown>[] }>(
        '/server/history/list?limit=100&order=desc',
      );
      return (result.jobs ?? []).map((j) => ({
        jobId: String(j.job_id ?? ''),
        filename: String(j.filename ?? ''),
        startTime: Number(j.start_time ?? 0),
        printDuration: Number(j.print_duration ?? 0),
        filamentUsed: Number(j.filament_used ?? 0),
        status: String(j.status ?? ''),
        ...j,
      }));
    },
    totals: async (): Promise<Record<string, number>> => {
      const result = await this.http<{ job_totals?: Record<string, number> }>('/server/history/totals');
      return result.job_totals ?? {};
    },
  };

  machine = {
    systemInfo: async (): Promise<Record<string, unknown>> =>
      this.http<Record<string, unknown>>('/machine/system_info'),
    procStats: async (): Promise<Record<string, unknown>> =>
      this.http<Record<string, unknown>>('/machine/proc_stats'),
    updateStatus: async (): Promise<Record<string, unknown>> =>
      this.http<Record<string, unknown>>('/machine/update/status?refresh=false'),
    // A REAL remote check. updateStatus(refresh=false) only re-reads
    // Moonraker's cached status, which can report "up to date" long after
    // remotes moved (verified on the rig: cache clean, refresh found
    // klipper 701->707 + 65 apt packages). Takes ~8s; Moonraker rejects it
    // mid-print, so callers gate on printActive().
    updateRefresh: async (): Promise<Record<string, unknown>> =>
      this.http<Record<string, unknown>>('/machine/update/refresh', { method: 'POST' }),
    updateAction: async (name: string): Promise<void> => {
      await this.http(`/machine/update/${encodeURIComponent(name)}`, { method: 'POST' });
    },
    shutdown: async (): Promise<void> => {
      await this.http('/machine/shutdown', { method: 'POST' });
    },
    reboot: async (): Promise<void> => {
      await this.http('/machine/reboot', { method: 'POST' });
    },
    queryEndstops: async (): Promise<Record<string, string>> =>
      ((await this.rpc('printer.query_endstops.status')) ?? {}) as Record<string, string>,
  };

  // ---- internals ----
  private setPhase(phase: ConnectionPhase): void {
    this._phase = phase;
    this.listeners.connection.forEach((h) => h(phase));
  }

  private emit<E extends keyof BackendEvents>(event: E, ...args: Parameters<BackendEvents[E]>): void {
    this.listeners[event].forEach((h) => (h as (...a: unknown[]) => void)(...args));
  }
}

export function createMoonrakerClient(cfg: MoonrakerConfig): BackendService {
  return new MoonrakerClient(cfg);
}
