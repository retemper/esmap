import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
  },
  {
    entry: ['src/hydration.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    platform: 'browser',
  },
]);
