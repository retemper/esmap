import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

export default defineConfig({
  root: __dirname,
  cacheDir: resolve(__dirname, '../../node_modules/.vite/deps-shell'),
  server: {
    port: 3100,
    strictPort: true,
    fs: {
      allow: [resolve(__dirname, '../../..')],
    },
  },
  plugins: [
    {
      name: 'serve-mfe-apps',
      configureServer(server) {
        const distDir = resolve(__dirname, '../../dist');

        /**
         * Routes /apps/* requests to subdirectories under dist/.
         * Structure: /apps/{appName}/{fileName} -> dist/apps/{appName}/{fileName}
         *            /apps/shared/{fileName}    -> dist/shared/{fileName}
         *            /apps/design-system/{file} -> dist/design-system/{file}
         */
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/apps/')) {
            next();
            return;
          }

          const urlPath = req.url.split('?')[0];
          const relativePath = urlPath.slice(6); // Remove '/apps/'

          // shared/, design-system/ are at dist root, others under dist/apps/
          const isInfra =
            relativePath.startsWith('shared/') || relativePath.startsWith('design-system/');
          const filePath = isInfra
            ? resolve(distDir, relativePath)
            : resolve(distDir, 'apps', relativePath);

          // Prevent directory traversal
          if (!filePath.startsWith(distDir)) {
            next();
            return;
          }

          try {
            const content = await readFile(filePath);
            const ext = filePath.split('.').pop();
            const contentTypes: Record<string, string> = {
              js: 'application/javascript',
              css: 'text/css',
              json: 'application/json',
            };
            res.setHeader('Content-Type', contentTypes[ext ?? ''] ?? 'application/octet-stream');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(content);
          } catch {
            const ext = filePath.split('.').pop();
            if (ext === 'js') {
              res.setHeader('Content-Type', 'application/javascript');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(`throw new Error("MFE module not found: ${urlPath}");`);
              return;
            }
            next();
          }
        });
      },
    },
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (
            req.url &&
            !req.url.startsWith('/apps/') &&
            !req.url.startsWith('/src/') &&
            !req.url.startsWith('/@') &&
            !req.url.startsWith('/node_modules/') &&
            !req.url.includes('.')
          ) {
            req.url = '/index.html';
          }
          next();
        });
      },
    },
  ],
});
