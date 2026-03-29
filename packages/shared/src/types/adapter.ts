/**
 * 프레임워크 어댑터가 구현하는 렌더링 프로토콜.
 * React, Vue, Svelte 등 각 프레임워크는 이 인터페이스만 구현하면
 * esmap MFE 라이프사이클과 자동으로 통합된다.
 *
 * @typeParam TContext - 프레임워크별 렌더링 컨텍스트 (React Root, Vue App 등)
 */
export interface AdapterProtocol<TContext> {
  /** 렌더링 컨텍스트를 생성하고 초기 렌더링을 수행한다 (예: createRoot + render) */
  mount(container: HTMLElement): TContext;
  /** props가 변경될 때 재렌더링한다 */
  update(context: TContext, props: Readonly<Record<string, unknown>>): void;
  /** 컨텍스트를 정리하고 DOM을 복원한다 */
  unmount(context: TContext, container: HTMLElement): void;
}

/**
 * defineAdapter 팩토리 옵션.
 * @typeParam TContext - 프레임워크별 렌더링 컨텍스트
 */
export interface DefineAdapterOptions<TContext> {
  /** 프레임워크 이름 (에러 메시지, 디버깅용) */
  readonly name: string;
  /** 프레임워크별 렌더링 프로토콜 */
  readonly protocol: AdapterProtocol<TContext>;
}
