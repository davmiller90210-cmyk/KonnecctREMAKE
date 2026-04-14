/* oxlint-disable twenty/no-hardcoded-colors -- canonical editorial palette (hex source of truth for Linaria chat theme) */
/**
 * Editorial / “Nexus” communication palette (from Stitch HTML Tailwind config).
 * Use these hex values in Linaria `styled` blocks — not Tailwind in the app bundle.
 *
 * **Tailwind class → token** (from mocks): `bg-[#0e0e0e]` → `surface`;
 * `bg-[#191a1a]` / panels → `surfaceContainer`; `bg-[#1f2020]` → `surfaceContainerHigh`;
 * `text-[#e7e5e4]` → `onSurface`; muted copy `text-[#acabaa]` → `onSurfaceVariant`;
 * accent / links `text-[#c2c1ff]` → `primary`; borders `border-[#484848]` → `outlineVariant`;
 * soft dividers → `outlineVariantGhost`; glass cards: background `glassPanel` + `backdrop-filter: ${glassBlur}`;
 * error states → `error` / `errorContainer` / `onErrorContainer`.
 */
export const editorialChatTheme = {
  surface: '#0e0e0e',
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#131313',
  surfaceContainer: '#191a1a',
  surfaceContainerHigh: '#1f2020',
  surfaceContainerHighest: '#252626',
  surfaceBright: '#2c2c2c',
  surfaceVariant: '#252626',
  primary: '#c2c1ff',
  /** Secondary CTA outline on the workspace rail */
  primaryMutedBorder: 'rgba(194, 193, 255, 0.35)',
  onPrimary: '#2c23b6',
  primaryContainer: '#332dbc',
  onPrimaryContainer: '#cdccff',
  inversePrimary: '#4e4bd5',
  onSurface: '#e7e5e4',
  onSurfaceVariant: '#acabaa',
  secondary: '#9f9da0',
  outlineVariant: '#484848',
  outlineVariantGhost: 'rgba(72, 72, 72, 0.15)',
  error: '#ec7c8a',
  errorContainer: '#7f2737',
  onError: '#490013',
  onErrorContainer: '#ff97a3',
  glassPanel:
    'linear-gradient(180deg, rgba(31, 32, 32, 0.72) 0%, rgba(31, 32, 32, 0.65) 100%)',
  glassBlur: 'blur(24px)',
  shadowElevated: '0px 20px 40px rgba(0, 0, 0, 0.4)',
  radiusSm: '4px',
  radiusMd: '8px',
  radiusLg: '12px',
  radiusXl: '16px',
  radiusFull: '9999px',
  fontStack: `'Inter', ${[
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    'sans-serif',
  ].join(', ')}`,
} as const;

export type EditorialChatTheme = typeof editorialChatTheme;
