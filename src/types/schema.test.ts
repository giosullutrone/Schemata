import { describe, it, expect } from 'vitest';
import type {
  CodeCanvasFile,
} from './schema';

describe('Schema types', () => {
  it('should allow constructing a valid CodeCanvasFile', () => {
    const file: CodeCanvasFile = {
      version: '1.0',
      name: 'Test Project',
      canvases: {
        main: {
          name: 'Main',
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
        },
      },
    };

    expect(file.version).toBe('1.0');
    expect(file.canvases.main.nodes).toHaveLength(1);
    expect(file.canvases.main.edges).toHaveLength(1);
    const node = file.canvases.main.nodes[0];
    if (node.type === 'classNode') {
      expect(node.data.properties[0].visibility).toBe('private');
      expect(node.data.methods[0].parameters).toHaveLength(1);
    }
  });

  it('should allow minimal node data without optional fields', () => {
    const file: CodeCanvasFile = {
      version: '1.0',
      name: 'Minimal',
      canvases: {
        main: {
          name: 'Main',
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
        },
      },
    };

    expect(file.canvases.main.nodes[0].data.stereotype).toBeUndefined();
    expect(file.canvases.main.nodes[0].data.color).toBeUndefined();
  });
});
