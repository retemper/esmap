import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  platform: 'browser',
  external: [
    '@angular/core',
    '@angular/platform-browser',
    '@angular/platform-browser-dynamic',
    'zone.js',
  ],
});
