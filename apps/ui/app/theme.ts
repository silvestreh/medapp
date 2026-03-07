import { createTheme, type MantineThemeOverride } from '@mantine/core';
import { breakpoints } from '~/media';

export const theme = createTheme({
  primaryColor: 'cyan',
  primaryShade: 4,
  breakpoints: Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, `${v / 16}em`])) as Record<
    string,
    string
  >,
  components: {
    Table: {
      styles: {
        thead: {
          backgroundColor: 'var(--mantine-primary-color-0)',
        },
      },
    },
  },
} as MantineThemeOverride);
