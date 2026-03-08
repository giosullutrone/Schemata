import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({ callStore: vi.fn() }));
import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('Media routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/media/images', () => {
    it('returns image paths', async () => {
      const imagePaths = ['/path/to/image1.png', '/path/to/image2.jpg'];
      mockCallStore.mockResolvedValueOnce(imagePaths);

      const res = await app.request('/api/media/images');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: imagePaths });
      expect(mockCallStore).toHaveBeenCalledWith('getImagePaths', []);
    });
  });

  describe('GET /api/media/pdfs', () => {
    it('returns PDF paths', async () => {
      const pdfPaths = ['/path/to/doc1.pdf', '/path/to/doc2.pdf'];
      mockCallStore.mockResolvedValueOnce(pdfPaths);

      const res = await app.request('/api/media/pdfs');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ data: pdfPaths });
      expect(mockCallStore).toHaveBeenCalledWith('getPdfPaths', []);
    });
  });
});
