# @esmap/cli

Command-line interface for esmap. Provides commands to generate import maps, deploy micro-frontend builds, rollback to previous versions, and analyze dependency conflicts.

## Installation

```bash
pnpm add -D @esmap/cli
```

## CLI Commands

### `esmap generate`

Generates an import map JSON file from the esmap config and MFE manifests.

### `esmap deploy`

Deploys a new MFE build to the import map server by updating the specifier-to-URL mapping.

### `esmap rollback`

Reverts a service to a previous import map entry using the deployment history.

### `esmap status`

Displays the current state of the import map and active deployments.

### `esmap analyze`

Analyzes dependency conflicts across all MFE apps. Reports incompatible version ranges.

## Functions

### `generateImportMap`

```ts
function generateImportMap(input: GenerateInput): GenerateResult;
```

Generates an import map JSON from config and manifests. Resolves CDN URLs for app entries and shared dependencies, and produces modulepreload hints.

### `analyzeDependencyConflicts`

```ts
function analyzeDependencyConflicts(
  declarations: readonly AppDependencyDeclaration[],
): DependencyAnalysisResult;
```

Analyzes shared dependency version declarations across all MFE apps and identifies incompatible ranges. Produces both errors (incompatible majors) and warnings (potentially incompatible minors).

### `extractDeclarationsFromManifests`

```ts
function extractDeclarationsFromManifests(
  manifestPaths: readonly string[],
): Promise<readonly AppDependencyDeclaration[]>;
```

Reads MFE manifest files from disk and extracts dependency version declarations for analysis.

## Types

### `GenerateInput`

| Property          | Type                                       | Description                 |
| ----------------- | ------------------------------------------ | --------------------------- |
| `config`          | `EsmapConfig`                              | Framework configuration     |
| `manifests`       | `Record<string, MfeManifest>`              | Per-app manifests           |
| `sharedManifests` | `Record<string, SharedDependencyManifest>` | Shared dependency manifests |

### `GenerateResult`

| Property       | Type                       | Description                 |
| -------------- | -------------------------- | --------------------------- |
| `importMap`    | `ImportMap`                | Generated import map object |
| `json`         | `string`                   | Pretty-printed JSON string  |
| `preloadHints` | `Record<string, string[]>` | Per-app modulepreload URLs  |

### `DependencyConflict`

| Property         | Type                                          | Description                        |
| ---------------- | --------------------------------------------- | ---------------------------------- |
| `dependencyName` | `string`                                      | Name of the conflicting dependency |
| `apps`           | `{ appName: string; versionRange: string }[]` | Apps involved in the conflict      |
| `severity`       | `'error' \| 'warning'`                        | Conflict severity                  |
| `message`        | `string`                                      | Human-readable description         |

### `DependencyAnalysisResult`

| Property    | Type                   | Description                        |
| ----------- | ---------------------- | ---------------------------------- |
| `conflicts` | `DependencyConflict[]` | Incompatible conflicts (errors)    |
| `warnings`  | `DependencyConflict[]` | Potentially incompatible conflicts |
| `summary`   | `string`               | Human-readable summary             |
