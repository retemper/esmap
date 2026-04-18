import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'types', path: 'src/types/**', canImport: [] },
          { name: 'utils', path: 'src/utils/**', canImport: ['types'] },
          { name: 'root', path: 'src/*.ts', canImport: ['types', 'utils'] },
        ],
      },
    },
    'architecture/no-circular': 'error',
  },
});
