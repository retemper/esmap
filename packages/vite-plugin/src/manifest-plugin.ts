import type { Plugin } from 'vite';
import type { MfeManifest } from '@esmap/shared';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** MFE manifest generation plugin options */
export interface ManifestPluginOptions {
  /** MFE app name (e.g., "@flex/checkout") */
  readonly name: string;
  /** MFE app version. Reads from package.json if not specified */
  readonly version?: string;
  /** Shared dependency list. Set as Vite externals and recorded in the manifest */
  readonly shared?: readonly string[];
  /** Internal package dependency list */
  readonly internal?: readonly string[];
  /** Manifest output file name (default: "esmap-manifest.json") */
  readonly outputFileName?: string;
}

/**
 * Vite plugin that automatically generates MFE manifest JSON after build.
 * Analyzes file names (including content hashes) from the build output to generate the manifest.
 *
 * @param options - plugin options
 */
export function esmapManifest(options: ManifestPluginOptions): Plugin {
  const outputFileName = options.outputFileName ?? 'esmap-manifest.json';
  const sharedDeps = options.shared ?? [];
  const internalDeps = options.internal ?? [];

  return {
    name: 'esmap:manifest',
    apply: 'build',

    config() {
      // Set shared dependencies as Vite externals to exclude them from the bundle
      if (sharedDeps.length > 0) {
        return {
          build: {
            rollupOptions: {
              external: [...sharedDeps],
            },
          },
        };
      }
      return {};
    },

    async writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir ?? 'dist';

      const assets: string[] = [];
      const modulepreload: string[] = [];
      const jsFiles: string[] = [];

      for (const [fileName, chunk] of Object.entries(bundle)) {
        assets.push(fileName);

        if (fileName.endsWith('.js')) {
          jsFiles.push(fileName);

          // Add entry chunks and their direct imports as modulepreload candidates
          if (chunk.type === 'chunk' && (chunk.isEntry || chunk.isDynamicEntry)) {
            modulepreload.push(fileName);
          }
        }
      }

      // Determine entry file: find an isEntry chunk, or fall back to the first JS file
      const entryChunk = Object.values(bundle).find(
        (chunk) => chunk.type === 'chunk' && chunk.isEntry,
      );
      const entry = entryChunk ? entryChunk.fileName : (jsFiles[0] ?? 'index.js');

      const version = options.version ?? (await readPackageVersion(process.cwd()));

      const manifest: MfeManifest = {
        name: options.name,
        version,
        entry,
        assets: assets.sort(),
        dependencies: {
          shared: [...sharedDeps],
          internal: [...internalDeps],
        },
        modulepreload: modulepreload.sort(),
      };

      const manifestPath = join(outDir, outputFileName);
      await mkdir(outDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    },
  };
}

/** Reads the version from package.json. Returns "0.0.0" on failure. */
async function readPackageVersion(cwd: string): Promise<string> {
  try {
    const pkgPath = join(cwd, 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg: unknown = JSON.parse(content);
    if (typeof pkg === 'object' && pkg !== null && 'version' in pkg) {
      return String(pkg.version);
    }
  } catch {
    // package.json does not exist or read failed
  }
  return '0.0.0';
}
