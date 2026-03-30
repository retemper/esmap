import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest } from '@esmap/vite-plugin';

/**
 * Legacy Settings MFE build configuration.
 * Vanilla JS (framework agnostic) — demonstrates that esmap works outside React.
 * Converts existing Module Federation config to import map via @esmap/compat.
 */
export default defineConfig(({ command }) => ({
  root: __dirname,
  cacheDir: resolve(__dirname, '../../node_modules/.vite/deps-legacy-settings'),
  define: command === 'build' ? { 'process.env.NODE_ENV': '"production"' } : {},
  server: {
    port: 3107,
    strictPort: true,
    cors: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'legacy-settings',
    },
    outDir: resolve(__dirname, '../../dist/apps/legacy-settings'),
    emptyOutDir: true,
    rollupOptions: {
      external: [],
    },
  },
  plugins: [
    esmapManifest({
      name: '@enterprise/legacy-settings',
      version: '1.0.0',
    }),
  ],
}));
