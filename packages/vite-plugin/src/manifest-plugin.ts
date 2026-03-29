import type { Plugin } from 'vite';
import type { MfeManifest } from '@esmap/shared';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** MFE manifest 생성 플러그인 옵션 */
export interface ManifestPluginOptions {
  /** MFE 앱 이름 (예: "@flex/checkout") */
  readonly name: string;
  /** MFE 앱 버전. 미지정 시 package.json에서 읽어온다 */
  readonly version?: string;
  /** 공유 의존성 목록. Vite externals로 설정되고 manifest에 기록된다 */
  readonly shared?: readonly string[];
  /** 내부 패키지 의존성 목록 */
  readonly internal?: readonly string[];
  /** manifest 출력 파일명 (기본: "esmap-manifest.json") */
  readonly outputFileName?: string;
}

/**
 * Vite 빌드 후 MFE manifest JSON을 자동 생성하는 플러그인.
 * 빌드 결과물의 파일명(content hash 포함)을 분석하여 manifest를 생성한다.
 *
 * @param options - 플러그인 옵션
 */
export function esmapManifest(options: ManifestPluginOptions): Plugin {
  const outputFileName = options.outputFileName ?? 'esmap-manifest.json';
  const sharedDeps = options.shared ?? [];
  const internalDeps = options.internal ?? [];

  return {
    name: 'esmap:manifest',
    apply: 'build',

    config() {
      // 공유 의존성을 Vite externals로 설정하여 번들에서 제외한다
      if (sharedDeps.length > 0) {
        return {
          build: {
            rollupOptions: {
              external: [...sharedDeps],
            },
          },
        };
      }
      return {};
    },

    async writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir ?? 'dist';

      const assets: string[] = [];
      const modulepreload: string[] = [];
      const jsFiles: string[] = [];

      for (const [fileName, chunk] of Object.entries(bundle)) {
        assets.push(fileName);

        if (fileName.endsWith('.js')) {
          jsFiles.push(fileName);

          // 엔트리 청크와 그 직계 import를 modulepreload 후보로 추가
          if (chunk.type === 'chunk' && (chunk.isEntry || chunk.isDynamicEntry)) {
            modulepreload.push(fileName);
          }
        }
      }

      // 엔트리 파일 결정: isEntry인 chunk를 찾거나, 첫 번째 JS 파일 사용
      const entryChunk = Object.values(bundle).find(
        (chunk) => chunk.type === 'chunk' && chunk.isEntry,
      );
      const entry = entryChunk ? entryChunk.fileName : (jsFiles[0] ?? 'index.js');

      const version = options.version ?? (await readPackageVersion(process.cwd()));

      const manifest: MfeManifest = {
        name: options.name,
        version,
        entry,
        assets: assets.sort(),
        dependencies: {
          shared: [...sharedDeps],
          internal: [...internalDeps],
        },
        modulepreload: modulepreload.sort(),
      };

      const manifestPath = join(outDir, outputFileName);
      await mkdir(outDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    },
  };
}

/** package.json에서 version을 읽어온다. 실패 시 "0.0.0"을 반환한다. */
async function readPackageVersion(cwd: string): Promise<string> {
  try {
    const pkgPath = join(cwd, 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg: unknown = JSON.parse(content);
    if (typeof pkg === 'object' && pkg !== null && 'version' in pkg) {
      return String(pkg.version);
    }
  } catch {
    // package.json이 없거나 읽기 실패
  }
  return '0.0.0';
}
