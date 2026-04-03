# Import Maps

::: warning WIP
This page is under construction.
:::

## What are Import Maps?

[Import Maps](https://wicg.github.io/import-maps/) are a W3C browser standard that lets you control how JavaScript module specifiers are resolved.

```html
<script type="importmap">
{
  "imports": {
    "@myorg/checkout": "https://cdn.example.com/checkout-v2.js",
    "react": "https://esm.sh/react@18"
  }
}
</script>
```

With an import map in place, bare specifiers like `import '@myorg/checkout'` resolve to the mapped URLs — no bundler required at runtime.

## How esmap uses Import Maps

esmap generates, serves, and dynamically updates import maps so that micro-frontends can be deployed independently:

1. **Build time** — `@esmap/vite-plugin` emits a manifest for each MFE
2. **Deploy time** — `@esmap/cli` pushes the manifest URL to the import map server
3. **Runtime** — `@esmap/runtime` fetches the import map and injects it into the page
