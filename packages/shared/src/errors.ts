/**
 * esmap 프레임워크 에러의 기본 클래스.
 * 모든 프레임워크 에러는 이 클래스를 상속한다.
 */
export class EsmapError extends Error {
  /** 에러 코드 (머신 파싱 가능) */
  readonly code: string;
  /** 에러 발생 원인 */
  override readonly cause?: Error;

  constructor(code: string, message: string, cause?: Error) {
    super(message);
    this.name = 'EsmapError';
    this.code = code;
    this.cause = cause;
  }
}

/** Import map 파싱/검증 에러 */
export class ImportMapError extends EsmapError {
  constructor(message: string, cause?: Error) {
    super('IMPORT_MAP_ERROR', message, cause);
    this.name = 'ImportMapError';
  }
}

/** Import map merge 시 충돌 에러 */
export class ImportMapConflictError extends EsmapError {
  readonly specifier: string;

  constructor(specifier: string) {
    super('IMPORT_MAP_CONFLICT', `Import map 충돌: "${specifier}"이 양쪽 맵에 존재합니다`);
    this.name = 'ImportMapConflictError';
    this.specifier = specifier;
  }
}

/** 매니페스트 검증 에러 */
export class ManifestValidationError extends EsmapError {
  readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super('MANIFEST_VALIDATION_ERROR', `매니페스트 검증 실패:\n  - ${errors.join('\n  - ')}`);
    this.name = 'ManifestValidationError';
    this.validationErrors = errors;
  }
}

/** 설정 검증 에러 */
export class ConfigValidationError extends EsmapError {
  readonly validationErrors: readonly { path: string; message: string }[];

  constructor(errors: readonly { path: string; message: string }[]) {
    const messages = errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    super('CONFIG_VALIDATION_ERROR', `설정 검증 실패:\n${messages}`);
    this.name = 'ConfigValidationError';
    this.validationErrors = errors;
  }
}

/** 앱 라이프사이클 에러 */
export class AppLifecycleError extends EsmapError {
  readonly appName: string;
  readonly phase: 'load' | 'bootstrap' | 'mount' | 'unmount';

  constructor(appName: string, phase: 'load' | 'bootstrap' | 'mount' | 'unmount', cause?: Error) {
    super(
      'APP_LIFECYCLE_ERROR',
      `앱 "${appName}" ${phase} 실패${cause ? `: ${cause.message}` : ''}`,
      cause,
    );
    this.name = 'AppLifecycleError';
    this.appName = appName;
    this.phase = phase;
  }
}

/** 앱이 등록되어 있지 않을 때 발생하는 에러 */
export class AppNotFoundError extends EsmapError {
  readonly appName: string;

  constructor(appName: string) {
    super('APP_NOT_FOUND', `앱 "${appName}"이 등록되어 있지 않습니다`);
    this.name = 'AppNotFoundError';
    this.appName = appName;
  }
}

/** 앱이 이미 등록되어 있을 때 발생하는 에러 */
export class AppAlreadyRegisteredError extends EsmapError {
  readonly appName: string;

  constructor(appName: string) {
    super('APP_ALREADY_REGISTERED', `앱 "${appName}"은 이미 등록되어 있습니다`);
    this.name = 'AppAlreadyRegisteredError';
    this.appName = appName;
  }
}

/** DOM 컨테이너를 찾을 수 없을 때 발생하는 에러 */
export class ContainerNotFoundError extends EsmapError {
  readonly selector: string;

  constructor(selector: string) {
    super(
      'CONTAINER_NOT_FOUND',
      `컨테이너 "${selector}"를 찾을 수 없습니다. ` +
        `HTML에 해당 셀렉터와 일치하는 요소가 있는지, 앱 등록 시 container 옵션이 올바른지 확인하세요.`,
    );
    this.name = 'ContainerNotFoundError';
    this.selector = selector;
  }
}

/** Import map 로드 실패 에러 */
export class ImportMapLoadError extends EsmapError {
  readonly url?: string;
  readonly status?: number;

  constructor(message: string, options?: { url?: string; status?: number; cause?: Error }) {
    super('IMPORT_MAP_LOAD_ERROR', message, options?.cause);
    this.name = 'ImportMapLoadError';
    this.url = options?.url;
    this.status = options?.status;
  }
}
