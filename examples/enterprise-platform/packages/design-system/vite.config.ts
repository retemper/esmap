import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest } from '@esmap/vite-plugin';

/**
 * Design system build configuration.
 * Externalizes React to reuse the shared dependency bundle.
 * Multiple MFEs consume the same design system instance via import map.
 */
export default defineConfig({
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'design-system',
    },
    outDir: resolve(__dirname, '../../dist/design-system'),
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
      name: '@enterprise/design-system',
      version: '1.0.0',
      shared: ['react', 'react-dom'],
    }),
  ],
});
