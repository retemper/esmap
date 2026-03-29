import type { EsmapConfig, ServerConfig, DevtoolsConfig } from '@esmap/shared';

/** 서버 설정 기본값 */
const DEFAULT_SERVER_CONFIG: Required<ServerConfig> = {
  port: 3100,
  storage: 'filesystem',
  storageOptions: {},
  auth: { type: 'none' },
};

/** 개발자 도구 설정 기본값 */
const DEFAULT_DEVTOOLS_CONFIG: Required<DevtoolsConfig> = {
  enabled: true,
  overrideMode: 'native-merge',
  trigger: 'Alt+D',
};

/**
 * 사용자 설정에 기본값을 병합한 완전한 설정을 반환한다.
 * @param config - 사용자가 정의한 설정
 */
export function resolveConfig(config: EsmapConfig): ResolvedConfig {
  return {
    apps: config.apps,
    shared: config.shared,
    cdnBase: config.cdnBase ?? '',
    server: { ...DEFAULT_SERVER_CONFIG, ...config.server },
    devtools: { ...DEFAULT_DEVTOOLS_CONFIG, ...config.devtools },
  };
}

/** 기본값이 모두 채워진 완전한 설정 타입 */
export interface ResolvedConfig {
  readonly apps: EsmapConfig['apps'];
  readonly shared: EsmapConfig['shared'];
  readonly cdnBase: string;
  readonly server: Required<ServerConfig>;
  readonly devtools: Required<DevtoolsConfig>;
}
