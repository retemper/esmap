import type { EsmapConfig } from '@esmap/shared';
import { ConfigValidationError, isRecord } from '@esmap/shared';

/** 설정 필드별 검증 에러 */
export interface ConfigFieldError {
  readonly path: string;
  readonly message: string;
}

/**
 * 설정 객체의 유효성을 검증한다. 에러 목록을 반환한다.
 * @param config - 검증할 설정 객체
 */
export function validateConfig(config: unknown): readonly ConfigFieldError[] {
  const errors: ConfigFieldError[] = [];

  if (!isRecord(config)) {
    errors.push({ path: '', message: '설정은 객체여야 합니다' });
    return errors;
  }

  if (!isRecord(config.apps)) {
    errors.push({ path: 'apps', message: '"apps" 필드는 필수이며 객체여야 합니다' });
  } else {
    validateApps(config.apps, errors);
  }

  if (!config.shared || typeof config.shared !== 'object') {
    errors.push({ path: 'shared', message: '"shared" 필드는 필수이며 객체여야 합니다' });
  }

  if (config.server !== undefined) {
    validateServer(config.server, errors);
  }

  return errors;
}

/**
 * EsmapConfig 타입 가드. validateConfig가 에러 없이 통과한 값에 대해 사용한다.
 * @param config - 검증할 설정 객체
 */
function isEsmapConfig(config: unknown): config is EsmapConfig {
  return validateConfig(config).length === 0;
}

/**
 * 검증 에러가 없으면 설정을 타입 안전하게 반환한다. 에러가 있으면 ConfigValidationError를 던진다.
 * @param config - 검증할 설정 객체
 */
export function assertValidConfig(config: unknown): EsmapConfig {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }
  if (!isEsmapConfig(config)) {
    throw new ConfigValidationError([]);
  }
  return config;
}

/**
 * apps 필드를 검증한다.
 * @param apps - 앱 설정 맵
 * @param errors - 에러 누적 배열
 */
function validateApps(apps: Record<string, unknown>, errors: ConfigFieldError[]): void {
  for (const [name, appConfig] of Object.entries(apps)) {
    if (!isRecord(appConfig)) {
      errors.push({ path: `apps.${name}`, message: '앱 설정은 객체여야 합니다' });
      continue;
    }

    if (typeof appConfig.path !== 'string' || appConfig.path.length === 0) {
      errors.push({ path: `apps.${name}.path`, message: '"path"는 필수 문자열입니다' });
    }
  }
}

/**
 * server 필드를 검증한다.
 * @param server - 서버 설정 객체
 * @param errors - 에러 누적 배열
 */
function validateServer(server: unknown, errors: ConfigFieldError[]): void {
  if (!isRecord(server)) {
    errors.push({ path: 'server', message: '"server"는 객체여야 합니다' });
    return;
  }

  if (
    server.port !== undefined &&
    (typeof server.port !== 'number' || server.port < 0 || server.port > 65535)
  ) {
    errors.push({ path: 'server.port', message: '포트는 0~65535 사이의 숫자여야 합니다' });
  }

  if (server.storage !== undefined) {
    const validStorages = ['filesystem', 's3', 'redis'];
    if (typeof server.storage !== 'string' || !validStorages.includes(server.storage)) {
      errors.push({
        path: 'server.storage',
        message: `storage는 ${validStorages.join(', ')} 중 하나여야 합니다`,
      });
    }
  }
}
