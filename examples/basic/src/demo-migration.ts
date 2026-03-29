/**
 * Module Federation → Import Map 마이그레이션 데모.
 * 기존 MF 설정을 import map 형식으로 변환하는 과정을 보여준다.
 */

import { convertMfToImportMap, convertMfSharedToImports } from '@esmap/compat';
import { mergeImportMaps, serializeImportMap } from '@esmap/shared';
import type { MfRemoteConfig } from '@esmap/compat';

// 1. 기존 Module Federation remote 설정 (mf.config.ts에서 가져온 것)
const remotes: MfRemoteConfig[] = [
  {
    name: 'flexPeople',
    scope: '@flex/people',
    remoteEntryUrl: 'https://cdn.flex.team/apps/people/remoteEntry.js',
    exposes: [
      { key: './EmployeeList', path: './src/pages/EmployeeList.tsx' },
      { key: './EmployeeDetail', path: './src/pages/EmployeeDetail.tsx' },
    ],
  },
  {
    name: 'flexPayroll',
    scope: '@flex/payroll',
    remoteEntryUrl: 'https://cdn.flex.team/apps/payroll/remoteEntry.js',
    exposes: [{ key: './PayrollDashboard', path: './src/pages/PayrollDashboard.tsx' }],
  },
  {
    name: 'flexGnb',
    scope: '@flex/gnb',
    remoteEntryUrl: 'https://cdn.flex.team/apps/gnb/remoteEntry.js',
  },
];

// 2. 기존 MF shared 의존성
const shared: Record<string, string> = {
  react: '18.3.1',
  'react-dom': '18.3.1',
  '@flex-design-system/fx': '2.3.1',
  '@flex-packages/router': '4.0.0',
};

// 3. Import map으로 변환
const appImportMap = convertMfToImportMap(remotes, {
  cdnBase: 'https://cdn.flex.team',
});

const sharedImports = convertMfSharedToImports(shared, 'https://cdn.flex.team');

const finalImportMap = mergeImportMaps(appImportMap, {
  imports: sharedImports,
});

// 4. 결과 출력
console.log('=== MF → Import Map 변환 결과 ===\n');
console.log(serializeImportMap(finalImportMap, 2));

console.log('\n=== 마이그레이션 전/후 비교 ===\n');

console.log('Before (Module Federation):');
console.log('  - remoteEntry.js 파일을 runtime에 fetch');
console.log('  - Webpack 런타임이 모듈 resolution 담당');
console.log('  - 공유 의존성은 Webpack이 runtime에 협상');
console.log('');

console.log('After (Import Map):');
console.log('  - 브라우저 네이티브 모듈 resolution');
console.log('  - remoteEntry.js 불필요 (import map이 대체)');
console.log('  - 공유 의존성은 import map의 specifier로 관리');
console.log('  - 빌드 도구 독립적 (Vite, Rollup, esbuild 모두 가능)');
