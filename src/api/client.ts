// Single backend instance for the app, plus the demo fallback logic.
//
// connectionMode (persisted in config):
//   'auto'  try Moonraker; fall back to the demo simulator if the socket
//           cannot open. This is the v1 behavior: the screen is never blank.
//   'live'  Moonraker only. The connection banner shows failures.
//   'demo'  simulator only.
//
// When a PrusaLink/Marlin adapter exists, choose it here from the active
// profile's remoteApi (src/profiles/schema.ts). Panels import getBackend() and
// never know which adapter they got.

import { createMoonrakerClient } from './moonraker';
import { createDemoBackend } from './demo';
import type { BackendService } from './types';
import type { BackendKind } from '../store/connection';
import { useConfig } from '../store/config';

let instance: BackendService | null = null;
let kind: BackendKind = 'demo';

export function makeBackend(k: BackendKind): BackendService {
  kind = k;
  instance?.disconnect();
  instance =
    k === 'demo'
      ? createDemoBackend()
      : createMoonrakerClient({ host: useConfig.getState().moonrakerHost });
  return instance;
}

export function getBackend(): BackendService {
  if (!instance) {
    const mode = useConfig.getState().connectionMode;
    makeBackend(mode === 'demo' ? 'demo' : 'moonraker');
  }
  return instance!;
}

export function getBackendKind(): BackendKind {
  return kind;
}

// Drop the instance so the next getBackend() rebuilds it (e.g. after the user
// changes the Moonraker host or connection mode in Settings).
export function resetBackend(): void {
  instance?.disconnect();
  instance = null;
}
