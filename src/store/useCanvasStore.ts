import { create } from 'zustand';
import type {
  CodeCanvasFile,
  ClassEdgeData,
  ClassEdgeSchema,
  CanvasNodeSchema,
  RelationshipType,
} from '../types/schema';

let nextNodeId = 1;
let nextEdgeId = 1;
let nextAnnotationId = 1;
let nextGroupId = 1;
let nextPropId = 1;
let nextMethodId = 1;

function generateNodeId(): string {
  return `class-${nextNodeId++}`;
}

function generateEdgeId(): string {
  return `edge-${nextEdgeId++}`;
}

function generateAnnotationId(): string {
  return `annotation-${nextAnnotationId++}`;
}

function generateGroupId(): string {
  return `group-${nextGroupId++}`;
}

export function generatePropId(): string {
  return `p${nextPropId++}`;
}

export function generateMethodId(): string {
  return `m${nextMethodId++}`;
}

function pushUndo(get: () => CanvasStore, set: (partial: Partial<CanvasStore>) => void) {
  const { file, _undoStack } = get();
  set({
    _undoStack: [..._undoStack, JSON.parse(JSON.stringify(file))],
    _redoStack: [],
  });
}

function createDefaultFile(): CodeCanvasFile {
  return {
    version: '1.0',
    name: 'Untitled Project',
    canvases: {
      main: {
        name: 'Main',
        nodes: [],
        edges: [],
      },
    },
  };
}

/** Migrate older files: ensure all properties/methods have stable IDs */
function migrateFile(file: CodeCanvasFile): void {
  for (const canvas of Object.values(file.canvases)) {
    for (const node of canvas.nodes) {
      if (node.type === 'classNode') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.data.properties.forEach((p: any) => {
          if (!p.id) p.id = generatePropId();
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.data.methods.forEach((m: any) => {
          if (!m.id) m.id = generateMethodId();
        });
      }
    }
  }
}

interface CanvasStore {
  file: CodeCanvasFile;
  currentCanvasId: string;
  _undoStack: CodeCanvasFile[];
  _redoStack: CodeCanvasFile[];

  // Undo/Redo
  undo: () => void;
  redo: () => void;

  // Reset (for tests)
  reset: () => void;

  // File operations
  loadFile: (file: CodeCanvasFile) => void;

  // Canvas operations
  setCurrentCanvas: (canvasId: string) => void;
  addCanvas: (id: string, name: string) => void;
  removeCanvas: (id: string) => void;
  renameCanvas: (id: string, name: string) => void;

  // Node operations
  addClassNode: (x: number, y: number) => void;
  addAnnotation: (parentId: string, parentType: 'node' | 'edge', x: number, y: number) => void;
  groupSelectedNodes: (rects: { id: string; x: number; y: number; w: number; h: number }[]) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  setCanvasNodes: (nodes: CanvasNodeSchema[]) => void;
  pushUndoSnapshot: () => void;

  // Edge operations
  addEdge: (source: string, target: string, type: RelationshipType, sourceHandle?: string, targetHandle?: string) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeData: (edgeId: string, data: Partial<ClassEdgeData>) => void;
  updateEdgeType: (edgeId: string, type: RelationshipType) => void;
  setCanvasEdges: (edges: ClassEdgeSchema[]) => void;
  saveViewport: (viewport: { x: number; y: number; zoom: number }) => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  file: createDefaultFile(),
  currentCanvasId: 'main',
  _undoStack: [],
  _redoStack: [],

  undo: () => {
    const { _undoStack, file } = get();
    if (_undoStack.length === 0) return;
    const previous = _undoStack[_undoStack.length - 1];
    set({
      _undoStack: _undoStack.slice(0, -1),
      _redoStack: [...get()._redoStack, file],
      file: previous,
    });
  },

  redo: () => {
    const { _redoStack, file } = get();
    if (_redoStack.length === 0) return;
    const next = _redoStack[_redoStack.length - 1];
    set({
      _redoStack: _redoStack.slice(0, -1),
      _undoStack: [...get()._undoStack, file],
      file: next,
    });
  },

  reset: () => {
    nextNodeId = 1;
    nextEdgeId = 1;
    nextAnnotationId = 1;
    nextGroupId = 1;
    nextPropId = 1;
    nextMethodId = 1;
    set({ file: createDefaultFile(), currentCanvasId: 'main', _undoStack: [], _redoStack: [] });
  },

  loadFile: (file) => {
    migrateFile(file);
    const canvasIds = Object.keys(file.canvases);
    set({ file, currentCanvasId: canvasIds[0] || 'main' });
  },

  setCurrentCanvas: (canvasId) => {
    set({ currentCanvasId: canvasId });
  },

  addCanvas: (id, name) => {
    pushUndo(get, set);
    const { file } = get();
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [id]: { name, nodes: [], edges: [] },
        },
      },
    });
  },

  removeCanvas: (id) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const { [id]: _, ...rest } = file.canvases;
    const newCurrentId = currentCanvasId === id ? Object.keys(rest)[0] : currentCanvasId;
    set({
      file: { ...file, canvases: rest },
      currentCanvasId: newCurrentId,
    });
  },

  renameCanvas: (id, name) => {
    pushUndo(get, set);
    const { file } = get();
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [id]: { ...file.canvases[id], name },
        },
      },
    });
  },

  addClassNode: (x, y) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    const newNode = {
      id: generateNodeId(),
      type: 'classNode' as const,
      position: { x, y },
      data: {
        name: 'NewClass',
        properties: [],
        methods: [],
      },
    };
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: [...canvas.nodes, newNode],
          },
        },
      },
    });
  },

  addAnnotation: (parentId, parentType, x, y) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    const nodeId = generateAnnotationId();

    // Resolve target node for the edge
    let targetNodeId = parentId;
    if (parentType === 'edge') {
      const parentEdge = canvas.edges.find((e) => e.id === parentId);
      if (parentEdge) targetNodeId = parentEdge.source;
    }

    // Pick handles based on relative position to the target
    const targetNode = canvas.nodes.find((n) => n.id === targetNodeId);
    const isLeft = targetNode ? x < targetNode.position.x : false;
    const sourceHandle = isLeft ? 'right' : 'left';
    const targetHandle = isLeft ? 'left' : 'right';

    const newNode = {
      id: nodeId,
      type: 'annotationNode' as const,
      position: { x, y },
      data: {
        comment: 'Comment',
        parentId,
        parentType,
        color: '#F39C12',
      },
    };
    const newEdge: ClassEdgeSchema = {
      id: generateEdgeId(),
      source: nodeId,
      target: targetNodeId,
      sourceHandle,
      targetHandle,
      type: 'uml' as const,
      data: { relationshipType: 'association' as const },
    };
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: [...canvas.nodes, newNode],
            edges: [...canvas.edges, newEdge],
          },
        },
      },
    });
  },

  groupSelectedNodes: (rects) => {
    if (rects.length === 0) return;
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    const padding = 20;
    const labelHeight = 24;
    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    const maxY = Math.max(...rects.map((r) => r.y + r.h));
    const groupNode = {
      id: generateGroupId(),
      type: 'groupNode' as const,
      position: { x: minX - padding, y: minY - padding - labelHeight },
      data: { label: 'Group' },
      style: {
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + labelHeight,
      },
    };
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: [groupNode, ...canvas.nodes],
          },
        },
      },
    });
  },

  removeNode: (nodeId) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    // Collect all node IDs to remove (target + cascade annotations)
    const removedIds = new Set([nodeId]);
    for (const n of canvas.nodes) {
      if (n.type === 'annotationNode' && n.data.parentId === nodeId) {
        removedIds.add(n.id);
      }
    }
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: canvas.nodes.filter((n) => !removedIds.has(n.id)),
            edges: canvas.edges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)),
          },
        },
      },
    });
  },

  updateNodeData: (nodeId, data) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: canvas.nodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, ...data } } as CanvasNodeSchema : n
            ),
          },
        },
      },
    });
  },

  updateNodePosition: (nodeId, x, y) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: canvas.nodes.map((n) =>
              n.id === nodeId ? { ...n, position: { x, y } } : n
            ),
          },
        },
      },
    });
  },

  setCanvasNodes: (nodes) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes,
          },
        },
      },
    });
  },

  pushUndoSnapshot: () => {
    pushUndo(get, set);
  },

  addEdge: (source, target, type, sourceHandle, targetHandle) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    const newEdge: ClassEdgeSchema = {
      id: generateEdgeId(),
      source,
      target,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
      type: 'uml' as const,
      data: { relationshipType: type },
    };
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges: [...canvas.edges, newEdge],
          },
        },
      },
    });
  },

  removeEdge: (edgeId) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    // Collect annotation node IDs that will be cascade-deleted
    const removedNodeIds = new Set(
      canvas.nodes
        .filter((n) => n.type === 'annotationNode' && n.data.parentId === edgeId)
        .map((n) => n.id)
    );
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: canvas.nodes.filter((n) => !removedNodeIds.has(n.id)),
            edges: canvas.edges.filter((e) => e.id !== edgeId && !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target)),
          },
        },
      },
    });
  },

  updateEdgeData: (edgeId, data) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges: canvas.edges.map((e) =>
              e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e
            ),
          },
        },
      },
    });
  },

  updateEdgeType: (edgeId, type) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges: canvas.edges.map((e) =>
              e.id === edgeId ? { ...e, data: { ...e.data, relationshipType: type } } : e
            ),
          },
        },
      },
    });
  },

  setCanvasEdges: (edges) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges,
          },
        },
      },
    });
  },

  saveViewport: (viewport) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            viewport,
          },
        },
      },
    });
  },
}));
