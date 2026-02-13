/** Single source of truth for breakpoints (in px). */
export const breakpoints = {
  sm: 320,
  md: 640,
  lg: 1024,
  xl: 1440,
} as const;

export const media = {
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
};
