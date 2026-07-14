// StoneLabs UI v2 theme tokens.
//
// These are the exact hex values ported from the v1 offline HTML:
//   C:\...\StoneLabs-3D-Printer-UI7-7-26-update\release\stonelabs-ui-v1.9.0\
//     web-ui\src\stonelabs-printer-ui.dc.html   (search "THEME PALETTES")
// v1 shipped the tokens as CSS custom properties keyed on [data-theme][data-mode].
// v2 keeps the same token names and the same six accents (cyan default, crimson,
// amber, mono, grey, sage), each in dark and light. Do not rename tokens; the
// components read them as var(--bg), var(--accent), etc.
//
// If a value here ever disagrees with v1, v1 is the source of truth. Re-port it.

export type ThemeId = 'cyan' | 'crimson' | 'amber' | 'mono' | 'grey' | 'sage';
export type ModeId = 'dark' | 'light';

// A token set is the full CSS-variable map for one theme+mode, keyed without
// the leading "--". applyTheme() writes these onto :root.
export type TokenSet = Record<string, string>;

// Status colors and the danger/ok surface ramps are identical across every
// theme and mode in v1, so factor them out and spread into each set.
const SHARED: TokenSet = {
  success: '#3fcf8e',
  danger: '#ff6b6b',
  ember: '#ff8a4c',
  warning: '#ffb84d',
  'danger-b': '#5e1f22',
  'danger-d1': '#2a0f12',
  'danger-d2': '#1a090b',
  'ok-d1': '#0a2a1e',
  'ok-d2': '#06160f',
  'success-rgb': '63,207,142',
  'danger-rgb': '255,107,107',
  'ember-rgb': '255,138,76',
  'warning-rgb': '255,184,77',
};

export const THEMES: Record<ThemeId, Record<ModeId, TokenSet>> = {
  cyan: {
    dark: { ...SHARED, bg: '#05060d', bg2: '#0f1118', inset: '#15161d', track: '#111219', control: '#1c1d24', surface: '#23242b', b0: '#1a1b22', b1: '#26272e', b2: '#34353c', b3: '#4b4c53', tx: '#eef0f7', tx2: '#cdcfd6', tx3: '#95979e', txd: '#6c6d74', txf: '#4b4c53', accent: '#2bcdf2', accent2: '#5fdcff', accentdim: '#0078a0', ad1: '#124a5b', ad2: '#0b2834', ad1h: '#166074', ad2h: '#0f3846', accentfg: '#d0f4fc', 'accent-rgb': '43,205,242', 'bg-rgb': '5,6,13', 'bg2-rgb': '15,17,24' },
    light: { ...SHARED, bg: '#eef1f6', bg2: '#e4e7ec', inset: '#dee1e7', track: '#e3e6eb', control: '#e3e6eb', surface: '#ffffff', b0: '#dadde2', b1: '#cfd2d7', b2: '#c2c5ca', b3: '#abaeb5', tx: '#10131c', tx2: '#2f323b', tx3: '#64676f', txd: '#8c8f96', txf: '#abaeb5', accent: '#2bcdf2', accent2: '#5fdcff', accentdim: '#0078a0', ad1: '#2bcdf2', ad2: '#26b4d5', ad1h: '#44d3f4', ad2h: '#2bcdf2', accentfg: '#ffffff', 'accent-rgb': '43,205,242', 'bg-rgb': '238,241,246', 'bg2-rgb': '228,231,236' },
  },
  crimson: {
    dark: { ...SHARED, bg: '#0c0608', bg2: '#171012', inset: '#1c1618', track: '#181214', control: '#241d1f', surface: '#2b2426', b0: '#211b1d', b1: '#2d2628', b2: '#3b3436', b3: '#534c4e', tx: '#f7eef0', tx2: '#d6ced0', tx3: '#9e9698', txd: '#736c6e', txf: '#534c4e', accent: '#e23b4e', accent2: '#ff6b78', accentdim: '#8f1f2c', ad1: '#551820', ad2: '#300f14', ad1h: '#6c1e28', ad2h: '#42131a', accentfg: '#f9d4d8', 'accent-rgb': '226,59,78', 'bg-rgb': '12,6,8', 'bg2-rgb': '23,16,18' },
    light: { ...SHARED, bg: '#f7eef0', bg2: '#ede4e6', inset: '#e8dee0', track: '#ece3e5', control: '#ece3e5', surface: '#ffffff', b0: '#e3dadc', b1: '#d8cfd1', b2: '#cbc2c4', b3: '#b5abad', tx: '#1c1012', tx2: '#3b2f31', tx3: '#6f6466', txd: '#978c8e', txf: '#b5abad', accent: '#e23b4e', accent2: '#ff6b78', accentdim: '#8f1f2c', ad1: '#e23b4e', ad2: '#c73445', ad1h: '#e55363', ad2h: '#e23b4e', accentfg: '#ffffff', 'accent-rgb': '226,59,78', 'bg-rgb': '247,238,240', 'bg2-rgb': '237,228,230' },
  },
  amber: {
    dark: { ...SHARED, bg: '#060a14', bg2: '#10141e', inset: '#161a24', track: '#12161f', control: '#1d212b', surface: '#242832', b0: '#1b1f29', b1: '#262a34', b2: '#343842', b3: '#4c4f58', tx: '#eef1f8', tx2: '#ced1d8', tx3: '#9699a1', txd: '#6c7078', txf: '#4c4f58', accent: '#ff8a3c', accent2: '#ffb066', accentdim: '#b5531a', ad1: '#5b3622', ad2: '#30201b', ad1h: '#764426', ad2h: '#442a1e', accentfg: '#ffe5d4', 'accent-rgb': '255,138,60', 'bg-rgb': '6,10,20', 'bg2-rgb': '16,20,30' },
    light: { ...SHARED, bg: '#eef1f7', bg2: '#e4e7ed', inset: '#dee2e8', track: '#e3e6ec', control: '#e3e6ec', surface: '#ffffff', b0: '#dadde4', b1: '#cfd2d9', b2: '#c1c5cc', b3: '#abafb7', tx: '#0e1422', tx2: '#2d3340', tx3: '#636873', txd: '#8b9099', txf: '#abafb7', accent: '#ff8a3c', accent2: '#ffb066', accentdim: '#b5531a', ad1: '#ff8a3c', ad2: '#e07935', ad1h: '#ff9853', ad2h: '#ff8a3c', accentfg: '#ffffff', 'accent-rgb': '255,138,60', 'bg-rgb': '238,241,247', 'bg2-rgb': '228,231,237' },
  },
  mono: {
    dark: { ...SHARED, bg: '#050505', bg2: '#101010', inset: '#171717', track: '#121212', control: '#1e1e1e', surface: '#262626', b0: '#1c1c1c', b1: '#282828', b2: '#373737', b3: '#505050', tx: '#ffffff', tx2: '#dcdcdc', tx3: '#a0a0a0', txd: '#737373', txf: '#505050', accent: '#f0f0f0', accent2: '#ffffff', accentdim: '#9a9a9a', ad1: '#555555', ad2: '#2d2d2d', ad1h: '#6f6f6f', ad2h: '#404040', accentfg: '#fcfcfc', 'accent-rgb': '240,240,240', 'bg-rgb': '5,5,5', 'bg2-rgb': '16,16,16' },
    light: { ...SHARED, bg: '#f4f4f5', bg2: '#eaeaeb', inset: '#e4e4e5', track: '#e9e9ea', control: '#e9e9ea', surface: '#ffffff', b0: '#e0e0e0', b1: '#d4d4d5', b2: '#c7c7c7', b3: '#b0b0b1', tx: '#111111', tx2: '#313131', tx3: '#676768', txd: '#909091', txf: '#b0b0b1', accent: '#1a1a1a', accent2: '#1a1a1a', accentdim: '#666666', ad1: '#1a1a1a', ad2: '#171717', ad1h: '#353535', ad2h: '#1a1a1a', accentfg: '#ffffff', 'accent-rgb': '26,26,26', 'bg-rgb': '244,244,245', 'bg2-rgb': '234,234,235' },
  },
  grey: {
    dark: { ...SHARED, bg: '#0c0d10', bg2: '#16171a', inset: '#1c1d20', track: '#17181b', control: '#232427', surface: '#292b2e', b0: '#202124', b1: '#2c2d30', b2: '#393a3d', b3: '#505154', tx: '#eef0f3', tx2: '#ced0d3', tx3: '#989a9d', txd: '#6f7174', txf: '#505154', accent: '#9aa3b2', accent2: '#c3cad6', accentdim: '#5b6473', ad1: '#3c4047', ad2: '#24272c', ad1h: '#4c5159', ad2h: '#303339', accentfg: '#e9ebee', 'accent-rgb': '154,163,178', 'bg-rgb': '12,13,16', 'bg2-rgb': '22,23,26' },
    light: { ...SHARED, bg: '#f1f2f4', bg2: '#e7e8ea', inset: '#e2e3e5', track: '#e6e7e9', control: '#e6e7e9', surface: '#ffffff', b0: '#dddee0', b1: '#d2d3d6', b2: '#c5c6c9', b3: '#afb0b3', tx: '#15171b', tx2: '#343639', tx3: '#696a6d', txd: '#909295', txf: '#afb0b3', accent: '#9aa3b2', accent2: '#c3cad6', accentdim: '#5b6473', ad1: '#9aa3b2', ad2: '#888f9d', ad1h: '#a6aebb', ad2h: '#9aa3b2', accentfg: '#ffffff', 'accent-rgb': '154,163,178', 'bg-rgb': '241,242,244', 'bg2-rgb': '231,232,234' },
  },
  sage: {
    dark: { ...SHARED, bg: '#0a0d0a', bg2: '#141714', inset: '#1a1d1a', track: '#151915', control: '#212421', surface: '#282b28', b0: '#1f221f', b1: '#2a2d2a', b2: '#383b38', b3: '#4e524e', tx: '#eef3ee', tx2: '#ced3ce', tx3: '#979c97', txd: '#6e726e', txf: '#4e524e', accent: '#8ab48a', accent2: '#b6d6b6', accentdim: '#4e7a52', ad1: '#364636', ad2: '#202920', ad1h: '#445844', ad2h: '#2a372a', accentfg: '#e5efe5', 'accent-rgb': '138,180,138', 'bg-rgb': '10,13,10', 'bg2-rgb': '20,23,20' },
    light: { ...SHARED, bg: '#eef2ec', bg2: '#e4e8e2', inset: '#dfe3dd', track: '#e3e7e1', control: '#e3e7e1', surface: '#ffffff', b0: '#dadfd8', b1: '#cfd4ce', b2: '#c2c7c1', b3: '#acb1ab', tx: '#131a13', tx2: '#323831', tx3: '#666c65', txd: '#8e938d', txf: '#acb1ab', accent: '#8ab48a', accent2: '#b6d6b6', accentdim: '#4e7a52', ad1: '#8ab48a', ad2: '#799e79', ad1h: '#98bd98', ad2h: '#8ab48a', accentfg: '#ffffff', 'accent-rgb': '138,180,138', 'bg-rgb': '238,242,236', 'bg2-rgb': '228,232,226' },
  },
};

// Wizard/Settings theme picker metadata: label + the dark-mode accent swatch.
export const THEME_META: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'cyan', label: 'Cyan', swatch: THEMES.cyan.dark.accent },
  { id: 'crimson', label: 'Crimson', swatch: THEMES.crimson.dark.accent },
  { id: 'amber', label: 'Amber', swatch: THEMES.amber.dark.accent },
  { id: 'mono', label: 'Mono', swatch: THEMES.mono.dark.accent },
  { id: 'grey', label: 'Grey', swatch: THEMES.grey.dark.accent },
  { id: 'sage', label: 'Sage', swatch: THEMES.sage.dark.accent },
];

export const DEFAULT_THEME: ThemeId = 'cyan';
export const DEFAULT_MODE: ModeId = 'dark';

// Custom-logo slot. The wizard (step 5) and Settings store a logo the user
// uploads; it replaces the printer-name mark in the top bar. Kept as a data URL
// (or a Moonraker-served path) in the config store, not here. This is only the
// type so the top bar and Settings agree on the shape.
export interface LogoConfig {
  // A data: URL (png/svg/webp/jpg) or an http(s) path served by Moonraker.
  src: string | null;
  // Accessible name shown when no image is set, e.g. the printer displayName.
  alt: string;
}

// Derived, mode-dependent tokens from v1 (the [data-mode] rules). In dark mode
// seg-on and accent-ink follow accent2; in light mode accent2 collapses to
// accentdim and seg-on follows accentfg. Applied on top of the base set.
function modeDerived(set: TokenSet, mode: ModeId): TokenSet {
  if (mode === 'light') {
    return { ...set, accent2: set.accentdim, 'seg-on': set.accentfg, 'accent-ink': set.accentdim };
  }
  return { ...set, 'seg-on': set.accent2, 'accent-ink': set.accent2 };
}

// Write a theme+mode onto :root as inline CSS custom properties, and set the
// data-theme / data-mode attributes so any static CSS selectors still match.
// This makes tokens.ts the single source of truth: no parallel .css file to
// drift out of sync. Call from the config store when theme or mode changes.
export function applyTheme(theme: ThemeId, mode: ModeId): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  const set = modeDerived(THEMES[theme][mode], mode);
  for (const [name, value] of Object.entries(set)) {
    root.style.setProperty(`--${name}`, value);
  }
}
