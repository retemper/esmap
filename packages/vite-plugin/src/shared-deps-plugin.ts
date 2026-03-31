import type { Plugin, Rollup } from 'vite';
import type { SharedDependencyManifest } from '@esmap/shared';
import { createHash } from 'node:crypto';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

/** Shared dependency build plugin options */
export interface SharedDepsPluginOptions {
  /** Shared dependency entries. Key = package name, value = import specifier or path */
  readonly deps: Readonly<Record<string, string>>;
  /** Build output directory */
  readonly outDir?: string;
  /** Manifest output file name (default: "shared-deps-manifest.json") */
  readonly outputFileName?: string;
}

/** Computes a content hash from a bundle chunk */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/** Inserts a content hash into the file name (e.g., "react.js" -> "react-a1b2c3d4.js") */
function insertContentHash(fileName: string, hash: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) {
    return `${fileName}-${hash}`;
  }
  return `${fileName.slice(0, dotIndex)}-${hash}${fileName.slice(dotIndex)}`;
}

/**
 * Vite plugin that builds shared dependencies as individual ESM modules and generates a SharedDependencyManifest.
 * Sets each dependency as an entry point, builds them as independent ES modules,
 * renames them with content-hash file names, and outputs the manifest JSON.
 *
 * @param options - plugin options
 */
export function esmapSharedDeps(options: SharedDepsPluginOptions): Plugin {
  const outputFileName = options.outputFileName ?? 'shared-deps-manifest.json';
  const depEntries = options.deps;

  return {
    name: 'esmap:shared-deps',
    apply: 'build',

    config() {
      const input: Record<string, string> = {};
      for (const [name, specifier] of Object.entries(depEntries)) {
        input[name] = specifier;
      }

      return {
        build: {
          rollupOptions: {
            input,
            output: {
              format: 'es' as const,
              entryFileNames: '[name].js',
            },
          },
        },
      };
    },

    async writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir ?? options.outDir ?? 'dist';
      await mkdir(outDir, { recursive: true });

      const manifests: readonly SharedDependencyManifest[] = await Promise.all(
        Object.keys(depEntries).map(async (depName) => {
          const chunk = findChunkForDep(bundle, depName);
          if (!chunk) {
            const emptyExports: Readonly<Record<string, string>> = {};
            return {
              name: depName,
              version: '0.0.0',
              exports: emptyExports,
            };
          }

          const hash = computeContentHash(chunk.code);
          const hashedFileName = insertContentHash(chunk.fileName, hash);

          const originalPath = join(outDir, chunk.fileName);
          const hashedPath = join(outDir, hashedFileName);
          await rename(originalPath, hashedPath);

          return {
            name: depName,
            version: '0.0.0',
            exports: {
              '.': hashedFileName,
            },
          };
        }),
      );

      const manifestPath = join(outDir, outputFileName);
      await writeFile(manifestPath, JSON.stringify(manifests, null, 2));
    },
  };
}

/** Finds the entry chunk matching the specified dependency name in the bundle */
function findChunkForDep(
  bundle: Rollup.OutputBundle,
  depName: string,
): Rollup.OutputChunk | undefined {
  for (const chunk of Object.values(bundle)) {
    if (chunk.type === 'chunk' && chunk.isEntry && chunk.name === depName) {
      return chunk;
    }
  }
  // fallback: filename-based matching
  for (const chunk of Object.values(bundle)) {
    if (chunk.type === 'chunk' && chunk.fileName.startsWith(depName)) {
      return chunk;
    }
  }
  return undefined;
}
