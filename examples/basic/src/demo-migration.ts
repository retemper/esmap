/**
 * Module Federation → Import Map migration demo.
 * Demonstrates the process of converting existing MF configurations to import map format.
 */

import { convertMfToImportMap, convertMfSharedToImports } from '@esmap/compat';
import { mergeImportMaps, serializeImportMap } from '@esmap/shared';
import type { MfRemoteConfig } from '@esmap/compat';

// 1. Existing Module Federation remote configuration (from mf.config.ts)
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

// 2. Existing MF shared dependencies
const shared: Record<string, string> = {
  react: '18.3.1',
  'react-dom': '18.3.1',
  '@flex-design-system/fx': '2.3.1',
  '@flex-packages/router': '4.0.0',
};

// 3. Convert to import map
const appImportMap = convertMfToImportMap(remotes, {
  cdnBase: 'https://cdn.flex.team',
});

const sharedImports = convertMfSharedToImports(shared, 'https://cdn.flex.team');

const finalImportMap = mergeImportMaps(appImportMap, {
  imports: sharedImports,
});

// 4. Output results
console.log('=== MF → Import Map Conversion Result ===\n');
console.log(serializeImportMap(finalImportMap, 2));

console.log('\n=== Before/After Migration Comparison ===\n');

console.log('Before (Module Federation):');
console.log('  - Fetches remoteEntry.js files at runtime');
console.log('  - Webpack runtime handles module resolution');
console.log('  - Shared dependencies negotiated by Webpack at runtime');
console.log('');

console.log('After (Import Map):');
console.log('  - Browser-native module resolution');
console.log('  - No remoteEntry.js needed (replaced by import map)');
console.log('  - Shared dependencies managed via import map specifiers');
console.log('  - Build-tool agnostic (Vite, Rollup, esbuild all supported)');
