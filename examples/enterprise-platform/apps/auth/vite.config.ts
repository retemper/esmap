import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest, esmapCssScope } from '@esmap/vite-plugin';

/**
 * Auth MFE build configuration.
 * Externalizes React and applies build-time CSS scoping.
 */
export default defineConfig(({ command }) => ({
  root: __dirname,
  cacheDir: resolve(__dirname, '../../node_modules/.vite/deps-auth'),
  define: command === 'build' ? { 'process.env.NODE_ENV': '"production"' } : {},
  server: {
    port: 3101,
    strictPort: true,
    cors: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'auth',
    },
    outDir: resolve(__dirname, '../../dist/apps/auth'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  plugins: [
    esmapManifest({
      name: '@enterprise/auth',
      version: '1.0.0',
      shared: ['react', 'react-dom'],
    }),
    esmapCssScope({ appName: '@enterprise/auth' }),
  ],
}));
