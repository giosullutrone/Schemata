import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/canvas/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to json format', async () => {
    mockCallStore.mockResolvedValueOnce({ nodes: [], edges: [] });

    const res = await app.request('/api/canvas/export');
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('exportCanvas', ['json']);
  });

  it('passes json format to callStore', async () => {
    mockCallStore.mockResolvedValueOnce({ nodes: [], edges: [] });

    const res = await app.request('/api/canvas/export?format=json');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.nodes).toHaveLength(0);
    expect(mockCallStore).toHaveBeenCalledWith('exportCanvas', ['json']);
  });

  it('passes png format', async () => {
    mockCallStore.mockResolvedValueOnce({ url: 'data:image/png;base64,...' });

    const res = await app.request('/api/canvas/export?format=png');
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('exportCanvas', ['png']);
  });

  it('returns 400 for invalid format', async () => {
    const res = await app.request('/api/canvas/export?format=invalid');
    expect(res.status).toBe(400);
  });

  it('returns 404 when no active canvas', async () => {
    mockCallStore.mockResolvedValueOnce(null);

    const res = await app.request('/api/canvas/export');
    expect(res.status).toBe(404);
  });
});
