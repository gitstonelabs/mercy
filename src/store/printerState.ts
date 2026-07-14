// printerState slice: the live merged Klipper object model.
//
// notify_status_update deltas from the backend are merged here field by field.
// Components read exactly the object.field they render with a selector, so a
// temperature tick does not re-render the macro grid (that is the whole reason
// for Zustand over Redux here; see the handoff section 2.3).

import type { StateCreator } from 'zustand';
import type { StatusUpdate } from '../api/types';
import type { LiveStore } from './index';

export interface PrinterStateSlice {
  // Keyed by Klipper object name -> its current fields. e.g.
  //   objects['toolhead'].position, objects['extruder'].temperature,
  //   objects['creality_cfs'].slots, objects['bed_mesh'].probed_matrix
  objects: Record<string, Record<string, unknown>>;
  // Merge one delta (shallow per object) into the model.
  applyStatus: (update: StatusUpdate) => void;
  // Drop everything on a klippy disconnect so stale values do not show.
  resetObjects: () => void;
}

export const createPrinterStateSlice: StateCreator<LiveStore, [], [], PrinterStateSlice> = (set) => ({
  objects: {},
  applyStatus: (update) =>
    set((s) => {
      const objects = { ...s.objects };
      for (const [name, fields] of Object.entries(update)) {
        objects[name] = { ...(objects[name] ?? {}), ...fields };
      }
      return { objects };
    }),
  resetObjects: () => set({ objects: {} }),
});
