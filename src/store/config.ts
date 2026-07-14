// config slice: the persisted app configuration.
//
// This is a separate store from the live printer state because it changes rarely
// and must survive reloads. It is persisted to localStorage here. The handoff
// (section 2.3) also wants it mirrored to a shared home (Moonraker database or a
// namespaced stonelabs-ui.json) so a kiosk and a phone agree; that sync is a
// TODO, localStorage is the first pass. Pick and document one home before ship.
//
// Everything the first-run wizard collects lives here, and the Settings page
// edits the same fields.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PROFILE_ID } from '../profiles';
import { DEFAULT_THEME, DEFAULT_MODE, applyTheme } from '../theme/tokens';
import type { ThemeId, ModeId } from '../theme/tokens';

const DEFAULT_WEBCAM: WebcamConfig = { enabled: false, name: 'Webcam', streamUrl: '', snapshotUrl: '', service: 'mjpeg', aspect: '16:9' };

export interface WebcamConfig {
  enabled: boolean;
  name: string;
  streamUrl: string;   // crowsnest / MJPEG source
  snapshotUrl: string; // for the snapshot poll mode
  service: 'mjpeg' | 'snapshot' | 'webrtc';
  aspect: string;      // e.g. '16:9'
}

export type InterfaceKind = 'touchscreen' | 'web' | 'both';

export type ConnectionMode = 'auto' | 'live' | 'demo';

// Dashboard layout: the prototype's preset + per-module overrides model.
// Presets are arrangements; 'custom' keeps whatever overrides exist.
export type DashPreset = 'parity' | 'cockpit' | 'deck' | 'custom';
export type ModuleSize = 'S' | 'M' | 'L' | 'W';

export interface DashboardLayout {
  preset: DashPreset;
  // The preset a 'custom' arrangement started from; untouched modules keep its
  // sizes, order, and hidden defaults instead of snapping to parity.
  base?: Exclude<DashPreset, 'custom'>;
  hidden: Record<string, boolean>;      // moduleKey -> hidden override
  sizes: Record<string, ModuleSize>;    // moduleKey -> size override
}

export interface ConsolePrefs {
  newestTop: boolean;
  inputTop: boolean;
  hideTempPolls: boolean;
  timestamps: boolean;
  // Page arrangement: console alone, or console with side modules
  // (webcam / toolhead / temps), matching the prototype's five configs.
  layout: 'full' | '1x2' | '1x3' | 'combo' | 'quad';
}

// A saved printer for the top-bar switcher. Switching writes host + profile
// into the active fields and reconnects; the schema stays single-active so
// every existing consumer keeps reading moonrakerHost/profileId. Cameras are
// scoped PER PRINTER: switching away stashes the working webcam/cameras set
// on the entry, switching back restores it — otherwise the Webcam page keeps
// pointing at the previous printer's stream and Detect on B overwrites A's
// list.
export interface SavedPrinter {
  name: string;
  host: string;         // '' = same origin
  profileId: string;
  webcam?: WebcamConfig;
  cameras?: WebcamConfig[];
}

export interface InterfaceConfig {
  kind: InterfaceKind;
  screenSize?: string;        // e.g. '7in'
  resolution?: string;        // e.g. '1024x600'
  attachedToHost?: boolean;   // screen wired to the printer host vs a separate SBC
  displayOutput?: string;     // HDMI0 / HDMI1 when attachedToHost
  printerIp?: string;         // when the kiosk is a separate SBC connecting over the network
}

export interface ConfigState {
  // Moonraker connection target.
  moonrakerHost: string;
  connectionMode: ConnectionMode;

  // Wizard result + the permanent Settings values.
  profileId: string;
  theme: ThemeId;
  mode: ModeId;
  logo: string | null;            // data URL or served path; null = show printer name
  webcam: WebcamConfig;
  ui: InterfaceConfig;
  dashboard: DashboardLayout;
  console: ConsolePrefs;
  printers: SavedPrinter[];
  // Every camera this install knows about; webcam (above) is the ACTIVE one.
  // Populated by hand or from Moonraker's /server/webcams/list.
  cameras: WebcamConfig[];
  wizardCompleted: boolean;

  // actions
  setProfile: (id: string) => void;
  setTheme: (theme: ThemeId) => void;
  setMode: (mode: ModeId) => void;
  setLogo: (logo: string | null) => void;
  setWebcam: (patch: Partial<WebcamConfig>) => void;
  setInterface: (patch: Partial<InterfaceConfig>) => void;
  setMoonrakerHost: (host: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setDashboard: (patch: Partial<DashboardLayout>) => void;
  setConsolePrefs: (patch: Partial<ConsolePrefs>) => void;
  // Upsert the active host+profile as a saved printer (wizard finish does
  // this); switch activates a saved printer's host + profile.
  saveCurrentPrinter: () => void;
  switchPrinter: (index: number) => void;
  removePrinter: (index: number) => void;
  setCameras: (cameras: WebcamConfig[]) => void;
  // Make cameras[index] the active webcam (keeps its enabled flag).
  selectCamera: (index: number) => void;
  // Remove cameras[index]; if it was the active webcam, re-point the active
  // webcam at the first remaining camera so the pickers and the Webcam page
  // stay in sync.
  removeCamera: (index: number) => void;
  completeWizard: () => void;
  resetWizard: () => void;
}

export const useConfig = create<ConfigState>()(
  persist(
    (set) => ({
      moonrakerHost: '',
      connectionMode: 'auto',
      profileId: DEFAULT_PROFILE_ID,
      theme: DEFAULT_THEME,
      mode: DEFAULT_MODE,
      logo: null,
      webcam: DEFAULT_WEBCAM,
      ui: { kind: 'web' },
      dashboard: { preset: 'parity', hidden: {}, sizes: {} },
      console: { newestTop: false, inputTop: false, hideTempPolls: true, timestamps: true, layout: 'combo' },
      printers: [],
      cameras: [],
      wizardCompleted: false,

      setProfile: (profileId) => set({ profileId }),
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme, useConfig.getState().mode);
      },
      setMode: (mode) => {
        set({ mode });
        applyTheme(useConfig.getState().theme, mode);
      },
      setLogo: (logo) => set({ logo }),
      setWebcam: (patch) => set((s) => ({ webcam: { ...s.webcam, ...patch } })),
      setInterface: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
      setMoonrakerHost: (moonrakerHost) => set({ moonrakerHost }),
      setConnectionMode: (connectionMode) => set({ connectionMode }),
      setDashboard: (patch) => set((s) => ({ dashboard: { ...s.dashboard, ...patch } })),
      setConsolePrefs: (patch) => set((s) => ({ console: { ...s.console, ...patch } })),
      saveCurrentPrinter: () =>
        set((s) => {
          const entry: SavedPrinter = { name: s.profileId, host: s.moonrakerHost, profileId: s.profileId, webcam: s.webcam, cameras: s.cameras };
          const i = s.printers.findIndex((p) => p.host === entry.host && p.profileId === entry.profileId);
          if (i >= 0) {
            // Upsert: refresh the stored camera snapshot for an existing entry.
            const printers = [...s.printers];
            printers[i] = { ...printers[i], ...entry };
            return { printers };
          }
          return { printers: [...s.printers, entry] };
        }),
      switchPrinter: (index) =>
        set((s) => {
          const p = s.printers[index];
          if (!p) return {};
          // Stash the outgoing printer's camera set on its entry, then load
          // the target's. Cameras are per-printer state, not install state.
          const printers = s.printers.map((e) =>
            e.host === s.moonrakerHost && e.profileId === s.profileId ? { ...e, webcam: s.webcam, cameras: s.cameras } : e,
          );
          return {
            printers,
            moonrakerHost: p.host,
            profileId: p.profileId,
            webcam: p.webcam ?? DEFAULT_WEBCAM,
            cameras: p.cameras ?? [],
          };
        }),
      removePrinter: (index) => set((s) => ({ printers: s.printers.filter((_, i) => i !== index) })),
      setCameras: (cameras) => set({ cameras }),
      selectCamera: (index) =>
        set((s) => {
          const cam = s.cameras[index];
          if (!cam) return {};
          return { webcam: { ...cam, enabled: s.webcam.enabled } };
        }),
      removeCamera: (index) =>
        set((s) => {
          const removed = s.cameras[index];
          const cameras = s.cameras.filter((_, i) => i !== index);
          if (!removed || removed.streamUrl !== s.webcam.streamUrl) return { cameras };
          const next = cameras[0];
          return { cameras, webcam: next ? { ...next, enabled: s.webcam.enabled } : s.webcam };
        }),
      completeWizard: () => set({ wizardCompleted: true }),
      resetWizard: () => set({ wizardCompleted: false }),
    }),
    {
      name: 'stonelabs-ui-config',
      // On rehydrate, push the saved theme onto :root so there is no flash.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme, state.mode);
      },
    },
  ),
);
