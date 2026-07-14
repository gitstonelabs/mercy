/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Dev-only Moonraker host used by the Vite proxy. See vite.config.ts.
  readonly VITE_MOONRAKER_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// gcode-preview ships its own types; three is typed via @types/three.
// plotly.js-dist-min has no bundled types, so declare it as any for the scaffold.
declare module 'plotly.js-dist-min';
