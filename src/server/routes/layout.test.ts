import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({ callStore: vi.fn() }));
import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('Layout routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/canvas/layout/align', () => {
    it('aligns nodes', async () => {
      const rects = [
        { id: 'n1', x: 0, y: 0, width: 100, height: 50 },
        { id: 'n2', x: 200, y: 100, width: 100, height: 50 },
      ];
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/canvas/layout/align', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rects, alignment: 'left' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: { success: true } });
      expect(mockCallStore).toHaveBeenCalledWith('alignNodes', [rects, 'left']);
    });

    it('rejects fewer than 2 rects', async () => {
      const res = await app.request('/api/canvas/layout/align', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rects: [{ id: 'n1' }], alignment: 'left' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'rects array with at least 2 items required' });
    });

    it('rejects invalid alignment value', async () => {
      const rects = [
        { id: 'n1', x: 0, y: 0, width: 100, height: 50 },
        { id: 'n2', x: 200, y: 100, width: 100, height: 50 },
      ];

      const res = await app.request('/api/canvas/layout/align', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rects, alignment: 'diagonal' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('alignment must be one of');
    });
  });

  describe('POST /api/canvas/layout/distribute', () => {
    it('distributes nodes', async () => {
      const rects = [
        { id: 'n1', x: 0, y: 0, width: 100, height: 50 },
        { id: 'n2', x: 200, y: 0, width: 100, height: 50 },
        { id: 'n3', x: 400, y: 0, width: 100, height: 50 },
      ];
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/canvas/layout/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rects, axis: 'horizontal' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: { success: true } });
      expect(mockCallStore).toHaveBeenCalledWith('distributeNodes', [rects, 'horizontal']);
    });

    it('rejects fewer than 3 rects', async () => {
      const rects = [
        { id: 'n1', x: 0, y: 0, width: 100, height: 50 },
        { id: 'n2', x: 200, y: 0, width: 100, height: 50 },
      ];

      const res = await app.request('/api/canvas/layout/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rects, axis: 'horizontal' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'rects array with at least 3 items required' });
    });

    it('rejects invalid axis', async () => {
      const rects = [
        { id: 'n1', x: 0, y: 0, width: 100, height: 50 },
        { id: 'n2', x: 200, y: 0, width: 100, height: 50 },
        { id: 'n3', x: 400, y: 0, width: 100, height: 50 },
      ];

      const res = await app.request('/api/canvas/layout/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rects, axis: 'diagonal' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'axis must be horizontal or vertical' });
    });
  });

  describe('POST /api/canvas/layout/group', () => {
    it('groups nodes', async () => {
      const rects = [{ id: 'n1', x: 0, y: 0, width: 100, height: 50 }];
      const groupData = { id: 'group-1', children: ['n1'] };
      mockCallStore.mockResolvedValueOnce(groupData);

      const res = await app.request('/api/canvas/layout/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rects }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json).toEqual({ data: groupData });
      expect(mockCallStore).toHaveBeenCalledWith('groupSelectedNodes', [rects]);
    });

    it('rejects empty rects array', async () => {
      const res = await app.request('/api/canvas/layout/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rects: [] }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'rects array required' });
    });
  });

  describe('POST /api/canvas/layout/auto', () => {
    it('applies auto layout and recalculates edge handles', async () => {
      // autoLayout, then recalculateEdgeHandles
      mockCallStore.mockResolvedValueOnce(undefined);
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/canvas/layout/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: { success: true } });
      expect(mockCallStore).toHaveBeenCalledWith('autoLayout', ['grid', undefined]);
      expect(mockCallStore).toHaveBeenCalledWith('recalculateEdgeHandles', []);
    });

    it('applies hierarchical strategy and recalculates handles', async () => {
      mockCallStore.mockResolvedValueOnce(undefined);
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/canvas/layout/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'hierarchical', gap: 50 }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: { success: true } });
      expect(mockCallStore).toHaveBeenCalledWith('autoLayout', ['hierarchical', 50]);
      expect(mockCallStore).toHaveBeenCalledWith('recalculateEdgeHandles', []);
    });

    it('rejects invalid strategy', async () => {
      const res = await app.request('/api/canvas/layout/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'circular' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('strategy must be one of');
    });
  });
});
