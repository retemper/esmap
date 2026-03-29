/** SSE 이벤트 타입 */
export interface SseEvent {
  readonly type: string;
  readonly data: string;
}

/** SSE 연결을 관리하는 브로드캐스터 */
export interface EventStream {
  /** 새 SSE 클라이언트 연결을 처리하고 ReadableStream을 반환한다 */
  connect(): ReadableStream<Uint8Array>;
  /** 모든 연결된 클라이언트에 이벤트를 브로드캐스트한다 */
  broadcast(event: SseEvent): void;
  /** 연결된 클라이언트 수 */
  readonly clientCount: number;
  /** 모든 연결을 종료한다 */
  close(): void;
}

/** TextEncoder 인스턴스를 재사용하여 문자열을 Uint8Array로 변환한다 */
const encoder = new TextEncoder();

/**
 * SSE 이벤트 문자열을 포맷한다.
 * @param event - 포맷할 SSE 이벤트
 */
function formatSseEvent(event: SseEvent): string {
  return `event: ${event.type}\ndata: ${event.data}\n\n`;
}

/**
 * SSE 이벤트 브로드캐스터를 생성한다.
 * 여러 클라이언트가 동시에 연결하여 서버에서 푸시하는 이벤트를 수신할 수 있다.
 */
export function createEventStream(): EventStream {
  const controllers = new Set<ReadableStreamDefaultController<Uint8Array>>();

  return {
    connect(): ReadableStream<Uint8Array> {
      /** cancel 시 제거할 수 있도록 start에서 캡처한 controller 참조 */
      const ref: { current: ReadableStreamDefaultController<Uint8Array> | null } = {
        current: null,
      };

      return new ReadableStream<Uint8Array>({
        start(controller) {
          ref.current = controller;
          controllers.add(controller);
        },
        cancel() {
          if (ref.current) {
            controllers.delete(ref.current);
          }
        },
      });
    },

    broadcast(event: SseEvent): void {
      const encoded = encoder.encode(formatSseEvent(event));
      for (const controller of controllers) {
        controller.enqueue(encoded);
      }
    },

    get clientCount(): number {
      return controllers.size;
    },

    close(): void {
      for (const controller of controllers) {
        controller.close();
      }
      controllers.clear();
    },
  };
}
