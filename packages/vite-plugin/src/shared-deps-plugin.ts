import type { Plugin, Rollup } from 'vite';
import type { SharedDependencyManifest } from '@esmap/shared';
import { createHash } from 'node:crypto';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

/** 공유 의존성 빌드 플러그인 옵션 */
export interface SharedDepsPluginOptions {
  /** 공유 의존성 엔트리. Key = 패키지 이름, value = import specifier 또는 경로 */
  readonly deps: Readonly<Record<string, string>>;
  /** 빌드 결과물 출력 디렉토리 */
  readonly outDir?: string;
  /** 매니페스트 출력 파일명 (기본: "shared-deps-manifest.json") */
  readonly outputFileName?: string;
}

/** 번들 청크에서 content hash를 계산한다 */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/** 파일명에 content hash를 삽입한다 (예: "react.js" → "react-a1b2c3d4.js") */
function insertContentHash(fileName: string, hash: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) {
    return `${fileName}-${hash}`;
  }
  return `${fileName.slice(0, dotIndex)}-${hash}${fileName.slice(dotIndex)}`;
}

/**
 * 공유 의존성을 개별 ESM 모듈로 빌드하고 SharedDependencyManifest를 생성하는 Vite 플러그인.
 * 각 의존성을 entry point로 설정하여 독립적인 ES 모듈로 빌드한 뒤,
 * content-hash 파일명으로 리네임하고 매니페스트 JSON을 출력한다.
 *
 * @param options - 플러그인 옵션
 */
export function esmapSharedDeps(options: SharedDepsPluginOptions): Plugin {
  const outputFileName = options.outputFileName ?? 'shared-deps-manifest.json';
  const depEntries = options.deps;

  return {
    name: 'esmap:shared-deps',
    apply: 'build',

    config() {
      const input: Record<string, string> = {};
      for (const [name, specifier] of Object.entries(depEntries)) {
        input[name] = specifier;
      }

      return {
        build: {
          rollupOptions: {
            input,
            output: {
              format: 'es' as const,
              entryFileNames: '[name].js',
            },
          },
        },
      };
    },

    async writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir ?? options.outDir ?? 'dist';
      await mkdir(outDir, { recursive: true });

      const manifests: readonly SharedDependencyManifest[] = await Promise.all(
        Object.keys(depEntries).map(async (depName) => {
          const chunk = findChunkForDep(bundle, depName);
          if (!chunk) {
            const emptyExports: Readonly<Record<string, string>> = {};
            return {
              name: depName,
              version: '0.0.0',
              exports: emptyExports,
            };
          }

          const hash = computeContentHash(chunk.code);
          const hashedFileName = insertContentHash(chunk.fileName, hash);

          const originalPath = join(outDir, chunk.fileName);
          const hashedPath = join(outDir, hashedFileName);
          await rename(originalPath, hashedPath);

          return {
            name: depName,
            version: '0.0.0',
            exports: {
              '.': hashedFileName,
            },
          };
        }),
      );

      const manifestPath = join(outDir, outputFileName);
      await writeFile(manifestPath, JSON.stringify(manifests, null, 2));
    },
  };
}

/** 번들에서 지정 의존성 이름에 해당하는 엔트리 청크를 찾는다 */
function findChunkForDep(
  bundle: Rollup.OutputBundle,
  depName: string,
): Rollup.OutputChunk | undefined {
  for (const chunk of Object.values(bundle)) {
    if (chunk.type === 'chunk' && chunk.isEntry && chunk.name === depName) {
      return chunk;
    }
  }
  // fallback: 파일명 기반 매칭
  for (const chunk of Object.values(bundle)) {
    if (chunk.type === 'chunk' && chunk.fileName.startsWith(depName)) {
      return chunk;
    }
  }
  return undefined;
}
