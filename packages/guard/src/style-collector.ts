/**
 * 앱별 스타일시트 추적 유틸리티.
 * document head에 추가되는 스타일 요소를 앱 단위로 수집하고 관리한다.
 */

/** 스타일 수집기 인터페이스 */
export interface StyleCollector {
  /** 특정 앱의 스타일 수집을 시작한다 */
  startCapture(appName: string): void;
  /** 수집을 중단하고 수집된 스타일 요소를 반환한다 */
  stopCapture(appName: string): readonly (HTMLStyleElement | HTMLLinkElement)[];
  /** 특정 앱에 속한 모든 스타일을 DOM에서 제거한다 */
  removeStyles(appName: string): void;
  /** 특정 앱에 속한 모든 스타일 요소를 반환한다 */
  getStyles(appName: string): readonly (HTMLStyleElement | HTMLLinkElement)[];
  /** 수집기를 해제하고 모든 리소스를 정리한다 */
  destroy(): void;
}

/** 앱별 수집 상태 */
interface CaptureState {
  /** 수집 중인지 여부 */
  readonly active: boolean;
  /** 수집된 스타일 요소 목록 */
  readonly elements: (HTMLStyleElement | HTMLLinkElement)[];
}

/**
 * head에 추가되는 스타일/링크 요소가 스타일 관련인지 판별한다.
 * @param node - 검사할 DOM 노드
 * @returns 스타일 관련 요소이면 true
 */
function isStyleRelatedElement(node: Node): node is HTMLStyleElement | HTMLLinkElement {
  if (node instanceof HTMLStyleElement) return true;
  if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') return true;
  return false;
}

/**
 * 스타일 수집기를 생성한다.
 * document head에 MutationObserver를 부착하여 스타일 추가를 감지한다.
 * @returns 스타일 수집기 인스턴스
 */
export function createStyleCollector(): StyleCollector {
  const captures = new Map<string, CaptureState>();
  const activeApps = new Set<string>();

  const observer = new MutationObserver((mutations) => {
    if (activeApps.size === 0) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!isStyleRelatedElement(node)) continue;

        for (const appName of activeApps) {
          const state = captures.get(appName);
          if (state?.active) {
            node.setAttribute('data-esmap-app', appName);
            state.elements.push(node);
          }
        }
      }
    }
  });

  observer.observe(document.head, { childList: true });

  return {
    startCapture(appName: string): void {
      const existing = captures.get(appName);
      const elements = existing?.elements ?? [];

      captures.set(appName, { active: true, elements });
      activeApps.add(appName);
    },

    stopCapture(appName: string): readonly (HTMLStyleElement | HTMLLinkElement)[] {
      const state = captures.get(appName);
      if (!state) return [];

      captures.set(appName, { active: false, elements: state.elements });
      activeApps.delete(appName);

      return state.elements;
    },

    removeStyles(appName: string): void {
      const state = captures.get(appName);
      if (!state) return;

      for (const element of state.elements) {
        element.remove();
      }

      captures.set(appName, { active: state.active, elements: [] });
    },

    getStyles(appName: string): readonly (HTMLStyleElement | HTMLLinkElement)[] {
      const state = captures.get(appName);
      if (!state) return [];

      return state.elements;
    },

    destroy(): void {
      observer.disconnect();
      captures.clear();
      activeApps.clear();
    },
  };
}
