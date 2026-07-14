// job slice: the current print job.
//
// Fed from print_stats, virtual_sdcard, and display_status. The dashboard print
// card and the top-bar progress read from here.

import type { StateCreator } from 'zustand';
import type { LiveStore } from './index';

export type JobState =
  | 'standby'
  | 'printing'
  | 'paused'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface JobSlice {
  filename: string | null;
  state: JobState;
  progress: number;          // 0..1 (from virtual_sdcard.progress / display_status)
  printDuration: number;     // seconds elapsed printing
  totalDuration: number;     // seconds since start incl. heat-up
  estimatedTime: number | null; // from gcode metadata
  currentLayer: number | null;
  totalLayers: number | null;
  setJob: (partial: Partial<Omit<JobSlice, 'setJob' | 'resetJob'>>) => void;
  resetJob: () => void;
}

const EMPTY: Omit<JobSlice, 'setJob' | 'resetJob'> = {
  filename: null,
  state: 'standby',
  progress: 0,
  printDuration: 0,
  totalDuration: 0,
  estimatedTime: null,
  currentLayer: null,
  totalLayers: null,
};

export const createJobSlice: StateCreator<LiveStore, [], [], JobSlice> = (set) => ({
  ...EMPTY,
  setJob: (partial) => set(partial),
  resetJob: () => set(EMPTY),
});
