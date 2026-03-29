import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest } from '@esmap/vite-plugin';

/**
 * Legacy Settings MFE 빌드 설정.
 * Vanilla JS (프레임워크 무관) — esmap이 React 외 환경에서도 동작함을 시연.
 * @esmap/compat로 기존 Module Federation 설정을 import map으로 변환한다.
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
