import { parseArgs } from './commands/parse-args.js';
import { runAnalyze, ANALYZE_HELP } from './commands/analyze.js';
import { runDeploy, DEPLOY_HELP } from './commands/deploy.js';
import { runGenerate, GENERATE_HELP } from './commands/generate.js';
import { runRollback, ROLLBACK_HELP } from './commands/rollback.js';
import { runStatus, STATUS_HELP } from './commands/status.js';

/** 메인 도움말 텍스트 */
const MAIN_HELP = `esmap - Import map management CLI

Usage: esmap <command> [options]

Commands:
  analyze   Analyze dependency conflicts across MFE manifests
  deploy    Deploy a service URL to the import map server
  generate  Generate an import map from config and manifests
  rollback  Rollback a service to its previous URL
  status    Show the current import map from the server

Run 'esmap <command> --help' for command-specific help.`;

/** 커맨드별 도움말 텍스트 맵 */
const COMMAND_HELP: Readonly<Record<string, string>> = {
  analyze: ANALYZE_HELP,
  deploy: DEPLOY_HELP,
  generate: GENERATE_HELP,
  rollback: ROLLBACK_HELP,
  status: STATUS_HELP,
};

/** 커맨드별 실행 함수 맵 */
const COMMAND_RUNNERS: Readonly<
  Record<string, (flags: Readonly<Record<string, string>>) => Promise<void>>
> = {
  analyze: runAnalyze,
  deploy: runDeploy,
  generate: runGenerate,
  rollback: runRollback,
  status: runStatus,
};

/**
 * CLI 메인 함수. process.argv를 파싱하여 적절한 커맨드를 실행한다.
 * @param argv - process.argv 배열
 */
export async function main(argv: readonly string[] = process.argv): Promise<void> {
  const parsed = parseArgs(argv);

  if (!parsed.command || (parsed.help && !parsed.command)) {
    console.log(MAIN_HELP);
    return;
  }

  if (parsed.help) {
    const helpText = COMMAND_HELP[parsed.command];
    if (helpText) {
      console.log(helpText);
    } else {
      console.error(`Unknown command: ${parsed.command}`);
      console.log(MAIN_HELP);
      process.exitCode = 1;
    }
    return;
  }

  const runner = COMMAND_RUNNERS[parsed.command];
  if (!runner) {
    console.error(`Unknown command: ${parsed.command}`);
    console.log(MAIN_HELP);
    process.exitCode = 1;
    return;
  }

  try {
    await runner(parsed.flags);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

main();
