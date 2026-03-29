/** 프록시 기반 샌드박스에 전달할 옵션 */
interface ProxySandboxOptions {
  /** 샌드박스 인스턴스의 식별 이름 */
  readonly name: string;
  /** 실제 window에서 직접 읽을 속성 목록 (기본값 제공) */
  readonly allowList?: ReadonlyArray<PropertyKey>;
}

/** 실제 window를 오염시키지 않고 속성을 격리하는 프록시 기반 샌드박스 */
const DEFAULT_ALLOW_LIST: ReadonlyArray<PropertyKey> = [
  'document',
  'location',
  'history',
  'navigator',
  'console',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'fetch',
  'performance',
];

/** Proxy를 활용하여 window 속성 변경을 격리하는 샌드박스 클래스 */
class ProxySandbox {
  /** 샌드박스 이름 */
  readonly name: string;

  /** 현재 활성 상태 여부 */
  private active = false;

  /** 수정된 속성을 저장하는 내부 맵 */
  private readonly modifiedPropsMap = new Map<PropertyKey, unknown>();

  /** 삭제된 속성을 추적하는 Set */
  private readonly deletedPropsSet = new Set<PropertyKey>();

  /** 실제 window에서 직접 읽을 속성 목록 */
  private readonly allowList: ReadonlySet<PropertyKey>;

  /** 외부에 노출되는 프록시 객체 */
  readonly proxy: Window;

  /** 주어진 옵션으로 ProxySandbox 인스턴스를 생성한다 */
  constructor(options: ProxySandboxOptions) {
    this.name = options.name;
    this.allowList = new Set(options.allowList ?? DEFAULT_ALLOW_LIST);

    const modifiedPropsMap = this.modifiedPropsMap;
    const deletedPropsSet = this.deletedPropsSet;
    const allowList = this.allowList;
    const sandbox = this;

    const fakeWindow = Object.create(null) as Window;

    this.proxy = new Proxy(fakeWindow, {
      /** 속성 읽기: 내부 맵 > allowList > window 순서로 조회한다 */
      get(_target, prop, _receiver): unknown {
        if (modifiedPropsMap.has(prop)) {
          return modifiedPropsMap.get(prop);
        }

        if (deletedPropsSet.has(prop)) {
          return undefined;
        }

        const value: unknown = Reflect.get(window, prop);

        if (allowList.has(prop) && typeof value === 'function') {
          return value.bind(window);
        }

        return value;
      },

      /** 속성 쓰기: 활성 상태일 때만 내부 맵에 저장한다 */
      set(_target, prop, value): boolean {
        if (!sandbox.active) {
          return true;
        }

        modifiedPropsMap.set(prop, value);
        deletedPropsSet.delete(prop);
        return true;
      },

      /** 속성 존재 확인: 내부 맵과 window 모두 확인한다 */
      has(_target, prop): boolean {
        if (deletedPropsSet.has(prop)) {
          return false;
        }
        return modifiedPropsMap.has(prop) || prop in window;
      },

      /** 속성 삭제: 내부 맵에서만 제거한다 */
      deleteProperty(_target, prop): boolean {
        if (!sandbox.active) {
          return true;
        }

        modifiedPropsMap.delete(prop);
        deletedPropsSet.add(prop);
        return true;
      },

      /** 열거 가능한 속성 목록: 샌드박스 수정분 + window 속성을 합친다 */
      ownKeys(): ArrayLike<string | symbol> {
        const windowKeys = Object.getOwnPropertyNames(window);
        const allKeys = new Set<string | symbol>(windowKeys);

        for (const key of modifiedPropsMap.keys()) {
          allKeys.add(key as string | symbol);
        }
        for (const key of deletedPropsSet) {
          allKeys.delete(key as string | symbol);
        }

        return [...allKeys];
      },

      /** 속성 서술자 조회: 수정된 속성은 configurable + enumerable로 반환한다 */
      getOwnPropertyDescriptor(_target, prop): PropertyDescriptor | undefined {
        if (modifiedPropsMap.has(prop)) {
          return {
            value: modifiedPropsMap.get(prop),
            writable: true,
            configurable: true,
            enumerable: true,
          };
        }

        if (deletedPropsSet.has(prop)) {
          return undefined;
        }

        const descriptor = Object.getOwnPropertyDescriptor(window, prop);
        if (descriptor) {
          return { ...descriptor, configurable: true };
        }
        return undefined;
      },

      /** 속성 정의: 활성 상태일 때만 내부 맵에 저장한다 */
      defineProperty(_target, prop, descriptor): boolean {
        if (!sandbox.active) {
          return true;
        }

        modifiedPropsMap.set(prop, descriptor.value);
        deletedPropsSet.delete(prop);
        return true;
      },
    });
  }

  /** 샌드박스를 활성화하고, 이전 수정사항이 있으면 복원한다 */
  activate(): void {
    this.active = true;
  }

  /** 샌드박스를 비활성화한다 */
  deactivate(): void {
    this.active = false;
  }

  /** 현재까지 수정된 속성 이름 목록을 반환한다 */
  getModifiedProps(): ReadonlyArray<PropertyKey> {
    return [...this.modifiedPropsMap.keys()];
  }

  /** 현재 활성 상태인지 반환한다 */
  isActive(): boolean {
    return this.active;
  }
}

export { ProxySandbox, DEFAULT_ALLOW_LIST };
export type { ProxySandboxOptions };
