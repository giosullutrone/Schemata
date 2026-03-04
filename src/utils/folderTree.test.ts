import { describe, it, expect } from 'vitest';
import { buildFolderTree } from './folderTree';
import type { CodeCanvasFile } from '../types/schema';

function makeFile(name: string): CodeCanvasFile {
  return { version: '1.0', name, nodes: [], edges: [] };
}

describe('buildFolderTree', () => {
  it('should return empty array for no files', () => {
    expect(buildFolderTree({})).toEqual([]);
  });

  it('should return flat file nodes for root-level files', () => {
    const tree = buildFolderTree({
      'models.codecanvas.json': makeFile('Models'),
      'api.codecanvas.json': makeFile('API'),
    });
    expect(tree).toHaveLength(2);
    expect(tree[0].kind).toBe('file');
    expect(tree[0].name).toBe('API');
    expect(tree[1].kind).toBe('file');
    expect(tree[1].name).toBe('Models');
  });

  it('should create folder nodes for nested files', () => {
    const tree = buildFolderTree({
      'src/api.codecanvas.json': makeFile('API'),
    });
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('folder');
    if (tree[0].kind === 'folder') {
      expect(tree[0].name).toBe('src');
      expect(tree[0].path).toBe('src');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].kind).toBe('file');
      expect(tree[0].children[0].name).toBe('API');
    }
  });

  it('should create intermediate folders', () => {
    const tree = buildFolderTree({
      'src/auth/users.codecanvas.json': makeFile('Users'),
    });
    expect(tree).toHaveLength(1);
    const src = tree[0];
    expect(src.kind).toBe('folder');
    if (src.kind === 'folder') {
      expect(src.name).toBe('src');
      expect(src.children).toHaveLength(1);
      const auth = src.children[0];
      expect(auth.kind).toBe('folder');
      if (auth.kind === 'folder') {
        expect(auth.name).toBe('auth');
        expect(auth.path).toBe('src/auth');
        expect(auth.children).toHaveLength(1);
        expect(auth.children[0].kind).toBe('file');
      }
    }
  });

  it('should sort folders before files, both alphabetically', () => {
    const tree = buildFolderTree({
      'zebra.codecanvas.json': makeFile('Zebra'),
      'src/api.codecanvas.json': makeFile('API'),
      'alpha.codecanvas.json': makeFile('Alpha'),
    });
    expect(tree).toHaveLength(3);
    expect(tree[0].kind).toBe('folder');
    expect(tree[0].name).toBe('src');
    expect(tree[1].kind).toBe('file');
    expect(tree[1].name).toBe('Alpha');
    expect(tree[2].kind).toBe('file');
    expect(tree[2].name).toBe('Zebra');
  });

  it('should include fileName in file nodes', () => {
    const tree = buildFolderTree({
      'src/models.codecanvas.json': makeFile('Models'),
    });
    const folder = tree[0];
    if (folder.kind === 'folder') {
      const file = folder.children[0];
      if (file.kind === 'file') {
        expect(file.fileName).toBe('models.codecanvas.json');
        expect(file.relativePath).toBe('src/models.codecanvas.json');
      }
    }
  });
});
