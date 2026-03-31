/** SSE event type */
export interface SseEvent {
  readonly type: string;
  readonly data: string;
}

/** Broadcaster that manages SSE connections */
export interface EventStream {
  /** Handles a new SSE client connection and returns a ReadableStream */
  connect(): ReadableStream<Uint8Array>;
  /** Broadcasts an event to all connected clients */
  broadcast(event: SseEvent): void;
  /** Number of connected clients */
  readonly clientCount: number;
  /** Terminates all connections */
  close(): void;
}

/** Reuses a TextEncoder instance to convert strings to Uint8Array */
const encoder = new TextEncoder();

/**
 * Formats an SSE event string.
 * @param event - SSE event to format
 */
function formatSseEvent(event: SseEvent): string {
  return `event: ${event.type}\ndata: ${event.data}\n\n`;
}

/**
 * Creates an SSE event broadcaster.
 * Multiple clients can connect simultaneously and receive events pushed from the server.
 */
export function createEventStream(): EventStream {
  const controllers = new Set<ReadableStreamDefaultController<Uint8Array>>();

  return {
    connect(): ReadableStream<Uint8Array> {
      /** Controller reference captured in start so it can be removed on cancel */
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
