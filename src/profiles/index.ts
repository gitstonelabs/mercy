// The stubbed printer profiles from the v2 handoff (section 4.2) plus the
// QIDI family added in alpha.6.
//
// ORDER IS POPULARITY ORDER (mirrored in `rank`): the wizard and Settings
// pickers present profiles in array order, StoneLabs rig pinned first. The
// ranking is editorial mindshare as of late 2025 (alpha.6 handoff section 3);
// adjacent ranks are ties, reorder freely. A data-driven signal (repo stars,
// review counts) can re-sort by `rank` later without touching the pickers.
//
// Values are researched, not measured. Entries the handoffs marked "verify"
// carry the uncertainty in two ways so it is not silently dropped:
//   - Heater.verifyOnCommission = true on provisional temperature ceilings.
//   - PrinterProfile.verifyNotes[] with the exact thing to confirm.
// Do not present a profile with verifyNotes as final until the note is resolved.
//
// Firmware buckets (so the wizard and Settings can warn correctly):
//   klipper-native        : works with the Moonraker backend as shipped.
//                           Includes the QIDI Klipper fork: vendor MCUs, but
//                           Moonraker is reachable on the standard port.
//   klipper-fork-locked   : Creality OS (Klipper fork). Reachable, but Moonraker
//                           may be on a non-default port and may need root.
//   buddy-needs-klipper-reflash : native API is PrusaLink. Needs a community
//                           Klipper reflash to drive from this UI. Not vendor
//                           supported. The wizard must say so before selection.
//
// reflashOnFirmwareUpdate: a Klipper bump on these machines also requires
// recompiling + reflashing MCU firmware (custom builds, vendor MCUs); the
// update manager shows a blocking warning listing firmwareMcus.

import type { PrinterProfile } from './schema';

export const PROFILES: PrinterProfile[] = [
  {
    id: 'modded-hi-cfs',
    displayName: 'Modded Creality Hi (CFS)',
    vendor: 'Creality / StoneLabs',
    rank: 1, // the rig this ships on; always first
    build: { x: 260, y: 260, z: 300 },
    kinematics: 'bedslinger',
    // hotend max 300: (verify) Nebula hotend / thermistor. Keep conservative.
    hotend: { maxTemp: 300, presets: [200, 220, 245, 260], verifyOnCommission: true },
    // AC bed, target ~100: (verify) bed is uncommissioned. Keep conservative.
    bed: { maxTemp: 100, presets: [60, 100], verifyOnCommission: true },
    chamber: null,
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes:
      'Octopus V1.1 runs as a USB-to-CAN bridge, so there is no restart_method. Config-editor restarts should offer FIRMWARE_RESTART, not an MCU reset.',
    leveling: [
      { kind: 'eddy-inductive', hasOffsetTriple: true, offset: { x: 4.45, y: -22.77, z: 2.0 }, notes: 'Eddy Duo over CAN (EBB42 toolhead).' },
      { kind: 'optical-switch', hasOffsetTriple: false, notes: 'Dual Z-max switches for gantry squaring.' },
    ],
    features: { cfs: true, toolCount: 1, enclosed: false, camera: true, inputShaper: true },
    reflashOnFirmwareUpdate: true,
    firmwareMcus: [
      { name: 'BTT Octopus V1.1', bus: 'usb' },
      { name: 'EBB42', bus: 'can', tool: true },
      { name: 'Eddy Duo', bus: 'can' },
    ],
    verifyNotes: [
      'Hotend/thermistor max depends on the Nebula hotend. Confirm before raising above 300 C.',
      'AC bed is uncommissioned. Confirm the safe target before presenting ~100 C as final.',
    ],
  },

  {
    id: 'sovol-sv08',
    displayName: 'Sovol SV08',
    vendor: 'Sovol',
    rank: 2,
    build: { x: 350, y: 350, z: 345 },
    kinematics: 'corexy',
    hotend: { maxTemp: 300, presets: [200, 230, 260] },
    bed: { maxTemp: 100, presets: [60, 100] },
    chamber: null,
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) stock probe. Sources conflate strain/microprobe with the Max eddy scanner.' }],
    features: { toolCount: 1, enclosed: false, camera: false, inputShaper: true },
    verifyNotes: ["Confirm the base SV08 stock sensor. It is conflated with the SV08 Max's eddy scanner in sources."],
  },

  {
    id: 'creality-k1c',
    displayName: 'Creality K1C',
    vendor: 'Creality',
    rank: 3,
    build: { x: 220, y: 220, z: 250 },
    kinematics: 'corexy',
    hotend: { maxTemp: 300, presets: [200, 240, 260] },
    bed: { maxTemp: 100, presets: [60, 100] },
    chamber: null,
    firmware: 'klipper-fork-locked',
    remoteApi: 'moonraker',
    apiNotes: 'Creality OS (Klipper fork). Moonraker may be on a non-default port and may need root.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: 'Strain-gauge nozzle-touch.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
  },

  {
    id: 'qidi-q1-pro',
    displayName: 'QIDI Q1 Pro',
    vendor: 'QIDI Technology',
    rank: 4,
    build: { x: 245, y: 245, z: 240 },
    kinematics: 'corexy',
    hotend: { maxTemp: 360, presets: [220, 260, 300] },
    bed: { maxTemp: 125, presets: [60, 100, 120] },
    chamber: { maxTemp: 65, presets: [45, 60] },
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes: 'QIDI Klipper fork with vendor MCUs; Moonraker reachable on the standard port. No QD multi-color box on the Q1 Pro.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) QIDI one-click auto-level sensor type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    motionDefaults: { velocity: 600, accel: 20000, squareCornerVelocity: 8 },
    reflashOnFirmwareUpdate: true,
    verifyNotes: ['Marketed chamber ~60 C; Klipper ceiling is 65. Confirm the leveling sensor type.'],
  },

  {
    id: 'prusa-mk4',
    displayName: 'Prusa MK4 / MK4S',
    vendor: 'Prusa Research',
    rank: 5,
    build: { x: 250, y: 210, z: 220 },
    kinematics: 'bedslinger',
    hotend: { maxTemp: 290, presets: [215, 240, 260] },
    bed: { maxTemp: 120, presets: [60, 90, 110] },
    chamber: null,
    firmware: 'buddy-needs-klipper-reflash',
    remoteApi: 'prusalink',
    apiNotes:
      'Native API is PrusaLink. Needs a community Klipper reflash to drive from this UI. MK4S shares electronics with the Core One.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: 'Nextruder loadcell nozzle-touch. No classic Z-offset probe object.' }],
    features: { toolCount: 1, enclosed: false, camera: false, inputShaper: true },
  },

  {
    id: 'prusa-core-one',
    displayName: 'Prusa Core One',
    vendor: 'Prusa Research',
    rank: 6,
    build: { x: 250, y: 220, z: 270 },
    kinematics: 'corexy',
    hotend: { maxTemp: 290, presets: [215, 240, 260] },
    bed: { maxTemp: 120, presets: [60, 90, 110] },
    chamber: { maxTemp: 60, presets: [55] },
    firmware: 'buddy-needs-klipper-reflash',
    remoteApi: 'prusalink',
    apiNotes: 'Native API is PrusaLink. Needs a community Klipper reflash. Enclosed with an active chamber around 55 C.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: 'Loadcell nozzle-touch.' }],
    features: { toolCount: 1, enclosed: true, camera: false, inputShaper: true },
    verifyNotes: ['Hotend reaches 300 C only with the HT hotend fitted; 290 C is the stock ceiling.'],
  },

  {
    id: 'qidi-x-plus-4',
    displayName: 'QIDI X-Plus 4',
    vendor: 'QIDI Technology',
    rank: 7,
    build: { x: 305, y: 305, z: 280 },
    kinematics: 'corexy',
    hotend: { maxTemp: 380, presets: [240, 280, 320] },
    bed: { maxTemp: 125, presets: [60, 100, 120] },
    chamber: { maxTemp: 65, presets: [45, 60] },
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes: 'QIDI Klipper fork; Moonraker reachable. Bed-assisted chamber (+~25 C). Supports the QD multi-color box (separate integration, not the Creality CFS panel).',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) QIDI auto-level sensor type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    motionDefaults: { velocity: 600, accel: 20000, squareCornerVelocity: 8 },
    reflashOnFirmwareUpdate: true,
    verifyNotes: ['Confirm leveling sensor type.'],
  },

  {
    id: 'creality-k2-plus',
    displayName: 'Creality K2 Plus',
    vendor: 'Creality',
    rank: 8,
    build: { x: 350, y: 350, z: 350 },
    kinematics: 'corexy',
    hotend: { maxTemp: 350, presets: [220, 260, 300] },
    bed: { maxTemp: 120, presets: [60, 100, 110] },
    chamber: { maxTemp: 60, presets: [] },
    firmware: 'klipper-fork-locked',
    remoteApi: 'moonraker',
    apiNotes: 'Creality OS (Klipper fork). Moonraker may be on a non-default port and may need root.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false }],
    features: { cfs: true, toolCount: 1, enclosed: true, camera: true, inputShaper: true },
  },

  {
    id: 'qidi-x-max-3',
    displayName: 'QIDI X-Max 3',
    vendor: 'QIDI Technology',
    rank: 9,
    build: { x: 325, y: 325, z: 315 },
    kinematics: 'corexy',
    hotend: { maxTemp: 350, presets: [220, 260, 300], verifyOnCommission: true },
    bed: { maxTemp: 120, presets: [60, 100, 110], verifyOnCommission: true },
    chamber: { maxTemp: 65, presets: [45, 60] },
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes: 'QIDI Klipper fork; Moonraker reachable.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) QIDI auto-level sensor type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    motionDefaults: { velocity: 600, accel: 20000, squareCornerVelocity: 5 },
    reflashOnFirmwareUpdate: true,
    verifyNotes: ['Temps are published-spec placeholders; the real printer.cfg ships in a release .rar, not the GitHub tree. Confirm hotend/bed/scv against a live config. Slicer velocity 600 vs typical Klipper max_velocity ~300: treat 600/20000 as the slicer ceiling, not the live limit.'],
  },

  {
    id: 'sovol-sv08-max',
    displayName: 'Sovol SV08 Max',
    vendor: 'Sovol',
    rank: 10,
    build: { x: 500, y: 500, z: 500 },
    kinematics: 'corexy',
    hotend: { maxTemp: 300, presets: [200, 230, 260] },
    bed: { maxTemp: 100, presets: [60, 100] },
    chamber: null,
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    leveling: [{ kind: 'eddy-inductive', hasOffsetTriple: true, notes: 'Eddy-current scanning probe.' }],
    features: { toolCount: 1, enclosed: false, camera: true, inputShaper: true },
  },

  {
    id: 'creality-k1-max',
    displayName: 'Creality K1 Max',
    vendor: 'Creality',
    rank: 11,
    build: { x: 300, y: 300, z: 300 },
    kinematics: 'corexy',
    hotend: { maxTemp: 300, presets: [200, 240, 260] },
    bed: { maxTemp: 100, presets: [60, 100], verifyOnCommission: true },
    chamber: null,
    firmware: 'klipper-fork-locked',
    remoteApi: 'moonraker',
    apiNotes: 'Creality OS (Klipper fork). Moonraker may be on a non-default port and may need root.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: 'Strain-gauge nozzle-touch. The AI Lidar is for print inspection, not leveling.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    verifyNotes: ['Bed ceiling (verify): sources give ~100 to 110 C. Confirm before raising above 100.'],
  },

  {
    id: 'qidi-x-plus-3',
    displayName: 'QIDI X-Plus 3',
    vendor: 'QIDI Technology',
    rank: 12,
    build: { x: 280, y: 280, z: 270 },
    kinematics: 'corexy',
    hotend: { maxTemp: 350, presets: [220, 260, 300], verifyOnCommission: true },
    bed: { maxTemp: 120, presets: [60, 100, 110], verifyOnCommission: true },
    chamber: { maxTemp: 65, presets: [45, 60] },
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes: 'QIDI Klipper fork; Moonraker reachable.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) QIDI auto-level sensor type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    motionDefaults: { velocity: 600, accel: 20000, squareCornerVelocity: 5 },
    reflashOnFirmwareUpdate: true,
    verifyNotes: ['Temps are published-spec placeholders (config ships in a release .rar). Confirm against a live config.'],
  },

  {
    id: 'prusa-mini',
    displayName: 'Prusa MINI / MINI+',
    vendor: 'Prusa Research',
    rank: 13,
    build: { x: 180, y: 180, z: 180 },
    kinematics: 'bedslinger',
    hotend: { maxTemp: 280, presets: [215, 230, 255] },
    bed: { maxTemp: 100, presets: [60, 90] },
    chamber: null,
    firmware: 'buddy-needs-klipper-reflash',
    remoteApi: 'prusalink',
    apiNotes:
      'Native API is PrusaLink, not Moonraker. Driving this from the UI needs a community Klipper reflash (exists for MINI, not vendor supported).',
    leveling: [{ kind: 'eddy-inductive', hasOffsetTriple: true, notes: 'SuperPINDA inductive probe.' }],
    features: { toolCount: 1, enclosed: false, camera: false, inputShaper: false },
  },

  {
    id: 'qidi-x-max-4',
    displayName: 'QIDI X-Max 4',
    vendor: 'QIDI Technology',
    rank: 14,
    build: { x: 385, y: 405, z: 342 },
    kinematics: 'corexy',
    hotend: { maxTemp: 375, presets: [240, 280, 320] },
    bed: { maxTemp: 125, presets: [60, 100, 120] },
    chamber: { maxTemp: 68, presets: [45, 60] },
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes: 'QIDI Klipper fork; Moonraker reachable. Uses closed-loop servos on X/Y. Supports the QD multi-color box (separate integration).',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) QIDI auto-level sensor type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    motionDefaults: { velocity: 800, accel: 30000, squareCornerVelocity: 8 },
    reflashOnFirmwareUpdate: true,
    verifyNotes: ['Build-volume sources disagree: slicer 390x390x340 vs printer.cfg header 385x405x342. Confirm.'],
  },

  {
    id: 'qidi-q2',
    displayName: 'QIDI Q2',
    vendor: 'QIDI Technology',
    rank: 15,
    build: { x: 270, y: 270, z: 256 },
    kinematics: 'corexy',
    hotend: { maxTemp: 375, presets: [220, 260, 300] },
    bed: { maxTemp: 125, presets: [60, 100, 120] },
    chamber: { maxTemp: 70, presets: [45, 60] },
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes: 'QIDI Klipper fork; Moonraker reachable. Supports the QD multi-color box (single hotend, AMS-style). The box is a separate integration, not the Creality CFS panel.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) QIDI auto-level sensor type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    motionDefaults: { velocity: 600, accel: 20000, squareCornerVelocity: 8 },
    reflashOnFirmwareUpdate: true,
    verifyNotes: ['Confirm leveling sensor type. QD box multi-color is a future integration.'],
  },

  {
    id: 'creality-k2',
    displayName: 'Creality K2 Plus Combo (K2)',
    vendor: 'Creality',
    rank: 16,
    build: { x: 260, y: 260, z: 260 },
    kinematics: 'corexy',
    hotend: { maxTemp: 300, presets: [200, 240, 260] },
    bed: { maxTemp: 100, presets: [60, 100] },
    chamber: { maxTemp: 60, presets: [] },
    firmware: 'klipper-fork-locked',
    remoteApi: 'moonraker',
    apiNotes: 'Creality OS (Klipper fork). Moonraker may be on a non-default port and may need root.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false }],
    features: { cfs: true, toolCount: 1, enclosed: true, camera: true, inputShaper: true },
  },

  {
    id: 'creality-k2-pro',
    displayName: 'Creality K2 Pro',
    vendor: 'Creality',
    rank: 17,
    build: { x: 300, y: 300, z: 300 },
    kinematics: 'corexy',
    hotend: { maxTemp: 300, presets: [200, 240, 260] },
    bed: { maxTemp: 110, presets: [60, 100, 110] },
    chamber: { maxTemp: 60, presets: [] },
    firmware: 'klipper-fork-locked',
    remoteApi: 'moonraker',
    apiNotes: 'Creality OS (Klipper fork). Moonraker may be on a non-default port and may need root.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false }],
    features: { cfs: true, toolCount: 1, enclosed: true, camera: true, inputShaper: true },
  },

  {
    id: 'creality-k2-se',
    displayName: 'Creality K2 SE',
    vendor: 'Creality',
    rank: 18,
    build: { x: 220, y: 215, z: 245 },
    kinematics: 'corexy',
    hotend: { maxTemp: 300, presets: [200, 240, 260] },
    bed: { maxTemp: 100, presets: [60, 100] },
    chamber: null,
    firmware: 'klipper-fork-locked',
    remoteApi: 'moonraker',
    apiNotes: 'Creality OS (Klipper fork). Moonraker may be on a non-default port and may need root.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false }],
    features: { cfs: true, toolCount: 1, enclosed: false, camera: true, inputShaper: true },
    verifyNotes: ['Open-frame kinematics (verify): confirm corexy vs open-frame gantry.'],
  },

  {
    id: 'qidi-x-smart-3',
    displayName: 'QIDI X-Smart 3',
    vendor: 'QIDI Technology',
    rank: 19,
    build: { x: 175, y: 180, z: 170 },
    kinematics: 'corexy',
    hotend: { maxTemp: 350, presets: [220, 260, 300], verifyOnCommission: true },
    bed: { maxTemp: 100, presets: [60, 90, 100], verifyOnCommission: true },
    chamber: null,
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes: 'QIDI Klipper fork; Moonraker reachable. Enclosed body but no active chamber heater.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) QIDI auto-level sensor type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    motionDefaults: { velocity: 600, accel: 20000, squareCornerVelocity: 5 },
    reflashOnFirmwareUpdate: true,
    verifyNotes: ['Non-square bed (175 x 180). Temps are published-spec placeholders (config ships in a release .rar). Confirm against a live config.'],
  },

  {
    id: 'prusa-xl',
    displayName: 'Prusa XL',
    vendor: 'Prusa Research',
    rank: 20,
    build: { x: 360, y: 360, z: 360 },
    kinematics: 'corexy',
    hotend: { maxTemp: 290, presets: [215, 240, 260] },
    bed: { maxTemp: 120, presets: [60, 90, 110] },
    chamber: null,
    firmware: 'buddy-needs-klipper-reflash',
    remoteApi: 'prusalink',
    apiNotes:
      'Native API is PrusaLink. Needs a community Klipper reflash. Up to 5 independent toolheads; the bed is segmented.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: 'Per-toolhead loadcell nozzle-touch.' }],
    features: { toolCount: 5, enclosed: false, camera: false, inputShaper: true },
  },

  {
    id: 'qidi-q2c',
    displayName: 'QIDI Q2C',
    vendor: 'QIDI Technology',
    rank: 21,
    build: { x: 270, y: 270, z: 256 },
    kinematics: 'corexy',
    hotend: { maxTemp: 375, presets: [220, 260, 300], verifyOnCommission: true },
    bed: { maxTemp: 125, presets: [60, 100, 120], verifyOnCommission: true },
    chamber: null,
    firmware: 'klipper-native',
    remoteApi: 'moonraker',
    apiNotes: 'QIDI Klipper fork; Moonraker reachable. Q2C shares the Q2 config; a real Q2C printer.cfg was not available.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) QIDI auto-level sensor type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    motionDefaults: { velocity: 600, accel: 20000, squareCornerVelocity: 8 },
    reflashOnFirmwareUpdate: true,
    verifyNotes: [
      'The "C" variant is unconfirmed: most likely a cost-reduced Q2 with active chamber heating disabled (no M141 in the slicer start gcode). If a heater is present on real hardware, set chamber { maxTemp: 70, presets: [45, 60] }.',
      'All specs inferred from the shared Q2 config. Camera is uncertain (Q2C omits the timelapse flag). Confirm build volume, temps, and camera against a real Q2C.',
    ],
  },

  {
    id: 'creality-k2e',
    displayName: 'Creality K2E',
    vendor: 'Creality',
    rank: 22, // possibly not a real product; keep last
    // (verify) all geometry and specs. No confirmed public spec.
    build: { x: 260, y: 260, z: 260 },
    kinematics: 'corexy',
    hotend: { maxTemp: 300, presets: [200, 240, 260], verifyOnCommission: true },
    bed: { maxTemp: 100, presets: [60, 100], verifyOnCommission: true },
    chamber: null,
    firmware: 'klipper-fork-locked',
    remoteApi: 'moonraker',
    apiNotes: 'Creality OS (Klipper fork). Moonraker may be on a non-default port and may need root.',
    leveling: [{ kind: 'nozzle-strain', hasOffsetTriple: false, notes: '(verify) probe type.' }],
    features: { toolCount: 1, enclosed: true, camera: true, inputShaper: true },
    verifyNotes: [
      'K2E may not be a real distinct product. It is not on Creality\'s current K2 lineup pages. Confirm it exists before shipping this profile.',
      'All geometry, temps, kinematics, and leveling are unconfirmed placeholders.',
    ],
  },
];

export const PROFILES_BY_ID: Record<string, PrinterProfile> = Object.fromEntries(
  PROFILES.map((p) => [p.id, p]),
);

// The profile the app assumes until the wizard sets one. The modded Hi is the
// rig this UI ships on first.
export const DEFAULT_PROFILE_ID = 'modded-hi-cfs';

export function getProfile(id: string): PrinterProfile | undefined {
  return PROFILES_BY_ID[id];
}
