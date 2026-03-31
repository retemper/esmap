import { describe, it, expect } from 'vitest';
import { parseArgs, requireFlag } from './parse-args.js';

describe('parseArgs', () => {
  it('extracts the subcommand', () => {
    const result = parseArgs(['node', 'esmap', 'deploy']);

    expect(result.command).toBe('deploy');
    expect(result.help).toBe(false);
  });

  it('parses --key value style flags', () => {
    const result = parseArgs([
      'node',
      'esmap',
      'deploy',
      '--server',
      'http://localhost:3000',
      '--name',
      '@flex/checkout',
    ]);

    expect(result.command).toBe('deploy');
    expect(result.flags).toStrictEqual({
      server: 'http://localhost:3000',
      name: '@flex/checkout',
    });
  });

  it('recognizes the --help flag', () => {
    const result = parseArgs(['node', 'esmap', '--help']);

    expect(result.help).toBe(true);
  });

  it('recognizes the -h shorthand flag', () => {
    const result = parseArgs(['node', 'esmap', '-h']);

    expect(result.help).toBe(true);
  });

  it('allows a command and --help to be used together', () => {
    const result = parseArgs(['node', 'esmap', 'deploy', '--help']);

    expect(result.command).toBe('deploy');
    expect(result.help).toBe(true);
  });

  it('returns undefined command when no arguments are provided', () => {
    const result = parseArgs(['node', 'esmap']);

    expect(result.command).toBeUndefined();
    expect(result.flags).toStrictEqual({});
  });

  it('treats flags without values as "true"', () => {
    const result = parseArgs(['node', 'esmap', 'status', '--verbose']);

    expect(result.flags.verbose).toBe('true');
  });
});

describe('requireFlag', () => {
  it('returns the value of an existing flag', () => {
    const result = requireFlag({ server: 'http://localhost' }, 'server', 'test');

    expect(result).toBe('http://localhost');
  });

  it('throws an error when the flag is missing', () => {
    expect(() => requireFlag({}, 'server', 'deploy')).toThrow(
      "Missing required flag --server for 'deploy' command",
    );
  });

  it('throws an error when the flag value is "true" (no value)', () => {
    expect(() => requireFlag({ server: 'true' }, 'server', 'deploy')).toThrow(
      "Missing required flag --server for 'deploy' command",
    );
  });
});
