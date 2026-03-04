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
let nextTextNodeId = 1;
let nextGroupId = 1;
let nextPropId = 1;
let nextMethodId = 1;

function generateNodeId(): string {
  return `class-${nextNodeId++}`;
}

function generateEdgeId(): string {
  return `edge-${nextEdgeId++}`;
}

function generateTextNodeId(): string {
  return `text-${nextTextNodeId++}`;
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

/** Parse the numeric suffix from an ID like "class-5" → 5, or return 0 */
function parseIdSuffix(id: string): number {
  const match = id.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Sync all ID counters to be above the highest existing IDs across all files */
function syncIdCounters(files: Record<string, CodeCanvasFile>) {
  let maxNode = 0, maxEdge = 0, maxTextNode = 0, maxGroup = 0, maxProp = 0, maxMethod = 0;
  for (const file of Object.values(files)) {
    for (const node of file.nodes) {
      if (node.id.startsWith('class-')) maxNode = Math.max(maxNode, parseIdSuffix(node.id));
      else if (node.id.startsWith('text-')) maxTextNode = Math.max(maxTextNode, parseIdSuffix(node.id));
      else if (node.id.startsWith('group-')) maxGroup = Math.max(maxGroup, parseIdSuffix(node.id));
      if (node.type === 'classNode') {
        const d = node.data as { properties?: { id?: string }[]; methods?: { id?: string }[] };
        for (const p of d.properties ?? []) {
          if (p.id?.startsWith('p')) maxProp = Math.max(maxProp, parseInt(p.id.slice(1), 10) || 0);
        }
        for (const m of d.methods ?? []) {
          if (m.id?.startsWith('m')) maxMethod = Math.max(maxMethod, parseInt(m.id.slice(1), 10) || 0);
        }
      }
    }
    for (const edge of file.edges) {
      if (edge.id.startsWith('edge-')) maxEdge = Math.max(maxEdge, parseIdSuffix(edge.id));
    }
  }
  nextNodeId = maxNode + 1;
  nextEdgeId = maxEdge + 1;
  nextTextNodeId = maxTextNode + 1;
  nextGroupId = maxGroup + 1;
  nextPropId = maxProp + 1;
  nextMethodId = maxMethod + 1;
}

/** Deduplicate nodes by ID, keeping the last occurrence */
function deduplicateNodes(file: CodeCanvasFile): CodeCanvasFile {
  const seen = new Set<string>();
  const unique: typeof file.nodes = [];
  // Iterate in reverse so we keep the last occurrence, then reverse back
  for (let i = file.nodes.length - 1; i >= 0; i--) {
    const node = file.nodes[i];
    if (!seen.has(node.id)) {
      seen.add(node.id);
      unique.push(node);
    }
  }
  if (unique.length === file.nodes.length) return file; // no duplicates
  unique.reverse();
  return { ...file, nodes: unique };
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

/** Migrate older files: ensure all properties/methods have stable IDs, annotationNode → textNode */
export function migrateFile(file: CodeCanvasFile): CodeCanvasFile {
  let changed = false;

  // Check for classNode property/method ID migration
  for (const node of file.nodes) {
    if (node.type === 'classNode') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (node.data.properties.some((p: any) => !p.id) || node.data.methods.some((m: any) => !m.id)) {
        changed = true;
        break;
      }
    }
    // Check for annotationNode → textNode migration
    if ((node.type as string) === 'annotationNode') {
      changed = true;
    }
  }

  if (!changed) return file;

  return {
    ...file,
    nodes: file.nodes.map((node) => {
      // Migrate annotationNode → textNode
      if ((node.type as string) === 'annotationNode') {
        const oldData = node.data as Record<string, unknown>;
        return {
          ...node,
          type: 'textNode' as CanvasNodeSchema['type'],
          data: {
            text: (oldData.comment as string) ?? '',
            ...(oldData.color != null && { color: oldData.color }),
            borderStyle: 'dashed',
            opacity: 0.85,
          } as unknown as typeof node.data,
        };
      }
      // Migrate classNode property/method IDs
      if (node.type === 'classNode') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const needsIds = node.data.properties.some((p: any) => !p.id) || node.data.methods.some((m: any) => !m.id);
        if (!needsIds) return node;
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
      }
      return node;
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
  refreshFolder: () => Promise<void>;
  setActiveFile: (filePath: string) => void;
  createFile: (folderRelativePath: string, displayName: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;
  saveAllFiles: () => Promise<void>;
  removeFile: (filePath: string) => Promise<void>;

  // Node operations
  addClassNode: (x: number, y: number) => void;
  addTextNode: (x: number, y: number, options?: {
    parentId?: string;
    parentType?: 'node' | 'edge';
    color?: string;
    borderStyle?: string;
    opacity?: number;
    text?: string;
  }) => void;
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

  // Status
  _loading: boolean;
  _error: string | null;
  clearError: () => void;
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
  _loading: false,
  _error: null,
  sidebarOpen: (() => {
    const stored = localStorage.getItem('codecanvas-sidebar-open');
    return stored !== null ? stored === 'true' : true;
  })(),

  undo: () => {
    const { _undoStack, files, lastSavedFiles, _dirtyFiles } = get();
    if (_undoStack.length === 0) return;
    const entry = _undoStack[_undoStack.length - 1];
    const currentFile = files[entry.filePath];
    if (!currentFile) return;
    const savedFile = lastSavedFiles[entry.filePath];
    const isClean = savedFile && JSON.stringify(savedFile) === JSON.stringify(entry.snapshot);
    const nextDirty = { ..._dirtyFiles };
    if (isClean) delete nextDirty[entry.filePath];
    else nextDirty[entry.filePath] = true;
    set({
      _undoStack: _undoStack.slice(0, -1),
      _redoStack: [...get()._redoStack, { filePath: entry.filePath, snapshot: currentFile }],
      files: { ...files, [entry.filePath]: entry.snapshot },
      _dirtyFiles: nextDirty,
    });
  },

  redo: () => {
    const { _redoStack, files, lastSavedFiles, _dirtyFiles } = get();
    if (_redoStack.length === 0) return;
    const entry = _redoStack[_redoStack.length - 1];
    const currentFile = files[entry.filePath];
    if (!currentFile) return;
    const savedFile = lastSavedFiles[entry.filePath];
    const isClean = savedFile && JSON.stringify(savedFile) === JSON.stringify(entry.snapshot);
    const nextDirty = { ..._dirtyFiles };
    if (isClean) delete nextDirty[entry.filePath];
    else nextDirty[entry.filePath] = true;
    set({
      _redoStack: _redoStack.slice(0, -1),
      _undoStack: [...get()._undoStack, { filePath: entry.filePath, snapshot: currentFile }],
      files: { ...files, [entry.filePath]: entry.snapshot },
      _dirtyFiles: nextDirty,
    });
  },

  reset: () => {
    nextNodeId = 1;
    nextEdgeId = 1;
    nextTextNodeId = 1;
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
      _loading: false,
      _error: null,
      sidebarOpen: true,
    });
  },

  openFolder: async () => {
    if (!('showDirectoryPicker' in window)) {
      set({ _error: 'Your browser does not support folder access. Please use Chrome or Edge.' });
      return;
    }
    const dirHandle = await openFolderPicker();
    if (!dirHandle) return;
    set({ _loading: true, _error: null });
    try {
      const scanned = await scanFolder(dirHandle);
      const files: Record<string, CodeCanvasFile> = {};
      const handles: Record<string, FileSystemFileHandle> = {};
      const lastSaved: Record<string, CodeCanvasFile> = {};
      for (const s of scanned) {
        const migrated = deduplicateNodes(migrateFile(s.file));
        files[s.relativePath] = migrated;
        handles[s.relativePath] = s.handle;
        lastSaved[s.relativePath] = migrated;
      }
      syncIdCounters(files);
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
        _loading: false,
      });
    } catch (err) {
      set({ _loading: false, _error: `Failed to open folder: ${(err as Error).message}` });
    }
  },

  refreshFolder: async () => {
    const { folderHandle, files, fileHandles, lastSavedFiles, _dirtyFiles, activeFilePath } = get();
    if (!folderHandle) return;
    set({ _loading: true, _error: null });
    try {
      const scanned = await scanFolder(folderHandle);
      const nextFiles: Record<string, CodeCanvasFile> = {};
      const nextHandles: Record<string, FileSystemFileHandle> = {};
      const nextSaved: Record<string, CodeCanvasFile> = {};
      const nextDirty: Record<string, boolean> = {};
      for (const s of scanned) {
        if (files[s.relativePath] && _dirtyFiles[s.relativePath]) {
          nextFiles[s.relativePath] = files[s.relativePath];
          nextHandles[s.relativePath] = fileHandles[s.relativePath] ?? s.handle;
          nextSaved[s.relativePath] = lastSavedFiles[s.relativePath] ?? deduplicateNodes(migrateFile(s.file));
          nextDirty[s.relativePath] = true;
        } else {
          const migrated = deduplicateNodes(migrateFile(s.file));
          nextFiles[s.relativePath] = migrated;
          nextHandles[s.relativePath] = s.handle;
          nextSaved[s.relativePath] = migrated;
        }
      }
      syncIdCounters(nextFiles);
      const nextActive = nextFiles[activeFilePath ?? ''] ? activeFilePath : (Object.keys(nextFiles)[0] ?? null);
      set({
        files: nextFiles,
        fileHandles: nextHandles,
        lastSavedFiles: nextSaved,
        _dirtyFiles: nextDirty,
        activeFilePath: nextActive,
        _loading: false,
      });
    } catch (err) {
      set({ _loading: false, _error: `Failed to refresh folder: ${(err as Error).message}` });
    }
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
    } catch (err) {
      set({ _error: `Failed to create file: ${(err as Error).message}` });
    }
  },

  saveActiveFile: async () => {
    const { activeFilePath, files, fileHandles } = get();
    if (!activeFilePath) return;
    const file = files[activeFilePath];
    const handle = fileHandles[activeFilePath];
    if (!file || !handle) return;
    try {
      await writeToHandle(handle, file);
      const { _dirtyFiles, lastSavedFiles } = get();
      const nextDirty = { ..._dirtyFiles };
      delete nextDirty[activeFilePath];
      set({
        _dirtyFiles: nextDirty,
        lastSavedFiles: { ...lastSavedFiles, [activeFilePath]: JSON.parse(JSON.stringify(file)) },
      });
    } catch (err) {
      set({ _error: `Save failed: ${(err as Error).message}` });
    }
  },

  saveAllFiles: async () => {
    const { files, fileHandles, _dirtyFiles } = get();
    const dirtyPaths = Object.keys(_dirtyFiles);
    if (dirtyPaths.length === 0) return;
    const errors: string[] = [];
    const nextDirty = { ..._dirtyFiles };
    const nextSaved = { ...get().lastSavedFiles };
    for (const fp of dirtyPaths) {
      const file = files[fp];
      const handle = fileHandles[fp];
      if (!file || !handle) continue;
      try {
        await writeToHandle(handle, file);
        delete nextDirty[fp];
        nextSaved[fp] = JSON.parse(JSON.stringify(file));
      } catch (err) {
        errors.push(`${fp}: ${(err as Error).message}`);
      }
    }
    set({ _dirtyFiles: nextDirty, lastSavedFiles: nextSaved });
    if (errors.length > 0) {
      set({ _error: `Save errors: ${errors.join('; ')}` });
    }
  },

  removeFile: async (filePath) => {
    const { folderHandle, files, fileHandles, lastSavedFiles, _dirtyFiles, activeFilePath } = get();
    if (!files[filePath]) return;

    // Delete from disk if we have the handles
    if (folderHandle && fileHandles[filePath]) {
      try {
        // Walk to the parent directory and remove the file entry
        const parts = filePath.split('/');
        const fileName = parts.pop()!;
        let parentDir = folderHandle;
        for (const part of parts) {
          parentDir = await parentDir.getDirectoryHandle(part);
        }
        await parentDir.removeEntry(fileName);
      } catch (err) {
        set({ _error: `Could not delete from disk: ${(err as Error).message}` });
      }
    }

    const nextFiles = { ...files };
    delete nextFiles[filePath];
    const nextHandles = { ...fileHandles };
    delete nextHandles[filePath];
    const nextSaved = { ...lastSavedFiles };
    delete nextSaved[filePath];
    const nextDirty = { ..._dirtyFiles };
    delete nextDirty[filePath];

    // If the removed file was active, switch to another file
    let nextActive = activeFilePath;
    if (activeFilePath === filePath) {
      const remaining = Object.keys(nextFiles);
      nextActive = remaining.length > 0 ? remaining[0] : null;
    }

    set({
      files: nextFiles,
      fileHandles: nextHandles,
      lastSavedFiles: nextSaved,
      _dirtyFiles: nextDirty,
      activeFilePath: nextActive,
    });
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

  addTextNode: (x, y, options) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const nodeId = generateTextNodeId();
      const { parentId, parentType, color, borderStyle, opacity, text = '' } = options ?? {};

      const newNode = {
        id: nodeId,
        type: 'textNode' as const,
        position: { x, y },
        data: {
          text,
          ...(color != null && { color }),
          ...(borderStyle != null && { borderStyle }),
          ...(opacity != null && { opacity }),
        },
      };

      let newEdges = file.edges;
      if (parentId) {
        let targetNodeId = parentId;
        if (parentType === 'edge') {
          const parentEdge = file.edges.find((e) => e.id === parentId);
          if (parentEdge) targetNodeId = parentEdge.source;
        }
        const targetNode = file.nodes.find((n) => n.id === targetNodeId);
        const isLeft = targetNode ? x < targetNode.position.x : false;
        const sourceHandle = isLeft ? 'right' : 'left';
        const targetHandle = isLeft ? 'left' : 'right';
        if (targetNodeId) {
          newEdges = [
            ...file.edges,
            {
              id: generateEdgeId(),
              source: nodeId,
              target: targetNodeId,
              sourceHandle,
              targetHandle,
              type: 'uml' as const,
              data: { relationshipType: 'association' as const },
            },
          ];
        }
      }
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
    updateActiveFile(get, set, (file) => ({
      ...file,
      nodes: file.nodes.filter((n) => n.id !== nodeId),
      edges: file.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
  },

  removeNodes: (nodeIds) => {
    if (nodeIds.length === 0) return;
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const removedIds = new Set(nodeIds);
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
    updateActiveFile(get, set, (file) => ({
      ...file,
      edges: file.edges.filter((e) => e.id !== edgeId),
    }));
  },

  removeEdges: (edgeIds) => {
    if (edgeIds.length === 0) return;
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => {
      const removedEdgeIds = new Set(edgeIds);
      return {
        ...file,
        edges: file.edges.filter((e) => !removedEdgeIds.has(e.id)),
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

  clearError: () => set({ _error: null }),

  renameFile: (newName) => {
    pushUndo(get, set);
    updateActiveFile(get, set, (file) => ({
      ...file,
      name: newName,
    }));
  },
}));
