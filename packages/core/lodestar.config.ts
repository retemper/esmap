import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'types', path: 'src/types.ts', canImport: [] },
          {
            name: 'core',
            path: 'src/{create-esmap,plugin,auto-perf}.ts',
            canImport: ['types'],
          },
          { name: 'plugins', path: 'src/plugins/**', canImport: ['types', 'core'] },
          {
            name: 'barrel',
            path: 'src/index.ts',
            canImport: ['types', 'core', 'plugins'],
          },
        ],
      },
    },
    'architecture/no-circular': 'error',
  },
});
