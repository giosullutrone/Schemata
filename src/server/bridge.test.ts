import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initBridge, callStore, resetBridge } from './bridge';

function createMockWs() {
  const listeners = new Map<string, Function>();
  return {
    on: vi.fn((event: string, cb: Function) => { listeners.set(event, cb); }),
    send: vi.fn(),
    _trigger: (event: string, data: unknown) => listeners.get(event)?.(data, {}),
  };
}

describe('bridge', () => {
  let ws: ReturnType<typeof createMockWs>;

  beforeEach(() => {
    ws = createMockWs();
    resetBridge();
    initBridge(ws as never);
  });

  it('sends request over WebSocket and resolves on response', async () => {
    const promise = callStore('getNodes', []);

    expect(ws.send).toHaveBeenCalledWith('canvas:request', expect.objectContaining({
      action: 'getNodes',
      args: [],
    }));

    const sentData = ws.send.mock.calls[0][1];
    ws._trigger('canvas:response', { id: sentData.id, result: [{ id: 'class-1' }] });

    const result = await promise;
    expect(result).toEqual([{ id: 'class-1' }]);
  });

  it('rejects on error response', async () => {
    const promise = callStore('badAction', []);
    const sentData = ws.send.mock.calls[0][1];
    ws._trigger('canvas:response', { id: sentData.id, error: 'Unknown action' });

    await expect(promise).rejects.toThrow('Unknown action');
  });

  it('rejects on timeout', async () => {
    vi.useFakeTimers();
    const promise = callStore('getNodes', []);
    vi.advanceTimersByTime(10_000);
    await expect(promise).rejects.toThrow('Bridge timeout');
    vi.useRealTimers();
  });
});
