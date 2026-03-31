import { requireFlag } from './parse-args.js';

/** Options for the rollback command */
export interface RollbackOptions {
  /** Import map server URL */
  readonly server: string;
  /** Service name to roll back */
  readonly name: string;
}

/** Result of the rollback command */
export interface RollbackResult {
  /** Service name */
  readonly name: string;
  /** URL after rollback */
  readonly url: string;
  /** Whether the rollback succeeded */
  readonly success: boolean;
}

/** Interface for type-guarding the server rollback response */
interface RollbackResponseBody {
  readonly service: string;
  readonly rolledBackTo: string;
}

/**
 * Checks whether the server response is a valid RollbackResponseBody.
 * @param value - value to validate
 */
function isRollbackResponseBody(value: unknown): value is RollbackResponseBody {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'service' in value &&
    typeof value.service === 'string' &&
    'rolledBackTo' in value &&
    typeof value.rolledBackTo === 'string'
  );
}

/**
 * Extracts RollbackOptions from the flag map.
 * @param flags - parsed CLI flags
 */
export function parseRollbackFlags(flags: Readonly<Record<string, string>>): RollbackOptions {
  return {
    server: requireFlag(flags, 'server', 'rollback'),
    name: requireFlag(flags, 'name', 'rollback'),
  };
}

/**
 * Requests a rollback from the import map server.
 * Calls the POST /rollback/:name endpoint.
 * @param options - rollback options
 * @param fetchFn - HTTP fetch function (for test injection)
 */
export async function rollback(
  options: RollbackOptions,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<RollbackResult> {
  const serverBase = options.server.replace(/\/$/, '');
  const endpoint = `${serverBase}/rollback/${encodeURIComponent(options.name)}`;

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Rollback failed (${response.status}): ${errorText}`);
  }

  const responseBody: unknown = await response.json();

  if (isRollbackResponseBody(responseBody)) {
    return {
      name: responseBody.service,
      url: responseBody.rolledBackTo,
      success: true,
    };
  }

  throw new Error(
    `Unexpected server response format: "service" and "rolledBackTo" fields are required. ` +
      `Received: ${JSON.stringify(responseBody)}`,
  );
}

/**
 * Runs the rollback command and prints the result to the console.
 * @param flags - parsed CLI flags
 */
export async function runRollback(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseRollbackFlags(flags);
  const result = await rollback(options);
  console.log(`✓ Rolled back ${result.name} → ${result.url}`);
}

/** Help text for the rollback command */
export const ROLLBACK_HELP = `Usage: esmap rollback --server <url> --name <app-name>

Options:
  --server <url>   Import map server URL (required)
  --name <name>    Service/app name to rollback (required)
  --help           Show this help message`;
