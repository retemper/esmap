import { describe, it, expect } from 'vitest';
import { createEventStream } from './event-stream.js';

/** ReadableStream에서 하나의 청크를 읽어 문자열로 반환한다 */
async function readChunk(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const { value } = await reader.read();
  reader.releaseLock();
  return new TextDecoder().decode(value);
}

describe('EventStream', () => {
  it('connect()가 ReadableStream을 반환한다', () => {
    const eventStream = createEventStream();
    const stream = eventStream.connect();

    expect(stream).toBeInstanceOf(ReadableStream);
    eventStream.close();
  });

  it('broadcast()가 연결된 클라이언트에 이벤트를 전달한다', async () => {
    const eventStream = createEventStream();
    const stream = eventStream.connect();

    eventStream.broadcast({ type: 'test', data: '{"msg":"hello"}' });

    const chunk = await readChunk(stream);

    expect(chunk).toBe('event: test\ndata: {"msg":"hello"}\n\n');
    eventStream.close();
  });

  it('클라이언트 연결 해제 시 clientCount가 감소한다', async () => {
    const eventStream = createEventStream();
    const stream = eventStream.connect();

    expect(eventStream.clientCount).toBe(1);

    await stream.cancel();

    expect(eventStream.clientCount).toBe(0);
    eventStream.close();
  });

  it('close()가 모든 연결을 종료한다', () => {
    const eventStream = createEventStream();
    eventStream.connect();
    eventStream.connect();

    expect(eventStream.clientCount).toBe(2);

    eventStream.close();

    expect(eventStream.clientCount).toBe(0);
  });

  it('연결이 없으면 broadcast가 에러 없이 완료된다', () => {
    const eventStream = createEventStream();

    expect(() => {
      eventStream.broadcast({ type: 'test', data: '{}' });
    }).not.toThrow();

    eventStream.close();
  });
});
