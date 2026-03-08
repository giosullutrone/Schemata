import { describe, it, expect } from 'vitest';
import { serializeFile, deserializeFile, validateFile } from './fileIO';
import { migrateFile } from '../store/useCanvasStore';
import type { SchemataFile, CanvasNodeSchema } from '../types/schema';

const validFile: SchemataFile = {
  version: '1.0',
  name: 'Test',
  nodes: [
    {
      id: 'class-1',
      type: 'classNode',
      position: { x: 0, y: 0 },
      data: { name: 'Foo', properties: [], methods: [] },
    },
  ],
  edges: [],
};

describe('fileIO', () => {
  it('should serialize a file to JSON string', () => {
    const json = serializeFile(validFile);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1.0');
    expect(parsed.nodes).toHaveLength(1);
  });

  it('should serialize with 2-space indentation', () => {
    const json = serializeFile(validFile);
    expect(json).toContain('  "version"');
  });

  it('should deserialize a valid JSON string', () => {
    const json = JSON.stringify(validFile);
    const result = deserializeFile(json);
    expect(result.name).toBe('Test');
    expect(result.nodes[0].data.name).toBe('Foo');
  });

  it('should throw on invalid JSON', () => {
    expect(() => deserializeFile('not json')).toThrow();
  });

  it('should validate a correct file', () => {
    const errors = validateFile(validFile);
    expect(errors).toEqual([]);
  });

  it('should reject a file without version', () => {
    const bad = { ...validFile, version: undefined } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a file without nodes', () => {
    const bad = { version: '1.0', name: 'X' } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should migrate old multi-canvas format', () => {
    const oldFormat = JSON.stringify({
      version: '1.0',
      name: 'Legacy',
      canvases: {
        main: {
          name: 'Main',
          nodes: [{ id: 'n1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } }],
          edges: [],
          viewport: { x: 10, y: 20, zoom: 1.5 },
        },
      },
    });
    const result = deserializeFile(oldFormat);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.name).toBe('A');
    expect(result.edges).toEqual([]);
    expect(result.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  it('should handle old format with empty canvases', () => {
    const oldFormat = JSON.stringify({
      version: '1.0',
      name: 'Empty',
      canvases: {},
    });
    const result = deserializeFile(oldFormat);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('should pass through new flat format unchanged', () => {
    const newFormat = JSON.stringify({
      version: '1.0',
      name: 'New',
      nodes: [{ id: 'n1', type: 'classNode', position: { x: 5, y: 10 }, data: { name: 'B', properties: [], methods: [] } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'uml', data: { relationshipType: 'dependency' } }],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    const result = deserializeFile(newFormat);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(1);
    expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('should reject nodes with invalid type', () => {
    const bad = {
      ...validFile,
      nodes: [{ id: 'x', type: 'unknown', position: { x: 0, y: 0 }, data: {} }],
    } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.some((e) => e.includes('invalid type'))).toBe(true);
  });

  it('should reject nodes without id', () => {
    const bad = {
      ...validFile,
      nodes: [{ type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } }],
    } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.some((e) => e.includes('missing "id"'))).toBe(true);
  });

  it('should reject nodes with missing position', () => {
    const bad = {
      ...validFile,
      nodes: [{ id: 'x', type: 'classNode', data: { name: 'A', properties: [], methods: [] } }],
    } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.some((e) => e.includes('position'))).toBe(true);
  });

  it('should reject edges with invalid type', () => {
    const bad = {
      ...validFile,
      edges: [{ id: 'e1', source: 'a', target: 'b', type: 'wrong', data: { relationshipType: 'dependency' } }],
    } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.some((e) => e.includes('invalid type'))).toBe(true);
  });

  it('should reject edges missing source or target', () => {
    const bad = {
      ...validFile,
      edges: [{ id: 'e1', type: 'uml', data: { relationshipType: 'dependency' } }],
    } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.some((e) => e.includes('missing "source"'))).toBe(true);
    expect(errors.some((e) => e.includes('missing "target"'))).toBe(true);
  });

  it('should reject non-object items in nodes array', () => {
    const bad = {
      ...validFile,
      nodes: [42, 'hello'],
    } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.some((e) => e.includes('not an object'))).toBe(true);
  });

  it('should validate a file with all node types', () => {
    const file: SchemataFile = {
      version: '1.0',
      name: 'Multi',
      nodes: [
        { id: 'c1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } },
        { id: 't1', type: 'textNode', position: { x: 10, y: 10 }, data: { text: 'hi' } },
        { id: 'g1', type: 'groupNode', position: { x: 20, y: 20 }, data: { label: 'Group' }, style: { width: 100, height: 100 } },
      ],
      edges: [
        { id: 'e1', source: 'c1', target: 't1', type: 'uml', data: { relationshipType: 'association' } },
      ],
    };
    const errors = validateFile(file);
    expect(errors).toEqual([]);
  });
});

describe('migrateFile — annotationNode to textNode', () => {
  it('should migrate annotationNode to textNode', () => {
    const file: SchemataFile = {
      version: '1.0',
      name: 'Legacy',
      nodes: [
        { id: 'c1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } },
        {
          id: 'a1',
          type: 'annotationNode',
          position: { x: 10, y: 10 },
          data: { comment: 'hello world', parentId: 'c1', parentType: 'node', color: '#F39C12' },
        } as unknown as CanvasNodeSchema,
      ],
      edges: [],
    };
    const migrated = migrateFile(file);
    expect(migrated).not.toBe(file);
    const textNode = migrated.nodes.find((n) => n.id === 'a1');
    expect(textNode).toBeDefined();
    expect(textNode!.type).toBe('textNode');
    expect(textNode!.data.text).toBe('hello world');
    expect(textNode!.data.color).toBe('#F39C12');
    expect(textNode!.data.borderStyle).toBe('dashed');
    expect(textNode!.data.opacity).toBe(0.85);
    // parentId and parentType should be removed
    expect((textNode!.data as Record<string, unknown>).parentId).toBeUndefined();
    expect((textNode!.data as Record<string, unknown>).parentType).toBeUndefined();
    expect((textNode!.data as Record<string, unknown>).comment).toBeUndefined();
  });
});
