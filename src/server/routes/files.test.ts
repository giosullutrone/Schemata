import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({ callStore: vi.fn() }));
import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/files', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns file list', async () => {
    mockCallStore.mockResolvedValueOnce([{ path: 'diagram.schemata.json', name: 'Diagram' }]);
    const res = await app.request('/api/files');
    const json = await res.json() as any;
    expect(json.data).toHaveLength(1);
  });
});

describe('GET /api/files/active', () => {
  it('returns active file', async () => {
    mockCallStore.mockResolvedValueOnce({ path: 'diagram.schemata.json', name: 'Diagram' });
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
      body: JSON.stringify({ path: 'other.schemata.json' }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('setActiveFile', ['other.schemata.json']);
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

describe('PUT /api/files/active — validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects path traversal', async () => {
    const res = await app.request('/api/files/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '../etc/passwd' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing path', async () => {
    const res = await app.request('/api/files/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/files — validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects missing name', async () => {
    const res = await app.request('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '' }),
    });
    expect(res.status).toBe(400);
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

describe('DELETE /api/files/:path', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes a file', async () => {
    mockCallStore.mockResolvedValueOnce(undefined);
    const res = await app.request('/api/files/diagram.schemata.json', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('removeFile', ['diagram.schemata.json']);
  });

  it('rejects path traversal attempts', async () => {
    const res = await app.request('/api/files/..%2Fetc%2Fpasswd', { method: 'DELETE' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/files/:path/rename', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renames a file', async () => {
    mockCallStore.mockResolvedValueOnce(undefined); // setActiveFile
    mockCallStore.mockResolvedValueOnce(undefined); // renameFile
    const res = await app.request('/api/files/diagram.schemata.json/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RenamedDiagram' }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('setActiveFile', ['diagram.schemata.json']);
    expect(mockCallStore).toHaveBeenCalledWith('renameFile', ['RenamedDiagram']);
  });

  it('rejects path traversal', async () => {
    const res = await app.request('/api/files/..%2Fetc%2Fpasswd/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Evil' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing name', async () => {
    const res = await app.request('/api/files/diagram.schemata.json/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/files/refresh', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('refreshes folder', async () => {
    mockCallStore.mockResolvedValueOnce([{ path: 'diagram.schemata.json' }]);
    const res = await app.request('/api/files/refresh', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('refreshFolder', []);
  });
});

describe('POST /api/files/save-all', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('saves all files', async () => {
    mockCallStore.mockResolvedValueOnce(undefined);
    const res = await app.request('/api/files/save-all', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('saveAllFiles', []);
  });
});
