import { readFile, access } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import type { EsmapConfig } from '@esmap/shared';
import { assertValidConfig } from './validate.js';

/** Config file name search order */
const CONFIG_FILE_NAMES = [
  'esmap.config.ts',
  'esmap.config.js',
  'esmap.config.mjs',
  'esmap.config.json',
] as const;

/**
 * Searches for and loads a config file from the project directory.
 * @param cwd - directory to start searching from (default: process.cwd())
 */
export async function loadConfig(cwd?: string): Promise<EsmapConfig> {
  const dir = cwd ?? process.cwd();

  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = resolve(dir, fileName);
    const exists = await fileExists(filePath);

    if (exists) {
      return loadConfigFile(filePath);
    }
  }

  throw new Error(
    `Config file not found. Please create one of: ${CONFIG_FILE_NAMES.join(', ')}`,
  );
}

/**
 * Loads a config file at the specified path.
 * @param filePath - absolute path to the config file
 */
export async function loadConfigFile(filePath: string): Promise<EsmapConfig> {
  const ext = extname(filePath);

  switch (ext) {
    case '.json':
      return loadJsonConfig(filePath);
    case '.ts':
    case '.js':
    case '.mjs':
      return loadModuleConfig(filePath);
    default:
      throw new Error(`Unsupported config file extension: ${ext}`);
  }
}

/**
 * Loads and validates a JSON config file.
 * @param filePath - absolute path to the JSON file
 */
async function loadJsonConfig(filePath: string): Promise<EsmapConfig> {
  const content = await readFile(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(content);
  return assertValidConfig(parsed);
}

/** Loads a TS/JS module config file via dynamic import. */
async function loadModuleConfig(filePath: string): Promise<EsmapConfig> {
  const module: unknown = await import(filePath).catch((error: unknown) => {
    throw new Error(
      `Failed to load config file: ${filePath}\nCause: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  const mod = (typeof module === 'object' && module !== null ? module : {}) satisfies object;
  const config = 'default' in mod ? (mod.default ?? mod) : mod;
  return assertValidConfig(config);
}

/**
 * Checks whether a file exists.
 * @param filePath - path to check
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
