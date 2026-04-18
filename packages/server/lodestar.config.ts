import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'storage', path: 'src/storage/**', canImport: [] },
          { name: 'sse', path: 'src/sse/**', canImport: ['storage'] },
          { name: 'routes', path: 'src/routes/**', canImport: ['storage', 'sse'] },
          {
            name: 'root',
            path: 'src/*.ts',
            canImport: ['storage', 'sse', 'routes'],
          },
        ],
      },
    },
    'architecture/no-circular': 'error',
  },
});
