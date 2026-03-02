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
    expect(edges[0].type).toBe('inheritance');
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
});
