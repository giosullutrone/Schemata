import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/canvas/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stats data', async () => {
    mockCallStore.mockResolvedValueOnce({
      nodeCount: 12,
      edgeCount: 8,
      classCount: 5,
    });

    const res = await app.request('/api/canvas/stats');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.nodeCount).toBe(12);
    expect(json.data.edgeCount).toBe(8);
    expect(json.data.classCount).toBe(5);
  });

  it('calls callStore with getStats', async () => {
    mockCallStore.mockResolvedValueOnce({});

    await app.request('/api/canvas/stats');
    expect(mockCallStore).toHaveBeenCalledWith('getStats', []);
  });
});
