import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({ callStore: vi.fn() }));
vi.mock('../fsScanner', () => ({ scanFolderFs: vi.fn() }));
import { callStore } from '../bridge';
import { scanFolderFs } from '../fsScanner';
const mockCallStore = vi.mocked(callStore);
const mockScanFolder = vi.mocked(scanFolderFs);

describe('Folder routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/folder', () => {
    it('returns folder info', async () => {
      const folderInfo = { path: '/test/folder', name: 'folder' };
      mockCallStore.mockResolvedValueOnce(folderInfo);

      const res = await app.request('/api/folder');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: folderInfo });
      expect(mockCallStore).toHaveBeenCalledWith('getFolderInfo', []);
    });
  });

  describe('POST /api/folder/open', () => {
    it('opens a folder', async () => {
      const scanResult = { files: [], imagePaths: [], pdfPaths: [], warnings: [] };
      mockScanFolder.mockResolvedValueOnce(scanResult);
      mockCallStore.mockResolvedValueOnce(undefined);

      const res = await app.request('/api/folder/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/absolute/test/folder' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockScanFolder).toHaveBeenCalledWith('/absolute/test/folder');
    });

    it('rejects missing path', async () => {
      const res = await app.request('/api/folder/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'Missing path' });
    });

    it('rejects relative path', async () => {
      const res = await app.request('/api/folder/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'relative/folder' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'Path must be absolute' });
    });
  });
});
