import { describe, it, expect } from 'vitest';
import type {
  SchemataFile,
  GroupNodeSchema,
  TextNodeSchema,
} from './schema';

describe('Schema types', () => {
  it('should allow constructing a valid SchemataFile', () => {
    const file: SchemataFile = {
      version: '1.0',
      name: 'Test Project',
      nodes: [
        {
          id: 'class-1',
          type: 'classNode',
          position: { x: 0, y: 0 },
          data: {
            name: 'UserService',
            stereotype: 'interface',
            color: '#4A90D9',
            properties: [
              { id: 'p1', name: 'db', type: 'Database', visibility: 'private' },
            ],
            methods: [
              {
                id: 'm1',
                name: 'getUser',
                parameters: [{ name: 'id', type: 'string' }],
                returnType: 'User',
                visibility: 'public',
              },
            ],
          },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'class-1',
          target: 'class-2',
          type: 'uml',
          data: { relationshipType: 'dependency', label: 'uses', color: '#E74C3C' },
        },
      ],
    };

    expect(file.version).toBe('1.0');
    expect(file.nodes).toHaveLength(1);
    expect(file.edges).toHaveLength(1);
    const node = file.nodes[0];
    if (node.type === 'classNode') {
      expect(node.data.properties[0].visibility).toBe('private');
      expect(node.data.methods[0].parameters).toHaveLength(1);
    }
  });

  it('should allow constructing a GroupNodeSchema', () => {
    const node: GroupNodeSchema = {
      id: 'group-1',
      type: 'groupNode',
      position: { x: 0, y: 0 },
      data: { label: 'Core', color: '#4A90D9' },
      style: { width: 400, height: 300 },
    };
    expect(node.type).toBe('groupNode');
    expect(node.data.label).toBe('Core');
    expect(node.style?.width).toBe(400);
  });

  it('should allow text node with color', () => {
    const node: TextNodeSchema = {
      id: 'text-1',
      type: 'textNode',
      position: { x: 0, y: 0 },
      data: { text: 'Note', color: '#F39C12' },
    };
    expect(node.data.color).toBe('#F39C12');
  });

  it('should allow minimal node data without optional fields', () => {
    const file: SchemataFile = {
      version: '1.0',
      name: 'Minimal',
      nodes: [
        {
          id: 'class-1',
          type: 'classNode',
          position: { x: 0, y: 0 },
          data: {
            name: 'SimpleClass',
            properties: [],
            methods: [],
          },
        },
      ],
      edges: [],
    };

    expect(file.nodes[0].data.stereotype).toBeUndefined();
    expect(file.nodes[0].data.color).toBeUndefined();
  });
});
