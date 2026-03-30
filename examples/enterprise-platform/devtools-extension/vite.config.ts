import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';

/**
 * esmap DevTools Extension build configuration.
 *
 * Since Chrome MV3 content scripts do not support ES modules,
 * all entry points are built as IIFE and static files (HTML, manifest) are copied.
 */

/** Plugin that copies static files to dist/ */
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
