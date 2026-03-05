import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/canvas/nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all nodes', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'User' } },
    ]);

    const res = await app.request('/api/canvas/nodes');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe('class-1');
    expect(mockCallStore).toHaveBeenCalledWith('getNodes', []);
  });

  it('filters by type', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'User' } },
      { id: 'text-1', type: 'textNode', position: { x: 100, y: 0 }, data: { text: 'Note' } },
    ]);

    const res = await app.request('/api/canvas/nodes?type=classNode');
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].type).toBe('classNode');
  });
});

describe('GET /api/canvas/nodes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a node by ID', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', type: 'classNode' });

    const res = await app.request('/api/canvas/nodes/class-1');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe('class-1');
  });

  it('returns 404 for missing node', async () => {
    mockCallStore.mockResolvedValueOnce(null);

    const res = await app.request('/api/canvas/nodes/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/canvas/nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a class node', async () => {
    mockCallStore.mockResolvedValueOnce({
      id: 'class-1',
      type: 'classNode',
      position: { x: 100, y: 200 },
    });

    const res = await app.request('/api/canvas/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'classNode', x: 100, y: 200 }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe('class-1');
    expect(mockCallStore).toHaveBeenCalledWith('addClassNode', [100, 200]);
  });

  it('creates a text node', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'text-1', type: 'textNode' });

    const res = await app.request('/api/canvas/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'textNode', x: 50, y: 50, text: 'Hello' }),
    });

    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('addTextNode', [50, 50, { text: 'Hello' }]);
  });

  it('rejects unknown node type', async () => {
    const res = await app.request('/api/canvas/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'badType', x: 0, y: 0 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/canvas/nodes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates node data', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', data: { name: 'Updated' } });

    const res = await app.request('/api/canvas/nodes/class-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });

    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateNodeData', [
      'class-1',
      { name: 'Updated' },
    ]);
  });
});

describe('PATCH /api/canvas/nodes/:id/position', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates node position', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', position: { x: 300, y: 400 } });

    const res = await app.request('/api/canvas/nodes/class-1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 300, y: 400 }),
    });

    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateNodePosition', ['class-1', 300, 400]);
  });
});

describe('DELETE /api/canvas/nodes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a node', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });

    const res = await app.request('/api/canvas/nodes/class-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('removeNode', ['class-1']);
  });
});

describe('POST /api/canvas/nodes/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes batch operations', async () => {
    mockCallStore
      .mockResolvedValueOnce({ id: 'class-2', type: 'classNode' }) // create
      .mockResolvedValueOnce({ id: 'class-1', data: { name: 'X' } }) // update
      .mockResolvedValueOnce({ success: true }); // delete

    const res = await app.request('/api/canvas/nodes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operations: [
          { op: 'create', type: 'classNode', x: 0, y: 0 },
          { op: 'update', id: 'class-1', data: { name: 'X' } },
          { op: 'delete', id: 'text-1' },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.results).toHaveLength(3);
  });
});
