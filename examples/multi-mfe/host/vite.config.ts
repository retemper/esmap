import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

export default defineConfig({
  root: __dirname,
  server: {
    port: 3100,
    fs: {
      allow: [resolve(__dirname, '../../..')],
    },
  },
  plugins: [
    {
      name: 'serve-mfe-apps',
      configureServer(server) {
        const distAppsDir = resolve(__dirname, '../dist/apps');

        // /apps/* 요청을 dist/apps/*로 라우팅
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/apps/')) {
            next();
            return;
          }

          // query string 제거 (Vite가 ?import 등을 붙일 수 있음)
          const urlPath = req.url.split('?')[0];
          const filePath = resolve(distAppsDir, urlPath.slice(6));

          // 디렉토리 트래버설 방지
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
            // 존재하지 않는 앱 JS 파일 요청 시, HTML 폴백 대신 에러를 throw하는 JS 모듈을 반환한다.
            // 이렇게 해야 AppRegistry의 error boundary가 정상적으로 에러를 잡을 수 있다.
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
