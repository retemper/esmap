import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import { packageLayersPlugin } from './tools/lodestar/package-layers.js';

export default defineConfig({
  plugins: [pluginArchitecture, packageLayersPlugin],
  rules: {
    'architecture/no-circular-packages': 'error',
    'package-layers': {
      severity: 'error',
      options: {
        layers: [
          // Tier 0 — Foundation
          { name: '@esmap/shared', path: 'packages/shared/**', canImport: [] },

          // Tier 1 — Isolated features (shared only)
          {
            name: '@esmap/communication',
            path: 'packages/communication/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/sandbox',
            path: 'packages/sandbox/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/guard',
            path: 'packages/guard/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/monitor',
            path: 'packages/monitor/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/devtools',
            path: 'packages/devtools/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/config',
            path: 'packages/config/**',
            canImport: ['@esmap/shared'],
          },

          // Tier 2 — Runtime
          {
            name: '@esmap/runtime',
            path: 'packages/runtime/**',
            canImport: ['@esmap/shared'],
          },

          // Tier 3 — Hub (orchestrates everything)
          {
            name: '@esmap/core',
            path: 'packages/core/**',
            canImport: [
              '@esmap/shared',
              '@esmap/runtime',
              '@esmap/communication',
              '@esmap/sandbox',
              '@esmap/guard',
              '@esmap/monitor',
              '@esmap/devtools',
            ],
          },

          // Tier 4 — Tools & Adapters
          {
            name: '@esmap/cli',
            path: 'packages/cli/**',
            canImport: ['@esmap/shared', '@esmap/config', '@esmap/runtime'],
          },
          {
            name: '@esmap/server',
            path: 'packages/server/**',
            canImport: ['@esmap/shared', '@esmap/config'],
          },
          {
            name: '@esmap/react',
            path: 'packages/react/**',
            canImport: ['@esmap/shared', '@esmap/runtime', '@esmap/communication'],
          },
          {
            name: '@esmap/vue',
            path: 'packages/vue/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/angular',
            path: 'packages/angular/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/ssr',
            path: 'packages/ssr/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/test',
            path: 'packages/test/**',
            canImport: ['@esmap/shared', '@esmap/runtime'],
          },
          {
            name: '@esmap/compat',
            path: 'packages/compat/**',
            canImport: ['@esmap/shared'],
          },
          {
            name: '@esmap/vite-plugin',
            path: 'packages/vite-plugin/**',
            canImport: ['@esmap/shared', '@esmap/guard'],
          },
        ],
      },
    },
  },
});
