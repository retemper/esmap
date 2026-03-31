/**
 * Parses commands and flags from process.argv.
 * Handles simple --key value format without external dependencies like yargs.
 */
export interface ParsedArgs {
  /** Subcommand (e.g., "deploy", "generate") */
  readonly command: string | undefined;
  /** --key value flag map */
  readonly flags: Readonly<Record<string, string>>;
  /** Whether the --help flag is present */
  readonly help: boolean;
}

/**
 * Parses the argv array to extract the command and flags.
 * @param argv - process.argv (includes node path and script path)
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const args = argv.slice(2);
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  const help = args.includes('--help') || args.includes('-h');

  for (const [i, arg] of args.entries()) {
    if (arg === '--help' || arg === '-h') {
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith('--')) {
        flags[key] = nextArg;
      } else {
        flags[key] = 'true';
      }
    } else {
      const prevArg = args[i - 1];
      if (prevArg === undefined || !prevArg.startsWith('--')) {
        positional.push(arg);
      }
    }
  }

  return {
    command: positional[0],
    flags,
    help,
  };
}

/**
 * Validates that a required flag exists and returns its value.
 * @param flags - parsed flag map
 * @param name - required flag name
 * @param commandName - command name to display in error messages
 */
export function requireFlag(
  flags: Readonly<Record<string, string>>,
  name: string,
  commandName: string,
): string {
  const value = flags[name];
  if (value === undefined || value === 'true') {
    throw new Error(`Missing required flag --${name} for '${commandName}' command`);
  }
  return value;
}
