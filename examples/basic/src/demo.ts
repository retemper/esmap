/**
 * 기본 데모: import map 생성 파이프라인.
 * 설정 + 매니페스트 → import map JSON 생성 과정을 보여준다.
 */
import { defineConfig } from '@esmap/config';
import { generateImportMap } from '@esmap/cli';
import type { MfeManifest, SharedDependencyManifest } from '@esmap/shared';

// 1. 프레임워크 설정 정의
const config = defineConfig({
  apps: {
    '@flex/people': {
      path: 'apps/people',
      activeWhen: '/people',
    },
    '@flex/payroll': {
      path: 'apps/payroll',
      activeWhen: '/payroll',
    },
    '@flex/time-tracking': {
      path: 'apps/time-tracking',
      activeWhen: '/time-tracking',
    },
  },
  shared: {
    react: { global: true },
    'react-dom': { global: true },
    '@flex-design-system/fx': { global: true },
  },
  cdnBase: 'https://cdn.flex.team',
});

// 2. 각 MFE가 빌드 시 생성한 매니페스트 (시뮬레이션)
const manifests: Record<string, MfeManifest> = {
  '@flex/people': {
    name: '@flex/people',
    version: '3.2.1',
    entry: 'people-a1b2c3d4.js',
    assets: ['people-a1b2c3d4.js', 'people-styles-e5f6g7h8.css'],
    dependencies: {
      shared: ['react', 'react-dom', '@flex-design-system/fx'],
      internal: ['@flex-packages/router', '@flex-packages/i18n'],
    },
    modulepreload: ['people-a1b2c3d4.js', 'people-list-i9j0k1l2.js'],
  },
  '@flex/payroll': {
    name: '@flex/payroll',
    version: '2.0.0',
    entry: 'payroll-m3n4o5p6.js',
    assets: ['payroll-m3n4o5p6.js'],
    dependencies: {
      shared: ['react', 'react-dom'],
      internal: [],
    },
    modulepreload: ['payroll-m3n4o5p6.js'],
  },
  '@flex/time-tracking': {
    name: '@flex/time-tracking',
    version: '1.5.0',
    entry: 'time-tracking-q7r8s9t0.js',
    assets: ['time-tracking-q7r8s9t0.js'],
    dependencies: {
      shared: ['react', 'react-dom', '@flex-design-system/fx'],
      internal: ['@flex-packages/router'],
    },
    modulepreload: ['time-tracking-q7r8s9t0.js', 'time-tracking-calendar-u1v2w3x4.js'],
  },
};

// 3. 공유 의존성 빌드 결과물 매니페스트 (시뮬레이션)
const sharedManifests: Record<string, SharedDependencyManifest> = {
  react: {
    name: 'react',
    version: '18.3.1',
    exports: {
      '.': 'shared/react@18.3.1/react.production-abc123.js',
      './jsx-runtime': 'shared/react@18.3.1/jsx-runtime.production-def456.js',
    },
  },
  'react-dom': {
    name: 'react-dom',
    version: '18.3.1',
    exports: {
      '.': 'shared/react-dom@18.3.1/react-dom.production-ghi789.js',
      './client': 'shared/react-dom@18.3.1/client.production-jkl012.js',
    },
  },
  '@flex-design-system/fx': {
    name: '@flex-design-system/fx',
    version: '2.3.1',
    exports: {
      '.': 'shared/@flex-design-system@2.3.1/fx-mno345.js',
    },
  },
};

// 4. Import Map 생성
const result = generateImportMap({
  config,
  manifests,
  sharedManifests,
});

console.log('=== Generated Import Map ===\n');
console.log(result.json);

console.log('\n=== Modulepreload Hints ===\n');
for (const [appName, urls] of Object.entries(result.preloadHints)) {
  console.log(`${appName}:`);
  for (const url of urls) {
    console.log(`  <link rel="modulepreload" href="${url}" />`);
  }
}

console.log('\n=== HTML 사용 예시 ===\n');
console.log(`<script type="importmap">
${result.json}
</script>

<script type="module">
  // 브라우저가 import map을 참조하여 bare specifier를 URL로 해석
  import { createRoot } from 'react-dom/client';

  // MFE 동적 로드
  const people = await import('@flex/people');
  people.mount(document.getElementById('app'));
</script>`);
