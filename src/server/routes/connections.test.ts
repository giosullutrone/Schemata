import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/canvas/nodes/:id/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns connections for a node', async () => {
    mockCallStore.mockResolvedValueOnce({
      edges: [{ id: 'e1', source: 'class-1', target: 'class-2' }],
      nodes: [{ id: 'class-2', type: 'classNode' }],
    });

    const res = await app.request('/api/canvas/nodes/class-1/connections');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.edges).toHaveLength(1);
    expect(json.data.nodes).toHaveLength(1);
    expect(mockCallStore).toHaveBeenCalledWith('getConnections', ['class-1']);
  });

  it('returns 404 when node not found', async () => {
    mockCallStore.mockResolvedValueOnce(null);

    const res = await app.request('/api/canvas/nodes/nonexistent/connections');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/canvas/nodes/:id/hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hierarchy with default direction', async () => {
    mockCallStore.mockResolvedValueOnce({
      ancestors: [{ id: 'class-0' }],
      descendants: [{ id: 'class-2' }],
    });

    const res = await app.request('/api/canvas/nodes/class-1/hierarchy');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.ancestors).toHaveLength(1);
    expect(json.data.descendants).toHaveLength(1);
    expect(mockCallStore).toHaveBeenCalledWith('getHierarchy', ['class-1', 'both']);
  });

  it('passes direction query param', async () => {
    mockCallStore.mockResolvedValueOnce({
      ancestors: [{ id: 'class-0' }],
    });

    const res = await app.request('/api/canvas/nodes/class-1/hierarchy?direction=ancestors');
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('getHierarchy', ['class-1', 'ancestors']);
  });

  it('returns 400 for invalid direction', async () => {
    const res = await app.request('/api/canvas/nodes/class-1/hierarchy?direction=sideways');
    expect(res.status).toBe(400);
  });

  it('returns 404 when node not found', async () => {
    mockCallStore.mockResolvedValueOnce(null);

    const res = await app.request('/api/canvas/nodes/nonexistent/hierarchy');
    expect(res.status).toBe(404);
  });
});
