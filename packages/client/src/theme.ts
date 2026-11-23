/** Kiwanja brand tokens (temporary identity). Mirrors apps/web/tailwind.config.js; mobile StyleSheets use these. */
export const colors = {
  ink: '#0B1A14',
  paper: '#F6F5F0',
  white: '#FFFFFF',
  pitch: '#0E7C66',
  pitchDark: '#09503F',
  pitchLight: '#E7F5F1',
  gold: '#F2B705',
  goldLight: '#FFF8DD',
  clay: '#E4572E',
  clayLight: '#FDECE6',
  sky: '#3A86FF',
  muted: 'rgba(11,26,20,0.55)',
  faint: 'rgba(11,26,20,0.08)',
  line: 'rgba(11,26,20,0.1)',
} as const;

export const fonts = { display: 'Sora', body: 'Inter', mono: 'JetBrains Mono' } as const;

export const ORIGIN_SHORT: Record<string, string> = { SAMPLE: 'Sample', MANUAL: 'Manual', IMPORTED: 'Imported', DEVICE: 'Device', VIDEO: 'Video' };

export const POSITION_COLOR: Record<string, string> = { GK: '#F2B705', DEF: '#0E7C66', MID: '#3A86FF', FWD: '#E4572E' };
