import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';

/**
 * esmap DevTools Extension 빌드 설정.
 *
 * Chrome MV3 content script는 ES module을 지원하지 않으므로
 * 모든 진입점을 IIFE로 빌드하고 정적 파일(HTML, manifest)은 복사한다.
 */

/** 정적 파일을 dist/로 복사하는 플러그인 */
function copyStaticFiles(): Plugin {
  return {
    name: 'copy-static',
    async writeBundle() {
      const dist = resolve(__dirname, 'dist');
      await mkdir(dist, { recursive: true });
      await Promise.all(
        ['manifest.json', 'devtools.html', 'panel.html'].map((file) =>
          copyFile(resolve(__dirname, file), resolve(dist, file)),
        ),
      );
    },
  };
}

export default defineConfig({
  plugins: [copyStaticFiles()],
  build: {
    outDir: 'dist',
    emptyDirOnce: true,
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, 'src/devtools.ts'),
        panel: resolve(__dirname, 'src/panel.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        'content-script': resolve(__dirname, 'src/content-script.ts'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    target: 'chrome120',
    minify: false,
    sourcemap: true,
  },
});
