// connection slice: socket + klippy status and the reconnect backoff.
//
// Drives the top-bar connection pill and the status banner. The backend adapter
// (src/api/moonraker.ts) pushes phase changes here via its 'connection' event.

import type { StateCreator } from 'zustand';
import type { ConnectionPhase } from '../api/types';
import type { LiveStore } from './index';

export type BackendKind = 'moonraker' | 'demo';

export interface ConnectionSlice {
  phase: ConnectionPhase;
  // Which adapter is live. 'demo' runs the simulator so the screen is never
  // blank; the top-bar pill renders DEMO vs LIVE from this.
  kind: BackendKind;
  backoffMs: number;         // current exponential backoff between reconnects
  lastError: string | null;
  setPhase: (phase: ConnectionPhase) => void;
  setKind: (kind: BackendKind) => void;
  setBackoff: (ms: number) => void;
  setError: (message: string | null) => void;
}

export const createConnectionSlice: StateCreator<LiveStore, [], [], ConnectionSlice> = (set) => ({
  phase: 'disconnected',
  kind: 'demo',
  backoffMs: 1000,
  lastError: null,
  setPhase: (phase) => set({ phase }),
  setKind: (kind) => set({ kind }),
  setBackoff: (backoffMs) => set({ backoffMs }),
  setError: (lastError) => set({ lastError }),
});
