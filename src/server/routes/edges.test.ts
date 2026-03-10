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
  it('creates an edge with auto-computed closest handles', async () => {
    // source at top-left, target below → should get bottom/top handles
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', position: { x: 100, y: 0 } });
    mockCallStore.mockResolvedValueOnce({ id: 'class-2', position: { x: 100, y: 300 } });
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', source: 'class-1', target: 'class-2' });

    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-1', target: 'class-2', relationshipType: 'inheritance' }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('addEdge', ['class-1', 'class-2', 'inheritance', 'bottom', 'top']);
  });

  it('uses explicit handles when provided', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', position: { x: 100, y: 0 } });
    mockCallStore.mockResolvedValueOnce({ id: 'class-2', position: { x: 100, y: 300 } });
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', source: 'class-1', target: 'class-2' });

    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-1', target: 'class-2', relationshipType: 'inheritance', sourceHandle: 'left', targetHandle: 'right' }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('addEdge', ['class-1', 'class-2', 'inheritance', 'left', 'right']);
  });

  it('rejects edge with non-existent source node', async () => {
    mockCallStore.mockResolvedValueOnce(null); // source not found
    mockCallStore.mockResolvedValueOnce({ id: 'class-2', position: { x: 0, y: 0 } }); // target found

    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-999', target: 'class-2', relationshipType: 'inheritance' }),
    });
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toContain('class-999');
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

describe('POST /api/canvas/edges — validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects missing source/target/relationshipType', async () => {
    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-1' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid relationshipType', async () => {
    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-1', target: 'class-2', relationshipType: 'badType' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/canvas/edges — relationshipType filter', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('filters by relationshipType query param', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'edge-1', source: 'class-1', target: 'class-2', data: { relationshipType: 'inheritance' } },
      { id: 'edge-2', source: 'class-3', target: 'class-4', data: { relationshipType: 'composition' } },
    ]);
    const res = await app.request('/api/canvas/edges?relationshipType=inheritance');
    const json = await res.json() as any;
    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe('edge-1');
  });
});

describe('DELETE /api/canvas/edges/batch', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes edges by ids array', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });
    const res = await app.request('/api/canvas/edges/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['edge-1', 'edge-2'] }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('removeEdges', [['edge-1', 'edge-2']]);
  });

  it('rejects missing ids', async () => {
    const res = await app.request('/api/canvas/edges/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('rejects more than 100 ids', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `edge-${i}`);
    const res = await app.request('/api/canvas/edges/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/canvas/edges/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns edge by id', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', source: 'class-1', target: 'class-2' });
    const res = await app.request('/api/canvas/edges/edge-1');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.id).toBe('edge-1');
  });

  it('returns 404 for non-existent edge', async () => {
    mockCallStore.mockResolvedValueOnce(null);
    const res = await app.request('/api/canvas/edges/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/canvas/edges — style fields', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('applies label and color on create', async () => {
    // getNode source, getNode target, addEdge, updateEdgeData
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', position: { x: 0, y: 0 } });
    mockCallStore.mockResolvedValueOnce({ id: 'class-2', position: { x: 0, y: 300 } });
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', source: 'class-1', target: 'class-2' });
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', data: { label: 'uses', color: '#E74C3C' } });

    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'class-1', target: 'class-2', relationshipType: 'association',
        label: 'uses', color: '#E74C3C',
      }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('updateEdgeData', ['edge-1', { label: 'uses', color: '#E74C3C' }]);
  });

  it('applies strokeStyle on create', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', position: { x: 0, y: 0 } });
    mockCallStore.mockResolvedValueOnce({ id: 'class-2', position: { x: 0, y: 300 } });
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1' });
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', data: { strokeStyle: 'dashed' } });

    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'class-1', target: 'class-2', relationshipType: 'dependency',
        strokeStyle: 'dashed',
      }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('updateEdgeData', ['edge-1', { strokeStyle: 'dashed' }]);
  });

  it('skips updateEdgeData when no style fields provided', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', position: { x: 0, y: 0 } });
    mockCallStore.mockResolvedValueOnce({ id: 'class-2', position: { x: 0, y: 300 } });
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1' });

    await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-1', target: 'class-2', relationshipType: 'inheritance' }),
    });
    // Should only have 3 calls (getNode x2, addEdge), no updateEdgeData
    expect(mockCallStore).toHaveBeenCalledTimes(3);
  });
});

describe('POST /api/canvas/edges/batch', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates edges in batch with auto-computed handles', async () => {
    // getNodes for node validation, then addEdgesBatch
    mockCallStore.mockResolvedValueOnce([
      { id: 'class-1', position: { x: 0, y: 0 } },
      { id: 'class-2', position: { x: 0, y: 300 } },
    ]);
    mockCallStore.mockResolvedValueOnce([
      { id: 'edge-1', source: 'class-1', target: 'class-2' },
    ]);

    const res = await app.request('/api/canvas/edges/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edges: [{ source: 'class-1', target: 'class-2', relationshipType: 'inheritance' }],
      }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('addEdgesBatch', [
      [{ source: 'class-1', target: 'class-2', relationshipType: 'inheritance', sourceHandle: 'bottom', targetHandle: 'top' }],
    ]);
  });

  it('rejects empty edges array', async () => {
    const res = await app.request('/api/canvas/edges/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edges: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects batch with over 100 edges', async () => {
    const edges = Array.from({ length: 101 }, (_, i) => ({
      source: `class-${i}`, target: `class-${i+1}`, relationshipType: 'association',
    }));
    const res = await app.request('/api/canvas/edges/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edges }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects batch entry missing required fields', async () => {
    const res = await app.request('/api/canvas/edges/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edges: [{ source: 'class-1' }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects batch entry with invalid relationshipType', async () => {
    const res = await app.request('/api/canvas/edges/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edges: [{ source: 'class-1', target: 'class-2', relationshipType: 'invalid' }],
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/canvas/edges — rejects non-existent target', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects edge with non-existent target node', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', position: { x: 0, y: 0 } }); // source found
    mockCallStore.mockResolvedValueOnce(null); // target not found

    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-1', target: 'class-999', relationshipType: 'inheritance' }),
    });
    expect(res.status).toBe(400);
    const json = await res.json() as any;
    expect(json.error).toContain('class-999');
  });
});
