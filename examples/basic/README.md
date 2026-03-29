# basic example

Demonstrates the import map generation pipeline.

`defineConfig` -> MFE manifests -> `generateImportMap` -> final import map output.

## Run

```bash
cd examples/basic
pnpm demo
```

## Pipeline

1. Define apps and shared dependencies in `esmap.config.ts`
2. Collect MFE manifests (build artifacts)
3. Generate a unified import map with `generateImportMap()`
4. Deploy the result to the server or upload to CDN

## Module Federation Migration Demo

```bash
pnpm demo:migration
```

Shows how to convert existing Webpack Module Federation configurations to import maps.
