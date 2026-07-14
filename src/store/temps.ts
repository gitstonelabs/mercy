// temps slice: a ring buffer for the temperature chart.
//
// The chart streams from this buffer, not from React state per tick, so a fast
// notify_status_update firehose does not thrash the tree. uPlot reads the
// arrays directly (see features/Temperatures.tsx). Keep a rolling window.

import type { StateCreator } from 'zustand';
import type { LiveStore } from './index';

export interface TempSeries {
  time: number[];    // unix seconds, ascending
  value: number[];   // measured temperature, deg C
  target: number[];  // target temperature, deg C
}

export interface TempsSlice {
  windowSeconds: number;                       // retain this many seconds (default 600)
  temps: Record<string, TempSeries>;           // keyed by sensor name
  pushTemp: (name: string, value: number, target: number, t?: number) => void;
  clearTemps: () => void;
}

// Trim samples older than the window from the front of a series.
function trim(series: TempSeries, windowSeconds: number, now: number): void {
  const cutoff = now - windowSeconds;
  let drop = 0;
  while (drop < series.time.length && series.time[drop] < cutoff) drop++;
  if (drop > 0) {
    series.time.splice(0, drop);
    series.value.splice(0, drop);
    series.target.splice(0, drop);
  }
}

export const createTempsSlice: StateCreator<LiveStore, [], [], TempsSlice> = (set) => ({
  windowSeconds: 600,
  temps: {},
  pushTemp: (name, value, target, t) =>
    set((s) => {
      const now = t ?? Date.now() / 1000;
      const prev = s.temps[name] ?? { time: [], value: [], target: [] };
      // Mutate the copied series in place, then trim to the window.
      const series: TempSeries = {
        time: [...prev.time, now],
        value: [...prev.value, value],
        target: [...prev.target, target],
      };
      trim(series, s.windowSeconds, now);
      return { temps: { ...s.temps, [name]: series } };
    }),
  clearTemps: () => set({ temps: {} }),
});
