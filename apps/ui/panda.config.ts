import { defineConfig } from '@pandacss/dev';
import { breakpoints } from './app/media';

export default defineConfig({
  preflight: false,
  jsxFramework: 'react',
  include: ['./app/routes/**/*.{ts,tsx}', './app/components/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'app/styled-system',
  theme: {
    extend: {
      breakpoints: Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, `${v}px`])),
    },
  },
});
