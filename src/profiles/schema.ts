// Printer-profile schema. This is the config object that tells the UI what a
// printer is: geometry, temperature ceilings, kinematics, firmware family,
// leveling hardware, and feature flags. It drives the dashboard limits, the
// preset lists, the wizard, and (later) which backend adapter to use.
//
// Marlin-ready by design: `firmware` and `remoteApi` are separate fields, so a
// Buddy/PrusaLink printer is fully describable today even though only the
// Moonraker adapter is implemented. The backend service (src/api/types.ts) keys
// off `remoteApi` to choose an adapter. When a PrusaLink/Marlin adapter is added
// later, no profile changes.

export type Kinematics = 'bedslinger' | 'corexy' | 'idex';

// Which firmware the printer runs, and therefore which remote API and how
// reachable it is.
export type FirmwareFamily =
  | 'klipper-native'              // mainline Klipper + vanilla Moonraker. Works today.
  | 'klipper-fork-locked'        // Klipper fork (Creality OS): Moonraker present but may need root / a non-default port.
  | 'buddy-needs-klipper-reflash'; // Prusa Buddy. Needs a community Klipper reflash to use this UI. Not vendor supported.

// What the printer speaks natively. Only 'moonraker' is implemented.
export type RemoteApi = 'moonraker' | 'prusalink';

// A printer can declare more than one leveling mechanism (the Hi uses eddy +
// dual switches).
export type LevelingKind =
  | 'nozzle-strain'    // contact / loadcell nozzle-touch. No classic Z-offset probe object.
  | 'eddy-inductive'   // eddy-current or inductive scanning. Has x/y/z offset.
  | 'optical-switch'   // endstop squaring (e.g. dual Z-max switches).
  | 'bltouch'          // reserve for future.
  | 'manual';

export interface Leveling {
  kind: LevelingKind;
  hasOffsetTriple: boolean;          // true for eddy-inductive / bltouch
  offset?: { x: number; y: number; z: number };
  notes?: string;
}

export interface Heater {
  maxTemp: number;                   // deg C ceiling for the UI keypad + guardrails
  presets: number[];                 // preset chips (e.g. [200, 220, 240] hotend; [60, 100] bed)
  verifyOnCommission?: boolean;      // true when the value is provisional (e.g. the Hi's uncommissioned AC bed)
}

export interface PrinterProfile {
  id: string;                        // 'modded-hi-cfs', 'prusa-mini', ...
  displayName: string;
  vendor: string;
  // Editorial popularity rank for pickers (1 = most popular; the StoneLabs
  // rig is pinned to 1). PROFILES is kept sorted by this; the field exists so
  // a future data-driven ranking can re-sort without re-ordering the file.
  rank: number;

  build: { x: number; y: number; z: number }; // mm
  kinematics: Kinematics;

  hotend: Heater;
  bed: Heater;
  chamber?: Heater | null;           // null when no chamber hardware

  firmware: FirmwareFamily;
  remoteApi: RemoteApi;              // 'moonraker' for everything implemented now
  apiNotes?: string;                 // e.g. "Creality OS: Moonraker may be on a non-default port; may need root."

  leveling: Leveling[];              // one or more mechanisms

  features: {
    cfs?: boolean;                   // Creality filament system present/expected
    toolCount?: number;              // number of tools/extruders (default 1)
    enclosed?: boolean;
    camera?: boolean;
    inputShaper?: boolean;
  };

  // Motion defaults shown in the Machine > Motion Limits card until Klipper
  // reports live values.
  motionDefaults?: {
    velocity?: number;               // mm/s
    accel?: number;                  // mm/s^2
    squareCornerVelocity?: number;   // mm/s
    minCruiseRatio?: number;         // 0..1
  };

  // True when a Klipper update is NOT just git pull + service restart on this
  // machine: the MCU firmware must be recompiled and reflashed to match the
  // new klippy, or Klipper refuses to start ("MCU Protocol error" version
  // mismatch). The update manager shows a blocking warning (listing
  // firmwareMcus) before offering the klipper update. Applies to
  // custom-firmware builds (the modded Hi) and vendor-MCU forks (QIDI).
  reflashOnFirmwareUpdate?: boolean;
  firmwareMcus?: FirmwareMcu[];

  verifyNotes?: string[];            // free-form "confirm before shipping" flags
}

// One flashable MCU, for the reflash warning and (future pass) the one-click
// per-printer update recipe.
export interface FirmwareMcu {
  name: string;                      // 'Octopus V1.1', 'EBB42', 'Eddy'
  bus: 'usb' | 'can' | 'usb-rs485';
  tool?: boolean;                    // toolhead-side device
}
