import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearImageCache, resolveImageUrl } from './imageCache';

// Mock File/Blob/URL APIs
const mockBlob = new Blob(['fake-image'], { type: 'image/png' });
const mockFile = new File([mockBlob], 'photo.png', { type: 'image/png' });

function createMockDirectoryHandle(structure: Record<string, unknown>): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name: 'root',
    getDirectoryHandle: vi.fn(async (name: string) => {
      const child = structure[name];
      if (child && typeof child === 'object' && !('getFile' in (child as object))) {
        return createMockDirectoryHandle(child as Record<string, unknown>);
      }
      throw new DOMException('Not found', 'NotFoundError');
    }),
    getFileHandle: vi.fn(async (name: string) => {
      const child = structure[name];
      if (child === 'file') {
        return { kind: 'file', name, getFile: async () => mockFile } as unknown as FileSystemFileHandle;
      }
      throw new DOMException('Not found', 'NotFoundError');
    }),
  } as unknown as FileSystemDirectoryHandle;
}

// Mock URL.createObjectURL / revokeObjectURL
let blobUrlCounter = 0;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  clearImageCache();
  blobUrlCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${++blobUrlCounter}`);
  URL.revokeObjectURL = vi.fn();
});

// Restore originals after all tests
import { afterAll } from 'vitest';
afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe('resolveImageUrl', () => {
  it('should resolve a simple image path', async () => {
    const handle = createMockDirectoryHandle({ 'photo.png': 'file' });
    const url = await resolveImageUrl(handle, '', 'photo.png');
    expect(url).toBe('blob:mock-1');
  });

  it('should resolve path relative to canvas directory', async () => {
    const handle = createMockDirectoryHandle({
      diagrams: { 'photo.png': 'file' },
    });
    const url = await resolveImageUrl(handle, 'diagrams/my.codecanvas.json', 'photo.png');
    expect(url).toBe('blob:mock-1');
  });

  it('should resolve nested subdirectory paths', async () => {
    const handle = createMockDirectoryHandle({
      diagrams: { images: { 'photo.png': 'file' } },
    });
    const url = await resolveImageUrl(handle, 'diagrams/my.codecanvas.json', 'images/photo.png');
    expect(url).toBe('blob:mock-1');
  });

  it('should return null for non-existent files', async () => {
    const handle = createMockDirectoryHandle({});
    const url = await resolveImageUrl(handle, '', 'missing.png');
    expect(url).toBeNull();
  });

  it('should cache results and not re-fetch', async () => {
    const handle = createMockDirectoryHandle({ 'photo.png': 'file' });
    const url1 = await resolveImageUrl(handle, '', 'photo.png');
    const url2 = await resolveImageUrl(handle, '', 'photo.png');
    expect(url1).toBe(url2);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('should dedup concurrent requests for the same path', async () => {
    const handle = createMockDirectoryHandle({ 'photo.png': 'file' });
    const [url1, url2] = await Promise.all([
      resolveImageUrl(handle, '', 'photo.png'),
      resolveImageUrl(handle, '', 'photo.png'),
    ]);
    expect(url1).toBe(url2);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('should normalize paths with . and ..', async () => {
    const handle = createMockDirectoryHandle({
      images: { 'photo.png': 'file' },
    });
    const url = await resolveImageUrl(handle, 'sub/file.json', '../images/photo.png');
    expect(url).toBe('blob:mock-1');
  });
});

describe('clearImageCache', () => {
  it('should revoke all blob URLs', async () => {
    const handle = createMockDirectoryHandle({
      'a.png': 'file',
      'b.png': 'file',
    });
    await resolveImageUrl(handle, '', 'a.png');
    await resolveImageUrl(handle, '', 'b.png');
    clearImageCache();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('should allow re-fetching after clear', async () => {
    const handle = createMockDirectoryHandle({ 'photo.png': 'file' });
    const url1 = await resolveImageUrl(handle, '', 'photo.png');
    clearImageCache();
    const url2 = await resolveImageUrl(handle, '', 'photo.png');
    expect(url1).not.toBe(url2);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
});
