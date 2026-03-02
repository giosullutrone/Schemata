import { create } from 'zustand';
import type {
  CodeCanvasFile,
  ClassNodeData,
  ClassEdgeData,
  RelationshipType,
} from '../types/schema';

let nextNodeId = 1;
let nextEdgeId = 1;

function generateNodeId(): string {
  return `class-${nextNodeId++}`;
}

function generateEdgeId(): string {
  return `edge-${nextEdgeId++}`;
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
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<ClassNodeData>) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;

  // Edge operations
  addEdge: (source: string, target: string, type: RelationshipType) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeData: (edgeId: string, data: Partial<ClassEdgeData>) => void;
  updateEdgeType: (edgeId: string, type: RelationshipType) => void;
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
    set({ file: createDefaultFile(), currentCanvasId: 'main', _undoStack: [], _redoStack: [] });
  },

  loadFile: (file) => {
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

  removeNode: (nodeId) => {
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
            nodes: canvas.nodes.filter((n) => n.id !== nodeId),
            edges: canvas.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
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
              n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
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

  addEdge: (source, target, type) => {
    pushUndo(get, set);
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    const newEdge = {
      id: generateEdgeId(),
      source,
      target,
      type,
      data: { label: type },
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
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges: canvas.edges.filter((e) => e.id !== edgeId),
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
              e.id === edgeId ? { ...e, type } : e
            ),
          },
        },
      },
    });
  },
}));
