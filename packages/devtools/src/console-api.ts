import {
  getOverrides,
  setOverride,
  removeOverride,
  clearOverrides,
  hasActiveOverrides,
} from './overrides.js';
import { createDevtoolsInspector } from './inspector.js';
import type { DevtoolsInspector } from './inspector.js';

/**
 * 브라우저 콘솔에서 사용할 수 있는 devtools API.
 * `window.__ESMAP__`로 접근한다.
 */
export interface EsmapDevtoolsApi {
  /** 현재 활성 override 목록을 출력한다. */
  readonly overrides: () => void;
  /** 모듈 URL을 override한다. 페이지 새로고침 후 적용. */
  readonly override: (specifier: string, url: string) => void;
  /** 특정 모듈의 override를 해제한다. */
  readonly removeOverride: (specifier: string) => void;
  /** 모든 override를 해제한다. */
  readonly clearOverrides: () => void;
  /** 현재 override 활성 상태를 확인한다. */
  readonly isOverriding: () => boolean;
  /** 런타임 상태 Inspector. connect() 후 이벤트/모듈/앱 상태를 조회한다. */
  readonly inspect: DevtoolsInspector;
}

/** devtools API 싱글턴 인스턴스를 생성한다. */
function createDevtoolsApi(): EsmapDevtoolsApi {
  return {
    inspect: createDevtoolsInspector(),

    overrides() {
      const entries = getOverrides();
      if (entries.length === 0) {
        console.log('[esmap] 활성 override 없음');
        return;
      }
      console.group(`[esmap] 활성 override (${entries.length}개)`);
      for (const entry of entries) {
        console.log(`${entry.specifier} → ${entry.url}`);
      }
      console.groupEnd();
    },

    override(specifier: string, url: string) {
      setOverride(specifier, url);
      console.log(`[esmap] override 설정: ${specifier} → ${url}`);
      console.log('[esmap] 페이지를 새로고침하면 적용됩니다.');
    },

    removeOverride(specifier: string) {
      removeOverride(specifier);
      console.log(`[esmap] override 해제: ${specifier}`);
    },

    clearOverrides() {
      clearOverrides();
      console.log('[esmap] 모든 override 해제');
    },

    isOverriding() {
      return hasActiveOverrides();
    },
  };
}

/** globalThis에 __ESMAP__ 프로퍼티를 추가하기 위한 타입 확장 */
declare global {
  /** devtools API 인스턴스. window.__ESMAP__으로 접근한다. */
  var __ESMAP__: EsmapDevtoolsApi | undefined;
}

/**
 * devtools API를 window.__ESMAP__에 등록한다.
 * 이미 등록되어 있으면 건너뛴다.
 */
export function installDevtoolsApi(): void {
  if (globalThis.__ESMAP__) return;

  globalThis.__ESMAP__ = createDevtoolsApi();
}
