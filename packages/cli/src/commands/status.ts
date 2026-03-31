import { requireFlag } from './parse-args.js';

/** Options for the status command */
export interface StatusOptions {
  /** Import map server URL */
  readonly server: string;
}

/** Import map status information */
export interface StatusResult {
  /** imports entries of the import map */
  readonly imports: Readonly<Record<string, string>>;
  /** scopes entries of the import map */
  readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * Checks whether the server response is a valid import map.
 * @param value - value to validate
 */
function isImportMapResponse(value: unknown): value is StatusResult {
  if (typeof value !== 'object' || value === null) return false;
  return 'imports' in value && typeof value.imports === 'object' && value.imports !== null;
}

/**
 * Extracts StatusOptions from the flag map.
 * @param flags - parsed CLI flags
 */
export function parseStatusFlags(flags: Readonly<Record<string, string>>): StatusOptions {
  return {
    server: requireFlag(flags, 'server', 'status'),
  };
}

/**
 * Queries the current import map status from the import map server.
 * Calls the GET / endpoint.
 * @param options - status query options
 * @param fetchFn - HTTP fetch function (for test injection)
 */
export async function status(
  options: StatusOptions,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<StatusResult> {
  const serverBase = options.server.replace(/\/$/, '');
  const endpoint = `${serverBase}/`;

  const response = await fetchFn(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Status check failed (${response.status}): ${errorText}`);
  }

  const responseBody: unknown = await response.json();

  if (!isImportMapResponse(responseBody)) {
    throw new Error('Invalid import map response from server');
  }

  return responseBody;
}

/**
 * Formats import map entries as a sorted table.
 * @param result - import map status received from the server
 */
export function formatStatus(result: StatusResult): string {
  const lines: string[] = [];
  lines.push('=== Current Import Map ===');
  lines.push('');

  const entries = Object.entries(result.imports).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    lines.push('(no imports registered)');
  } else {
    const maxKeyLen = Math.max(...entries.map(([key]) => key.length));
    for (const [specifier, url] of entries) {
      lines.push(`  ${specifier.padEnd(maxKeyLen)}  →  ${url}`);
    }
  }

  if (result.scopes && Object.keys(result.scopes).length > 0) {
    lines.push('');
    lines.push('--- Scopes ---');
    for (const [scope, mapping] of Object.entries(result.scopes)) {
      lines.push(`  ${scope}:`);
      for (const [specifier, url] of Object.entries(mapping)) {
        lines.push(`    ${specifier}  →  ${url}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Runs the status command and prints the result to the console.
 * @param flags - parsed CLI flags
 */
export async function runStatus(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseStatusFlags(flags);
  const result = await status(options);
  console.log(formatStatus(result));
}

/** Help text for the status command */
export const STATUS_HELP = `Usage: esmap status --server <url>

Options:
  --server <url>   Import map server URL (required)
  --help           Show this help message`;
