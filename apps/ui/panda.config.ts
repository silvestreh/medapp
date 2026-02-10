import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: false,
  jsxFramework: 'react',
  include: ['./app/routes/**/*.{ts,tsx}', './app/components/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'app/styled-system',
  theme: {
    extend: {
      breakpoints: {
        sm: '320px',
        md: '640px',
        lg: '1024px',
        xl: '1440px',
      },
    },
  },
});
