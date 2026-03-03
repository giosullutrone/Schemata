import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './useCanvasStore';

describe('useCanvasStore', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('should initialize with a default canvas', () => {
    const state = useCanvasStore.getState();
    expect(state.currentCanvasId).toBe('main');
    expect(state.file.canvases.main).toBeDefined();
    expect(state.file.canvases.main.name).toBe('Main');
    expect(state.file.canvases.main.nodes).toEqual([]);
    expect(state.file.canvases.main.edges).toEqual([]);
  });

  it('should add a class node', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(100, 200);

    const state = useCanvasStore.getState();
    const nodes = state.file.canvases.main.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('classNode');
    expect(nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(nodes[0].data.name).toBe('NewClass');
    expect(nodes[0].data.properties).toEqual([]);
    expect(nodes[0].data.methods).toEqual([]);
  });

  it('should remove a node', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;

    useCanvasStore.getState().removeNode(nodeId);
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  });

  it('should remove edges connected to a deleted node', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');

    expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(1);

    useCanvasStore.getState().removeNode(nodes[0].id);
    expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
  });

  it('should add an edge', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;

    addEdge(nodes[0].id, nodes[1].id, 'inheritance');
    const edges = useCanvasStore.getState().file.canvases.main.edges;
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
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = useCanvasStore.getState().file.canvases.main.edges[0].id;

    useCanvasStore.getState().removeEdge(edgeId);
    expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
  });

  it('should update node data', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;

    useCanvasStore.getState().updateNodeData(nodeId, { name: 'UserService', color: '#4A90D9' });
    const node = useCanvasStore.getState().file.canvases.main.nodes[0];
    expect(node.data.name).toBe('UserService');
    expect(node.data.color).toBe('#4A90D9');
  });

  it('should update edge data', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = useCanvasStore.getState().file.canvases.main.edges[0].id;

    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses', color: '#E74C3C' });
    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.label).toBe('uses');
    expect(edge.data.color).toBe('#E74C3C');
  });

  it('should update node position', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;

    useCanvasStore.getState().updateNodePosition(nodeId, 50, 75);
    const node = useCanvasStore.getState().file.canvases.main.nodes[0];
    expect(node.position).toEqual({ x: 50, y: 75 });
  });

  it('should update edge relationship type via data', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = useCanvasStore.getState().file.canvases.main.edges[0].id;

    useCanvasStore.getState().updateEdgeType(edgeId, 'composition');
    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.type).toBe('uml');
    expect(edge.data.relationshipType).toBe('composition');
  });

  it('should set canvas edges without undo', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');

    useCanvasStore.getState().setCanvasEdges([]);
    expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
  });

  it('should save viewport for current canvas', () => {
    useCanvasStore.getState().saveViewport({ x: 100, y: 200, zoom: 1.5 });
    const canvas = useCanvasStore.getState().file.canvases.main;
    expect(canvas.viewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
  });

  it('should add an annotation node with default color and connecting edge', () => {
    const { addClassNode, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;

    addAnnotation(nodeId, 'node', 200, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes[1].type).toBe('annotationNode');
    expect(nodes[1].data.parentId).toBe(nodeId);
    expect(nodes[1].data.comment).toBe('Comment');
    expect(nodes[1].data.color).toBe('#F39C12');

    // Should also create a connecting edge
    const edges = useCanvasStore.getState().file.canvases.main.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(nodes[1].id);
    expect(edges[0].target).toBe(nodeId);
    expect(edges[0].data.relationshipType).toBe('association');
  });

  it('should cascade delete annotations when parent node is removed', () => {
    const { addClassNode, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;
    addAnnotation(nodeId, 'node', 200, 0);

    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(2);
    useCanvasStore.getState().removeNode(nodeId);
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  });

  it('should cascade delete annotations when parent edge is removed', () => {
    const { addClassNode, addEdge, addAnnotation } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = useCanvasStore.getState().file.canvases.main.edges[0].id;

    addAnnotation(edgeId, 'edge', 200, 50);
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(3);

    useCanvasStore.getState().removeEdge(edgeId);
    expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(2); // only class nodes remain
  });

  it('should add a standalone annotation (empty parentId) without a dangling edge', () => {
    useCanvasStore.getState().addAnnotation('', 'node', 100, 200);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('annotationNode');
    expect(nodes[0].data.parentId).toBe('');

    // No edge should be created when there is no parent
    const edges = useCanvasStore.getState().file.canvases.main.edges;
    expect(edges).toHaveLength(0);
  });

  it('should not push undo when using setCanvasNodes', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(0, 0);
    // addClassNode pushes undo, so stack has 1 entry
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
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;
    addAnnotation(nodeId, 'node', 200, 0);
    const annotationId = useCanvasStore.getState().file.canvases.main.nodes[1].id;

    useCanvasStore.getState().updateNodeData(annotationId, { color: '#E74C3C' });
    const node = useCanvasStore.getState().file.canvases.main.nodes[1];
    expect(node.data.color).toBe('#E74C3C');
  });

  it('should create a group node wrapping the given rects', () => {
    useCanvasStore.getState().groupSelectedNodes([
      { id: 'a', x: 100, y: 100, w: 200, h: 150 },
      { id: 'b', x: 400, y: 200, w: 200, h: 150 },
    ]);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('groupNode');
    expect(nodes[0].data.label).toBe('Group');
    // Check bounding box: padding=20, labelHeight=24
    expect(nodes[0].position.x).toBe(80);  // 100 - 20
    expect(nodes[0].position.y).toBe(56);  // 100 - 20 - 24
    const style = (nodes[0] as { style?: { width: number; height: number } }).style;
    expect(style?.width).toBe(540);  // (600-100) + 40
    expect(style?.height).toBe(314); // (350-100) + 40 + 24
  });

  it('should prepend group node so it renders behind other nodes', () => {
    const { addClassNode, groupSelectedNodes } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    groupSelectedNodes([
      { id: 'a', x: 0, y: 0, w: 200, h: 150 },
      { id: 'b', x: 100, y: 0, w: 200, h: 150 },
    ]);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    expect(nodes).toHaveLength(3);
    expect(nodes[0].type).toBe('groupNode');
    expect(nodes[1].type).toBe('classNode');
  });

  it('should not create a group for empty rects', () => {
    useCanvasStore.getState().groupSelectedNodes([]);
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  });

  it('should preserve other edge data when updating relationship type', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = useCanvasStore.getState().file.canvases.main.edges[0].id;

    // Set label and color first
    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses', color: '#E74C3C' });
    // Then change type
    useCanvasStore.getState().updateEdgeType(edgeId, 'composition');

    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.relationshipType).toBe('composition');
    expect(edge.data.label).toBe('uses');
    expect(edge.data.color).toBe('#E74C3C');
  });
});

describe('Edge label lifecycle', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  function createEdge() {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(200, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'association');
    return useCanvasStore.getState().file.canvases.main.edges[0].id;
  }

  it('should set empty-string label as creation marker', () => {
    const edgeId = createEdge();
    // Simulates handleEdgeDoubleClick setting label to '' as a signal
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.label).toBe('');
  });

  it('should save label text over the creation marker', () => {
    const edgeId = createEdge();
    // Step 1: double-click sets marker
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    // Step 2: user types and commits
    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses' });

    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.label).toBe('uses');
  });

  it('should remove label when committing empty text', () => {
    const edgeId = createEdge();
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    // User commits without typing → label should be removed
    useCanvasStore.getState().updateEdgeData(edgeId, { label: undefined });

    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.label).toBeUndefined();
  });

  it('should remove label when cancelling creation via Escape', () => {
    const edgeId = createEdge();
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    // Escape → clean up the empty-string marker
    useCanvasStore.getState().updateEdgeData(edgeId, { label: undefined });

    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.label).toBeUndefined();
  });

  it('should preserve label after intermediate state during commit', () => {
    const edgeId = createEdge();
    // Simulates the full lifecycle:
    // 1. Double-click: marker set
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    expect(useCanvasStore.getState().file.canvases.main.edges[0].data.label).toBe('');

    // 2. Commit: label saved (the real component calls this in commitLabel)
    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'depends on' });
    expect(useCanvasStore.getState().file.canvases.main.edges[0].data.label).toBe('depends on');

    // 3. Verify label persists (it shouldn't revert to '' or undefined)
    const finalEdge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(finalEdge.data.label).toBe('depends on');
    expect(finalEdge.data.relationshipType).toBe('association');
  });

  it('should allow re-editing an existing label', () => {
    const edgeId = createEdge();
    // Create and commit initial label
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses' });

    // Edit existing label (double-click on label div sets draft, doesn't touch store)
    // Commit with new text
    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'depends on' });

    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.label).toBe('depends on');
  });

  it('should preserve other data fields when updating label', () => {
    const edgeId = createEdge();
    useCanvasStore.getState().updateEdgeData(edgeId, { color: '#E74C3C' });
    useCanvasStore.getState().updateEdgeData(edgeId, { label: '' });
    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses' });

    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.label).toBe('uses');
    expect(edge.data.color).toBe('#E74C3C');
    expect(edge.data.relationshipType).toBe('association');
  });
});

describe('Canvas management', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('should add a new canvas', () => {
    useCanvasStore.getState().addCanvas('auth', 'Authentication');
    const state = useCanvasStore.getState();
    expect(state.file.canvases.auth).toBeDefined();
    expect(state.file.canvases.auth.name).toBe('Authentication');
    expect(state.file.canvases.auth.nodes).toEqual([]);
  });

  it('should switch current canvas', () => {
    useCanvasStore.getState().addCanvas('auth', 'Authentication');
    useCanvasStore.getState().setCurrentCanvas('auth');
    expect(useCanvasStore.getState().currentCanvasId).toBe('auth');
  });

  it('should remove a canvas and switch to another', () => {
    useCanvasStore.getState().addCanvas('auth', 'Authentication');
    useCanvasStore.getState().setCurrentCanvas('auth');
    useCanvasStore.getState().removeCanvas('auth');

    const state = useCanvasStore.getState();
    expect(state.file.canvases.auth).toBeUndefined();
    expect(state.currentCanvasId).toBe('main');
  });

  it('should rename a canvas', () => {
    useCanvasStore.getState().renameCanvas('main', 'Core Architecture');
    expect(useCanvasStore.getState().file.canvases.main.name).toBe('Core Architecture');
  });

  it('should scope node operations to current canvas', () => {
    useCanvasStore.getState().addCanvas('auth', 'Authentication');
    useCanvasStore.getState().addClassNode(0, 0); // adds to 'main'

    useCanvasStore.getState().setCurrentCanvas('auth');
    useCanvasStore.getState().addClassNode(100, 100); // adds to 'auth'

    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(1);
    expect(useCanvasStore.getState().file.canvases.auth.nodes).toHaveLength(1);
  });

  it('should load a file', () => {
    const file = {
      version: '1.0',
      name: 'Loaded Project',
      canvases: {
        api: {
          name: 'API Layer',
          nodes: [],
          edges: [],
        },
      },
    };
    useCanvasStore.getState().loadFile(file);
    const state = useCanvasStore.getState();
    expect(state.file.name).toBe('Loaded Project');
    expect(state.currentCanvasId).toBe('api');
  });

  it('should migrate old files by adding IDs to properties and methods', () => {
    const file = {
      version: '1.0',
      name: 'Old Project',
      canvases: {
        main: {
          name: 'Main',
          nodes: [
            {
              id: 'class-1',
              type: 'classNode' as const,
              position: { x: 0, y: 0 },
              data: {
                name: 'OldClass',
                properties: [
                  { name: 'field', type: 'string', visibility: 'private' as const },
                ],
                methods: [
                  { name: 'doStuff', parameters: [], returnType: 'void', visibility: 'public' as const },
                ],
              },
            },
          ],
          edges: [],
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useCanvasStore.getState().loadFile(file as any);
    const node = useCanvasStore.getState().file.canvases.main.nodes[0];
    if (node.type === 'classNode') {
      expect(node.data.properties[0].id).toBeDefined();
      expect(node.data.methods[0].id).toBeDefined();
    }
  });
});
