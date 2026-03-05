import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({ callStore: vi.fn() }));
import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/files', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns file list', async () => {
    mockCallStore.mockResolvedValueOnce([{ path: 'diagram.codecanvas.json', name: 'Diagram' }]);
    const res = await app.request('/api/files');
    const json = await res.json();
    expect(json.data).toHaveLength(1);
  });
});

describe('GET /api/files/active', () => {
  it('returns active file', async () => {
    mockCallStore.mockResolvedValueOnce({ path: 'diagram.codecanvas.json', name: 'Diagram' });
    const res = await app.request('/api/files/active');
    expect(res.status).toBe(200);
  });

  it('returns 404 when no file active', async () => {
    mockCallStore.mockResolvedValueOnce(null);
    const res = await app.request('/api/files/active');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/files/active', () => {
  it('switches active file', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });
    const res = await app.request('/api/files/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'other.codecanvas.json' }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('setActiveFile', ['other.codecanvas.json']);
  });
});

describe('POST /api/files', () => {
  it('creates a new file', async () => {
    mockCallStore.mockResolvedValueOnce(undefined);
    const res = await app.request('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', name: 'NewDiagram' }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('createFile', ['', 'NewDiagram']);
  });
});

describe('POST /api/files/save', () => {
  it('saves active file', async () => {
    mockCallStore.mockResolvedValueOnce(undefined);
    const res = await app.request('/api/files/save', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('saveActiveFile', []);
  });
});
