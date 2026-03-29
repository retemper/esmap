/**
 * 로컬 빌드 결과물로 import map 서버를 초기화하는 시드 스크립트.
 * dist/ 디렉토리의 esmap-manifest.json과 shared-deps-manifest.json을 읽어
 * 서버의 import map을 구성한다.
 *
 * 사용: pnpm seed (pnpm build 이후 실행)
 *
 * --dev 플래그를 전달하면 MFE 앱 엔트리를 각 Vite dev server URL로 매핑한다.
 * 공유 의존성과 디자인 시스템은 빌드 산출물을 그대로 사용한다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ImportMap, MfeManifest } from '@esmap/shared';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '../../../dist');
const DATA_DIR = resolve(__dirname, '../../../data');

/** HOST_BASE는 호스트 Vite dev server의 /apps 엔드포인트 (상대경로로 import map 주입 시 호스트 origin에서 해석된다) */
const HOST_BASE = '/apps';

/** --dev 플래그 여부. dev 모드에서는 MFE 앱이 개별 Vite dev server를 가리킨다. */
const isDev = process.argv.includes('--dev');

/** 각 MFE 앱 디렉토리에 대응하는 Vite dev server 포트 */
const DEV_PORTS: Record<string, number> = {
  auth: 3101,
  dashboard: 3102,
  'team-directory': 3103,
  'activity-feed': 3104,
  'task-board': 3105,
  notifications: 3106,
  'legacy-settings': 3107,
};

/** 기본 엔트리(src/index.tsx)와 다른 앱의 엔트리 파일 경로 */
const DEV_ENTRIES: Record<string, string> = {
  'legacy-settings': 'src/index.ts',
};

/** 매니페스트 파일에서 앱 이름과 엔트리를 읽어 import map 엔트리로 변환한다 */
async function readManifest(appDir: string): Promise<{ name: string; entry: string } | null> {
  try {
    const manifestPath = join(DIST_DIR, 'apps', appDir, 'esmap-manifest.json');
    const content = await readFile(manifestPath, 'utf-8');
    const manifest: MfeManifest = JSON.parse(content);
    return { name: manifest.name, entry: manifest.entry };
  } catch {
    console.warn(`[seed] ${appDir}/esmap-manifest.json 없음, 건너뜀`);
    return null;
  }
}

/** 로컬 빌드 결과물에서 import map을 조합하여 data 디렉토리에 저장한다 */
async function seed(): Promise<void> {
  const imports: Record<string, string> = {};

  // 1. 공유 의존성 매핑
  try {
    const sharedManifestPath = join(DIST_DIR, 'shared', 'shared-deps-manifest.json');
    const sharedContent = await readFile(sharedManifestPath, 'utf-8');
    const sharedManifests: readonly { name: string; exports: Record<string, string> }[] =
      JSON.parse(sharedContent);

    for (const dep of sharedManifests) {
      const entryFile = dep.exports['.'];
      if (entryFile) {
        imports[dep.name] = `${HOST_BASE}/shared/${entryFile}`;
      }
    }
  } catch {
    console.warn('[seed] shared-deps-manifest.json 없음, 공유 의존성 건너뜀');
  }

  // 2. 디자인 시스템 매핑
  try {
    const dsManifestPath = join(DIST_DIR, 'design-system', 'esmap-manifest.json');
    const dsContent = await readFile(dsManifestPath, 'utf-8');
    const dsManifest: MfeManifest = JSON.parse(dsContent);
    imports[dsManifest.name] = `${HOST_BASE}/design-system/${dsManifest.entry}`;
  } catch {
    console.warn('[seed] design-system manifest 없음, 건너뜀');
  }

  // 3. MFE 앱 매핑
  const appDirs = ['auth', 'dashboard', 'team-directory', 'activity-feed', 'task-board', 'notifications', 'legacy-settings'];

  if (isDev) {
    for (const appDir of appDirs) {
      const port = DEV_PORTS[appDir];
      if (port === undefined) {
        console.warn(`[seed] ${appDir}의 dev port 매핑 없음, 건너뜀`);
        continue;
      }
      const entry = DEV_ENTRIES[appDir] ?? 'src/index.tsx';
      imports[`@enterprise/${appDir}`] = `http://localhost:${port}/${entry}`;
    }
  } else {
    for (const appDir of appDirs) {
      const result = await readManifest(appDir);
      if (result) {
        imports[result.name] = `${HOST_BASE}/${appDir}/${result.entry}`;
      }
    }
  }

  // 4. import map 작성
  const importMap: ImportMap = { imports };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'importmap.json'), JSON.stringify(importMap, null, 2));
  await writeFile(join(DATA_DIR, 'history.json'), JSON.stringify([]));

  console.log('[seed] Import map 생성 완료:');
  console.log(JSON.stringify(importMap, null, 2));
}

seed().catch((err) => {
  console.error('[seed] 실패:', err);
  process.exit(1);
});
