// The live store: printer state, temps, job, and connection composed into one
// Zustand store. High-frequency and ephemeral. The persisted app config lives
// in a separate store (./config.ts) so a temperature tick never touches disk.

import { create } from 'zustand';
import { createPrinterStateSlice, type PrinterStateSlice } from './printerState';
import { createTempsSlice, type TempsSlice } from './temps';
import { createJobSlice, type JobSlice } from './job';
import { createConnectionSlice, type ConnectionSlice } from './connection';
import { createNotificationsSlice, type NotificationsSlice } from './notifications';

export type LiveStore = PrinterStateSlice & TempsSlice & JobSlice & ConnectionSlice & NotificationsSlice;

export const useLiveStore = create<LiveStore>()((...a) => ({
  ...createPrinterStateSlice(...a),
  ...createTempsSlice(...a),
  ...createJobSlice(...a),
  ...createConnectionSlice(...a),
  ...createNotificationsSlice(...a),
}));

// Re-export the config store so callers have one import site for state.
export { useConfig } from './config';
