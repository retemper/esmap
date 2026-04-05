# @esmap/compat

Migration compatibility layer — Webpack Module Federation to import maps.

Converts existing MF configurations to import map format for incremental migration.

## Installation

```bash
pnpm add @esmap/compat
```

## Module Federation to Import Map

```ts
import { convertMfToImportMap } from '@esmap/compat';
import type { MfRemoteConfig } from '@esmap/compat';

const remotes: MfRemoteConfig[] = [
  {
    name: 'checkout',
    scope: '@myorg/checkout',
    remoteEntryUrl: 'https://cdn.example.com/checkout/remoteEntry.js',
    exposes: [
      { key: './App', path: './src/App.tsx' },
      { key: './Widget', path: './src/Widget.tsx' },
    ],
  },
  {
    name: 'cart',
    scope: '@myorg/cart',
    remoteEntryUrl: 'https://cdn.example.com/cart/remoteEntry.js',
    exposes: [{ key: './CartButton', path: './src/CartButton.tsx' }],
  },
];

const importMap = convertMfToImportMap(remotes, {
  cdnBase: 'https://cdn.example.com',
});

// Result:
// {
//   imports: {
//     '@myorg/checkout': 'https://cdn.example.com/myorg-checkout/index.js',
//     '@myorg/checkout/App': 'https://cdn.example.com/myorg-checkout/App.js',
//     '@myorg/checkout/Widget': 'https://cdn.example.com/myorg-checkout/Widget.js',
//     '@myorg/cart': 'https://cdn.example.com/myorg-cart/index.js',
//     '@myorg/cart/CartButton': 'https://cdn.example.com/myorg-cart/CartButton.js',
//   }
// }
```

## Shared Dependencies Conversion

```ts
import { convertMfSharedToImports } from '@esmap/compat';

// Convert MF shared config to import map imports
const sharedImports = convertMfSharedToImports(
  {
    react: '18.3.1',
    'react-dom': '18.3.1',
  },
  'https://cdn.example.com',
);

// Result:
// {
//   react: 'https://cdn.example.com/shared/react@18.3.1.js',
//   'react-dom': 'https://cdn.example.com/shared/react-dom@18.3.1.js',
// }
```

## Migration Guide

1. Convert existing MF config with `convertMfToImportMap()`
2. Load the import map in your shell using `@esmap/runtime`
3. Remote apps keep their existing build output as-is
4. Incrementally migrate each remote to ESM builds
5. Remove `@esmap/compat` when migration is complete
