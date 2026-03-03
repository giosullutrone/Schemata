# File Tree Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the toolbar with a collapsible left sidebar containing a canvas/node tree, file operations, and drag-and-drop management; add a floating settings gear for snap/color mode.

**Architecture:** The sidebar reads from the Zustand store and communicates with the ReactFlow canvas via `useReactFlow()`. New store methods handle node transfer between canvases and canvas reordering. The sidebar lives inside `ReactFlowProvider` so it can pan/select nodes. Native HTML5 drag events handle all DnD.

**Tech Stack:** React 19, Zustand 5, @xyflow/react v12, vanilla CSS with CSS custom properties, native HTML5 Drag and Drop API.

**Design doc:** `docs/plans/2026-03-03-file-tree-sidebar-design.md`

---

## Task 1: Store — Add `moveNodeToCanvas`, `reorderCanvases`, `sidebarOpen`, `fileHandle`

**Files:**
- Modify: `src/store/useCanvasStore.ts`
- Test: `src/store/useCanvasStore.test.ts`

**Step 1: Write the failing tests**

Add to `src/store/useCanvasStore.test.ts` (after the existing `groupSelectedNodes` tests, before the `preserve other edge data` test around line 260):

```typescript
it('should move a node to another canvas', () => {
  const { addClassNode, addCanvas } = useCanvasStore.getState();
  addClassNode(100, 200);
  addCanvas('second', 'Second');
  const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;

  useCanvasStore.getState().moveNodeToCanvas(nodeId, 'main', 'second');

  expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  expect(useCanvasStore.getState().file.canvases.second.nodes).toHaveLength(1);
  expect(useCanvasStore.getState().file.canvases.second.nodes[0].id).toBe(nodeId);
  expect(useCanvasStore.getState().file.canvases.second.nodes[0].position).toEqual({ x: 0, y: 0 });
});

it('should remove edges connected to moved node', () => {
  const { addClassNode, addEdge, addCanvas } = useCanvasStore.getState();
  addClassNode(0, 0);
  addClassNode(100, 0);
  const nodes = useCanvasStore.getState().file.canvases.main.nodes;
  addEdge(nodes[0].id, nodes[1].id, 'dependency');
  addCanvas('second', 'Second');

  useCanvasStore.getState().moveNodeToCanvas(nodes[0].id, 'main', 'second');

  expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
  expect(useCanvasStore.getState().file.canvases.second.edges).toHaveLength(0);
});

it('should cascade-remove annotations when moving their parent node', () => {
  const { addClassNode, addAnnotation, addCanvas } = useCanvasStore.getState();
  addClassNode(0, 0);
  const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;
  addAnnotation(nodeId, 'node', 200, 0);
  addCanvas('second', 'Second');

  useCanvasStore.getState().moveNodeToCanvas(nodeId, 'main', 'second');

  // Parent + annotation both move; annotation edges cleaned
  expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
  // Only the class node moves; annotation stays removed (it's parented)
  const secondNodes = useCanvasStore.getState().file.canvases.second.nodes;
  expect(secondNodes).toHaveLength(1);
  expect(secondNodes[0].type).toBe('classNode');
});

it('should reorder canvases', () => {
  const { addCanvas } = useCanvasStore.getState();
  addCanvas('second', 'Second');
  addCanvas('third', 'Third');

  useCanvasStore.getState().reorderCanvases(['third', 'main', 'second']);

  const keys = Object.keys(useCanvasStore.getState().file.canvases);
  expect(keys).toEqual(['third', 'main', 'second']);
});

it('should toggle sidebar open state', () => {
  expect(useCanvasStore.getState().sidebarOpen).toBe(true);
  useCanvasStore.getState().setSidebarOpen(false);
  expect(useCanvasStore.getState().sidebarOpen).toBe(false);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/useCanvasStore.test.ts`
Expected: FAIL — `moveNodeToCanvas`, `reorderCanvases`, `sidebarOpen`, `setSidebarOpen` not defined

**Step 3: Add interface fields and state**

In `src/store/useCanvasStore.ts`, add to the `CanvasStore` interface (after line 119, before the closing `}`):

```typescript
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  fileHandle: FileSystemFileHandle | null;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;

  // Cross-canvas operations
  moveNodeToCanvas: (nodeId: string, fromCanvasId: string, toCanvasId: string) => void;
  reorderCanvases: (orderedIds: string[]) => void;
```

Add initial state values in the `create` call (after `_redoStack: [],` at line 126):

```typescript
  sidebarOpen: true,
  fileHandle: null,
```

Add the `setSidebarOpen` implementation (after the `saveViewport` method):

```typescript
  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },

  setFileHandle: (handle) => {
    set({ fileHandle: handle });
  },
```

Add `reset` update — add `sidebarOpen: true, fileHandle: null` to the reset `set()` call.

Add `moveNodeToCanvas` implementation:

```typescript
  moveNodeToCanvas: (nodeId, fromCanvasId, toCanvasId) => {
    if (fromCanvasId === toCanvasId) return;
    pushUndo(get, set);
    const { file } = get();
    const fromCanvas = file.canvases[fromCanvasId];
    const toCanvas = file.canvases[toCanvasId];
    if (!fromCanvas || !toCanvas) return;

    const node = fromCanvas.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Collect IDs to remove: the node + any child annotations
    const removedIds = new Set([nodeId]);
    for (const n of fromCanvas.nodes) {
      if (n.type === 'annotationNode' && n.data.parentId === nodeId) {
        removedIds.add(n.id);
      }
    }

    // Move only the target node (not annotations) to target canvas at origin
    const movedNode = { ...node, position: { x: 0, y: 0 } };

    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [fromCanvasId]: {
            ...fromCanvas,
            nodes: fromCanvas.nodes.filter((n) => !removedIds.has(n.id)),
            edges: fromCanvas.edges.filter(
              (e) => !removedIds.has(e.source) && !removedIds.has(e.target)
            ),
          },
          [toCanvasId]: {
            ...toCanvas,
            nodes: [...toCanvas.nodes, movedNode],
          },
        },
      },
    });
  },
```

Add `reorderCanvases` implementation:

```typescript
  reorderCanvases: (orderedIds) => {
    pushUndo(get, set);
    const { file } = get();
    const reordered: Record<string, typeof file.canvases[string]> = {};
    for (const id of orderedIds) {
      if (file.canvases[id]) {
        reordered[id] = file.canvases[id];
      }
    }
    set({ file: { ...file, canvases: reordered } });
  },
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/useCanvasStore.test.ts`
Expected: All tests PASS

**Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/store/useCanvasStore.ts src/store/useCanvasStore.test.ts
git commit -m "feat(store): add moveNodeToCanvas, reorderCanvases, sidebar state"
```

---

## Task 2: SettingsPopover Component

**Files:**
- Create: `src/components/SettingsPopover.tsx`
- Create: `src/components/SettingsPopover.css`

**Step 1: Create `src/components/SettingsPopover.css`**

```css
.settings-popover-container {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

.settings-popover-trigger {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border-secondary);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.settings-popover-trigger:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-popover-panel {
  position: absolute;
  top: 40px;
  right: 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  box-shadow: 0 2px 12px var(--shadow-heavy);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.settings-popover-item {
  padding: 6px 12px;
  border: none;
  background: none;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
  font-family: inherit;
}

.settings-popover-item:hover {
  background: var(--bg-hover);
}

.settings-popover-item .settings-value {
  color: var(--text-muted);
  margin-left: 4px;
}
```

**Step 2: Create `src/components/SettingsPopover.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';
import './SettingsPopover.css';

type ColorModeSetting = 'light' | 'dark' | 'system';
type SnapMode = 'grid' | 'guides' | 'none';

interface SettingsPopoverProps {
  colorMode: ColorModeSetting;
  onColorModeChange: (mode: ColorModeSetting) => void;
  snapMode: SnapMode;
  onSnapCycle: () => void;
}

export default function SettingsPopover({ colorMode, onColorModeChange, snapMode, onSnapCycle }: SettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const cycleColorMode = () => {
    const next: Record<ColorModeSetting, ColorModeSetting> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    onColorModeChange(next[colorMode]);
  };

  return (
    <div className="settings-popover-container" ref={ref}>
      <button
        className="settings-popover-trigger"
        onClick={() => setOpen(!open)}
        title="Settings"
      >
        ⚙
      </button>
      {open && (
        <div className="settings-popover-panel">
          <button className="settings-popover-item" onClick={onSnapCycle}>
            Snap<span className="settings-value">
              {snapMode === 'grid' ? 'Grid' : snapMode === 'guides' ? 'Guides' : 'Off'}
            </span>
          </button>
          <button className="settings-popover-item" onClick={cycleColorMode}>
            Theme<span className="settings-value">
              {colorMode === 'light' ? 'Light' : colorMode === 'dark' ? 'Dark' : 'System'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/SettingsPopover.tsx src/components/SettingsPopover.css
git commit -m "feat: add SettingsPopover component for snap/color mode"
```

---

## Task 3: Sidebar Component — Header + File Operations + Basic Tree (no DnD, no context menu)

This is the largest task. Build the sidebar shell with the tree view, canvas switching, node click-to-navigate, and inline canvas creation. DnD and sidebar context menus come in later tasks.

**Files:**
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/Sidebar.css`

**Step 1: Create `src/components/Sidebar.css`**

```css
.sidebar {
  width: 240px;
  height: 100%;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-secondary);
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  transition: width 0.15s ease;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 0;
  border-right: none;
}

.sidebar-toggle-tab {
  position: absolute;
  left: 0;
  top: 12px;
  z-index: 100;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-secondary);
  border-left: none;
  border-radius: 0 4px 4px 0;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.sidebar-toggle-tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* --- Header --- */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-secondary);
  min-height: 40px;
}

.sidebar-header-toggle {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 2px;
  line-height: 1;
  flex-shrink: 0;
}

.sidebar-header-toggle:hover {
  color: var(--text-primary);
}

.sidebar-project-name {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
}

.sidebar-project-name-input {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  padding: 1px 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  min-width: 0;
}

.sidebar-save-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  flex-shrink: 0;
}

.sidebar-save-btn:hover {
  color: var(--text-primary);
}

/* --- Action Row --- */
.sidebar-actions {
  display: flex;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-secondary);
}

.sidebar-action-btn {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
  white-space: nowrap;
}

.sidebar-action-btn:hover {
  background: var(--bg-hover);
}

/* --- Tree --- */
.sidebar-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.sidebar-canvas-row {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  cursor: pointer;
  gap: 4px;
  user-select: none;
}

.sidebar-canvas-row:hover {
  background: var(--bg-hover);
}

.sidebar-canvas-row.active {
  background: var(--bg-active);
  font-weight: 600;
}

.sidebar-canvas-row.drag-over {
  background: var(--bg-active);
}

.sidebar-canvas-chevron {
  width: 16px;
  font-size: 10px;
  color: var(--text-muted);
  text-align: center;
  flex-shrink: 0;
}

.sidebar-canvas-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-canvas-name-input {
  flex: 1;
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  min-width: 0;
}

.sidebar-node-row {
  display: flex;
  align-items: center;
  padding: 3px 10px 3px 30px;
  cursor: pointer;
  gap: 6px;
  user-select: none;
}

.sidebar-node-row:hover {
  background: var(--bg-hover);
}

.sidebar-node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-node-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1.2;
}

.sidebar-node-badge.class {
  background: #4A90D933;
  color: #4A90D9;
}

.sidebar-node-badge.annotation {
  background: #F39C1233;
  color: #F39C12;
}

.sidebar-node-badge.group {
  background: #2ECC7133;
  color: #2ECC71;
}

.sidebar-drop-indicator {
  height: 2px;
  background: var(--guide-color);
  margin: 0 10px;
}

/* --- Sidebar context menu --- */
.sidebar-context-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  box-shadow: 0 2px 12px var(--shadow-heavy);
  min-width: 140px;
  z-index: 1001;
  padding: 4px 0;
  font-size: 12px;
}
```

**Step 2: Create `src/components/Sidebar.tsx`**

```tsx
import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../store/useCanvasStore';
import { saveToFileSystem, loadFromFileSystem, writeToHandle } from '../utils/fileIO';
import './Sidebar.css';

const COLORS = ['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'];

function getNodeDisplayName(node: { type?: string; data: Record<string, unknown> }): string {
  if (node.type === 'classNode') return (node.data.name as string) || 'Class';
  if (node.type === 'annotationNode') return (node.data.comment as string) || 'Comment';
  if (node.type === 'groupNode') return (node.data.label as string) || 'Group';
  return 'Node';
}

function getNodeBadge(type?: string): { label: string; className: string } {
  if (type === 'classNode') return { label: 'C', className: 'class' };
  if (type === 'annotationNode') return { label: 'A', className: 'annotation' };
  if (type === 'groupNode') return { label: 'G', className: 'group' };
  return { label: '?', className: '' };
}

export default function Sidebar() {
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);
  const sidebarOpen = useCanvasStore((s) => s.sidebarOpen);
  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);
  const setCurrentCanvas = useCanvasStore((s) => s.setCurrentCanvas);
  const addCanvas = useCanvasStore((s) => s.addCanvas);
  const removeCanvas = useCanvasStore((s) => s.removeCanvas);
  const renameCanvas = useCanvasStore((s) => s.renameCanvas);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const moveNodeToCanvas = useCanvasStore((s) => s.moveNodeToCanvas);
  const reorderCanvases = useCanvasStore((s) => s.reorderCanvases);
  const fileHandle = useCanvasStore((s) => s.fileHandle);
  const setFileHandle = useCanvasStore((s) => s.setFileHandle);
  const loadFile = useCanvasStore((s) => s.loadFile);
  const saveViewport = useCanvasStore((s) => s.saveViewport);

  const { getViewport, setCenter, setNodes } = useReactFlow();

  // --- Project name editing ---
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(file.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  const commitName = useCallback(() => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== file.name) {
      useCanvasStore.setState((state) => ({
        file: { ...state.file, name: trimmed },
      }));
    }
  }, [nameDraft, file.name]);

  // --- New canvas inline creation ---
  const [creatingCanvas, setCreatingCanvas] = useState(false);
  const [newCanvasDraft, setNewCanvasDraft] = useState('');
  const newCanvasInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingCanvas && newCanvasInputRef.current) newCanvasInputRef.current.focus();
  }, [creatingCanvas]);

  const commitNewCanvas = useCallback(() => {
    setCreatingCanvas(false);
    const name = newCanvasDraft.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    addCanvas(id, name);
    saveViewport(getViewport());
    setCurrentCanvas(id);
    setNewCanvasDraft('');
  }, [newCanvasDraft, addCanvas, setCurrentCanvas, saveViewport, getViewport]);

  // --- Canvas renaming ---
  const [renamingCanvasId, setRenamingCanvasId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingCanvasId && renameInputRef.current) renameInputRef.current.focus();
  }, [renamingCanvasId]);

  const commitRename = useCallback(() => {
    if (renamingCanvasId && renameDraft.trim()) {
      renameCanvas(renamingCanvasId, renameDraft.trim());
    }
    setRenamingCanvasId(null);
  }, [renamingCanvasId, renameDraft, renameCanvas]);

  // --- File operations ---
  const handleSave = useCallback(async () => {
    const currentFile = useCanvasStore.getState().file;
    if (fileHandle) {
      await writeToHandle(fileHandle, currentFile);
    } else {
      const handle = await saveToFileSystem(currentFile);
      if (handle) setFileHandle(handle);
    }
  }, [fileHandle, setFileHandle]);

  const handleLoad = useCallback(async () => {
    const result = await loadFromFileSystem();
    if (result) {
      loadFile(result.file);
      setFileHandle(result.handle);
    }
  }, [loadFile, setFileHandle]);

  // --- Canvas switching ---
  const handleCanvasClick = useCallback(
    (id: string) => {
      if (id === currentCanvasId) return;
      saveViewport(getViewport());
      setCurrentCanvas(id);
    },
    [currentCanvasId, setCurrentCanvas, saveViewport, getViewport]
  );

  // --- Node click: pan + select ---
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const canvas = useCanvasStore.getState().file.canvases[currentCanvasId];
      if (!canvas) return;
      const node = canvas.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      // Pan to node center (approximate 200x150 for measured size)
      setCenter(node.position.x + 100, node.position.y + 75, { duration: 300 });
      // Select only this node
      setNodes((nodes) =>
        nodes.map((n) => ({ ...n, selected: n.id === nodeId }))
      );
    },
    [currentCanvasId, setCenter, setNodes]
  );

  // --- Sidebar context menu ---
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    kind: 'canvas' | 'node';
    canvasId: string;
    nodeId?: string;
    nodeType?: string;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ctxMenu]);

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent, canvasId: string) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'canvas', canvasId });
    },
    []
  );

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, canvasId: string, nodeId: string, nodeType?: string) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'node', canvasId, nodeId, nodeType });
    },
    []
  );

  // --- DnD state ---
  const [dragType, setDragType] = useState<'canvas' | 'node' | null>(null);
  const [dragCanvasId, setDragCanvasId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dropTargetCanvasId, setDropTargetCanvasId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);

  const canvasIds = Object.keys(file.canvases);

  // Canvas drag
  const handleCanvasDragStart = useCallback(
    (e: React.DragEvent, canvasId: string) => {
      setDragType('canvas');
      setDragCanvasId(canvasId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', canvasId);
    },
    []
  );

  const handleCanvasDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (dragType !== 'canvas') {
        // Node being dragged over a canvas row
        if (dragType === 'node') {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropTargetCanvasId(canvasIds[index]);
          setDropInsertIndex(null);
        }
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDropInsertIndex(e.clientY < midY ? index : index + 1);
      setDropTargetCanvasId(null);
    },
    [dragType, canvasIds]
  );

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dragType === 'canvas' && dragCanvasId && dropInsertIndex !== null) {
        const newOrder = canvasIds.filter((id) => id !== dragCanvasId);
        const adjustedIndex = dropInsertIndex > canvasIds.indexOf(dragCanvasId)
          ? dropInsertIndex - 1
          : dropInsertIndex;
        newOrder.splice(adjustedIndex, 0, dragCanvasId);
        reorderCanvases(newOrder);
      }
      if (dragType === 'node' && dragNodeId && dropTargetCanvasId) {
        moveNodeToCanvas(dragNodeId, currentCanvasId, dropTargetCanvasId);
      }
      setDragType(null);
      setDragCanvasId(null);
      setDragNodeId(null);
      setDropTargetCanvasId(null);
      setDropInsertIndex(null);
    },
    [dragType, dragCanvasId, dragNodeId, dropInsertIndex, dropTargetCanvasId, canvasIds, reorderCanvases, moveNodeToCanvas, currentCanvasId]
  );

  const handleDragEnd = useCallback(() => {
    setDragType(null);
    setDragCanvasId(null);
    setDragNodeId(null);
    setDropTargetCanvasId(null);
    setDropInsertIndex(null);
  }, []);

  // Node drag
  const handleNodeDragStart = useCallback(
    (e: React.DragEvent, nodeId: string) => {
      e.stopPropagation();
      setDragType('node');
      setDragNodeId(nodeId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', nodeId);
    },
    []
  );

  // --- Render ---
  const currentCanvas = file.canvases[currentCanvasId];

  if (!sidebarOpen) {
    return (
      <button className="sidebar-toggle-tab" onClick={() => setSidebarOpen(true)} title="Open sidebar (Ctrl+B)">
        ☰
      </button>
    );
  }

  return (
    <>
      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <button className="sidebar-header-toggle" onClick={() => setSidebarOpen(false)} title="Close sidebar (Ctrl+B)">
            ☰
          </button>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="sidebar-project-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingName(false);
              }}
            />
          ) : (
            <span
              className="sidebar-project-name"
              onDoubleClick={() => { setNameDraft(file.name); setEditingName(true); }}
              title={file.name}
            >
              {file.name}
            </span>
          )}
          <button className="sidebar-save-btn" onClick={handleSave} title="Save (Ctrl+S)">
            💾
          </button>
        </div>

        {/* Action Row */}
        <div className="sidebar-actions">
          <button
            className="sidebar-action-btn"
            onClick={() => { setNewCanvasDraft(''); setCreatingCanvas(true); }}
          >
            + Canvas
          </button>
          <button className="sidebar-action-btn" onClick={handleLoad}>
            Open
          </button>
        </div>

        {/* Tree */}
        <div className="sidebar-tree">
          {creatingCanvas && (
            <div className="sidebar-canvas-row">
              <span className="sidebar-canvas-chevron">▶</span>
              <input
                ref={newCanvasInputRef}
                className="sidebar-canvas-name-input"
                value={newCanvasDraft}
                placeholder="Canvas name..."
                onChange={(e) => setNewCanvasDraft(e.target.value)}
                onBlur={() => { if (newCanvasDraft.trim()) commitNewCanvas(); else setCreatingCanvas(false); }}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') commitNewCanvas();
                  if (e.key === 'Escape') setCreatingCanvas(false);
                }}
              />
            </div>
          )}
          {canvasIds.map((canvasId, index) => {
            const canvas = file.canvases[canvasId];
            const isActive = canvasId === currentCanvasId;
            const isDropTarget = dropTargetCanvasId === canvasId && dragType === 'node';

            return (
              <div key={canvasId}>
                {dropInsertIndex === index && dragType === 'canvas' && (
                  <div className="sidebar-drop-indicator" />
                )}
                <div
                  className={`sidebar-canvas-row${isActive ? ' active' : ''}${isDropTarget ? ' drag-over' : ''}`}
                  onClick={() => handleCanvasClick(canvasId)}
                  onContextMenu={(e) => handleCanvasContextMenu(e, canvasId)}
                  draggable
                  onDragStart={(e) => handleCanvasDragStart(e, canvasId)}
                  onDragOver={(e) => handleCanvasDragOver(e, index)}
                  onDrop={handleCanvasDrop}
                  onDragEnd={handleDragEnd}
                >
                  <span className="sidebar-canvas-chevron">{isActive ? '▼' : '▶'}</span>
                  {renamingCanvasId === canvasId ? (
                    <input
                      ref={renameInputRef}
                      className="sidebar-canvas-name-input"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingCanvasId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="sidebar-canvas-name">{canvas.name}</span>
                  )}
                </div>

                {/* Node children — only for active canvas */}
                {isActive && currentCanvas && currentCanvas.nodes.map((node) => {
                  const badge = getNodeBadge(node.type);
                  return (
                    <div
                      key={node.id}
                      className="sidebar-node-row"
                      onClick={() => handleNodeClick(node.id)}
                      onContextMenu={(e) => handleNodeContextMenu(e, canvasId, node.id, node.type)}
                      draggable
                      onDragStart={(e) => handleNodeDragStart(e, node.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className="sidebar-node-name">{getNodeDisplayName(node)}</span>
                      <span className={`sidebar-node-badge ${badge.className}`}>{badge.label}</span>
                    </div>
                  );
                })}

                {/* Drop indicator after last canvas */}
                {dropInsertIndex === index + 1 && dragType === 'canvas' && index === canvasIds.length - 1 && (
                  <div className="sidebar-drop-indicator" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar context menu */}
      {ctxMenu && (
        <div
          className="sidebar-context-menu"
          ref={ctxMenuRef}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {ctxMenu.kind === 'canvas' && (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  setRenameDraft(file.canvases[ctxMenu.canvasId]?.name || '');
                  setRenamingCanvasId(ctxMenu.canvasId);
                  setCtxMenu(null);
                }}
              >
                Rename
              </div>
              {canvasIds.length > 1 && (
                <div
                  className="context-menu-item danger"
                  onClick={() => {
                    removeCanvas(ctxMenu.canvasId);
                    setCtxMenu(null);
                  }}
                >
                  Delete
                </div>
              )}
            </>
          )}
          {ctxMenu.kind === 'node' && ctxMenu.nodeId && (
            <>
              <div className="context-menu-color-row">
                {COLORS.map((color) => (
                  <div
                    key={color}
                    className="context-menu-color-swatch"
                    style={{ background: color }}
                    onClick={() => {
                      updateNodeData(ctxMenu.nodeId!, { color });
                      setCtxMenu(null);
                    }}
                  />
                ))}
              </div>
              <div className="context-menu-separator" />
              {ctxMenu.nodeType === 'classNode' && (
                <>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      updateNodeData(ctxMenu.nodeId!, { stereotype: 'interface' });
                      setCtxMenu(null);
                    }}
                  >
                    Set stereotype
                  </div>
                  <div className="context-menu-separator" />
                </>
              )}
              <div
                className="context-menu-item danger"
                onClick={() => {
                  removeNode(ctxMenu.nodeId!);
                  setCtxMenu(null);
                }}
              >
                Delete
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
```

**Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Sidebar.css
git commit -m "feat: add Sidebar component with tree, file ops, DnD, and context menus"
```

---

## Task 4: Rewire App.tsx — Replace Toolbar with Sidebar + SettingsPopover

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update imports**

Replace:
```typescript
import Toolbar from './components/Toolbar';
```
With:
```typescript
import Sidebar from './components/Sidebar';
import SettingsPopover from './components/SettingsPopover';
```

**Step 2: Move `Ctrl+S` handler to App**

The `Ctrl+S` handler currently lives in Toolbar.tsx. Add it to the existing keyboard shortcut `useEffect` in App (around line 571-584). Extend the handler:

```typescript
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const store = useCanvasStore.getState();
        const currentFile = store.file;
        const handle = store.fileHandle;
        if (handle) {
          writeToHandle(handle, currentFile);
        } else {
          saveToFileSystem(currentFile).then((h) => {
            if (h) store.setFileHandle(h);
          });
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        const store = useCanvasStore.getState();
        store.setSidebarOpen(!store.sidebarOpen);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);
```

Add the import at the top:
```typescript
import { saveToFileSystem, writeToHandle } from './utils/fileIO';
```

(Note: `deserializeFile` and `validateFile` are already imported for drag-drop.)

**Step 3: Update the layout in the return JSX**

Replace the current layout (around line 613-627):

```tsx
  return (
    <div
      className={resolvedDark ? 'dark' : ''}
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlowProvider>
        <Sidebar />
        <div style={{ flex: 1, position: 'relative' }}>
          <FlowCanvas colorMode={colorMode} snapMode={snapMode} />
          <SettingsPopover
            colorMode={colorMode}
            onColorModeChange={handleColorModeChange}
            snapMode={snapMode}
            onSnapCycle={handleSnapCycle}
          />
        </div>
      </ReactFlowProvider>
    </div>
  );
```

Key changes:
- `flexDirection` changes from `'column'` to `'row'` (sidebar is on the left, canvas on the right)
- `<Toolbar ... />` is removed
- `<Sidebar />` added inside `ReactFlowProvider`
- Canvas wrapper gets `position: relative` for the absolute-positioned SettingsPopover
- `<SettingsPopover />` is placed inside the canvas wrapper

**Step 4: Remove unused imports**

Remove:
```typescript
import Toolbar from './components/Toolbar';
```

Add (if not already present):
```typescript
import { saveToFileSystem, writeToHandle } from './utils/fileIO';
```

The existing import `import { deserializeFile, validateFile } from './utils/fileIO';` should be updated to:
```typescript
import { deserializeFile, validateFile, saveToFileSystem, writeToHandle } from './utils/fileIO';
```

**Step 5: Type-check and test**

Run: `npx tsc --noEmit`
Expected: No errors (Toolbar imports in tests don't exist — Toolbar isn't tested directly)

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace toolbar with sidebar + settings popover in App layout"
```

---

## Task 5: Delete Old Toolbar and CanvasSelector

**Files:**
- Delete: `src/components/Toolbar.tsx`
- Delete: `src/components/Toolbar.css`
- Delete: `src/components/CanvasSelector.tsx`
- Delete: `src/components/CanvasSelector.css`

**Step 1: Verify no remaining imports**

Run: `grep -r "Toolbar\|CanvasSelector" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules`

Expected: No results (App.tsx was updated in Task 4 to remove the Toolbar import; CanvasSelector was only imported by Toolbar)

**Step 2: Delete files**

```bash
rm src/components/Toolbar.tsx src/components/Toolbar.css
rm src/components/CanvasSelector.tsx src/components/CanvasSelector.css
```

**Step 3: Final verification**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: No type errors, all tests pass, build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Toolbar and CanvasSelector (replaced by Sidebar)"
```

---

## Task 6: Polish and Integration Testing

**Files:**
- Possibly modify: `src/components/Sidebar.tsx`, `src/components/Sidebar.css`

**Step 1: Manual testing checklist**

Run: `npx vite` and test in browser:

1. Sidebar appears on the left, canvas fills remaining space
2. Toggle sidebar with `Ctrl+B` — collapses/expands with transition
3. Collapsed state shows `☰` tab on left edge
4. Project name editable on double-click
5. Save button works (and `Ctrl+S`)
6. Open button loads a file
7. "+ Canvas" creates a new canvas with inline name input
8. Click canvas row to switch canvases
9. Right-click canvas → Rename / Delete
10. Nodes listed under active canvas with correct badges (C/A/G)
11. Click node → canvas pans to it and selects it
12. Right-click node → color swatches, set stereotype (class only), delete
13. Drag canvas row to reorder
14. Drag node row onto different canvas row to move it
15. Settings gear in top-right shows snap + color mode popover
16. Dark mode works correctly (sidebar uses CSS vars)
17. Drag-and-drop file loading still works

**Step 2: Fix any issues found**

Address styling tweaks or interaction bugs.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: file tree sidebar — polish and integration fixes"
```

---

## Summary of All Files

| File | Action |
|------|--------|
| `src/store/useCanvasStore.ts` | Modify — add `moveNodeToCanvas`, `reorderCanvases`, `sidebarOpen`, `fileHandle` |
| `src/store/useCanvasStore.test.ts` | Modify — add 5 new tests |
| `src/components/SettingsPopover.tsx` | Create |
| `src/components/SettingsPopover.css` | Create |
| `src/components/Sidebar.tsx` | Create |
| `src/components/Sidebar.css` | Create |
| `src/App.tsx` | Modify — new layout, `Ctrl+B`/`Ctrl+S`, remove Toolbar |
| `src/components/Toolbar.tsx` | Delete |
| `src/components/Toolbar.css` | Delete |
| `src/components/CanvasSelector.tsx` | Delete |
| `src/components/CanvasSelector.css` | Delete |
