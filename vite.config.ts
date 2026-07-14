import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Vite config for the Mercy build.
//
// base: './' makes the built output path-relative, so the same dist/ folder
// works whether it is served from a domain root, a Moonraker static_files
// subpath (see docs/INSTALL.md), or opened as a local file on a kiosk.
//
// The dev server proxies to a Moonraker host during development so the browser
// talks same-origin and you do not have to add the dev origin to Moonraker's
// cors_domains. Set VITE_MOONRAKER_HOST in a .env file, e.g.
//   VITE_MOONRAKER_HOST=http://printer.local:7125
// At runtime (production) the client reads the Moonraker host from app config,
// not from this proxy. See src/api/moonraker.ts.
const MOONRAKER_HOST = process.env.VITE_MOONRAKER_HOST ?? 'http://localhost:7125';

// Emit release_info.json at the dist root so Moonraker's update manager can
// compare the installed build against GitHub releases once the
// [update_manager mercy] entry exists (see docs). Version comes from
// package.json, prefixed 'v' per the Mainsail/Fluidd web-client convention.
//
// OTA repo is <project_owner>/<project_name> = gitstonelabs/mercy.
const RELEASE_OWNER = 'gitstonelabs';
function releaseInfo(): Plugin {
  return {
    name: 'mercy-release-info',
    apply: 'build',
    generateBundle() {
      const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };
      this.emitFile({
        type: 'asset',
        fileName: 'release_info.json',
        source: `${JSON.stringify({ project_name: 'mercy', project_owner: RELEASE_OWNER, version: `v${pkg.version ?? '0.0.0'}` }, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), releaseInfo()],
  server: {
    port: 5173,
    // Vite 5.4.21+ blocks unknown Host headers by default. The dev server runs
    // on a trusted LAN and gets reached by hostname (http://printer.local:5173,
    // *.local from a kiosk), so allow any host here. The shipped build is
    // static files behind the mercy service, not this dev server.
    allowedHosts: true,
    proxy: {
      // REST endpoints Moonraker serves under these prefixes.
      '/server': { target: MOONRAKER_HOST, changeOrigin: true },
      '/machine': { target: MOONRAKER_HOST, changeOrigin: true },
      '/printer': { target: MOONRAKER_HOST, changeOrigin: true },
      '/access': { target: MOONRAKER_HOST, changeOrigin: true },
      // Detected cameras report a relative /webcam/?action=stream (crowsnest
      // behind the printer's nginx). Proxy it so the dev server can actually
      // show a detected camera; production installs are same-origin or get the
      // URL absolutized by listWebcams().
      '/webcam': { target: MOONRAKER_HOST, changeOrigin: true },
      // WebSocket JSON-RPC channel.
      '/websocket': { target: MOONRAKER_HOST, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Keep the boot path small on a Pi: vendor React separately so the
        // dashboard chunk is app code only. The heavy libraries (Monaco,
        // Plotly, three/gcode-preview) split on their own via the lazy
        // route imports in src/App.tsx.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          uplot: ['uplot'],
        },
      },
    },
  },
});
