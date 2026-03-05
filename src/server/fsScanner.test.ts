import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

import { scanFolderFs } from './fsScanner';

describe('scanFolderFs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('finds .codecanvas.json files', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'diagram.codecanvas.json', isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      version: '1.0', name: 'Diagram', nodes: [], edges: [],
    }));

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('diagram.codecanvas.json');
  });

  it('finds images', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'photo.png', isFile: () => true, isDirectory: () => false },
    ]);

    const result = await scanFolderFs('/test/folder');
    expect(result.imagePaths).toContain('photo.png');
  });

  it('skips excluded directories', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'node_modules', isFile: () => false, isDirectory: () => true },
      { name: 'src', isFile: () => false, isDirectory: () => true },
    ]);
    // src subdir
    mockReaddir.mockResolvedValueOnce([]);

    await scanFolderFs('/test/folder');
    // node_modules should be skipped, only src scanned
    expect(mockReaddir).toHaveBeenCalledTimes(2);
  });
});
