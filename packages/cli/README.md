# @esmap/cli

esmap CLI — import map generation, build post-processing, and server deployment.

## Installation

```bash
pnpm add -D @esmap/cli

# Or globally
pnpm add -g @esmap/cli
```

## Commands

### generate

Generates a unified import map from MFE manifests:

```bash
esmap generate --config ./esmap.config.json --out ./dist/importmap.json
```

Programmatic usage:

```ts
import { generateImportMap } from '@esmap/cli';
import type { GenerateInput, GenerateResult } from '@esmap/cli';

const input: GenerateInput = {
  config: {
    apps: {
      '@myorg/checkout': { path: 'apps/checkout', url: 'https://cdn/checkout.js' },
    },
    shared: {
      react: { url: 'https://cdn/react.js', version: '18.3.1' },
    },
  },
  manifests: {
    '@myorg/checkout': {
      name: '@myorg/checkout',
      version: '1.0.0',
      entry: 'checkout-abc123.js',
      assets: ['checkout-abc123.js'],
      dependencies: { shared: ['react'], internal: [] },
      modulepreload: ['checkout-abc123.js'],
    },
  },
};

const result: GenerateResult = generateImportMap(input);
console.log(result.importMap); // { imports: {...} }
console.log(result.json); // pretty-printed JSON string
console.log(result.preloadHints); // { '@myorg/checkout': ['...'] }
```

### deploy

Deploys an MFE to the import map server:

```bash
esmap deploy \
  --server http://importmap-server.internal:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js
```

### rollback

Rolls back to the previous deployment:

```bash
esmap rollback \
  --server http://importmap-server.internal:3000 \
  --name @myorg/checkout
```

### help

```bash
esmap --help
esmap deploy --help
esmap rollback --help
```
