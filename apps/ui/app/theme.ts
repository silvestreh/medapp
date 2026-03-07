import { createTheme, type MantineThemeOverride } from '@mantine/core';
import { breakpoints } from '~/media';

export const theme = createTheme({
  primaryColor: 'cyan',
  breakpoints: Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, `${v / 16}em`])) as Record<
    string,
    string
  >,
} as MantineThemeOverride);
