import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { esmapSharedDeps } from './shared-deps-plugin.js';
import type { Plugin, Rollup } from 'vite';
import { readFile, rm, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

/** writeBundle 훅을 추출하여 실행하는 헬퍼 */
async function callWriteBundle(
  plugin: Plugin,
  outDir: string,
  bundle: Rollup.OutputBundle,
): Promise<void> {
  const hook = plugin.writeBundle;
  if (typeof hook !== 'function') throw new Error('writeBundle hook이 없음');

  // writeBundle 전에 번들의 원본 파일을 디스크에 기록한다
  await mkdir(outDir, { recursive: true });
  for (const chunk of Object.values(bundle)) {
    if (chunk.type === 'chunk') {
      const { writeFile: writeFileFs } = await import('node:fs/promises');
      await writeFileFs(join(outDir, chunk.fileName), chunk.code, 'utf-8');
    }
  }

  const outputOptions = { dir: outDir } as Rollup.NormalizedOutputOptions;
  await hook.call({} as never, outputOptions, bundle);
}

/** 테스트용 OutputChunk 생성 */
function createChunk(
  fileName: string,
  name: string,
  code: string,
  isEntry = true,
): Rollup.OutputChunk {
  return {
    type: 'chunk',
    fileName,
    name,
    isEntry,
    isDynamicEntry: false,
    isImplicitEntry: false,
    code,
    facadeModuleId: null,
    imports: [],
    dynamicImports: [],
    modules: {},
    exports: [],
    referencedFiles: [],
    implicitlyLoadedBefore: [],
    importedBindings: {},
    map: null,
    sourcemapFileName: null,
    preliminaryFileName: fileName,
    moduleIds: [],
  };
}

/** 문자열의 content hash를 계산하는 헬퍼 */
function expectedHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

describe('esmapSharedDeps', () => {
  const testDir = join(tmpdir(), `esmap-shared-deps-test-${Date.now()}`);

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('플러그인 이름이 esmap:shared-deps이다', () => {
    const plugin = esmapSharedDeps({ deps: { react: 'react' } });
    expect(plugin.name).toBe('esmap:shared-deps');
  });

  it('빌드 시에만 적용된다', () => {
    const plugin = esmapSharedDeps({ deps: { react: 'react' } });
    expect(plugin.apply).toBe('build');
  });

  it('config 훅이 rollup input과 ES 포맷을 설정한다', () => {
    const plugin = esmapSharedDeps({
      deps: { react: 'react', lodash: 'lodash-es' },
    });

    const configHook = plugin.config;
    if (typeof configHook !== 'function') throw new Error('config hook이 없음');

    const result = configHook.call({} as never, {} as never, {} as never);
    expect(result).toStrictEqual({
      build: {
        rollupOptions: {
          input: { react: 'react', lodash: 'lodash-es' },
          output: {
            format: 'es',
            entryFileNames: '[name].js',
          },
        },
      },
    });
  });

  it('매니페스트가 올바른 형식으로 생성된다', async () => {
    const reactCode = 'export const useState = () => {};';
    const plugin = esmapSharedDeps({
      deps: { react: 'react' },
    });

    const bundle: Rollup.OutputBundle = {
      'react.js': createChunk('react.js', 'react', reactCode),
    };

    await callWriteBundle(plugin, testDir, bundle);

    const manifestPath = join(testDir, 'shared-deps-manifest.json');
    const content = await readFile(manifestPath, 'utf-8');
    const manifests: unknown = JSON.parse(content);

    expect(Array.isArray(manifests)).toBe(true);
    const arr = manifests as readonly Record<string, unknown>[];
    expect(arr).toHaveLength(1);
    expect(arr[0]).toHaveProperty('name', 'react');
    expect(arr[0]).toHaveProperty('version', '0.0.0');
    expect(arr[0]).toHaveProperty('exports');
  });

  it('content-hash 파일명이 포함된다', async () => {
    const reactCode = 'export const useState = () => {};';
    const hash = expectedHash(reactCode);

    const plugin = esmapSharedDeps({
      deps: { react: 'react' },
    });

    const bundle: Rollup.OutputBundle = {
      'react.js': createChunk('react.js', 'react', reactCode),
    };

    await callWriteBundle(plugin, testDir, bundle);

    const manifestPath = join(testDir, 'shared-deps-manifest.json');
    const content = await readFile(manifestPath, 'utf-8');
    const manifests = JSON.parse(content) as readonly Record<string, unknown>[];

    const reactManifest = manifests[0];
    const exports = reactManifest.exports as Record<string, string>;
    expect(exports['.']).toBe(`react-${hash}.js`);

    // content-hash 파일이 디스크에 존재한다
    const files = await readdir(testDir);
    expect(files).toContain(`react-${hash}.js`);
    // 원본 파일명은 리네임되어 존재하지 않는다
    expect(files).not.toContain('react.js');
  });

  it('exports 매핑이 올바르다', async () => {
    const reactCode = 'export const useState = () => {};';
    const lodashCode = 'export const debounce = () => {};';

    const plugin = esmapSharedDeps({
      deps: { react: 'react', lodash: 'lodash-es' },
    });

    const bundle: Rollup.OutputBundle = {
      'react.js': createChunk('react.js', 'react', reactCode),
      'lodash.js': createChunk('lodash.js', 'lodash', lodashCode),
    };

    await callWriteBundle(plugin, testDir, bundle);

    const content = await readFile(join(testDir, 'shared-deps-manifest.json'), 'utf-8');
    const manifests = JSON.parse(content) as readonly {
      name: string;
      version: string;
      exports: Record<string, string>;
    }[];

    const reactManifestEntry = manifests.find((m) => m.name === 'react');
    const lodashManifestEntry = manifests.find((m) => m.name === 'lodash');
    const reactExports = reactManifestEntry?.exports;
    const lodashExports = lodashManifestEntry?.exports;

    expect(reactExports).toStrictEqual({ '.': `react-${expectedHash(reactCode)}.js` });
    expect(lodashExports).toStrictEqual({ '.': `lodash-${expectedHash(lodashCode)}.js` });
  });

  it('기본 출력 파일명이 적용된다', async () => {
    const plugin = esmapSharedDeps({
      deps: { react: 'react' },
    });

    const bundle: Rollup.OutputBundle = {
      'react.js': createChunk('react.js', 'react', 'export default {}'),
    };

    await callWriteBundle(plugin, testDir, bundle);

    const files = await readdir(testDir);
    expect(files).toContain('shared-deps-manifest.json');
  });

  it('커스텀 출력 파일명이 적용된다', async () => {
    const plugin = esmapSharedDeps({
      deps: { react: 'react' },
      outputFileName: 'custom-shared.json',
    });

    const bundle: Rollup.OutputBundle = {
      'react.js': createChunk('react.js', 'react', 'export default {}'),
    };

    await callWriteBundle(plugin, testDir, bundle);

    const files = await readdir(testDir);
    expect(files).toContain('custom-shared.json');
    expect(files).not.toContain('shared-deps-manifest.json');
  });
});
