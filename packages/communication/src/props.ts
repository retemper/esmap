/** 앱 프로퍼티 변경 리스너 */
type PropsListener<T> = (newProps: T, prevProps: T) => void;

/** 앱 프로퍼티 관리 인터페이스 */
interface AppProps<T extends Record<string, unknown>> {
  /** 현재 프로퍼티의 동결된 복사본을 반환한다 */
  getProps: () => Readonly<T>;
  /** 부분 프로퍼티를 병합하고, 구독자에게 알린다 */
  setProps: (partial: Partial<T>) => void;
  /** 프로퍼티 변경을 구독하고, 구독 해제 함수를 반환한다 */
  onPropsChange: (listener: PropsListener<T>) => () => void;
}

/**
 * 호스트에서 리모트 앱으로 전달하는 프로퍼티를 관리한다.
 * @param initial - 초기 프로퍼티 객체
 * @returns 앱 프로퍼티 인스턴스
 */
function createAppProps<T extends Record<string, unknown>>(initial: T): AppProps<T> {
  const props: { current: T } = { current: { ...initial } };
  const listeners: Array<PropsListener<T>> = [];

  /**
   * 현재 프로퍼티의 동결된 복사본을 만든다.
   */
  function frozenCopy(): Readonly<T> {
    return Object.freeze({ ...props.current });
  }

  return {
    getProps(): Readonly<T> {
      return frozenCopy();
    },

    setProps(partial: Partial<T>): void {
      const prev = frozenCopy();
      props.current = { ...props.current, ...partial };
      const next = frozenCopy();
      for (const listener of [...listeners]) {
        listener(next, prev);
      }
    },

    onPropsChange(listener: PropsListener<T>): () => void {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) {
          listeners.splice(idx, 1);
        }
      };
    },
  };
}

export { createAppProps };
export type { AppProps, PropsListener };
