import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

export default defineConfig({
  root: __dirname,
  server: {
    port: 3100,
    fs: {
      allow: [resolve(__dirname, '../..')],
    },
  },
  plugins: [
    {
      name: 'serve-mfe-apps',
      configureServer(server) {
        const distAppsDir = resolve(__dirname, 'dist/apps');

        // Route /apps/* requests to dist/apps/*
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/apps/')) {
            next();
            return;
          }

          // Remove query string (Vite may append ?import etc.)
          const urlPath = req.url.split('?')[0];
          const filePath = resolve(distAppsDir, urlPath.slice(6));

          // Prevent directory traversal
          if (!filePath.startsWith(distAppsDir)) {
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
            // For non-existent app JS file requests, return a JS module that throws an error instead of HTML fallback.
            // This allows AppRegistry's error boundary to properly catch the error.
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
