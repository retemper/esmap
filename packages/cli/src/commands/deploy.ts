import { readFile } from 'node:fs/promises';
import { requireFlag } from './parse-args.js';

/** Options for the deploy command */
export interface DeployOptions {
  /** Import map server URL */
  readonly server: string;
  /** Service (app) name */
  readonly name: string;
  /** App URL */
  readonly url: string;
  /** Deployer name */
  readonly deployedBy?: string;
  /** Manifest file path (for automatic URL resolution) */
  readonly manifest?: string;
  /** CDN base URL (used with manifest) */
  readonly cdnBase?: string;
}

/** Result of the deploy command */
export interface DeployResult {
  /** Service name */
  readonly name: string;
  /** Deployed URL */
  readonly url: string;
  /** Whether the deployment succeeded */
  readonly success: boolean;
}

/** Interface for type-guarding the server response body */
interface DeployResponseBody {
  readonly service: string;
  readonly url: string;
}

/**
 * Checks whether the server response is a valid DeployResponseBody.
 * @param value - value to validate
 */
function isDeployResponseBody(value: unknown): value is DeployResponseBody {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'service' in value &&
    typeof value.service === 'string' &&
    'url' in value &&
    typeof value.url === 'string'
  );
}

/**
 * Extracts DeployOptions from the flag map.
 * @param flags - parsed CLI flags
 */
export function parseDeployFlags(flags: Readonly<Record<string, string>>): DeployOptions {
  return {
    server: requireFlag(flags, 'server', 'deploy'),
    name: requireFlag(flags, 'name', 'deploy'),
    url: requireFlag(flags, 'url', 'deploy'),
    deployedBy: flags['deployed-by'],
    manifest: flags['manifest'],
    cdnBase: flags['cdn-base'],
  };
}

/**
 * Resolves the entry URL from a manifest file.
 * @param manifestPath - manifest JSON file path
 * @param cdnBase - CDN base URL
 */
export async function resolveUrlFromManifest(
  manifestPath: string,
  cdnBase: string,
): Promise<string> {
  const content = await readFile(manifestPath, 'utf-8');
  const parsed: unknown = JSON.parse(content);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid manifest file: ${manifestPath}`);
  }

  const manifest = parsed;
  const entry = 'entry' in manifest ? manifest.entry : undefined;

  if (typeof entry !== 'string') {
    throw new Error(`Manifest missing "entry" field: ${manifestPath}`);
  }

  const base = cdnBase.replace(/\/$/, '');
  return `${base}/${entry}`;
}

/**
 * Deploys (updates) a service URL to the import map server.
 * Calls the PATCH /services/:name endpoint.
 * @param options - deploy options
 * @param fetchFn - HTTP fetch function (for test injection)
 */
export async function deploy(
  options: DeployOptions,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<DeployResult> {
  const resolvedUrl =
    options.manifest && options.cdnBase
      ? await resolveUrlFromManifest(options.manifest, options.cdnBase)
      : options.url;

  const serverBase = options.server.replace(/\/$/, '');
  const endpoint = `${serverBase}/services/${encodeURIComponent(options.name)}`;

  const body: Record<string, string> = { url: resolvedUrl };
  if (options.deployedBy) {
    body.deployedBy = options.deployedBy;
  }

  const response = await fetchFn(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deploy failed (${response.status}): ${errorText}`);
  }

  const responseBody: unknown = await response.json();

  if (isDeployResponseBody(responseBody)) {
    return {
      name: responseBody.service,
      url: responseBody.url,
      success: true,
    };
  }

  return {
    name: options.name,
    url: resolvedUrl,
    success: true,
  };
}

/**
 * Runs the deploy command and prints the result to the console.
 * @param flags - parsed CLI flags
 */
export async function runDeploy(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseDeployFlags(flags);
  const result = await deploy(options);
  console.log(`✓ Deployed ${result.name} → ${result.url}`);
}

/** Help text for the deploy command */
export const DEPLOY_HELP = `Usage: esmap deploy --server <url> --name <app-name> --url <app-url> [options]

Options:
  --server <url>        Import map server URL (required)
  --name <name>         Service/app name (required)
  --url <url>           App URL (required)
  --deployed-by <name>  Deployer name
  --manifest <path>     Manifest file path (auto-resolves URL)
  --cdn-base <url>      CDN base URL (used with --manifest)
  --help                Show this help message`;
