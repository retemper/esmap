import { describe, it, expect } from 'vitest';
import { createEventStream } from './event-stream.js';

/** Reads a single chunk from a ReadableStream and returns it as a string */
async function readChunk(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const { value } = await reader.read();
  reader.releaseLock();
  return new TextDecoder().decode(value);
}

describe('EventStream', () => {
  it('connect() returns a ReadableStream', () => {
    const eventStream = createEventStream();
    const stream = eventStream.connect();

    expect(stream).toBeInstanceOf(ReadableStream);
    eventStream.close();
  });

  it('broadcast() delivers events to connected clients', async () => {
    const eventStream = createEventStream();
    const stream = eventStream.connect();

    eventStream.broadcast({ type: 'test', data: '{"msg":"hello"}' });

    const chunk = await readChunk(stream);

    expect(chunk).toBe('event: test\ndata: {"msg":"hello"}\n\n');
    eventStream.close();
  });

  it('clientCount decreases when a client disconnects', async () => {
    const eventStream = createEventStream();
    const stream = eventStream.connect();

    expect(eventStream.clientCount).toBe(1);

    await stream.cancel();

    expect(eventStream.clientCount).toBe(0);
    eventStream.close();
  });

  it('close() terminates all connections', () => {
    const eventStream = createEventStream();
    eventStream.connect();
    eventStream.connect();

    expect(eventStream.clientCount).toBe(2);

    eventStream.close();

    expect(eventStream.clientCount).toBe(0);
  });

  it('broadcast completes without error when there are no connections', () => {
    const eventStream = createEventStream();

    expect(() => {
      eventStream.broadcast({ type: 'test', data: '{}' });
    }).not.toThrow();

    eventStream.close();
  });
});
