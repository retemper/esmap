# Server

::: warning WIP
This page is under construction.
:::

`@esmap/server` is a deploy server that manages import maps at runtime.

## Overview

The server provides:

- **Deploy API** — Push new MFE versions without rebuilding the host
- **Rollback** — Instantly revert to a previous version
- **History** — Track all deployments with timestamps

## Starting the server

```bash
esmap serve --port 3000
```

## Deploy API

```bash
esmap deploy \
  --server http://localhost:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js
```

## Rollback

```bash
esmap rollback \
  --server http://localhost:3000 \
  --name @myorg/checkout
```
