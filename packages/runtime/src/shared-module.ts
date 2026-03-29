import { satisfiesRange, compareVersions } from './semver.js';

/** 공유 모듈 등록 시 필요한 설정 */
export interface SharedModuleConfig {
  /** 모듈 이름 (예: "react") */
  readonly name: string;
  /** 제공하는 버전 (예: "18.3.1") */
  readonly version: string;
  /** 요구 버전 범위 (예: "^18.0.0") */
  readonly requiredVersion?: string;
  /** 단일 인스턴스 강제 여부 */
  readonly singleton?: boolean;
  /** 즉시 로딩 여부. true이면 register 시점에 바로 로드한다. */
  readonly eager?: boolean;
  /** 버전 불일치 시 에러 throw 여부 */
  readonly strictVersion?: boolean;
  /** 모듈 인스턴스를 생성하는 팩토리 함수 */
  readonly factory: () => Promise<unknown>;
  /** 버전 협상 실패 시 사용할 대체 팩토리. strictVersion보다 우선한다. */
  readonly fallback?: () => Promise<unknown>;
  /** subpath exports 매핑 (예: { "./client": factory }) */
  readonly subpaths?: Readonly<Record<string, () => Promise<unknown>>>;
  /** 이 모듈을 등록한 앱 이름 (소유권 추적용) */
  readonly from?: string;
}

/** 로드된 모듈 정보 */
interface LoadedModule {
  /** 선택된 버전 */
  readonly version: string;
  /** 로드된 모듈 인스턴스 */
  readonly module: unknown;
  /** 모듈을 제공한 등록자 */
  readonly from?: string;
}

/** 공유 모듈 레지스트리 인터페이스 */
export interface SharedModuleRegistry {
  /** 공유 모듈을 등록한다. eager: true면 즉시 로드를 시작한다. */
  register(config: SharedModuleConfig): void;
  /** 이름으로 공유 모듈을 해결하여 로드한다. 동시 호출 시 중복 로드를 방지한다. */
  resolve(name: string): Promise<unknown>;
  /** subpath로 공유 모듈을 해결한다 (예: resolve('react-dom', './client')). */
  resolveSubpath(name: string, subpath: string): Promise<unknown>;
  /** 등록된 모든 모듈 설정을 반환한다. */
  getRegistered(): ReadonlyMap<string, readonly SharedModuleConfig[]>;
  /** 이미 로드된 모든 모듈을 반환한다. */
  getLoaded(): ReadonlyMap<string, LoadedModule>;
  /** eager 모듈이 모두 로드될 때까지 기다린다. */
  waitForEager(): Promise<void>;
}

/** 버전 협상 실패 시 발생하는 에러 */
export class SharedVersionConflictError extends Error {
  /** 충돌이 발생한 모듈 이름 */
  readonly moduleName: string;

  /**
   * 버전 충돌 에러를 생성한다.
   * @param moduleName - 충돌이 발생한 모듈 이름
   * @param message - 에러 메시지
   */
  constructor(moduleName: string, message: string) {
    super(message);
    this.name = 'SharedVersionConflictError';
    this.moduleName = moduleName;
  }
}

/**
 * 공유 모듈 레지스트리를 생성한다.
 * 여러 MFE 앱이 등록한 공유 의존성의 버전을 협상하고,
 * 최적의 버전을 선택하여 단일 인스턴스를 공유한다.
 * @returns SharedModuleRegistry 인스턴스
 */
export function createSharedModuleRegistry(): SharedModuleRegistry {
  const registered = new Map<string, SharedModuleConfig[]>();
  const loaded = new Map<string, LoadedModule>();
  /** 동시 resolve 중복 호출 방지용 inflight 캐시 */
  const inflight = new Map<string, Promise<unknown>>();
  /** eager 로딩 Promise 추적 */
  const eagerPromises: Array<Promise<void>> = [];
  /** subpath별 로드된 모듈 캐시 */
  const loadedSubpaths = new Map<string, unknown>();

  /**
   * subpath 캐시 키를 생성한다.
   * @param name - 모듈 이름
   * @param subpath - subpath (예: "./client")
   */
  function subpathKey(name: string, subpath: string): string {
    return `${name}::${subpath}`;
  }

  /**
   * 공유 모듈을 레지스트리에 등록한다. eager가 true면 즉시 로드를 시작한다.
   * @param config - 등록할 모듈 설정
   */
  function register(config: SharedModuleConfig): void {
    const existing = registered.get(config.name) ?? [];
    registered.set(config.name, [...existing, config]);

    // eager: true면 등록 즉시 로드 시작
    if (config.eager) {
      const promise = resolve(config.name).then(() => undefined).catch(() => undefined);
      eagerPromises.push(promise);
    }
  }

  /**
   * 등록된 후보 중 최적의 버전을 선택하여 모듈을 로드한다.
   * 동시에 같은 모듈을 resolve하면 inflight 캐시로 중복 로드를 방지한다.
   * @param name - 해결할 모듈 이름
   * @returns 로드된 모듈 인스턴스
   */
  async function resolve(name: string): Promise<unknown> {
    // 1. 이미 로드된 모듈 반환
    const cachedModule = loaded.get(name);
    if (cachedModule) {
      return cachedModule.module;
    }

    // 2. 이미 로드 중인 모듈이 있으면 같은 Promise 반환 (dedup)
    const existing = inflight.get(name);
    if (existing) {
      return existing;
    }

    // 3. 새로 로드 시작
    const promise = doResolve(name);
    inflight.set(name, promise);

    try {
      return await promise;
    } finally {
      inflight.delete(name);
    }
  }

  /**
   * 실제 모듈 해결 로직. 버전 협상 → 팩토리 호출 → 캐시 저장.
   * @param name - 해결할 모듈 이름
   */
  async function doResolve(name: string): Promise<unknown> {
    const candidates = registered.get(name);
    if (!candidates || candidates.length === 0) {
      throw new SharedVersionConflictError(name, `공유 모듈 "${name}"이 등록되지 않았습니다`);
    }

    const selected = selectBestCandidate(name, candidates);
    const module = await selected.factory();

    loaded.set(name, { version: selected.version, module, from: selected.from });

    return module;
  }

  /**
   * subpath로 공유 모듈의 하위 경로를 해결한다.
   * 부모 모듈의 subpaths 매핑에서 팩토리를 찾아 로드한다.
   * @param name - 모듈 이름 (예: "react-dom")
   * @param subpath - 하위 경로 (예: "./client")
   */
  async function resolveSubpath(name: string, subpath: string): Promise<unknown> {
    const key = subpathKey(name, subpath);

    // 캐시 확인
    const cached = loadedSubpaths.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // 부모 모듈의 후보에서 subpath 팩토리 탐색
    const candidates = registered.get(name);
    if (!candidates || candidates.length === 0) {
      throw new SharedVersionConflictError(
        name,
        `공유 모듈 "${name}"이 등록되지 않았습니다`,
      );
    }

    // 선택된 최적 후보의 subpaths에서 해당 subpath 팩토리를 찾는다
    const selected = selectBestCandidate(name, candidates);
    const subpathFactory = selected.subpaths?.[subpath];

    if (!subpathFactory) {
      throw new SharedVersionConflictError(
        name,
        `공유 모듈 "${name}"에 subpath "${subpath}"가 등록되지 않았습니다. ` +
        `등록된 subpaths: [${Object.keys(selected.subpaths ?? {}).join(', ')}]`,
      );
    }

    const module = await subpathFactory();
    loadedSubpaths.set(key, module);
    return module;
  }

  /**
   * 등록된 모든 모듈 설정을 읽기 전용 Map으로 반환한다.
   * @returns 등록된 모듈 Map
   */
  function getRegistered(): ReadonlyMap<string, readonly SharedModuleConfig[]> {
    return registered;
  }

  /**
   * 이미 로드된 모든 모듈을 읽기 전용 Map으로 반환한다.
   * @returns 로드된 모듈 Map
   */
  function getLoaded(): ReadonlyMap<string, LoadedModule> {
    return loaded;
  }

  /**
   * eager로 표시된 모든 모듈이 로드 완료될 때까지 대기한다.
   * 개별 eager 로드 실패는 무시된다 (register 시점에 catch됨).
   */
  async function waitForEager(): Promise<void> {
    await Promise.all(eagerPromises);
  }

  return { register, resolve, resolveSubpath, getRegistered, getLoaded, waitForEager };
}

/**
 * 후보 목록에서 모든 requiredVersion 제약을 만족하는 최적의 버전을 선택한다.
 * 만족하는 버전이 없으면 fallback → strictVersion → 경고 순서로 처리한다.
 * @param name - 모듈 이름
 * @param candidates - 등록된 후보 설정 목록
 * @returns 선택된 후보 설정
 */
function selectBestCandidate(
  name: string,
  candidates: readonly SharedModuleConfig[],
): SharedModuleConfig {
  const requiredVersions = collectRequiredVersions(candidates);
  const isStrict = candidates.some((c) => c.strictVersion);

  // 버전 내림차순 정렬
  const sorted = [...candidates].sort((a, b) => compareVersions(b.version, a.version));

  // 모든 requiredVersion 제약을 만족하는 후보 찾기
  const compatible = sorted.filter((candidate) =>
    requiredVersions.every((range) => satisfiesRange(candidate.version, range)),
  );

  if (compatible.length > 0) {
    return compatible[0];
  }

  // 호환 버전 없음 — fallback factory가 있는 후보 확인
  const withFallback = candidates.find((c) => c.fallback !== undefined);
  if (withFallback?.fallback) {
    console.warn(
      `[esmap] 공유 모듈 "${name}" 버전 충돌 — fallback factory를 사용합니다.`,
    );
    return {
      ...withFallback,
      factory: withFallback.fallback,
    };
  }

  // fallback 없음 — strict or warn
  const highestCandidate = sorted[0];
  const message =
    `공유 모듈 "${name}" 버전 충돌: ` +
    `사용 가능한 버전 [${sorted.map((c) => c.version).join(', ')}], ` +
    `요구 범위 [${requiredVersions.join(', ')}]. ` +
    `최고 버전 ${highestCandidate.version}을 사용합니다.`;

  if (isStrict) {
    throw new SharedVersionConflictError(name, message);
  }

  console.warn(`[esmap] ${message}`);
  return highestCandidate;
}

/**
 * 후보 목록에서 모든 고유한 requiredVersion 범위를 수집한다.
 * @param candidates - 후보 설정 목록
 * @returns 고유한 requiredVersion 범위 배열
 */
function collectRequiredVersions(candidates: readonly SharedModuleConfig[]): readonly string[] {
  const versions = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.requiredVersion) {
      versions.add(candidate.requiredVersion);
    }
  }
  return [...versions];
}
