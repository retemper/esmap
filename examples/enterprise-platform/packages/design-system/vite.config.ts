import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapManifest } from '@esmap/vite-plugin';

/**
 * 디자인 시스템 빌드 설정.
 * React를 external로 처리하여 공유 의존성 번들을 재사용한다.
 * 여러 MFE가 import map을 통해 동일한 디자인 시스템 인스턴스를 소비한다.
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
