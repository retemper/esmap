import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest } from '@esmap/vite-plugin';

export default defineConfig({
  root: __dirname,
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'app-home',
    },
    outDir: resolve(__dirname, '../../dist/apps/app-home'),
    emptyOutDir: true,
  },
  plugins: [
    esmapManifest({
      name: 'app-home',
      version: '1.0.0',
    }),
  ],
});
