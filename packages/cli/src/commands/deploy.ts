import { readFile } from 'node:fs/promises';
import { requireFlag } from './parse-args.js';

/** deploy 커맨드의 옵션 */
export interface DeployOptions {
  /** import map 서버 URL */
  readonly server: string;
  /** 서비스(앱) 이름 */
  readonly name: string;
  /** 앱 URL */
  readonly url: string;
  /** 배포자 이름 */
  readonly deployedBy?: string;
  /** 매니페스트 파일 경로 (URL 자동 해석용) */
  readonly manifest?: string;
  /** CDN 베이스 URL (매니페스트 사용 시) */
  readonly cdnBase?: string;
}

/** deploy 커맨드의 결과 */
export interface DeployResult {
  /** 서비스 이름 */
  readonly name: string;
  /** 배포된 URL */
  readonly url: string;
  /** 성공 여부 */
  readonly success: boolean;
}

/** 서버 응답 형태의 타입 가드용 인터페이스 */
interface DeployResponseBody {
  readonly service: string;
  readonly url: string;
}

/**
 * 서버 응답이 유효한 DeployResponseBody인지 확인한다.
 * @param value - 검증할 값
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
 * 플래그 맵에서 DeployOptions를 추출한다.
 * @param flags - 파싱된 CLI 플래그
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
 * 매니페스트 파일에서 엔트리 URL을 해석한다.
 * @param manifestPath - 매니페스트 JSON 파일 경로
 * @param cdnBase - CDN 베이스 URL
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
 * import map 서버에 서비스 URL을 배포(업데이트)한다.
 * PATCH /services/:name 엔드포인트를 호출한다.
 * @param options - 배포 옵션
 * @param fetchFn - HTTP fetch 함수 (테스트 주입용)
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
 * deploy 커맨드를 실행하고 결과를 콘솔에 출력한다.
 * @param flags - 파싱된 CLI 플래그
 */
export async function runDeploy(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseDeployFlags(flags);
  const result = await deploy(options);
  console.log(`✓ Deployed ${result.name} → ${result.url}`);
}

/** deploy 커맨드의 도움말 텍스트 */
export const DEPLOY_HELP = `Usage: esmap deploy --server <url> --name <app-name> --url <app-url> [options]

Options:
  --server <url>        Import map server URL (required)
  --name <name>         Service/app name (required)
  --url <url>           App URL (required)
  --deployed-by <name>  Deployer name
  --manifest <path>     Manifest file path (auto-resolves URL)
  --cdn-base <url>      CDN base URL (used with --manifest)
  --help                Show this help message`;
