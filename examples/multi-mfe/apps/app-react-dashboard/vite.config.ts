import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest } from '@esmap/vite-plugin';

export default defineConfig({
  root: __dirname,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'app-react-dashboard',
    },
    outDir: resolve(__dirname, '../../dist/apps/app-react-dashboard'),
    emptyOutDir: true,
  },
  esbuild: {
    jsx: 'automatic',
  },
  plugins: [
    esmapManifest({
      name: 'app-react-dashboard',
      version: '1.0.0',
    }),
  ],
});
