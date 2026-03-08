import { describe, it, expect } from 'vitest';
import { buildFolderTree } from './folderTree';
import type { SchemataFile } from '../types/schema';

function makeFile(name: string): SchemataFile {
  return { version: '1.0', name, nodes: [], edges: [] };
}

describe('buildFolderTree', () => {
  it('should return empty array for no files', () => {
    expect(buildFolderTree({})).toEqual([]);
  });

  it('should return flat file nodes for root-level files', () => {
    const tree = buildFolderTree({
      'models.schemata.json': makeFile('Models'),
      'api.schemata.json': makeFile('API'),
    });
    expect(tree).toHaveLength(2);
    expect(tree[0].kind).toBe('file');
    expect(tree[0].name).toBe('API');
    expect(tree[1].kind).toBe('file');
    expect(tree[1].name).toBe('Models');
  });

  it('should create folder nodes for nested files', () => {
    const tree = buildFolderTree({
      'src/api.schemata.json': makeFile('API'),
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
      'src/auth/users.schemata.json': makeFile('Users'),
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
      'zebra.schemata.json': makeFile('Zebra'),
      'src/api.schemata.json': makeFile('API'),
      'alpha.schemata.json': makeFile('Alpha'),
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
      'src/models.schemata.json': makeFile('Models'),
    });
    const folder = tree[0];
    if (folder.kind === 'folder') {
      const file = folder.children[0];
      if (file.kind === 'file') {
        expect(file.fileName).toBe('models.schemata.json');
        expect(file.relativePath).toBe('src/models.schemata.json');
      }
    }
  });
});
