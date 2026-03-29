import { describe, it, expect } from 'vitest';
import {
  EsmapError,
  ImportMapError,
  ImportMapConflictError,
  ManifestValidationError,
  ConfigValidationError,
  AppLifecycleError,
  AppNotFoundError,
  AppAlreadyRegisteredError,
  ContainerNotFoundError,
  ImportMapLoadError,
} from './errors.js';

describe('EsmapError', () => {
  it('코드, 메시지, cause를 가진다', () => {
    const cause = new Error('원인');
    const error = new EsmapError('TEST_CODE', '테스트 메시지', cause);

    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('테스트 메시지');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('EsmapError');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ImportMapError', () => {
  it('IMPORT_MAP_ERROR 코드를 가진다', () => {
    const error = new ImportMapError('파싱 실패');
    expect(error.code).toBe('IMPORT_MAP_ERROR');
    expect(error.name).toBe('ImportMapError');
    expect(error).toBeInstanceOf(EsmapError);
  });
});

describe('ImportMapConflictError', () => {
  it('충돌한 specifier를 포함한다', () => {
    const error = new ImportMapConflictError('react');
    expect(error.specifier).toBe('react');
    expect(error.code).toBe('IMPORT_MAP_CONFLICT');
    expect(error.message).toContain('react');
  });
});

describe('ManifestValidationError', () => {
  it('검증 에러 목록을 포함한다', () => {
    const errors = ['"name" is required', '"version" is required'];
    const error = new ManifestValidationError(errors);
    expect(error.validationErrors).toStrictEqual(errors);
    expect(error.code).toBe('MANIFEST_VALIDATION_ERROR');
  });
});

describe('ConfigValidationError', () => {
  it('경로별 에러 목록을 포함한다', () => {
    const errors = [{ path: 'apps', message: '필수' }];
    const error = new ConfigValidationError(errors);
    expect(error.validationErrors).toStrictEqual(errors);
    expect(error.message).toContain('apps');
  });
});

describe('AppLifecycleError', () => {
  it('앱 이름과 페이즈를 포함한다', () => {
    const cause = new Error('네트워크 에러');
    const error = new AppLifecycleError('@flex/checkout', 'load', cause);
    expect(error.appName).toBe('@flex/checkout');
    expect(error.phase).toBe('load');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('@flex/checkout');
    expect(error.message).toContain('load');
  });

  it('cause 없이도 생성 가능하다', () => {
    const error = new AppLifecycleError('@flex/checkout', 'mount');
    expect(error.cause).toBeUndefined();
  });
});

describe('AppNotFoundError', () => {
  it('앱 이름을 포함한다', () => {
    const error = new AppNotFoundError('@flex/checkout');
    expect(error.appName).toBe('@flex/checkout');
    expect(error.code).toBe('APP_NOT_FOUND');
  });
});

describe('AppAlreadyRegisteredError', () => {
  it('앱 이름을 포함한다', () => {
    const error = new AppAlreadyRegisteredError('@flex/checkout');
    expect(error.appName).toBe('@flex/checkout');
    expect(error.code).toBe('APP_ALREADY_REGISTERED');
  });
});

describe('ContainerNotFoundError', () => {
  it('셀렉터를 포함한다', () => {
    const error = new ContainerNotFoundError('#app');
    expect(error.selector).toBe('#app');
    expect(error.code).toBe('CONTAINER_NOT_FOUND');
  });
});

describe('ImportMapLoadError', () => {
  it('URL과 상태 코드를 포함한다', () => {
    const error = new ImportMapLoadError('로드 실패', {
      url: 'https://api.example.com/importmap',
      status: 500,
    });
    expect(error.url).toBe('https://api.example.com/importmap');
    expect(error.status).toBe(500);
    expect(error.code).toBe('IMPORT_MAP_LOAD_ERROR');
  });

  it('옵션 없이도 생성 가능하다', () => {
    const error = new ImportMapLoadError('필수 옵션 누락');
    expect(error.url).toBeUndefined();
    expect(error.status).toBeUndefined();
  });
});
