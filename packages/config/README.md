# @esmap/config

Configuration schema, loading, and validation for the esmap framework.

## Installation

```bash
pnpm add @esmap/config
```

## Config File

Create one of the following in your project root (searched in this order):

1. `esmap.config.ts`
2. `esmap.config.js`
3. `esmap.config.mjs`
4. `esmap.config.json`

## defineConfig

Type-safe configuration definition:

```ts
// esmap.config.ts
import { defineConfig } from '@esmap/config';

export default defineConfig({
  apps: {
    '@myorg/checkout': {
      path: '/checkout',
    },
    '@myorg/cart': {
      path: '/cart',
    },
  },
  shared: {
    react: 'https://cdn.example.com/react.js',
    'react-dom': 'https://cdn.example.com/react-dom.js',
  },
  server: {
    port: 3000,
    storage: 'filesystem', // 'filesystem' | 's3' | 'redis'
  },
});
```

## Loading

```ts
import { loadConfig, loadConfigFile } from '@esmap/config';

// Auto-discover (searches cwd for config files)
const config = await loadConfig();

// Load a specific path
const config = await loadConfigFile('/path/to/esmap.config.ts');
```

Supported formats: `.ts`, `.js`, `.mjs` (dynamic import), `.json` (parsed).

## Validation

```ts
import { validateConfig, assertValidConfig } from '@esmap/config';
import type { ConfigFieldError } from '@esmap/config';

// Returns error list
const errors: readonly ConfigFieldError[] = validateConfig(unknownData);

// Returns type-safe config if valid, throws otherwise
const config = assertValidConfig(unknownData);
```

## resolveConfig

Fills in defaults for optional fields:

```ts
import { resolveConfig } from '@esmap/config';
import type { ResolvedConfig } from '@esmap/config';

const resolved: ResolvedConfig = resolveConfig(config);
```
