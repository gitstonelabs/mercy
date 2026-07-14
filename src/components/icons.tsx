// Inline SVG icon set, traced from the approved v2 prototype (Lucide-style:
// 1.75 stroke, round caps). One component, keyed paths; circles are encoded as
// arc paths so everything stays a <path>.

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const PATHS: Record<string, string[]> = {
  dashboard: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9.5 21v-6h5v6'],
  filament: [circle(12, 11, 7), circle(12, 11, 2.4), 'M12 18v3', 'M9.5 21h5'],
  files: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'],
  viewer: ['m21 8-9-5-9 5v8l9 5 9-5Z', 'm3 8 9 5 9-5', 'M12 13v8'],
  console: ['m4 17 6-5-6-5', 'M12 19h8'],
  heightmap: ['M3 16c3-6 6 2 9-3s6-1 9-6', 'M3 20h18'],
  history: [circle(12, 12, 9), 'M12 7v5l3 2'],
  machine: ['M7 7h10v10H7z', 'M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3'],
  webcam: ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z', circle(12, 13, 3.5)],
  settings: [
    circle(12, 12, 3),
    'M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.2-1.3L14 2h-4l-.4 2.5a7 7 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.3l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.2 1.3L10 22h4l.4-2.5a7 7 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12Z',
  ],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  power: ['M12 2v10', 'M18.4 6.6a9 9 0 1 1-12.77.04'],
  upload: ['M12 17V4', 'm6 10 6-6 6 6', 'M4 20h16'],
  stop: [circle(12, 12, 9), 'M9 9h6v6H9z'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronUp: ['m18 15-6-6-6 6'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5'],
  check: ['m5 12 5 5L20 7'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  more: [circle(5, 12, 1.6), circle(12, 12, 1.6), circle(19, 12, 1.6)],
  restart: ['M21 12a9 9 0 1 1-9-9', 'M21 3v6h-6'],
};

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, strokeWidth = 1.75 }: IconProps) {
  const paths = PATHS[name] ?? [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
