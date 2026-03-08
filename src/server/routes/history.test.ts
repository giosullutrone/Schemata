import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({ callStore: vi.fn() }));
import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('History routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/canvas/undo', () => {
    it('calls undo and returns success', async () => {
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/canvas/undo', { method: 'POST' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: { success: true } });
      expect(mockCallStore).toHaveBeenCalledWith('undo', []);
    });
  });

  describe('POST /api/canvas/redo', () => {
    it('calls redo and returns success', async () => {
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/canvas/redo', { method: 'POST' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: { success: true } });
      expect(mockCallStore).toHaveBeenCalledWith('redo', []);
    });
  });
});
