import type { EsmapConfig } from '@esmap/shared';

/**
 * 타입 안전한 설정 객체를 생성하는 헬퍼. esmap.config.ts에서 사용한다.
 * @param config - 프레임워크 설정 객체
 */
export function defineConfig(config: EsmapConfig): EsmapConfig {
  return config;
}
