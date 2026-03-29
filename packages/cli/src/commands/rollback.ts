import { requireFlag } from './parse-args.js';

/** rollback 커맨드의 옵션 */
export interface RollbackOptions {
  /** import map 서버 URL */
  readonly server: string;
  /** 롤백할 서비스 이름 */
  readonly name: string;
}

/** rollback 커맨드의 결과 */
export interface RollbackResult {
  /** 서비스 이름 */
  readonly name: string;
  /** 롤백 후 URL */
  readonly url: string;
  /** 성공 여부 */
  readonly success: boolean;
}

/** 서버 롤백 응답의 타입 가드용 인터페이스 */
interface RollbackResponseBody {
  readonly service: string;
  readonly rolledBackTo: string;
}

/**
 * 서버 응답이 유효한 RollbackResponseBody인지 확인한다.
 * @param value - 검증할 값
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
 * 플래그 맵에서 RollbackOptions를 추출한다.
 * @param flags - 파싱된 CLI 플래그
 */
export function parseRollbackFlags(flags: Readonly<Record<string, string>>): RollbackOptions {
  return {
    server: requireFlag(flags, 'server', 'rollback'),
    name: requireFlag(flags, 'name', 'rollback'),
  };
}

/**
 * import map 서버에 롤백을 요청한다.
 * POST /rollback/:name 엔드포인트를 호출한다.
 * @param options - 롤백 옵션
 * @param fetchFn - HTTP fetch 함수 (테스트 주입용)
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
    `서버 응답 형식이 올바르지 않습니다: service, rolledBackTo 필드가 필요합니다. ` +
      `받은 응답: ${JSON.stringify(responseBody)}`,
  );
}

/**
 * rollback 커맨드를 실행하고 결과를 콘솔에 출력한다.
 * @param flags - 파싱된 CLI 플래그
 */
export async function runRollback(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseRollbackFlags(flags);
  const result = await rollback(options);
  console.log(`✓ Rolled back ${result.name} → ${result.url}`);
}

/** rollback 커맨드의 도움말 텍스트 */
export const ROLLBACK_HELP = `Usage: esmap rollback --server <url> --name <app-name>

Options:
  --server <url>   Import map server URL (required)
  --name <name>    Service/app name to rollback (required)
  --help           Show this help message`;
