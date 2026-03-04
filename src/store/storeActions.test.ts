import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore, migrateFile } from './useCanvasStore';
import type { CodeCanvasFile, ClassEdgeSchema } from '../types/schema';

const TEST_FILE = 'test.codecanvas.json';

function setup(file?: Partial<CodeCanvasFile>) {
  useCanvasStore.getState().reset();
  const f: CodeCanvasFile = {
    version: '1.0',
    name: 'Test',
    nodes: [],
    edges: [],
    ...file,
  };
  useCanvasStore.setState({
    files: { [TEST_FILE]: f },
    activeFilePath: TEST_FILE,
    lastSavedFiles: { [TEST_FILE]: f },
    _dirtyFiles: {},
  });
}

function getFile() {
  return useCanvasStore.getState().files[TEST_FILE];
}

// ---- Edge operations ----

describe('addEdge', () => {
  beforeEach(() => {
    setup({
      nodes: [
        { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } },
        { id: 'class-2', type: 'classNode', position: { x: 200, y: 0 }, data: { name: 'B', properties: [], methods: [] } },
      ],
    });
  });

  it('should create an edge with correct type and handles', () => {
    useCanvasStore.getState().addEdge('class-1', 'class-2', 'inheritance', 'bottom', 'top');
    const edges = getFile().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('class-1');
    expect(edges[0].target).toBe('class-2');
    expect(edges[0].data.relationshipType).toBe('inheritance');
    expect(edges[0].sourceHandle).toBe('bottom');
    expect(edges[0].targetHandle).toBe('top');
    expect(edges[0].type).toBe('uml');
  });

  it('should generate unique edge IDs', () => {
    useCanvasStore.getState().addEdge('class-1', 'class-2', 'association');
    useCanvasStore.getState().addEdge('class-2', 'class-1', 'dependency');
    const edges = getFile().edges;
    expect(edges).toHaveLength(2);
    expect(edges[0].id).not.toBe(edges[1].id);
  });

  it('should push undo entry', () => {
    useCanvasStore.getState().addEdge('class-1', 'class-2', 'association');
    expect(useCanvasStore.getState()._undoStack).toHaveLength(1);
  });
});

describe('removeEdge', () => {
  beforeEach(() => {
    setup({
      nodes: [
        { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } },
        { id: 'text-1', type: 'textNode', position: { x: 200, y: 0 }, data: { text: 'note' } },
      ],
      edges: [
        { id: 'edge-1', source: 'text-1', target: 'class-1', type: 'uml', data: { relationshipType: 'association' } } as ClassEdgeSchema,
      ],
    });
  });

  it('should remove the edge', () => {
    useCanvasStore.getState().removeEdge('edge-1');
    expect(getFile().edges).toHaveLength(0);
  });

  it('should NOT cascade delete text nodes when edge is removed', () => {
    useCanvasStore.getState().removeEdge('edge-1');
    expect(getFile().nodes).toHaveLength(2); // both class-1 and text-1 remain
    expect(getFile().nodes.find((n) => n.id === 'text-1')).toBeDefined();
  });
});

describe('removeEdges', () => {
  beforeEach(() => {
    setup({
      nodes: [
        { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } },
        { id: 'class-2', type: 'classNode', position: { x: 200, y: 0 }, data: { name: 'B', properties: [], methods: [] } },
        { id: 'text-1', type: 'textNode', position: { x: 300, y: 0 }, data: { text: 'note' } },
      ],
      edges: [
        { id: 'edge-1', source: 'text-1', target: 'class-1', type: 'uml', data: { relationshipType: 'association' } } as ClassEdgeSchema,
        { id: 'edge-2', source: 'class-1', target: 'class-2', type: 'uml', data: { relationshipType: 'dependency' } } as ClassEdgeSchema,
      ],
    });
  });

  it('should remove multiple edges at once', () => {
    useCanvasStore.getState().removeEdges(['edge-1', 'edge-2']);
    expect(getFile().edges).toHaveLength(0);
  });

  it('should NOT cascade text nodes for batch edge removal', () => {
    useCanvasStore.getState().removeEdges(['edge-1']);
    const nodes = getFile().nodes;
    expect(nodes.find((n) => n.id === 'text-1')).toBeDefined();
    expect(nodes.find((n) => n.id === 'class-1')).toBeDefined();
  });

  it('should not push undo for empty array', () => {
    useCanvasStore.getState().removeEdges([]);
    expect(useCanvasStore.getState()._undoStack).toHaveLength(0);
  });
});

describe('updateEdgeData', () => {
  beforeEach(() => {
    setup({
      edges: [
        { id: 'edge-1', source: 'a', target: 'b', type: 'uml', data: { relationshipType: 'association' } } as ClassEdgeSchema,
      ],
    });
  });

  it('should partially merge edge data', () => {
    useCanvasStore.getState().updateEdgeData('edge-1', { label: 'uses' });
    const edge = getFile().edges[0];
    expect(edge.data.label).toBe('uses');
    expect(edge.data.relationshipType).toBe('association');
  });
});

describe('updateEdgeType', () => {
  beforeEach(() => {
    setup({
      edges: [
        { id: 'edge-1', source: 'a', target: 'b', type: 'uml', data: { relationshipType: 'association' } } as ClassEdgeSchema,
      ],
    });
  });

  it('should change the relationship type', () => {
    useCanvasStore.getState().updateEdgeType('edge-1', 'composition');
    expect(getFile().edges[0].data.relationshipType).toBe('composition');
  });
});

// ---- Node operations ----

describe('addTextNode', () => {
  beforeEach(() => {
    setup({
      nodes: [
        { id: 'class-1', type: 'classNode', position: { x: 100, y: 100 }, data: { name: 'A', properties: [], methods: [] } },
      ],
    });
  });

  it('should create standalone text node WITHOUT edge when no parentId', () => {
    useCanvasStore.getState().addTextNode(320, 100);
    const file = getFile();
    expect(file.nodes).toHaveLength(2);
    const textNode = file.nodes.find((n) => n.type === 'textNode');
    expect(textNode).toBeDefined();
    expect(textNode!.data.text).toBe('');
    expect(file.edges).toHaveLength(0);
  });

  it('should create text node WITH edge when parentId provided', () => {
    useCanvasStore.getState().addTextNode(320, 100, { parentId: 'class-1', parentType: 'node' });
    const file = getFile();
    expect(file.nodes).toHaveLength(2);
    const textNode = file.nodes.find((n) => n.type === 'textNode');
    expect(textNode).toBeDefined();
    expect(file.edges).toHaveLength(1);
    expect(file.edges[0].source).toBe(textNode!.id);
    expect(file.edges[0].target).toBe('class-1');
  });

  it('should use left handle when text node is to the left of parent', () => {
    useCanvasStore.getState().addTextNode(0, 100, { parentId: 'class-1', parentType: 'node' });
    const edge = getFile().edges[0];
    expect(edge.sourceHandle).toBe('right');
    expect(edge.targetHandle).toBe('left');
  });
});

describe('groupSelectedNodes', () => {
  beforeEach(() => {
    setup({
      nodes: [
        { id: 'class-1', type: 'classNode', position: { x: 100, y: 100 }, data: { name: 'A', properties: [], methods: [] } },
        { id: 'class-2', type: 'classNode', position: { x: 400, y: 100 }, data: { name: 'B', properties: [], methods: [] } },
      ],
    });
  });

  it('should create group node with correct bounds', () => {
    useCanvasStore.getState().groupSelectedNodes([
      { id: 'class-1', x: 100, y: 100, w: 200, h: 150 },
      { id: 'class-2', x: 400, y: 100, w: 200, h: 150 },
    ]);
    const file = getFile();
    expect(file.nodes).toHaveLength(3);
    const group = file.nodes.find((n) => n.type === 'groupNode');
    expect(group).toBeDefined();
    expect(group!.position.x).toBe(80); // 100 - 20 padding
    expect((group as { style?: { width: number } }).style?.width).toBe(540); // (600-100) + 40 padding
  });

  it('should not create group for empty selection', () => {
    useCanvasStore.getState().groupSelectedNodes([]);
    expect(getFile().nodes).toHaveLength(2);
    expect(useCanvasStore.getState()._undoStack).toHaveLength(0);
  });
});

describe('removeNode', () => {
  beforeEach(() => {
    setup({
      nodes: [
        { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } },
        { id: 'text-1', type: 'textNode', position: { x: 200, y: 0 }, data: { text: 'note' } },
      ],
      edges: [
        { id: 'edge-1', source: 'text-1', target: 'class-1', type: 'uml', data: { relationshipType: 'association' } } as ClassEdgeSchema,
      ],
    });
  });

  it('should remove only the target node and connected edges, NOT cascade to text nodes', () => {
    useCanvasStore.getState().removeNode('class-1');
    const file = getFile();
    expect(file.nodes).toHaveLength(1); // text-1 survives
    expect(file.nodes[0].id).toBe('text-1');
    expect(file.edges).toHaveLength(0);
  });
});

describe('removeNodes', () => {
  beforeEach(() => {
    setup({
      nodes: [
        { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } },
        { id: 'class-2', type: 'classNode', position: { x: 200, y: 0 }, data: { name: 'B', properties: [], methods: [] } },
        { id: 'text-1', type: 'textNode', position: { x: 100, y: 100 }, data: { text: 'note' } },
      ],
      edges: [
        { id: 'edge-1', source: 'class-1', target: 'class-2', type: 'uml', data: { relationshipType: 'association' } } as ClassEdgeSchema,
        { id: 'edge-2', source: 'text-1', target: 'class-1', type: 'uml', data: { relationshipType: 'association' } } as ClassEdgeSchema,
      ],
    });
  });

  it('should batch remove without cascade — text nodes survive parent deletion', () => {
    useCanvasStore.getState().removeNodes(['class-1']);
    const file = getFile();
    expect(file.nodes).toHaveLength(2); // class-2 and text-1 remain
    expect(file.nodes.find((n) => n.id === 'class-2')).toBeDefined();
    expect(file.nodes.find((n) => n.id === 'text-1')).toBeDefined();
    expect(file.edges).toHaveLength(0); // both edges removed (connected to class-1)
  });

  it('should not push undo for empty array', () => {
    useCanvasStore.getState().removeNodes([]);
    expect(useCanvasStore.getState()._undoStack).toHaveLength(0);
  });
});

describe('renameFile', () => {
  beforeEach(() => setup());

  it('should update the active file name', () => {
    useCanvasStore.getState().renameFile('New Name');
    expect(getFile().name).toBe('New Name');
  });

  it('should push undo', () => {
    useCanvasStore.getState().renameFile('New Name');
    expect(useCanvasStore.getState()._undoStack).toHaveLength(1);
  });
});

// ---- State guards ----

describe('setCanvasNodes', () => {
  beforeEach(() => {
    setup({
      nodes: [{ id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [], methods: [] } }],
    });
  });

  it('should be a no-op when nodes reference is the same', () => {
    const original = getFile();
    const nodes = original.nodes;
    useCanvasStore.getState().setCanvasNodes(nodes);
    // File reference should be unchanged (no update applied)
    expect(getFile()).toBe(original);
  });

  it('should update when nodes reference is different', () => {
    const newNodes = [{ id: 'class-2', type: 'classNode' as const, position: { x: 0, y: 0 }, data: { name: 'B', properties: [], methods: [] } }];
    useCanvasStore.getState().setCanvasNodes(newNodes);
    expect(getFile().nodes).toHaveLength(1);
    expect(getFile().nodes[0].id).toBe('class-2');
  });
});

describe('setCanvasEdges', () => {
  beforeEach(() => {
    setup({
      edges: [{ id: 'edge-1', source: 'a', target: 'b', type: 'uml', data: { relationshipType: 'association' } } as ClassEdgeSchema],
    });
  });

  it('should be a no-op when edges reference is the same', () => {
    const original = getFile();
    useCanvasStore.getState().setCanvasEdges(original.edges);
    expect(getFile()).toBe(original);
  });
});

describe('saveViewport', () => {
  beforeEach(() => {
    setup();
    // Set initial viewport
    useCanvasStore.getState().saveViewport({ x: 10, y: 20, zoom: 1.5 });
  });

  it('should skip update when viewport is unchanged', () => {
    const fileBefore = getFile();
    useCanvasStore.getState().saveViewport({ x: 10, y: 20, zoom: 1.5 });
    expect(getFile()).toBe(fileBefore);
  });

  it('should update when viewport changes', () => {
    useCanvasStore.getState().saveViewport({ x: 50, y: 60, zoom: 2 });
    expect(getFile().viewport).toEqual({ x: 50, y: 60, zoom: 2 });
  });
});

// ---- Store utilities ----

describe('migrateFile', () => {
  it('should add IDs to properties and methods missing them', () => {
    const file: CodeCanvasFile = {
      version: '1.0',
      name: 'Test',
      nodes: [
        {
          id: 'class-1',
          type: 'classNode',
          position: { x: 0, y: 0 },
          data: {
            name: 'A',
            properties: [
              { name: 'field', type: 'string', visibility: 'private' } as never,
            ],
            methods: [
              { name: 'doStuff', parameters: [], returnType: 'void', visibility: 'public' } as never,
            ],
          },
        },
      ],
      edges: [],
    };
    const migrated = migrateFile(file);
    const node = migrated.nodes[0];
    const data = node.data as { properties: { id?: string }[]; methods: { id?: string }[] };
    expect(data.properties[0].id).toBeDefined();
    expect(data.methods[0].id).toBeDefined();
  });

  it('should not modify file when all IDs are present', () => {
    const file: CodeCanvasFile = {
      version: '1.0',
      name: 'Test',
      nodes: [
        {
          id: 'class-1',
          type: 'classNode',
          position: { x: 0, y: 0 },
          data: {
            name: 'A',
            properties: [{ id: 'p1', name: 'field', type: 'string', visibility: 'private' }],
            methods: [{ id: 'm1', name: 'doStuff', parameters: [], returnType: 'void', visibility: 'public' }],
          },
        },
      ],
      edges: [],
    };
    const result = migrateFile(file);
    expect(result).toBe(file); // same reference — no migration needed
  });
});

// ---- Dirty tracking ----

describe('dirty tracking', () => {
  beforeEach(() => setup());

  it('should mark file dirty after mutating action', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    expect(useCanvasStore.getState()._dirtyFiles[TEST_FILE]).toBe(true);
  });

  it('should clear dirty flag after save', async () => {
    useCanvasStore.getState().addClassNode(0, 0);
    expect(useCanvasStore.getState()._dirtyFiles[TEST_FILE]).toBe(true);

    // Mock save by manually clearing dirty (saveActiveFile requires file handle)
    const { _dirtyFiles, files } = useCanvasStore.getState();
    const nextDirty = { ..._dirtyFiles };
    delete nextDirty[TEST_FILE];
    useCanvasStore.setState({
      _dirtyFiles: nextDirty,
      lastSavedFiles: { [TEST_FILE]: JSON.parse(JSON.stringify(files[TEST_FILE])) },
    });
    expect(useCanvasStore.getState()._dirtyFiles[TEST_FILE]).toBeUndefined();
  });

  it('should clear dirty on undo back to saved state', () => {
    // Save the clean state as lastSaved
    useCanvasStore.setState({
      lastSavedFiles: { [TEST_FILE]: JSON.parse(JSON.stringify(getFile())) },
    });
    useCanvasStore.getState().addClassNode(0, 0);
    expect(useCanvasStore.getState()._dirtyFiles[TEST_FILE]).toBe(true);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState()._dirtyFiles[TEST_FILE]).toBeUndefined();
  });
});
