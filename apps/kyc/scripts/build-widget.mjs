import { readFileSync } from 'fs';
import { build } from 'esbuild';

// Read the compiled CSS to inline into the Shadow DOM
const css = readFileSync('public/widget-styles.css', 'utf-8');

await build({
  entryPoints: ['src/widget-page/client/index.tsx'],
  bundle: true,
  minify: true,
  outfile: 'public/widget.js',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  define: {
    '__WIDGET_CSS__': JSON.stringify(css),
  },
});
