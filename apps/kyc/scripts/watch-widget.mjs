import { readFileSync, watchFile } from 'fs';
import { context } from 'esbuild';
import { execSync } from 'child_process';

// Build CSS first
console.log('[widget] Building CSS...');
execSync('pnpm run build:widget-css', { stdio: 'inherit' });

let css = readFileSync('public/widget-styles.css', 'utf-8');

const ctx = await context({
  entryPoints: ['src/widget-page/client/index.tsx'],
  bundle: true,
  outfile: 'public/widget.js',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  define: {
    '__WIDGET_CSS__': JSON.stringify(css),
  },
});

await ctx.watch();
console.log('[widget] Watching for changes...');

// Also watch the CSS source and rebuild when it changes
watchFile('public/widget-styles.css', { interval: 1000 }, async () => {
  console.log('[widget] CSS changed, rebuilding...');
  css = readFileSync('public/widget-styles.css', 'utf-8');
  await ctx.dispose();

  const newCtx = await context({
    entryPoints: ['src/widget-page/client/index.tsx'],
    bundle: true,
    outfile: 'public/widget.js',
    platform: 'browser',
    target: 'es2020',
    jsx: 'automatic',
    define: {
      '__WIDGET_CSS__': JSON.stringify(css),
    },
  });
  await newCtx.watch();
});
