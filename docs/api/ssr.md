---
description: 'API reference for @esmap/ssr — server-side rendering support for esmap micro-frontends.'
---

# @esmap/ssr

Server-side rendering support for esmap. Enables micro-frontend applications to be rendered on the server for improved initial load performance and SEO.

## Installation

```bash
pnpm add @esmap/ssr
```

## Functions

### `createImportMapResolver`

```ts
function createImportMapResolver(importMap: ImportMap): ImportMapResolver;
```

Creates a server-side import map resolver. Implements the W3C import map resolution algorithm for bare specifiers, enabling the same import map used in the browser to resolve modules on the server.

### `createServerModuleLoader`

```ts
function createServerModuleLoader(options: ServerModuleLoaderOptions): ServerModuleLoader;
```

Creates a server-side module loader that fetches and evaluates ESM modules. Fetched ESM sources are written to temporary files and evaluated via native `import()`, preserving full ESM semantics. Modules from `externals` are resolved from local `node_modules`.

### `createSsrRenderer`

```ts
function createSsrRenderer(options: SsrRendererOptions): SsrRenderer;
```

Creates an SSR renderer that loads MFE modules on the server and renders them to HTML. Modules must export an `ssrRender` function.

### `renderReactToString`

```ts
function renderReactToString<P extends Record<string, unknown>>(
  options: ReactSsrOptions<P>,
): string;
```

Renders a React component tree to an HTML string on the server. Use this to implement the `ssrRender` export in React-based MFE modules.

### `createReactSsrRender`

```ts
function createReactSsrRender<P extends Record<string, unknown>>(
  options: Omit<ReactSsrOptions<P>, 'props'>,
): (props?: Record<string, unknown>) => string;
```

Creates an `ssrRender` function for a React MFE app. Pairs with `createReactMfeApp` from `@esmap/react` to add SSR capability to the same MFE entry module.

### `composeHtml`

```ts
function composeHtml(options: HtmlComposerOptions): string;
```

Composes a complete HTML document shell with embedded import map, modulepreload hints, rendered app markup, and hydration script.

## Types

### `ImportMapResolver`

| Method    | Signature                                             | Description                                  |
| --------- | ----------------------------------------------------- | -------------------------------------------- |
| `resolve` | `(specifier: string, referrerUrl?: string) => string` | Resolves a bare specifier to an absolute URL |

### `ServerModuleLoader`

| Method       | Signature                                 | Description                        |
| ------------ | ----------------------------------------- | ---------------------------------- |
| `load`       | `<T>(specifier: string) => Promise<T>`    | Loads a module by specifier or URL |
| `prefetch`   | `(specifiers: string[]) => Promise<void>` | Prefetches modules into cache      |
| `clearCache` | `() => void`                              | Clears the module cache            |

### `ServerModuleLoaderOptions`

| Property    | Type                     | Description                                     |
| ----------- | ------------------------ | ----------------------------------------------- |
| `resolver`  | `ImportMapResolver`      | Import map resolver for bare specifiers         |
| `fetchFn`   | `typeof fetch`           | Custom fetch function                           |
| `cacheTtl`  | `number`                 | Cache TTL in ms (`0` = no expiry, default: `0`) |
| `externals` | `Record<string, string>` | Specifiers resolved from local `node_modules`   |

### `SsrRenderer`

| Method         | Signature                                                                   | Description                  |
| -------------- | --------------------------------------------------------------------------- | ---------------------------- |
| `renderApp`    | `(appName: string, options?: RenderAppOptions) => Promise<SsrRenderResult>` | Renders an MFE app to HTML   |
| `moduleLoader` | `ServerModuleLoader`                                                        | The underlying module loader |
| `resolver`     | `ImportMapResolver`                                                         | The underlying resolver      |

### `SsrRenderResult`

| Property      | Type        | Description                         |
| ------------- | ----------- | ----------------------------------- |
| `html`        | `string`    | Rendered HTML markup                |
| `head`        | `string`    | Additional head elements            |
| `importMap`   | `ImportMap` | Import map to embed in the document |
| `preloadUrls` | `string[]`  | URLs for modulepreload hints        |

### `ReactSsrOptions`

| Property        | Type                                     | Description                        |
| --------------- | ---------------------------------------- | ---------------------------------- |
| `rootComponent` | `ComponentType<P>`                       | Root React component to render     |
| `wrapWith`      | `ComponentType<{ children: ReactNode }>` | Wrapper component (e.g. providers) |
| `props`         | `P`                                      | Props passed to the root component |

### `HtmlComposerOptions`

| Property          | Type        | Description                              |
| ----------------- | ----------- | ---------------------------------------- |
| `importMap`       | `ImportMap` | Import map to embed as a script tag      |
| `appHtml`         | `string`    | Rendered app HTML markup                 |
| `head`            | `string`    | Additional head content                  |
| `bodyAttrs`       | `string`    | Additional body attributes               |
| `preloadUrls`     | `string[]`  | URLs for modulepreload link tags         |
| `hydrationScript` | `string`    | Inline hydration script                  |
| `containerId`     | `string`    | Container element id (default: `"root"`) |
| `title`           | `string`    | Page title                               |
| `lang`            | `string`    | HTML lang attribute (default: `"en"`)    |
