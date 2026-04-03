# CLI

::: warning WIP
This page is under construction.
:::

`@esmap/cli` provides command-line tools for generating, deploying, and managing micro-frontends.

## Installation

```bash
pnpm add -D @esmap/cli
```

## Commands

### `esmap generate`

Generate an import map from MFE manifests.

### `esmap serve`

Start the import map server.

```bash
esmap serve --port 3000
```

### `esmap deploy`

Deploy a new MFE version to the server.

```bash
esmap deploy \
  --server http://localhost:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js
```

### `esmap rollback`

Rollback to the previous version.

```bash
esmap rollback \
  --server http://localhost:3000 \
  --name @myorg/checkout
```
