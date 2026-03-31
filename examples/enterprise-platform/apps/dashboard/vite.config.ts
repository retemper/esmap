import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest, esmapCssScope } from '@esmap/vite-plugin';
import { mfeDevExternals } from '../_shared/dev-externals-plugin.js';

/**
 * Dashboard MFE build configuration.
 * Externalizes React and design system.
 * A composite MFE that includes a nested Parcel (activity-feed widget).
 */
export default defineConfig(({ command }) => ({
  root: __dirname,
  cacheDir: resolve(__dirname, '../../node_modules/.vite/deps-dashboard'),
  define: command === 'build' ? { 'process.env.NODE_ENV': '"production"' } : {},
  server: {
    port: 3102,
    strictPort: true,
    cors: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'dashboard',
    },
    outDir: resolve(__dirname, '../../dist/apps/dashboard'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['react', 'react-dom', '@enterprise/design-system', '@enterprise/activity-feed'],
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  plugins: [
    mfeDevExternals(),
    esmapManifest({
      name: '@enterprise/dashboard',
      version: '1.0.0',
      shared: ['react', 'react-dom', '@enterprise/design-system'],
    }),
    esmapCssScope({ appName: '@enterprise/dashboard' }),
  ],
}));
