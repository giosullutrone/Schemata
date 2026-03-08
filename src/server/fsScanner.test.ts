import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

const { mockValidateFile } = vi.hoisted(() => ({
  mockValidateFile: vi.fn(),
}));

vi.mock('../utils/fileIO.js', () => ({
  validateFile: mockValidateFile,
}));

import { scanFolderFs } from './fsScanner';

const validFile = { version: '1.0', name: 'Diagram', nodes: [], edges: [] };

describe('scanFolderFs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateFile.mockReturnValue([]);
  });

  it('finds .schemata.json files', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'diagram.schemata.json', isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(validFile));

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('diagram.schemata.json');
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

  it('finds PDF files', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'report.pdf', isFile: () => true, isDirectory: () => false },
    ]);

    const result = await scanFolderFs('/test/folder');
    expect(result.pdfPaths).toContain('report.pdf');
  });

  it('finds images with various extensions', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'a.jpg', isFile: () => true, isDirectory: () => false },
      { name: 'b.jpeg', isFile: () => true, isDirectory: () => false },
      { name: 'c.gif', isFile: () => true, isDirectory: () => false },
      { name: 'd.svg', isFile: () => true, isDirectory: () => false },
      { name: 'e.webp', isFile: () => true, isDirectory: () => false },
    ]);

    const result = await scanFolderFs('/test/folder');
    expect(result.imagePaths).toEqual(
      expect.arrayContaining(['a.jpg', 'b.jpeg', 'c.gif', 'd.svg', 'e.webp']),
    );
    expect(result.imagePaths).toHaveLength(5);
  });

  it('scans nested directories', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'sub', isFile: () => false, isDirectory: () => true },
    ]);
    mockReaddir.mockResolvedValueOnce([
      { name: 'diagram.schemata.json', isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(validFile));

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('sub/diagram.schemata.json');
  });

  it('handles corrupt JSON gracefully', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'bad.schemata.json', isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValueOnce('{ not valid json !!!');

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('bad.schemata.json');
  });

  it('handles readdir error gracefully', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT'));

    const result = await scanFolderFs('/nonexistent/folder');
    expect(result.files).toHaveLength(0);
    expect(result.imagePaths).toHaveLength(0);
    expect(result.pdfPaths).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('validates parsed files and sends invalid ones to warnings', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'invalid.schemata.json', isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(validFile));
    mockValidateFile.mockReturnValueOnce(['Missing "version" field']);

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Missing "version" field');
    expect(result.warnings[0]).toContain('invalid.schemata.json');
  });

  it('accepts valid files', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'good.schemata.json', isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(validFile));
    mockValidateFile.mockReturnValueOnce([]);

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('good.schemata.json');
    expect(result.files[0].file).toEqual(validFile);
    expect(result.warnings).toHaveLength(0);
  });

  it('sorts files alphabetically', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'zebra.schemata.json', isFile: () => true, isDirectory: () => false },
      { name: 'alpha.schemata.json', isFile: () => true, isDirectory: () => false },
    ]);
    mockReadFile.mockResolvedValueOnce(JSON.stringify(validFile));
    mockReadFile.mockResolvedValueOnce(JSON.stringify(validFile));

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(2);
    expect(result.files[0].relativePath).toBe('alpha.schemata.json');
    expect(result.files[1].relativePath).toBe('zebra.schemata.json');
  });

  it('ignores non-schemata JSON files', async () => {
    mockReaddir.mockResolvedValueOnce([
      { name: 'package.json', isFile: () => true, isDirectory: () => false },
    ]);

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(0);
    expect(result.imagePaths).toHaveLength(0);
    expect(result.pdfPaths).toHaveLength(0);
  });
});
