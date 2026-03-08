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
    const json = await res.json() as any;
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
    const json = await res.json() as any;
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
    const json = await res.json() as any;
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
    const json = await res.json() as any;
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

describe('POST /api/canvas/nodes — validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects non-numeric x/y', async () => {
    const res = await app.request('/api/canvas/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'classNode', x: 'foo', y: 'bar' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty batch', async () => {
    const res = await app.request('/api/canvas/nodes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: [] }),
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
    const json = await res.json() as any;
    expect(json.data.results).toHaveLength(3);
  });
});

describe('POST /api/canvas/nodes/duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates duplicated nodes', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'class-2', type: 'classNode', position: { x: 20, y: 20 }, data: { name: 'User' } },
    ]);

    const res = await app.request('/api/canvas/nodes/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['class-1'] }),
    });

    expect(res.status).toBe(201);
    const json = await res.json() as any;
    expect(json.data).toHaveLength(1);
    expect(mockCallStore).toHaveBeenCalledWith('duplicateNodes', [['class-1'], 30, 30]);
  });

  it('rejects missing ids array', async () => {
    const res = await app.request('/api/canvas/nodes/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/canvas/nodes/orphans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns orphan nodes', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'class-3', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'Orphan' } },
    ]);

    const res = await app.request('/api/canvas/nodes/orphans');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data).toHaveLength(1);
    expect(mockCallStore).toHaveBeenCalledWith('getOrphans', []);
  });
});

describe('GET /api/canvas/nodes/groups/:id/children', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns group children', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'child-1', type: 'classNode', position: { x: 10, y: 10 }, data: { name: 'Child' } },
    ]);

    const res = await app.request('/api/canvas/nodes/groups/group-1/children');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data).toHaveLength(1);
  });

  it('returns 404 for non-existent group', async () => {
    mockCallStore.mockResolvedValueOnce(null);

    const res = await app.request('/api/canvas/nodes/groups/nonexistent/children');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/canvas/nodes/groups/:id/fit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resizes group to fit nodes', async () => {
    mockCallStore.mockResolvedValueOnce({
      id: 'group-1', type: 'groupNode',
      position: { x: 80, y: 56 },
      style: { width: 220, height: 244 },
    });

    const res = await app.request('/api/canvas/nodes/groups/group-1/fit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeIds: ['class-1', 'class-2'] }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('fitGroupToNodes', ['group-1', ['class-1', 'class-2'], 20]);
  });

  it('accepts custom padding', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'group-1' });

    const res = await app.request('/api/canvas/nodes/groups/group-1/fit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeIds: ['class-1'], padding: 40 }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('fitGroupToNodes', ['group-1', ['class-1'], 40]);
  });

  it('returns 404 when group not found', async () => {
    mockCallStore.mockResolvedValueOnce(null);

    const res = await app.request('/api/canvas/nodes/groups/nonexistent/fit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeIds: ['class-1'] }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects empty nodeIds', async () => {
    const res = await app.request('/api/canvas/nodes/groups/group-1/fit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeIds: [] }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/canvas/nodes/:id/distance/:otherId', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns distance between two nodes', async () => {
    mockCallStore.mockResolvedValueOnce({
      from: { id: 'class-1', x: 100, y: 100 },
      to: { id: 'class-2', x: 400, y: 500 },
      dx: 300, dy: 400, distance: 500,
    });

    const res = await app.request('/api/canvas/nodes/class-1/distance/class-2');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.dx).toBe(300);
    expect(json.data.dy).toBe(400);
    expect(json.data.distance).toBe(500);
    expect(mockCallStore).toHaveBeenCalledWith('getNodeDistance', ['class-1', 'class-2']);
  });

  it('returns 404 when node not found', async () => {
    mockCallStore.mockResolvedValueOnce(null);

    const res = await app.request('/api/canvas/nodes/class-1/distance/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/canvas/nodes/batch — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects batch with over 100 operations', async () => {
    const operations = Array.from({ length: 101 }, (_, i) => ({
      op: 'create',
      type: 'classNode',
      x: i,
      y: i,
    }));

    const res = await app.request('/api/canvas/nodes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations }),
    });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/canvas/nodes/positions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates multiple node positions', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true, updated: 2 });

    const res = await app.request('/api/canvas/nodes/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        positions: [
          { id: 'class-1', x: 100, y: 200 },
          { id: 'class-2', x: 300, y: 400 },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.success).toBe(true);
    expect(mockCallStore).toHaveBeenCalledWith('updateNodePositions', [
      [{ id: 'class-1', x: 100, y: 200 }, { id: 'class-2', x: 300, y: 400 }],
    ]);
  });

  it('rejects empty positions array', async () => {
    const res = await app.request('/api/canvas/nodes/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects more than 200 positions', async () => {
    const positions = Array.from({ length: 201 }, (_, i) => ({
      id: `class-${i}`, x: i, y: i,
    }));
    const res = await app.request('/api/canvas/nodes/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects position with non-numeric x', async () => {
    const res = await app.request('/api/canvas/nodes/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        positions: [{ id: 'class-1', x: 'abc', y: 100 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects position with missing id', async () => {
    const res = await app.request('/api/canvas/nodes/positions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        positions: [{ x: 100, y: 200 }],
      }),
    });
    expect(res.status).toBe(400);
  });
});
