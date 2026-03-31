import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapSharedDeps } from '@esmap/vite-plugin';

/**
 * Shared dependency build configuration.
 * Builds React, ReactDOM as standalone ESM bundles with content-hash filenames.
 * These bundles are used by SharedModuleRegistry for runtime version negotiation.
 */
export default defineConfig({
  plugins: [
    esmapSharedDeps({
      deps: {
        react: resolve(__dirname, 'src/react-esm.js'),
        'react-dom': resolve(__dirname, 'src/react-dom-esm.js'),
      },
      outDir: resolve(__dirname, '../../dist/shared'),
      outputFileName: 'shared-deps-manifest.json',
    }),
  ],
  build: {
    outDir: resolve(__dirname, '../../dist/shared'),
    emptyOutDir: true,
    rollupOptions: {
      // Preserve named exports from CJS->ESM wrappers to prevent tree-shaking
      preserveEntrySignatures: 'strict',
    },
  },
});
