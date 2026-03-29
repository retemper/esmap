import { requireFlag } from './parse-args.js';

/** status 커맨드의 옵션 */
export interface StatusOptions {
  /** import map 서버 URL */
  readonly server: string;
}

/** import map 상태 정보 */
export interface StatusResult {
  /** import map의 imports 항목 */
  readonly imports: Readonly<Record<string, string>>;
  /** import map의 scopes 항목 */
  readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * 서버 응답이 유효한 import map인지 확인한다.
 * @param value - 검증할 값
 */
function isImportMapResponse(value: unknown): value is StatusResult {
  if (typeof value !== 'object' || value === null) return false;
  return 'imports' in value && typeof value.imports === 'object' && value.imports !== null;
}

/**
 * 플래그 맵에서 StatusOptions를 추출한다.
 * @param flags - 파싱된 CLI 플래그
 */
export function parseStatusFlags(flags: Readonly<Record<string, string>>): StatusOptions {
  return {
    server: requireFlag(flags, 'server', 'status'),
  };
}

/**
 * import map 서버에서 현재 import map 상태를 조회한다.
 * GET / 엔드포인트를 호출한다.
 * @param options - 상태 조회 옵션
 * @param fetchFn - HTTP fetch 함수 (테스트 주입용)
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
 * import map 항목을 정렬된 테이블 형태로 포맷한다.
 * @param result - 서버에서 받은 import map 상태
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
 * status 커맨드를 실행하고 결과를 콘솔에 출력한다.
 * @param flags - 파싱된 CLI 플래그
 */
export async function runStatus(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseStatusFlags(flags);
  const result = await status(options);
  console.log(formatStatus(result));
}

/** status 커맨드의 도움말 텍스트 */
export const STATUS_HELP = `Usage: esmap status --server <url>

Options:
  --server <url>   Import map server URL (required)
  --help           Show this help message`;
