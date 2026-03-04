import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore, migrateFile } from './useCanvasStore';
import type { CodeCanvasFile } from '../types/schema';

const TEST_FILE_PATH = 'test.codecanvas.json';

/** Set up store with a single test file + active path so actions work */
function setupTestFile() {
  useCanvasStore.setState({
    files: {
      [TEST_FILE_PATH]: {
        version: '1.0',
        name: 'Untitled Project',
        nodes: [],
        edges: [],
      },
    },
    activeFilePath: TEST_FILE_PATH,
    lastSavedFiles: {},
  });
}

/** Shorthand to get the test file */
function getFile() {
  return useCanvasStore.getState().files[TEST_FILE_PATH];
}

describe('useCanvasStore', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
    setupTestFile();
  });

  it('should initialize with empty state after reset', () => {
    useCanvasStore.getState().reset();
    const state = useCanvasStore.getState();
    expect(state.activeFilePath).toBeNull();
    expect(Object.keys(state.files)).toHaveLength(0);
  });

  it('should have test file set up correctly', () => {
    const state = useCanvasStore.getState();
    expect(state.activeFilePath).toBe(TEST_FILE_PATH);
    expect(getFile()).toBeDefined();
    expect(getFile()!.name).toBe('Untitled Project');
    expect(getFile()!.nodes).toEqual([]);
    expect(getFile()!.edges).toEqual([]);
  });

  it('should add a class node', () => {
    useCanvasStore.getState().addClassNode(100, 200);
    const nodes = getFile()!.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('classNode');
    expect(nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(nodes[0].data.name).toBe('NewClass');
    expect(nodes[0].data.properties).toEqual([]);
    expect(nodes[0].data.methods).toEqual([]);
  });

  it('should remove a node', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    const nodeId = getFile()!.nodes[0].id;
    useCanvasStore.getState().removeNode(nodeId);
    expect(getFile()!.nodes).toHaveLength(0);
  });

  it('should remove edges connected to a deleted node', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    expect(getFile()!.edges).toHaveLength(1);

    useCanvasStore.getState().removeNode(nodes[0].id);
    expect(getFile()!.edges).toHaveLength(0);
  });

  it('should add an edge', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'inheritance');

    const edges = getFile()!.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('uml');
    expect(edges[0].data.relationshipType).toBe('inheritance');
    expect(edges[0].source).toBe(nodes[0].id);
    expect(edges[0].target).toBe(nodes[1].id);
  });

  it('should remove an edge', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = getFile()!.edges[0].id;

    useCanvasStore.getState().removeEdge(edgeId);
    expect(getFile()!.edges).toHaveLength(0);
  });

  it('should update node data', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    const nodeId = getFile()!.nodes[0].id;
    useCanvasStore.getState().updateNodeData(nodeId, { name: 'UserService', color: '#4A90D9' });
    const node = getFile()!.nodes[0];
    expect(node.data.name).toBe('UserService');
    expect(node.data.color).toBe('#4A90D9');
  });

  it('should update edge data', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = getFile()!.edges[0].id;

    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses', color: '#E74C3C' });
    const edge = getFile()!.edges[0];
    expect(edge.data.label).toBe('uses');
    expect(edge.data.color).toBe('#E74C3C');
  });

  it('should update node position', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    const nodeId = getFile()!.nodes[0].id;
    useCanvasStore.getState().updateNodePosition(nodeId, 50, 75);
    const node = getFile()!.nodes[0];
    expect(node.position).toEqual({ x: 50, y: 75 });
  });

  it('should update edge relationship type via data', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = getFile()!.edges[0].id;

    useCanvasStore.getState().updateEdgeType(edgeId, 'composition');
    const edge = getFile()!.edges[0];
    expect(edge.type).toBe('uml');
    expect(edge.data.relationshipType).toBe('composition');
  });

  it('should set canvas edges without undo', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');

    useCanvasStore.getState().setCanvasEdges([]);
    expect(getFile()!.edges).toHaveLength(0);
  });

  it('should save viewport for current file', () => {
    useCanvasStore.getState().saveViewport({ x: 100, y: 200, zoom: 1.5 });
    expect(getFile()!.viewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
  });

  it('should add an annotation node with default color and connecting edge', () => {
    const { addClassNode, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = getFile()!.nodes[0].id;
    addAnnotation(nodeId, 'node', 200, 0);

    const nodes = getFile()!.nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes[1].type).toBe('annotationNode');
    expect(nodes[1].data.parentId).toBe(nodeId);
    expect(nodes[1].data.comment).toBe('Comment');
    expect(nodes[1].data.color).toBe('#F39C12');

    const edges = getFile()!.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(nodes[1].id);
    expect(edges[0].target).toBe(nodeId);
    expect(edges[0].data.relationshipType).toBe('association');
  });

  it('should cascade delete annotations when parent node is removed', () => {
    const { addClassNode, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = getFile()!.nodes[0].id;
    addAnnotation(nodeId, 'node', 200, 0);

    expect(getFile()!.nodes).toHaveLength(2);
    useCanvasStore.getState().removeNode(nodeId);
    expect(getFile()!.nodes).toHaveLength(0);
  });

  it('should cascade delete annotations when parent edge is removed', () => {
    const { addClassNode, addEdge, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = getFile()!.edges[0].id;

    addAnnotation(edgeId, 'edge', 200, 50);
    expect(getFile()!.nodes).toHaveLength(3);

    useCanvasStore.getState().removeEdge(edgeId);
    expect(getFile()!.edges).toHaveLength(0);
    expect(getFile()!.nodes).toHaveLength(2);
  });

  it('should add a standalone annotation (empty parentId) without a dangling edge', () => {
    useCanvasStore.getState().addAnnotation('', 'node', 100, 200);
    const nodes = getFile()!.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('annotationNode');
    expect(nodes[0].data.parentId).toBe('');
    expect(getFile()!.edges).toHaveLength(0);
  });

  it('should not push undo when using setCanvasNodes', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    const stackBefore = useCanvasStore.getState()._undoStack.length;
    useCanvasStore.getState().setCanvasNodes([]);
    const stackAfter = useCanvasStore.getState()._undoStack.length;
    expect(stackAfter).toBe(stackBefore);
  });

  it('should push undo snapshot via pushUndoSnapshot', () => {
    const stackBefore = useCanvasStore.getState()._undoStack.length;
    useCanvasStore.getState().pushUndoSnapshot();
    const stackAfter = useCanvasStore.getState()._undoStack.length;
    expect(stackAfter).toBe(stackBefore + 1);
  });

  it('should update annotation node color', () => {
    const { addClassNode, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = getFile()!.nodes[0].id;
    addAnnotation(nodeId, 'node', 200, 0);
    const annotationId = getFile()!.nodes[1].id;

    useCanvasStore.getState().updateNodeData(annotationId, { color: '#E74C3C' });
    const node = getFile()!.nodes[1];
    expect(node.data.color).toBe('#E74C3C');
  });

  it('should create a group node wrapping the given rects', () => {
    useCanvasStore.getState().groupSelectedNodes([
      { id: 'a', x: 100, y: 100, w: 200, h: 150 },
      { id: 'b', x: 400, y: 200, w: 200, h: 150 },
    ]);
    const nodes = getFile()!.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('groupNode');
    expect(nodes[0].data.label).toBe('Group');
    expect(nodes[0].position.x).toBe(80);
    expect(nodes[0].position.y).toBe(56);
    const style = (nodes[0] as { style?: { width: number; height: number } }).style;
    expect(style?.width).toBe(540);
    expect(style?.height).toBe(314);
  });

  it('should prepend group node so it renders behind other nodes', () => {
    const { addClassNode, groupSelectedNodes } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    groupSelectedNodes([
      { id: 'a', x: 0, y: 0, w: 200, h: 150 },
      { id: 'b', x: 100, y: 0, w: 200, h: 150 },
    ]);
    const nodes = getFile()!.nodes;
    expect(nodes).toHaveLength(3);
    expect(nodes[0].type).toBe('groupNode');
    expect(nodes[1].type).toBe('classNode');
  });

  it('should not create a group for empty rects', () => {
    useCanvasStore.getState().groupSelectedNodes([]);
    expect(getFile()!.nodes).toHaveLength(0);
  });

  it('should toggle sidebar open state', () => {
    expect(useCanvasStore.getState().sidebarOpen).toBe(true);
    useCanvasStore.getState().setSidebarOpen(false);
    expect(useCanvasStore.getState().sidebarOpen).toBe(false);
  });

  it('should preserve other edge data when updating relationship type', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = getFile()!.edges[0].id;

    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses', color: '#E74C3C' });
    useCanvasStore.getState().updateEdgeType(edgeId, 'composition');

    const edge = getFile()!.edges[0];
    expect(edge.data.relationshipType).toBe('composition');
    expect(edge.data.label).toBe('uses');
    expect(edge.data.color).toBe('#E74C3C');
  });

  it('should no-op actions when no active file', () => {
    useCanvasStore.getState().reset();
    // These should not throw
    useCanvasStore.getState().addClassNode(0, 0);
    useCanvasStore.getState().pushUndoSnapshot();
    expect(Object.keys(useCanvasStore.getState().files)).toHaveLength(0);
  });

  it('should rename the active file', () => {
    useCanvasStore.getState().renameFile('New Name');
    expect(getFile()!.name).toBe('New Name');
  });

  it('should set active file', () => {
    useCanvasStore.getState().setActiveFile('some-file.json');
    const state = useCanvasStore.getState();
    expect(state.activeFilePath).toBe('some-file.json');
  });

  it('should batch-remove multiple nodes with one undo entry', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    addClassNode(200, 0);
    const undoBefore = useCanvasStore.getState()._undoStack.length;

    const nodeIds = getFile()!.nodes.map((n) => n.id);
    useCanvasStore.getState().removeNodes(nodeIds);

    expect(getFile()!.nodes).toHaveLength(0);
    expect(useCanvasStore.getState()._undoStack.length).toBe(undoBefore + 1);
  });

  it('should cascade-delete annotations when batch-removing parent nodes', () => {
    const { addClassNode, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addAnnotation(nodes[0].id, 'node', 200, 0);

    expect(getFile()!.nodes).toHaveLength(3);
    useCanvasStore.getState().removeNodes([nodes[0].id, nodes[1].id]);
    expect(getFile()!.nodes).toHaveLength(0);
  });

  it('should no-op removeNodes with empty array', () => {
    const undoBefore = useCanvasStore.getState()._undoStack.length;
    useCanvasStore.getState().removeNodes([]);
    expect(useCanvasStore.getState()._undoStack.length).toBe(undoBefore);
  });

  it('should batch-remove multiple edges with one undo entry', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    addClassNode(200, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    addEdge(nodes[1].id, nodes[2].id, 'inheritance');

    const undoBefore = useCanvasStore.getState()._undoStack.length;
    const edgeIds = getFile()!.edges.map((e) => e.id);
    useCanvasStore.getState().removeEdges(edgeIds);

    expect(getFile()!.edges).toHaveLength(0);
    expect(useCanvasStore.getState()._undoStack.length).toBe(undoBefore + 1);
  });

  it('should cascade-delete annotations when batch-removing parent edges', () => {
    const { addClassNode, addEdge, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = getFile()!.edges[0].id;
    addAnnotation(edgeId, 'edge', 200, 50);

    expect(getFile()!.nodes).toHaveLength(3);
    useCanvasStore.getState().removeEdges([edgeId]);
    expect(getFile()!.edges).toHaveLength(0);
    expect(getFile()!.nodes).toHaveLength(2);
  });

  it('should no-op removeEdges with empty array', () => {
    const undoBefore = useCanvasStore.getState()._undoStack.length;
    useCanvasStore.getState().removeEdges([]);
    expect(useCanvasStore.getState()._undoStack.length).toBe(undoBefore);
  });
});

describe('Edge label lifecycle', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
    setupTestFile();
  });

  function createEdge() {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(200, 0);
    const nodes = getFile()!.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'association');
    return getFile()!.edges[0].id;
  }

  it('should set empty-string label as creation marker', () => {
    const edgeId = createEdge();
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    expect(getFile()!.edges[0].data.label).toBe('');
  });

  it('should save label text over the creation marker', () => {
    const edgeId = createEdge();
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses' });
    expect(getFile()!.edges[0].data.label).toBe('uses');
  });

  it('should remove label when committing empty text', () => {
    const edgeId = createEdge();
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    useCanvasStore.getState().updateEdgeData(edgeId, { label: undefined });
    expect(getFile()!.edges[0].data.label).toBeUndefined();
  });

  it('should preserve other data fields when updating label', () => {
    const edgeId = createEdge();
    useCanvasStore.getState().updateEdgeData(edgeId, { color: '#E74C3C' });
    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses' });
    const edge = getFile()!.edges[0];
    expect(edge.data.label).toBe('uses');
    expect(edge.data.color).toBe('#E74C3C');
    expect(edge.data.relationshipType).toBe('association');
  });
});

describe('migrateFile', () => {
  it('should return the same file when no migration is needed', () => {
    const file: CodeCanvasFile = {
      version: '1.0',
      name: 'Test',
      nodes: [
        { id: 'c1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [{ id: 'p1', name: 'x', type: 'int', visibility: 'public' }], methods: [{ id: 'm1', name: 'foo', parameters: [], returnType: 'void', visibility: 'public' }] } },
      ],
      edges: [],
    };
    const result = migrateFile(file);
    expect(result).toBe(file); // same reference — no-op
  });

  it('should add IDs to properties and methods that lack them', () => {
    const file = {
      version: '1.0',
      name: 'Test',
      nodes: [
        { id: 'c1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'A', properties: [{ name: 'x', type: 'int', visibility: 'public' }], methods: [{ name: 'foo', parameters: [], returnType: 'void', visibility: 'public' }] } },
      ],
      edges: [],
    } as unknown as CodeCanvasFile;
    const result = migrateFile(file);
    expect(result).not.toBe(file); // new object
    const node = result.nodes[0];
    if (node.type === 'classNode') {
      expect(node.data.properties[0].id).toBeTruthy();
      expect(node.data.methods[0].id).toBeTruthy();
    }
  });

  it('should not modify non-classNode nodes', () => {
    const file: CodeCanvasFile = {
      version: '1.0',
      name: 'Test',
      nodes: [
        { id: 'a1', type: 'annotationNode', position: { x: 0, y: 0 }, data: { comment: 'hi', parentId: 'c1', parentType: 'node' } },
      ],
      edges: [],
    };
    const result = migrateFile(file);
    expect(result).toBe(file); // no migration needed
  });
});
