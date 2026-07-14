# mercy

3D printing at your Mercy. A control UI for Klipper printers that takes the pain out of running them: fast, good-looking, customizable, and built to grow from one printer into a managed print farm.

Mercy talks to a printer through Moonraker over a WebSocket and REST. It covers the day-to-day work (jog, heat, macros, file management, print monitoring, config editing, bed mesh, g-code preview, print history) and adds a filament-system panel for the Creality CFS that Mainsail does not have. It is one static build you serve from the printer or run full-screen on a kiosk.

## Modules

Mercy is the core control UI. The others are named for what they do, and land over time.

- **Triage** is the print-farm and projects manager: hand each plate of a multi-plate project to a printer that can run it. Planned.
- **Vitals** is health monitoring and cameras: temperatures, load, endstops, and a live webcam or WebRTC stream per printer.
- **Remedy** is troubleshooting and updates: surfaced errors, the console command palette, and over-the-air updates for the printer stack and for Mercy itself.
- **Surgical** slices or re-slices a model or plate inside the UI, per printer, so one job can go to printers that do not share the same hardware. Planned, and the hardest of the set.

## Status

Alpha, `2.0.0-alpha.6`. Every page is built: dashboard, toolhead, temperatures, macros, extruder, fans, lights, filament sensors, CFS, console, webcam, height map, files, g-code viewer, history, machine, and settings, plus a first-run wizard. It ships six accent themes in light and dark, printer profiles for Creality, Prusa, Sovol, and QIDI (popularity-sorted, with values that are researched rather than measured flagged per profile), offline fonts and a bundled Monaco editor for a no-internet kiosk, and a `release_info.json` for over-the-air updates.

Not done yet: Triage and Surgical; the PrusaLink/Marlin adapter, so the Prusa profiles are describable but not drivable; and a set of values that need confirming on real hardware (the WebRTC dialect, some Moonraker refresh timing, and the QIDI X-3 temperatures), tracked in the handoffs and the per-profile verify notes.

## Stack

- React 18 and TypeScript, built with Vite.
- Routing is `react-router-dom` on a HashRouter, so a static build survives a page refresh with no server rewrite.
- State is Zustand in two stores. Live printer state and persisted config are separate, so a one-per-second temperature tick never writes to disk.
- uPlot draws the streaming temperature chart, Plotly draws the history charts and the 3D bed mesh, gcode-preview (Three.js) is the g-code viewer, and Monaco is the config editor. Those four load as lazy route chunks, so the dashboard boot path is app code plus a small vendor chunk.

## Run it

```
npm install
npm run dev            # demo simulator, no printer needed
```

Point it at a real printer by setting the host in a `.env` file (copy `.env.example`):

```
VITE_MOONRAKER_HOST=http://printer.local:7125
```

The dev server proxies `/server`, `/machine`, `/printer`, `/access`, `/webcam`, and `/websocket` to that host so the browser talks same-origin. For the shipped build:

```
npm run build          # static files in dist/
```

## Connecting to a printer

Every backend call goes through the `BackendService` interface (`src/api/types.ts`); no panel calls `fetch` or touches a socket directly. The Moonraker adapter is the one implemented today. In the app, a blank Moonraker host means same-origin (served from the printer, or behind the dev proxy); an explicit host connects directly and needs a matching `cors_domains` entry on Moonraker.

The active printer profile (`src/profiles/`) sets the temperature ceilings, build volume, kinematics, and leveling the UI shows. `firmware` and `remoteApi` are separate profile fields, so a Prusa Buddy printer is describable now (`remoteApi: 'prusalink'`) and becomes drivable when a PrusaLink or Marlin adapter is added behind the same seam, with no profile changes.

## Deploy and updates

`docs/INSTALL.md` covers serving the build from Moonraker's `static_files` or from a kiosk browser on a Raspberry Pi or a generic Linux SBC. Over-the-air updates use Moonraker's `update_manager` web-client type: the build emits `dist/release_info.json`, and once the repo has tagged releases and an `[update_manager mercy]` entry, Mercy lists itself in its own update manager and updates the way Mainsail and Fluidd do. Set `project_owner` in `vite.config.ts` before the first release.

## Repo layout

```
src/
  api/         BackendService seam; Moonraker WS + REST client; demo simulator; bootstrap
  store/       live printer state, temps ring buffer, job, connection, config, notifications
  profiles/    PrinterProfile schema and the printer list
  theme/       six accent themes (light + dark) and the CSS token map
  components/  app shell, error boundary, webcam view, shared panel chrome
  features/    one file per page and card (dashboard, machine, console, ...)
  wizard/      first-run setup steps
  webgl.ts     WebGL capability probe that gates the 3D viewer and the mesh
docs/INSTALL.md
vite.config.ts, BUILD-NOTES.md
```

## License

Mercy is free for personal and other noncommercial use under the [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use requires a separate license from the copyright holder, Roger Wirkus (gitstonelabs). This is a source-available license, not OSI open source; the bundled dependencies keep their own permissive licenses.
