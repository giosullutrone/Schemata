import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({ callStore: vi.fn() }));
import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('Canvas routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/canvas', () => {
    it('returns canvas data', async () => {
      const canvasData = { id: 'canvas-1', name: 'Test Canvas' };
      mockCallStore.mockResolvedValueOnce(canvasData);

      const res = await app.request('/api/canvas');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: canvasData });
      expect(mockCallStore).toHaveBeenCalledWith('getCanvas', []);
    });

    it('returns 404 when no active canvas', async () => {
      mockCallStore.mockResolvedValueOnce(null);

      const res = await app.request('/api/canvas');
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toEqual({ error: 'No active canvas' });
      expect(mockCallStore).toHaveBeenCalledWith('getCanvas', []);
    });
  });

  describe('GET /api/canvas/viewport', () => {
    it('returns viewport', async () => {
      const viewport = { x: 0, y: 0, zoom: 1 };
      mockCallStore.mockResolvedValueOnce(viewport);

      const res = await app.request('/api/canvas/viewport');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: viewport });
      expect(mockCallStore).toHaveBeenCalledWith('getViewport', []);
    });
  });

  describe('PUT /api/canvas/viewport', () => {
    it('saves and returns viewport', async () => {
      const viewport = { x: 100, y: 200, zoom: 1.5 };
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/canvas/viewport', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(viewport),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: viewport });
      expect(mockCallStore).toHaveBeenCalledWith('saveViewport', [viewport]);
    });

    it('rejects non-numeric values', async () => {
      const res = await app.request('/api/canvas/viewport', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: 'abc', y: 200, zoom: 1 }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'x, y, and zoom must be numbers' });
    });
  });

  describe('POST /api/canvas/clear', () => {
    it('clears the canvas', async () => {
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/canvas/clear', { method: 'POST' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: { success: true } });
      expect(mockCallStore).toHaveBeenCalledWith('clearCanvas', []);
    });
  });

  describe('POST /api/canvas/viewport/fit', () => {
    it('fits viewport to content', async () => {
      const viewport = { x: 50, y: 50, zoom: 0.8, width: 800, height: 600 };
      mockCallStore.mockResolvedValueOnce(viewport);

      const res = await app.request('/api/canvas/viewport/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ padding: 40 }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: viewport });
      expect(mockCallStore).toHaveBeenCalledWith('fitViewport', [40]);
    });

    it('returns 404 when no nodes on canvas', async () => {
      mockCallStore.mockResolvedValueOnce(null);

      const res = await app.request('/api/canvas/viewport/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toEqual({ error: 'No nodes on canvas' });
    });

    it('uses default padding when not specified', async () => {
      mockCallStore.mockResolvedValueOnce({ x: 0, y: 0, zoom: 1 });

      await app.request('/api/canvas/viewport/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(mockCallStore).toHaveBeenCalledWith('fitViewport', [undefined]);
    });
  });
});
