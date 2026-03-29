import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { esmapSharedDeps } from '@esmap/vite-plugin';

/**
 * 공유 의존성 빌드 설정.
 * React, ReactDOM을 독립 ESM 번들로 빌드하고 content-hash 파일명으로 출력한다.
 * SharedModuleRegistry가 런타임에 버전 협상을 수행할 때 이 번들을 사용한다.
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
      // CJS→ESM 래퍼의 named export가 tree-shake되지 않도록 보존한다
      preserveEntrySignatures: 'strict',
    },
  },
});
