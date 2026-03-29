/**
 * process.argv에서 커맨드와 플래그를 파싱한다.
 * yargs 같은 외부 의존성 없이 간단한 --key value 형태를 처리한다.
 */
export interface ParsedArgs {
  /** 서브커맨드 (예: "deploy", "generate") */
  readonly command: string | undefined;
  /** --key value 플래그 맵 */
  readonly flags: Readonly<Record<string, string>>;
  /** --help 플래그 존재 여부 */
  readonly help: boolean;
}

/**
 * argv 배열을 파싱하여 커맨드와 플래그를 추출한다.
 * @param argv - process.argv (node 경로, 스크립트 경로 포함)
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
 * 필수 플래그가 존재하는지 검증하고 값을 반환한다.
 * @param flags - 파싱된 플래그 맵
 * @param name - 필수 플래그 이름
 * @param commandName - 에러 메시지에 표시할 커맨드 이름
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
