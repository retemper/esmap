import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { generateImportMap } from '../generate/generate-import-map.js';
import type { GenerateInput } from '../generate/generate-import-map.js';
import type { EsmapConfig, MfeManifest, SharedDependencyManifest } from '@esmap/shared';
import { assertValidConfig } from '@esmap/config';

/** File read function type (for test injection) */
type ReadFileFn = (path: string, encoding: BufferEncoding) => Promise<string | Buffer>;

/** File write function type (for test injection) */
type WriteFileFn = (path: string, data: string, encoding: BufferEncoding) => Promise<void>;

/** Options for the generate command */
export interface GenerateOptions {
  /** Config file path */
  readonly config: string;
  /** Output file path (defaults to stdout if not specified) */
  readonly out?: string;
}

/**
 * Extracts GenerateOptions from the flag map.
 * @param flags - parsed CLI flags
 */
export function parseGenerateFlags(flags: Readonly<Record<string, string>>): GenerateOptions {
  return {
    config: flags['config'] ?? 'esmap.config.json',
    out: flags['out'],
  };
}

/**
 * Discovers and loads manifest files from the app configuration.
 * @param config - esmap config
 * @param basePath - base directory relative to the config file
 * @param readFn - file read function
 */
export async function discoverManifests(
  config: EsmapConfig,
  basePath: string,
  readFn: ReadFileFn = readFile,
): Promise<Record<string, MfeManifest>> {
  const manifests: Record<string, MfeManifest> = {};

  for (const [appName, appConfig] of Object.entries(config.apps)) {
    const manifestPath = appConfig.manifestPath ?? `${appConfig.path}/manifest.json`;
    const fullPath = resolve(basePath, manifestPath);

    try {
      const content = await readFn(fullPath, 'utf-8');
      const parsed: unknown = JSON.parse(content.toString());

      if (isMfeManifest(parsed)) {
        manifests[appName] = parsed;
      }
    } catch {
      // Skip if the manifest file does not exist
    }
  }

  return manifests;
}

/**
 * Discovers and loads shared dependency manifests.
 * @param config - esmap config
 * @param basePath - base directory relative to the config file
 * @param readFn - file read function
 */
export async function discoverSharedManifests(
  config: EsmapConfig,
  basePath: string,
  readFn: ReadFileFn = readFile,
): Promise<Record<string, SharedDependencyManifest>> {
  const manifests: Record<string, SharedDependencyManifest> = {};

  for (const name of Object.keys(config.shared)) {
    const manifestPath = `shared/${name}/manifest.json`;
    const fullPath = resolve(basePath, manifestPath);

    try {
      const content = await readFn(fullPath, 'utf-8');
      const parsed: unknown = JSON.parse(content.toString());

      if (isSharedDependencyManifest(parsed)) {
        manifests[name] = parsed;
      }
    } catch {
      // Skip if the manifest file does not exist
    }
  }

  return manifests;
}

/**
 * Generates an import map from config and manifests, then outputs the result.
 * @param options - generate options
 * @param readFileFn - file read function (for test injection)
 * @param writeFileFn - file write function (for test injection)
 */
export async function generate(
  options: GenerateOptions,
  readFileFn: ReadFileFn = readFile,
  writeFileFn: WriteFileFn = writeFile,
): Promise<string> {
  const configPath = resolve(options.config);
  const basePath = dirname(configPath);

  const configContent = await readFileFn(configPath, 'utf-8');
  const config: unknown = JSON.parse(configContent.toString());

  if (typeof config !== 'object' || config === null) {
    throw new Error(`Invalid config file: ${options.config}`);
  }

  const esmapConfig = assertValidConfig(config);
  const manifests = await discoverManifests(esmapConfig, basePath, readFileFn);
  const sharedManifests = await discoverSharedManifests(esmapConfig, basePath, readFileFn);

  const input: GenerateInput = {
    config: esmapConfig,
    manifests,
    sharedManifests: Object.keys(sharedManifests).length > 0 ? sharedManifests : undefined,
  };

  const result = generateImportMap(input);

  if (options.out) {
    await writeFileFn(resolve(options.out), result.json, 'utf-8');
    console.log(`✓ Import map written to ${options.out}`);
  } else {
    console.log(result.json);
  }

  return result.json;
}

/**
 * Runs the generate command.
 * @param flags - parsed CLI flags
 */
export async function runGenerate(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseGenerateFlags(flags);
  await generate(options);
}

/**
 * Checks whether a value satisfies the MfeManifest structure.
 * @param value - value to validate
 */
function isMfeManifest(value: unknown): value is MfeManifest {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'entry' in value &&
    typeof value.entry === 'string' &&
    'assets' in value &&
    Array.isArray(value.assets) &&
    'modulepreload' in value &&
    Array.isArray(value.modulepreload)
  );
}

/**
 * Checks whether a value satisfies the SharedDependencyManifest structure.
 * @param value - value to validate
 */
function isSharedDependencyManifest(value: unknown): value is SharedDependencyManifest {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'version' in value &&
    typeof value.version === 'string' &&
    'exports' in value &&
    typeof value.exports === 'object'
  );
}

/** Help text for the generate command */
export const GENERATE_HELP = `Usage: esmap generate [options]

Options:
  --config <path>  Config file path (default: esmap.config.json)
  --out <path>     Output file path (default: stdout)
  --help           Show this help message`;
