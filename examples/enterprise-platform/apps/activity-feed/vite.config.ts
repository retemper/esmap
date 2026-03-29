import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest, esmapCssScope } from '@esmap/vite-plugin';
import { mfeDevExternals } from '../_shared/dev-externals-plugin.js';

/**
 * Activity Feed MFE 빌드 설정.
 * 라우트 기반 독립 앱 + Parcel 위젯 듀얼 모드로 동작한다.
 */
export default defineConfig(({ command }) => ({
  root: __dirname,
  cacheDir: resolve(__dirname, '../../node_modules/.vite/deps-activity-feed'),
  define: command === 'build' ? { 'process.env.NODE_ENV': '"production"' } : {},
  server: {
    port: 3104,
    strictPort: true,
    cors: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'activity-feed',
    },
    outDir: resolve(__dirname, '../../dist/apps/activity-feed'),
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
      name: '@enterprise/activity-feed',
      version: '1.0.0',
      shared: ['react', 'react-dom', '@enterprise/design-system'],
    }),
    esmapCssScope({ appName: '@enterprise/activity-feed' }),
  ],
}));
