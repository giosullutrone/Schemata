import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/canvas/edges', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all edges', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'edge-1', source: 'class-1', target: 'class-2', data: { relationshipType: 'inheritance' } },
    ]);
    const res = await app.request('/api/canvas/edges');
    const json = await res.json() as any;
    expect(json.data).toHaveLength(1);
  });

  it('filters by source', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'edge-1', source: 'class-1', target: 'class-2' },
      { id: 'edge-2', source: 'class-3', target: 'class-2' },
    ]);
    const res = await app.request('/api/canvas/edges?source=class-1');
    const json = await res.json() as any;
    expect(json.data).toHaveLength(1);
    expect(json.data[0].source).toBe('class-1');
  });
});

describe('POST /api/canvas/edges', () => {
  it('creates an edge', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', source: 'class-1', target: 'class-2' });

    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-1', target: 'class-2', relationshipType: 'inheritance' }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('addEdge', ['class-1', 'class-2', 'inheritance', undefined, undefined]);
  });
});

describe('PATCH /api/canvas/edges/:id', () => {
  it('updates edge data', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', data: { label: 'uses' } });

    const res = await app.request('/api/canvas/edges/edge-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'uses' }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateEdgeData', ['edge-1', { label: 'uses' }]);
  });
});

describe('PATCH /api/canvas/edges/:id/type', () => {
  it('changes relationship type', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1' });

    const res = await app.request('/api/canvas/edges/edge-1/type', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'composition' }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateEdgeType', ['edge-1', 'composition']);
  });
});

describe('DELETE /api/canvas/edges/:id', () => {
  it('deletes an edge', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });
    const res = await app.request('/api/canvas/edges/edge-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});
