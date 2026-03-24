import { readFileSync } from 'fs';
import { build } from 'esbuild';

const css = readFileSync('public/admin-styles.css', 'utf-8');

await build({
  entryPoints: ['src/admin-page/client/index.tsx'],
  bundle: true,
  minify: true,
  outfile: 'public/admin.js',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  define: {
    '__ADMIN_CSS__': JSON.stringify(css),
  },
});
