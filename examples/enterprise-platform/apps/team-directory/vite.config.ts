import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest, esmapCssScope } from '@esmap/vite-plugin';
import { mfeDevExternals } from '../_shared/dev-externals-plugin.js';

/**
 * Team Directory MFE 빌드 설정.
 * keepAlive 상태 보존 + MFE 내부 레이지 서브모듈 시연.
 */
export default defineConfig(({ command }) => ({
  root: __dirname,
  cacheDir: resolve(__dirname, '../../node_modules/.vite/deps-team-directory'),
  define: command === 'build' ? { 'process.env.NODE_ENV': '"production"' } : {},
  server: {
    port: 3103,
    strictPort: true,
    cors: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'team-directory',
    },
    outDir: resolve(__dirname, '../../dist/apps/team-directory'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['react', 'react-dom', '@enterprise/design-system'],
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  plugins: [
    mfeDevExternals(),
    esmapManifest({
      name: '@enterprise/team-directory',
      version: '1.0.0',
      shared: ['react', 'react-dom', '@enterprise/design-system'],
    }),
    esmapCssScope({ appName: '@enterprise/team-directory' }),
  ],
}));
