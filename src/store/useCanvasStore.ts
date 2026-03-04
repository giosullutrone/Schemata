import { create } from 'zustand';
import type {
  CodeCanvasFile,
  ClassEdgeData,
  ClassEdgeSchema,
  CanvasNodeSchema,
  RelationshipType,
} from '../types/schema';
import {
  openFolder as openFolderPicker,
  scanFolder,
  createFileInFolder,
  writeToHandle,
} from '../utils/fileIO';

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

interface UndoEntry {
  filePath: string;
  snapshot: CodeCanvasFile;
}

const MAX_UNDO_STACK = 100;

function pushUndo(get: () => CanvasStore, set: (partial: Partial<CanvasStore>) => void) {
  const { files, activeFilePath, _undoStack } = get();
  if (!activeFilePath) return;
  const file = files[activeFilePath];
  if (!file) return;
  const newStack = [..._undoStack, { filePath: activeFilePath, snapshot: JSON.parse(JSON.stringify(file)) }];
  if (newStack.length > MAX_UNDO_STACK) newStack.splice(0, newStack.length - MAX_UNDO_STACK);
  set({
    _undoStack: newStack,
    _redoStack: [],
    _dirtyFiles: { ...get()._dirtyFiles, [activeFilePath]: true },
  });
}

/** Helper: update the active file's state via an updater function */
function updateActiveFile(
  get: () => CanvasStore,
  set: (partial: Partial<CanvasStore>) => void,
  updater: (file: CodeCanvasFile) => CodeCanvasFile,
) {
  const { activeFilePath, files } = get();
  if (!activeFilePath) return;
  const file = files[activeFilePath];
  if (!file) return;
  const updated = updater(file);
  set({ files: { ...files, [activeFilePath]: updated } });
}

/** Migrate older files: ensure all properties/methods have stable IDs */
export function migrateFile(file: CodeCanvasFile): CodeCanvasFile {
  let needsMigration = false;
  for (const node of file.nodes) {
    if (node.type === 'classNode') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (node.data.properties.some((p: any) => !p.id) || node.data.methods.some((m: any) => !m.id)) {
        needsMigration = true;
        break;
      }
    }
  }
  if (!needsMigration) return file;
  return {
    ...file,
    nodes: file.nodes.map((node) => {
      if (node.type !== 'classNode') return node;
      return {
        ...node,
        data: {
          ...node.data,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          properties: node.data.properties.map((p: any) => (p.id ? p : { ...p, id: generatePropId() })),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          methods: node.data.methods.map((m: any) => (m.id ? m : { ...m, id: generateMethodId() })),
        },
      };
    }),
  };
}

interface CanvasStore {
  // Folder state
  folderHandle: FileSystemDirectoryHandle | null;
  folderName: string | null;

  // Multi-file state
  files: Record<string, CodeCanvasFile>;
  fileHandles: Record<string, FileSystemFileHandle>;

  // Active location
  activeFilePath: string | null;

  // Undo/redo
  _undoStack: UndoEntry[];
  _redoStack: UndoEntry[];

  // Save tracking
  lastSavedFiles: Record<string, CodeCanvasFile>;
  _dirtyFiles: Record<string, boolean>;

  // Sidebar
  sidebarOpen: boolean;

  // Undo/Redo
  undo: () => void;
  redo: () => void;

  // Reset (for tests)
  reset: () => void;

  // Folder operations
  openFolder: () => Promise<void>;
  setActiveFile: (filePath: string) => void;
  createFile: (folderRelativePath: string, displayName: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;

  // Node operations
  addClassNode: (x: number, y: number) => void;
  addAnnotation: (parentId: string, parentType: 'node' | 'edge', x: number, y: number) => void;
  groupSelectedNodes: (rects: { id: string; x: number; y: number; w: number; h: number }[]) => void;
  removeNode: (nodeId: string) => void;
  removeNodes: (nodeIds: string[]) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  setCanvasNodes: (nodes: CanvasNodeSchema[]) => void;
  pushUndoSnapshot: () => void;

  // Edge operations
  addEdge: (source: string, target: string, type: RelationshipType, sourceHandle?: string, targetHandle?: string) => void;
  removeEdge: (edgeId: string) => void;
  removeEdges: (edgeIds: string[]) => void;
  updateEdgeData: (edgeId: string, data: Partial<ClassEdgeData>) => void;
  updateEdgeType: (edgeId: string, type: RelationshipType) => void;
  setCanvasEdges: (edges: ClassEdgeSchema[]) => void;
  saveViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  // Sidebar
  setSidebarOpen: (open: boolean) => void;

  // File name
  renameFile: (newName: string) => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  folderHandle: null,
  folderName: null,
  files: {},
  fileHandles: {},
  activeFilePath: null,
  _undoStack: [],
  _redoStack: [],
  lastSavedFiles: {},
  _dirtyFiles: {},
  sidebarOpen: (() => {
    const stored = localStorage.getItem('codecanvas-sidebar-open');
    return stored !== null ? stored === 'true' : true;
  })(),

  undo: () => {
    const { _undoStack, files } = get();
    if (_undoStack.length === 0) return;
    const entry = _undoStack[_undoStack.length - 1];
    const currentFile = files[entry.filePath];
    if (!currentFile) return;
    set({
      _undoStack: _undoStack.slice(0, -1),
      _redoStack: [...get()._redoStack, { filePath: entry.filePath, snapshot: currentFile }],
      files: { ...files, [entry.filePath]: entry.snapshot },
    });
  },

  redo: () => {
    const { _redoStack, files } = get();
    if (_redoStack.length === 0) return;
    const entry = _redoStack[_redoStack.length - 1];
    const currentFile = files[entry.filePath];
    if (!currentFile) return;
    set({
      _redoStack: _redoStack.slice(0, -1),
      _undoStack: [...get()._undoStack, { filePath: entry.filePath, snapshot: currentFile }],
      files: { ...files, [entry.filePath]: entry.snapshot },
    });
  },

  reset: () => {
    nextNodeId = 1;
    nextEdgeId = 1;
    nextAnnotationId = 1;
    nextGroupId = 1;
    nextPropId = 1;
    nextMethodId = 1;
    set({
      folderHandle: null,
      folderName: null,
      files: {},
      fileHandles: {},
      activeFilePath: null,
      _undoStack: [],
      _redoStack: [],
      lastSavedFiles: {},
      _dirtyFiles: {},
      sidebarOpen: true,
    });
  },

  openFolder: async () => {
    const dirHandle = await openFolderPicker();
    if (!dirHandle) return;
    const scanned = await scanFolder(dirHandle);
    const files: Record<string, CodeCanvasFile> = {};
    const handles: Record<string, FileSystemFileHandle> = {};
    const lastSaved: Record<string, CodeCanvasFile> = {};
    for (const s of scanned) {
      const migrated = migrateFile(s.file);
      files[s.relativePath] = migrated;
      handles[s.relativePath] = s.handle;
      lastSaved[s.relativePath] = migrated;
    }
    const firstPath = Object.keys(files)[0] ?? null;
    set({
      folderHandle: dirHandle,
      folderName: dirHandle.name,
      files,
      fileHandles: handles,
      lastSavedFiles: lastSaved,
      _dirtyFiles: {},
      activeFilePath: firstPath,
      _undoStack: [],
      _redoStack: [],
    });
  },

  setActiveFile: (filePath) => {
    set({ activeFilePath: filePath });
  },

  createFile: async (folderRelativePath, displayName) => {
    const { folderHandle, files, fileHandles, lastSavedFiles } = get();
    if (!folderHandle) return;
    const newFile: CodeCanvasFile = {
      version: '1.0',
      name: displayName,
      nodes: [],
      edges: [],
    };
    const sanitized = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fileName = `${sanitized || 'untitled'}.codecanvas.json`;
    try {
      const result = await createFileInFolder(folderHandle, folderRelativePath, fileName, newFile);
      if (!result) return;
      set({
        files: { ...files, [result.relativePath]: result.file },
        fileHandles: { ...fileHandles, [result.relativePath]: result.handle },
        lastSavedFiles: { ...lastSavedFiles, [result.relativePath]: result.file },
        activeFilePath: result.relativePath,
      });
    } catch {
      // Failed to create file on disk
    }
  },

  saveActiveFile: async () => {
    const { activeFilePath, files, fileHandles } = get();
    if (!activeFilePath) return;
    const file = files[activeFilePath];
    const handle = fileHandles[activeFilePath];
    if (!file || !handle) return;
    await writeToHandle(handle, file);
    const { _dirtyFiles } = get();
    const nextDirty = { ..._dirtyFiles };
    delete nextDirty[activeFilePath];
    set({ _dirtyFiles: nextDirty });
  },

  addClassNode: (x, y) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
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
      return { ...file, nodes: [...file.nodes, newNode] };
    });
  },

  addAnnotation: (parentId, parentType, x, y) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const nodeId = generateAnnotationId();

      let targetNodeId = parentId;
      if (parentType === 'edge') {
        const parentEdge = file.edges.find((e) => e.id === parentId);
        if (parentEdge) targetNodeId = parentEdge.source;
      }

      const targetNode = file.nodes.find((n) => n.id === targetNodeId);
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

      const newEdges = targetNodeId
        ? [
            ...file.edges,
            {
              id: generateEdgeId(),
              source: nodeId,
              target: targetNodeId,
              sourceHandle,
              targetHandle,
              type: 'uml' as const,
              data: { relationshipType: 'association' as const },
            } satisfies ClassEdgeSchema,
          ]
        : file.edges;

      return { ...file, nodes: [...file.nodes, newNode], edges: newEdges };
    });
  },

  groupSelectedNodes: (rects) => {
    if (rects.length === 0) return;
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
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
      return { ...file, nodes: [groupNode, ...file.nodes] };
    });
  },

  removeNode: (nodeId) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const removedIds = new Set([nodeId]);
      for (const n of file.nodes) {
        if (n.type === 'annotationNode' && n.data.parentId === nodeId) {
          removedIds.add(n.id);
        }
      }
      return {
        ...file,
        nodes: file.nodes.filter((n) => !removedIds.has(n.id)),
        edges: file.edges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)),
      };
    });
  },

  removeNodes: (nodeIds) => {
    if (nodeIds.length === 0) return;
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const removedIds = new Set(nodeIds);
      for (const n of file.nodes) {
        if (n.type === 'annotationNode' && removedIds.has(n.data.parentId)) {
          removedIds.add(n.id);
        }
      }
      return {
        ...file,
        nodes: file.nodes.filter((n) => !removedIds.has(n.id)),
        edges: file.edges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)),
      };
    });
  },

  updateNodeData: (nodeId, data) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => ({
      ...file,
      nodes: file.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } as CanvasNodeSchema : n
      ),
    }));
  },

  updateNodePosition: (nodeId, x, y) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => ({
      ...file,
      nodes: file.nodes.map((n) =>
        n.id === nodeId ? { ...n, position: { x, y } } : n
      ),
    }));
  },

  setCanvasNodes: (nodes) => {
    const { activeFilePath, files } = get();
    if (!activeFilePath) return;
    const file = files[activeFilePath];
    if (!file || file.nodes === nodes) return;
    updateActiveFile(get, set, (f) => ({ ...f, nodes }));
  },

  pushUndoSnapshot: () => {
    pushUndo(get, set);
  },

  addEdge: (source, target, type, sourceHandle, targetHandle) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const newEdge: ClassEdgeSchema = {
        id: generateEdgeId(),
        source,
        target,
        ...(sourceHandle ? { sourceHandle } : {}),
        ...(targetHandle ? { targetHandle } : {}),
        type: 'uml' as const,
        data: { relationshipType: type },
      };
      return { ...file, edges: [...file.edges, newEdge] };
    });
  },

  removeEdge: (edgeId) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const removedNodeIds = new Set(
        file.nodes
          .filter((n) => n.type === 'annotationNode' && n.data.parentId === edgeId)
          .map((n) => n.id)
      );
      return {
        ...file,
        nodes: file.nodes.filter((n) => !removedNodeIds.has(n.id)),
        edges: file.edges.filter((e) => e.id !== edgeId && !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target)),
      };
    });
  },

  removeEdges: (edgeIds) => {
    if (edgeIds.length === 0) return;
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const removedEdgeIds = new Set(edgeIds);
      const removedNodeIds = new Set(
        file.nodes
          .filter((n) => n.type === 'annotationNode' && removedEdgeIds.has(n.data.parentId))
          .map((n) => n.id)
      );
      return {
        ...file,
        nodes: file.nodes.filter((n) => !removedNodeIds.has(n.id)),
        edges: file.edges.filter((e) => !removedEdgeIds.has(e.id) && !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target)),
      };
    });
  },

  updateEdgeData: (edgeId, data) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => ({
      ...file,
      edges: file.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e
      ),
    }));
  },

  updateEdgeType: (edgeId, type) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => ({
      ...file,
      edges: file.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, relationshipType: type } } : e
      ),
    }));
  },

  setCanvasEdges: (edges) => {
    const { activeFilePath, files } = get();
    if (!activeFilePath) return;
    const file = files[activeFilePath];
    if (!file || file.edges === edges) return;
    updateActiveFile(get, set, (f) => ({ ...f, edges }));
  },

  saveViewport: (viewport) => {
    const { activeFilePath, files } = get();
    if (!activeFilePath) return;
    const file = files[activeFilePath];
    if (!file) return;
    // Skip update if viewport hasn't changed to avoid dirtying the file
    const v = file.viewport;
    if (v && v.x === viewport.x && v.y === viewport.y && v.zoom === viewport.zoom) return;
    updateActiveFile(get, set, (f) => ({ ...f, viewport }));
  },

  setSidebarOpen: (open) => {
    localStorage.setItem('codecanvas-sidebar-open', String(open));
    set({ sidebarOpen: open });
  },

  renameFile: (newName) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => ({
      ...file,
      name: newName,
    }));
  },
}));
