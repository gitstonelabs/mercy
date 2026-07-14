# Build notes, v2.0.0-alpha.2

Progress log for the working code, kept separate from README.md so the scaffold
docs stay canonical. Newest entry first.

## alpha.6: review fixes (9) + Qidi + palette + WebRTC + update manager

All nine alpha.5.1 review findings fixed, plus the three "close to bugs"
suggestions:

- Detected camera URLs absolutize against the configured host in
  listWebcams() (relative /webcam/?action=stream broke every cross-origin
  deployment: Jetson kiosk on :8088, dev server). Blank host stays relative;
  the vite dev server now proxies /webcam so detected URLs render in dev.
- Per-route ErrorBoundary detects a dead lazy chunk (redeploy race) and
  offers Reload instead of a dead "Try again" (React caches the rejection).
- Settings import type-checks every cameras[]/printers[] element field by
  field; a corrupt export can no longer brick the Settings page (where
  Factory reset lives).
- Detect keeps the webcam's enabled flag (was force-enabled), maps services
  explicitly (webrtc/snapshot/mjpeg; unknowns default mjpeg, so snapshot
  cams no longer render as unplayable webrtc), and camService() infers
  snapshot/mjpeg for legacy configs instead of guessing webrtc.
- Removing the active camera re-points the webcam at the first remaining
  entry (new removeCamera action).
- WebGL probe releases its context (WEBGL_lose_context) after caching.
- BED_MESH_PROFILE LOAD/REMOVE gate on confirmRiskyDuringPrint like
  Calibrate and Home.
- Update manager: "Check now" is a real remote check (new
  machine.updateRefresh() = POST /machine/update/refresh, with a spinner;
  falls back to cached status with a note during a print since Moonraker
  rejects refresh then). The system (apt) entry reports package_count as
  UPDATE READY with the count instead of comparing versions it does not have.
- restartBackend() clears objects/temps/job, so switching printers no longer
  shows A's data on B or splices A's temps into B's chart.
- Cameras are scoped per saved printer: switchPrinter stashes the outgoing
  webcam/cameras set on its entry and restores the target's;
  saveCurrentPrinter upserts the snapshot. Exports carry the nested sets.

New in this pass:

- Qidi support: 8 profiles (Q1 Pro, Q2, Q2C, X-Plus 4, X-Max 4, X-Max 3,
  X-Plus 3, X-Smart 3) as klipper-native + moonraker with usable build
  volumes, Klipper temp ceilings, apiNotes about the QD multi-color box
  (NOT the Creality CFS panel; features.cfs stays false), and
  verifyOnCommission placeholders on the X-3 series (real configs ship in a
  release .rar). Leveling sensor types flagged (verify) throughout.
- Printer list sorted by popularity (rank field + array order), rig pinned
  first, K2E last (possibly not a real product).
- Console command palette (v1.9 parity): Macros button opens a searchable
  command list built live from printer.gcode.help with the v1.9 curated
  descriptions + hidden keywords overlaid (search "cut", "level", "cfs"),
  Clear search, no-commands-match empty state, click inserts into the input.
  Plus an up/down command-history ring on the input.
- WebRTC playback: WebcamView negotiates RTCPeerConnection against
  camera-streamer (JSON offer/remote exchange) or go2rtc/WHEP (SDP POST),
  with an error overlay + Retry. ICE gathering capped at 2s so an offline
  kiosk with no STUN cannot stall.
- Reflash warning: profiles gain reflashOnFirmwareUpdate + firmwareMcus.
  The klipper update on the modded Hi (Octopus/EBB42/Eddy listed) and all
  Qidi profiles shows a blocking confirm: MCU recompile+reflash via
  Katapult required, Hi soft-restart regression needs a cold power cycle.
- OTA groundwork: the build emits release_info.json (project_name
  mercy, version from package.json) for a future
  [update_manager mercy] entry; updating a web-type component from
  the update card shows a "reload to finish updating" affordance.

Verify on the rig: WebRTC against the real go2rtc/camera-streamer endpoint;
Check now timing (~8s) and the mid-print fallback; detected camera URLs from
the Jetson kiosk; Qidi X-3 temps against a live printer.cfg.

Still open: in-app confirm modal (substrate for hold-to-confirm E-STOP),
console feed virtualization, service-worker precache, shared config home
(Moonraker database), remaining Prusa printers (next pass), QD multi-color
box panel, one-click per-printer update recipe + host-side runner.

## alpha.5.1: webcam sources + multi-camera

- StrictMode teardown fix: WebcamView assigns the stream src inside the
  effect body and blanks only in cleanup, so dev double-invoke ends with
  the stream restored instead of permanently blank.
- Camera source types: mjpeg (multipart stream), snapshot (1 Hz cache-
  busted poll, snapshot URL derives from the stream URL when blank), and
  webrtc (placeholder until the v1 RTCPeerConnection port). Old persisted
  configs without a service field infer mjpeg from action=stream.
- Multi-camera: config.cameras[] with select/remove; the active camera
  stays in config.webcam so every existing consumer keeps working. The
  Webcam page grows camera chips when more than one exists.
- Detect cameras: Settings pulls /server/webcams/list (new backend method
  on both adapters) and populates the list with each camera's name, stream
  and snapshot URLs, service type, and aspect; nobody types URLs.
- Settings export/import now carries printers and cameras (validated on
  import like everything else).

## alpha.5: review fixes (5) + hardening + multi-printer

Bug fixes from the alpha.4 review:
- Extruder tool tabs route through confirmRiskyDuringPrint like the CFS
  panel (they fire the same T{n} cut/retrude/extrude choreography), and a
  tap on the already-active tool is a no-op.
- Top-level ErrorBoundary in main.tsx with a Reload button covers /setup
  and permanently-failed lazy chunks; every lazy route import retries once
  after 800ms before escalating (React caches a rejected import forever).
- Leaving live mode mid-print now gates on the effective connection
  (kind === 'moonraker'), not the literal 'live' label, so auto -> demo
  asks too.
- BED_MESH_CALIBRATE goes through sendGcode, so 'Must home axis first'
  lands in the console and the bell instead of vanishing.
- A failed Plotly chunk load shows a '3D view failed to load' note with
  the 2D map instead of a blank box.

Hardening:
- WebGL probe (src/webgl.ts): Viewer disables its 3D preview with a note,
  and Heightmap defaults to a new 2D colored-grid map when WebGL is absent
  (also the fallback when Plotly cannot load).
- Monaco trimmed to the core editor API + the ini contribution; the editor
  chunk drops from the full-barrel megabytes to the fraction the config
  editor actually uses.
- The 44px touch floor wins now: data-touch rules use !important
  min-height, which beats the per-instance inline heights.

Multi-printer (the v2 requirement from the original scope):
- config gains printers[] (name, host, profileId) with saveCurrentPrinter /
  switchPrinter / removePrinter. Finishing the wizard (and Set up another
  printer) upserts the current printer.
- The top-bar printer pill is a switcher: saved printers with host lines,
  active highlighted, switch reconnects (with a confirm when a print is
  running here), plus Add a printer -> wizard.
- The wizard's printer step collects the Moonraker host (scheme
  auto-prefixed), so a second printer's address is set during setup.

Still open: in-app confirm modal (substrate for hold-to-confirm E-STOP),
console feed virtualization, service-worker precache for atomic offline
redeploys, shared config home (Moonraker database), WebRTC camera.

## alpha.4: offline kiosk, bundle splitting, notifications, touch

- Route-level code splitting: every page except the dashboard loads via
  React.lazy behind a Suspense fallback, and vite manualChunks vendors
  react/router/zustand and uplot separately. Monaco, Plotly, and the
  three.js viewer land as their own chunks the first time their page opens;
  the Pi boot path is app code plus vendor only.
- Offline fonts: Manrope, JetBrains Mono, and Caveat now come from
  @fontsource packages imported in src/theme/fonts.ts; the Google Fonts
  @import is gone. Run npm install after pulling.
- Offline Monaco: monaco-editor is bundled locally with its base editor
  worker (src/monaco-setup.ts) and @monaco-editor/react points at that
  instance instead of its CDN loader. The config editor now works with no
  internet.
- Notifications bell is real: a notifications slice collects klippy
  shutdown transitions, '!!' gcode errors, and failed sends (deduped,
  capped at 50). The bell shows the unread count, opening marks read,
  clear empties it.
- Touchscreen sizing: when config.ui.kind includes a touchscreen the app
  root carries data-touch and buttons/chips/inputs grow to the 44px floor
  from the handoff's mobile spec.
- Temperature chart gains a cursor value readout line (uPlot setCursor
  hook); uPlot maps touch to cursor, so this is the touch tooltip too.

Still open: 2D heightmap default on kiosks, hold-to-confirm E-STOP
variant, shared config home (Moonraker database), multi-printer switcher,
WebRTC camera.

## alpha.3.1: review fixes (14 findings) + print-safety pass

Bug fixes:
- WebcamView teardown ref-capture regression: the node is captured in the
  effect body now, so cleanup actually kills the old MJPEG stream and never
  blanks the new one.
- Viewer: GCodePreview.init() is guarded; a software-GL kiosk gets an error
  note instead of a crash. A route-level ErrorBoundary (keyed by pathname)
  wraps the Outlet, so no page can white-screen the rail, top bar, or E-STOP.
- Heightmap: Plotly.purge() runs on cleanup (no WebGL context or resize
  listener leak per navigation); empty-matrix guard kills the
  '-Infinity mm' readout when a profile exists but no mesh is active.
- Settings import: every field is whitelisted, type-checked, and deep-merged;
  a malformed export can no longer persist a state that crashes every render.
- Settings host entry gains http:// when the scheme is missing, so
  printer.local:7125 connects instead of throwing in the WebSocket ctor.
- moonraker files.delete/download/read encode each path segment ('Bracket
  #3.gcode' no longer silently 404s).
- Files page: latest-wins guard on refresh (fast folder hops cannot clobber
  rows), print button gates on .gcode/.g/.gco like the upload accept, delete
  hidden on the actively printing file.
- History CSV: formula-injection guard on filenames, revokeObjectURL
  deferred a tick (same fix on the settings export).
- Machine: config save failures surface in the editor footer and keep the
  dirty flag; crowsnest.log downloads from the logs root.
- Viewer local-file load reports read failures.

Print-safety pass (per the review's kiosk-safety theme):
- E-STOP is immediate everywhere; the confirm dialog is gone (a modal
  defeats an emergency stop). Recovery is FIRMWARE_RESTART in the banner.
- Shared guard in bootstrap: printActive() + confirmRiskyDuringPrint().
  Routed through it: homing and jog (Toolhead, Heightmap, Console module),
  Z-tilt, manual extrude/retract, CFS tool change and unload, bed mesh
  calibrate, FIRMWARE_RESTART (power menu + config editor), component
  updates. Host reboot/shutdown confirms say when a running print is lost;
  leaving live mode mid-print asks first.
- SET_VELOCITY_LIMIT bumps clamp to sane ranges (velocity 5-1000, accel
  100-50000, scv 0-20, mcr 0-0.99); they apply live mid-print.
- sendGcode() replaces the swallow-everything pattern: a rejected command
  posts a '!!' line into the console feed, so a bounced motion command is
  visible.

Still open (unchanged): local fonts + bundled Monaco workers for the
offline kiosk, route-level code splitting for the 944 KB main chunk, 2D
heightmap default on kiosks, uPlot touch tooltip, touch-target sizing from
ui.kind, shared config home, multi-printer, notifications feed, WebRTC
camera, hold-to-confirm E-STOP variant.

## alpha.3: Files, History, Machine, Heightmap, Viewer, Settings

Every route is now real; no TodoBody stubs remain.

- G-code files: gcodes browser with folder navigation and breadcrumbs,
  metadata + thumbnails from /server/files/metadata (thumbnail URL built
  against the configured host), search, refresh, upload, delete with
  confirm, print with confirm (printer.print.start), PRINTING pill on the
  active job. Table scrolls inside its own container on phones.
- Print history: totals card (print time, longest, average, filament, jobs),
  completed donut, last-12-weeks bars with a print-time / filament toggle
  bucketed from the fetched jobs, searchable table with status pills, and a
  real CSV export (blob download).
- Machine: config/logs/gcodes browser; Monaco editor (lazy chunk) with save
  and Save + FIRMWARE_RESTART (no restart_method on the usb-can bridge);
  update manager from /machine/update/status with confirmed updates; system
  loads (host cpu/mem gauges polled every 3s, per-mcu awake/freq from the
  mcu objects); endstops via printer.query_endstops; log download links;
  motion limits spinners reading toolhead limits and pushing
  SET_VELOCITY_LIMIT.
- Heightmap: Plotly surface (lazy chunk) over bed_mesh.probed_matrix with
  mesh_min/mesh_max axes, range readout, profile load/delete
  (BED_MESH_PROFILE), calibrate with confirm, and the no-mesh empty state.
- Viewer: wraps gcode-preview (Three.js). Loads the printing file from
  Moonraker or a local .gcode, layer scrubber, travel-move toggle, and a
  follow-live mode that tracks print_stats current_layer while the loaded
  file is the active job. endLayer/clear usage is annotated for
  re-verification on dependency bumps.
- Settings: profile picker with firmware warnings, connection host +
  auto/live/demo mode with restartBackend(), webcam, interface summary,
  theme + mode, logo picker (validated), dashboard preset reset, export /
  import mercy.json, factory reset (clears persisted config and
  reloads into the wizard), re-run wizard.

Verify on the rig: thumbnails resolve against your host setting; Monaco
loads its worker from the CDN today (offline kiosk needs the loader pointed
at bundled assets, same open item as local fonts); gcode-preview layer
scrub against a real multi-megabyte file.

## alpha.2.1: source-review fixes (12 findings + favicon)

- Klipper 'error' state now maps to the shutdown banner + FIRMWARE_RESTART
  prompt instead of an endless connecting spinner (moonraker.ts).
- Custom dashboard layouts remember their base preset: editing one module on
  Cockpit or Command deck no longer snaps the rest to Parity
  (config.dashboard.base, Dashboard.tsx customize()).
- extruder1..N objects subscribe correctly (no-space names) and the extruder
  card no longer falls back to tool 0 state, so the cold-extrude guard gates
  on the active tool (bootstrap.ts, Extruder.tsx).
- CFS slot colors re-gain their leading '#' on read, whatever CFS_SET_SLOT
  persisted (CfsPanel.tsx).
- A successful reconnect clears the stale 'Moonraker is unreachable' banner
  (bootstrap.ts setError(null) on ready).
- files.metadata() maps thumbnails to camelCase and spreads raw fields first
  so the typed keys survive (moonraker.ts).
- Fan sliders commit on keyup/blur, not just pointer release (Fans.tsx).
- Console: newest-at-top resets scroll to the top; the restored backlog keeps
  each line's arrival time instead of re-stamping on mount (Console.tsx,
  bootstrap.ts backlog now stores {t, text}).
- Logo picker validates MIME type against the allowlist and reports
  FileReader failures (Logo.tsx).
- MJPEG stream tears down on unmount/source change so page hops cannot leak
  connections toward the per-host cap (WebcamView.tsx).
- Favicon added (public/favicon.svg + link tag), no more /favicon.ico 404.
- Still open: local fonts for the offline kiosk (ui.css imports Google Fonts).

## alpha.2: wizard, remaining dashboard cards, CFS, console, edit mode

- Typecheck fix: @types/node added for vite.config.ts. Dev server now sets
  allowedHosts (Vite 5.4.21 blocks LAN hostnames by default; the shipped
  build is static files behind the kiosk service, not this dev server).
- Wizard steps are real controls bound to the config store: printer picker
  with firmware pills (KLIPPER / CREALITY OS / NEEDS REFLASH) and apiNotes
  warnings plus verify notes, webcam enable + stream URL, interface type with
  screen/output/kiosk-address branches, live theme picker, logo file picker
  (data URL, 1 MB cap). Per-step help texts are in. Summary reads the config
  back and offers Set up another printer.
- Dashboard is the prototype's module system: presets parity / cockpit /
  deck / custom, per-module hide + S/M/L/W size overrides persisted in
  config.dashboard, Edit layout mode with label pills, remove buttons, size
  chips, preset switcher, cancel snapshot, and the restore drawer. Modules
  drop out automatically when hardware is absent (CFS without the profile
  flag, lights/sensors without objects). One column under 900px.
- New cards: Extruder (PA / smooth time live edits, length + feedrate,
  retract/extrude with the can_extrude cold-guard, tool tabs when
  toolCount > 1), Fans & outputs (M106 part fan, SET_FAN_SPEED generics,
  read-only tach fans, SET_PIN toggles), Lights (SET_LED swatches),
  Filament sensors (SET_FILAMENT_SENSOR toggles).
- CFS panel: creality_cfs + save_variables field map from v1, spool rings
  with remaining arc, active-slot glow with FEEDING pill, Load sends T{n},
  Unload sends CUT_FILAMENT + CFS_RETRUDE, slot edit dialog sends
  CFS_SET_SLOT, and the No CFS detected empty state with CFS_INITIALIZE.
- Console page: live feed via the bootstrap fan-out, send with local echo,
  Tab autocomplete from printer.gcode.help, temp-poll filter, timestamps,
  newest top/bottom, input top/bottom, and the five layouts (full, 1x2,
  1x3, console 50 with two stacked, quad) with webcam / toolhead / temps
  side modules. All persisted in config.console.
- Webcam page + shared WebcamView: MJPEG renders directly; other URLs show
  the WebRTC note until that path is ported from v1.

Still open from this pass: Files, History, Machine, Heightmap, Viewer pages;
Settings page; multi-printer; WebRTC camera; local fonts for offline kiosk.

## alpha.1: data layer end to end, shell, first three cards

Implements handoff section 9 steps 1 to 4 for the first panels. The approved
prototype (Mercy.dc.html in the design project) is the visual and
behavioral reference.

### What works now

- `src/api/moonraker.ts`: full Moonraker client. WebSocket JSON-RPC with a
  10s call timeout, reconnect with exponential backoff (1s doubling to a 15s
  cap), subscriptions re-issued on reconnect and on notify_klippy_ready,
  gcode queued while the socket is down and flushed on reopen. REST for
  files (directory listing, metadata, upload, download, delete, read, write),
  history (list + totals), and machine (system_info, proc_stats, update
  status/action, shutdown, reboot). Endstops via printer.query_endstops.
- `src/api/demo.ts`: the simulator behind the same BackendService seam. Emits
  the same object shapes (toolhead, extruder, heater_bed, print_stats,
  virtual_sdcard, creality_cfs, save_variables) once per second, answers
  gcode (M104/M140/M220/M221/M106, TURN_OFF_HEATERS, PAUSE/RESUME/CANCEL,
  FIRMWARE_RESTART), and fakes files/history/machine data. The screen is
  never blank; the pill shows DEMO.
- `src/api/client.ts` + `src/api/bootstrap.ts`: connectionMode 'auto' tries
  Moonraker and falls back to demo; 'live' and 'demo' force one adapter.
  Bootstrap subscribes from printer.objects.list filtered by prefix, maps
  print_stats/virtual_sdcard into the job slice, samples every heater and
  temperature sensor into the ring buffer at 1 Hz, and fans gcode responses
  out to subscribers (Console page hook: `onGcodeResponse`).
- `src/api/types.ts`: seam gained `listObjects()` and `gcodeHelp()`.
- Store: connection slice knows which adapter is live (`kind`), config gained
  `connectionMode`, `dashboard` (preset + per-module hidden/size overrides),
  and `console` display prefs. All persisted.
- `src/theme/ui.css`: the component classes from the prototype (sl-card,
  sl-btn variants, sl-seg, sl-chip, sl-input, eyebrow/mono/script text,
  mobile tab bar under 900px). Panel.tsx now renders the prototype card.
- AppShell: 86px icon rail with the prototype SVG set and a rail STOP button,
  top bar (printer pill with klippy dot, Upload and print, LIVE/DEMO/LINKING
  pill, bell, settings, power menu, E-STOP with confirm), klippy-shutdown
  banner with a FIRMWARE_RESTART action, bottom tabs on phones.
- Dashboard: job card (filename, progress, elapsed, remaining, layer,
  pause/resume/cancel) plus three real cards:
  - Temperatures: uPlot streaming chart from the ring buffer, sensor table
    with per-series colors, target input + profile preset chips, Cooldown
    (TURN_OFF_HEATERS).
  - Toolhead: live position (motion_report first), homing, jog grid over
    SAVE_GCODE_STATE/G91/G1/RESTORE_GCODE_STATE, step set 0.1/1/10/100,
    Z-offset babystep chips (SET_GCODE_OFFSET), speed slider (M220), Z-Tilt
    button when the config has z_tilt.
  - Macros: pill grid from printer.gcode.help, underscore names filtered,
    KEY= help text triggers a parameter prompt.

### Run it

    npm install
    npm run dev            # demo simulator, no printer needed
    VITE_MOONRAKER_HOST=http://printer.local:7125 npm run dev   # live rig

Set connectionMode 'live' or 'demo' in localStorage (mercy-config) to
pin an adapter; 'auto' is the default.

### Verify against the live rig

1. Temperatures chart streams and targets stick (SET_HEATER_TEMPERATURE).
2. Jog moves the toolhead the selected step; the readout follows
   motion_report.
3. Pull the ethernet cable: pill goes OFFLINE, then recovers by itself and
   the subscription resumes (backoff capped at 15s).
4. Send a gcode while unplugged: it must run on reconnect (queue flush).
5. Background the phone browser, foreground it: socket reconnects (iOS
   suspends sockets; the backoff loop covers it).

### Next, in order

1. Extruder, Fans, Rgb, FilamentSensor cards on the same store reads.
2. CfsPanel: creality_cfs + save_variables per the field map in that file;
   slot cards and the CFS_SET_SLOT edit dialog from the prototype.
3. Console page: onGcodeResponse feed + the five-layout configurator and
   display prefs already persisted in config.console.
4. Dashboard edit mode wired to config.dashboard (prototype behavior:
   presets parity/cockpit/deck/custom, hide/restore, S/M/L/W sizes).
5. Files, History, Machine pages on the REST methods that already exist.
6. Heightmap (Plotly surface) and Viewer (gcode-preview) wrappers.
7. Wizard steps + Settings page bound to config; add-another-printer flow.
8. Bundle fonts locally for the offline kiosk build (ui.css imports Google
   Fonts today).

### Known gaps

- Notifications bell is a placeholder.
- Multi-printer switching is designed (prototype) but not in config yet;
  one host per install for now.
- uPlot tooltip is default; the touch tooltip check from handoff section 6
  is still open.
