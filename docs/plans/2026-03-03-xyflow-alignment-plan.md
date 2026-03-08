# xyflow Standard Alignment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align Schemata with standard @xyflow/react patterns — fix edge architecture, add missing handlers/components, and add dark mode.

**Architecture:** Refactor edge type system from 6 identical mappings to single `uml` type with `data.relationshipType`. Add standard ReactFlow components (Background, Controls, MiniMap). Add `onEdgesChange` + `onReconnect` handlers. Add dark mode via ReactFlow's built-in `colorMode` + CSS custom properties for our components.

**Tech Stack:** @xyflow/react 12, React 19, Zustand 5, TypeScript, Vitest

---

### Task 1: Schema — Add `relationshipType` to edge data, add viewport to canvas

**Files:**
- Modify: `src/types/schema.ts`
- Modify: `src/types/schema.test.ts`

**Step 1: Update schema types**

In `src/types/schema.ts`:

Change `ClassEdgeData` to add `relationshipType`:

```ts
export interface ClassEdgeData {
  [key: string]: unknown;
  relationshipType: RelationshipType;
  label?: string;
  comment?: string;
  color?: string;
}
```

Change `ClassEdgeSchema.type` from `RelationshipType` to `'uml'`:

```ts
export interface ClassEdgeSchema {
  id: string;
  source: string;
  target: string;
  type: 'uml';
  data: ClassEdgeData;
}
```

Add `viewport` to `CanvasData`:

```ts
export interface CanvasData {
  name: string;
  nodes: ClassNodeSchema[];
  edges: ClassEdgeSchema[];
  viewport?: { x: number; y: number; zoom: number };
}
```

**Step 2: Update schema tests**

In `src/types/schema.test.ts`, update the edge in the valid file test:

```ts
edges: [
  {
    id: 'edge-1',
    source: 'class-1',
    target: 'class-2',
    type: 'uml',
    data: { relationshipType: 'dependency', label: 'uses', comment: 'Injected', color: '#E74C3C' },
  },
],
```

**Step 3: Run tests**

Run: `npm test`
Expected: All schema tests pass. Store tests may fail (expected — we'll fix in Task 2).

**Step 4: Commit**

```
feat: update schema — single uml edge type, viewport field, relationshipType in data
```

---

### Task 2: Store — Migrate edge methods + add `setCanvasEdges` + viewport methods

**Files:**
- Modify: `src/store/useCanvasStore.ts`
- Modify: `src/store/useCanvasStore.test.ts`
- Modify: `src/store/undoMiddleware.test.ts`

**Step 1: Update store edge methods**

In `src/store/useCanvasStore.ts`:

Add `ClassEdgeSchema` to imports:

```ts
import type {
  SchemataFile,
  ClassNodeData,
  ClassEdgeData,
  ClassNodeSchema,
  ClassEdgeSchema,
  RelationshipType,
} from '../types/schema';
```

Add new interface methods:

```ts
setCanvasEdges: (edges: ClassEdgeSchema[]) => void;
saveViewport: (viewport: { x: number; y: number; zoom: number }) => void;
```

Update `addEdge` implementation — set `type: 'uml'`, put relationship in data:

```ts
addEdge: (source, target, type) => {
  pushUndo(get, set);
  const { file, currentCanvasId } = get();
  const canvas = file.canvases[currentCanvasId];
  const newEdge = {
    id: generateEdgeId(),
    source,
    target,
    type: 'uml' as const,
    data: { relationshipType: type, label: type },
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
```

Update `updateEdgeType` — change `data.relationshipType` instead of `type`:

```ts
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
```

Add `setCanvasEdges` (mirrors `setCanvasNodes` — no undo, for ReactFlow `onEdgesChange`):

```ts
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
```

Add `saveViewport`:

```ts
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
```

**Step 2: Update store tests**

In `src/store/useCanvasStore.test.ts`, update the edge assertion tests:

The "should add an edge" test — change assertion from `edges[0].type` to `edges[0].data.relationshipType`:

```ts
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
```

Add test for `updateEdgeType` updating `data.relationshipType`:

```ts
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
```

Add test for `setCanvasEdges`:

```ts
it('should set canvas edges without undo', () => {
  const { addClassNode, addEdge } = useCanvasStore.getState();
  addClassNode(0, 0);
  addClassNode(100, 0);
  const nodes = useCanvasStore.getState().file.canvases.main.nodes;
  addEdge(nodes[0].id, nodes[1].id, 'dependency');

  const edges = useCanvasStore.getState().file.canvases.main.edges;
  useCanvasStore.getState().setCanvasEdges([]);
  expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
  // No undo pushed — undo should not restore edges
  useCanvasStore.getState().undo();
  // Undo restores the addEdge action (which did push undo)
});
```

Add test for `saveViewport`:

```ts
it('should save viewport for current canvas', () => {
  useCanvasStore.getState().saveViewport({ x: 100, y: 200, zoom: 1.5 });
  const canvas = useCanvasStore.getState().file.canvases.main;
  expect(canvas.viewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
});
```

**Step 3: Run tests**

Run: `npm test`
Expected: All store tests and undo tests pass.

**Step 4: Commit**

```
feat: store — single uml edge type, setCanvasEdges, saveViewport
```

---

### Task 3: Edge components — Single edge type + remove useEdges

**Files:**
- Modify: `src/components/edges/index.ts`
- Modify: `src/components/edges/UmlEdge.tsx`

**Step 1: Simplify edge type map**

Replace `src/components/edges/index.ts` entirely:

```ts
import UmlEdge from './UmlEdge';

export const edgeTypes = {
  uml: UmlEdge,
};
```

**Step 2: Update UmlEdge to read from data.relationshipType**

In `src/components/edges/UmlEdge.tsx`:

Remove `useEdges` from imports. Remove the `useEdges()` call and lookup. Read relationship type from `data.relationshipType`:

```ts
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { ClassEdgeData, RelationshipType } from '../../types/schema';
import { useCanvasStore } from '../../store/useCanvasStore';
import './UmlEdge.css';

type ClassEdge = Edge<ClassEdgeData>;

interface UmlEdgeConfig {
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
}

const EDGE_CONFIG: Record<RelationshipType, UmlEdgeConfig> = {
  inheritance: { markerEnd: 'url(#uml-inheritance)' },
  implementation: { strokeDasharray: '6 3', markerEnd: 'url(#uml-implementation)' },
  composition: { markerStart: 'url(#uml-composition)' },
  aggregation: { markerStart: 'url(#uml-aggregation)' },
  dependency: { strokeDasharray: '6 3', markerEnd: 'url(#uml-dependency)' },
  association: { markerEnd: 'url(#uml-association)' },
};

export default function UmlEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: EdgeProps<ClassEdge>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);

  const relationshipType: RelationshipType = data?.relationshipType ?? 'association';
  const config = EDGE_CONFIG[relationshipType] ?? EDGE_CONFIG.association;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = data?.color ?? '#b1b1b7';
  const label = data?.label ?? '';

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitLabel = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== label) {
      updateEdgeData(id, { label: trimmed || undefined });
    }
  }, [draft, label, id, updateEdgeData]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: config.strokeDasharray,
        }}
        markerStart={config.markerStart}
        markerEnd={config.markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          className="uml-edge-label"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            borderColor: selected ? '#1a192b' : 'var(--edge-label-border, #e2e2e2)',
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(label);
            setEditing(true);
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="class-node-inline-input nodrag nopan"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') {
                  setDraft(label);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <span>{label || relationshipType}</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

**Step 3: Run type check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: Clean compile, all tests pass.

**Step 4: Commit**

```
refactor: single uml edge type, remove useEdges() performance issue
```

---

### Task 4: ContextMenu — Update edge type references

**Files:**
- Modify: `src/components/ContextMenu.tsx`

**Step 1: Update ContextMenu**

The `handleChangeType` calls `updateEdgeType` which now updates `data.relationshipType`. No code change needed in ContextMenu — the store method signature hasn't changed.

Verify by reading the code — `updateEdgeType(targetId, newType)` is unchanged.

**Step 2: Update EdgeTypePopup**

No change needed — `onSelect` callback still receives `RelationshipType` and passes it to `addEdge` in App.tsx.

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: Clean.

---

### Task 5: ClassNode — Forward `isConnectable`

**Files:**
- Modify: `src/components/ClassNode.tsx`

**Step 1: Add `isConnectable` to component props and handles**

In the `ClassNodeComponent` function signature, add `isConnectable`:

```ts
function ClassNodeComponent({ id, data, selected, isConnectable }: NodeProps<ClassNodeType>) {
```

Update all 4 Handle components to include `isConnectable`:

```tsx
<Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} />
<Handle type="source" position={Position.Bottom} id="bottom" isConnectable={isConnectable} />
<Handle type="target" position={Position.Left} id="left" isConnectable={isConnectable} />
<Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} />
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Clean.

**Step 3: Commit**

```
fix: forward isConnectable to ClassNode handles
```

---

### Task 6: App.tsx — Add onEdgesChange, onReconnect, standard components, connectionMode

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update imports**

Add new imports from @xyflow/react:

```ts
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge,
  ConnectionMode,
  Background,
  Controls,
  MiniMap,
  type OnConnect,
  type OnReconnect,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
```

**Step 2: Add store selectors and handlers in FlowCanvas**

Add store selectors:

```ts
const setCanvasEdges = useCanvasStore((s) => s.setCanvasEdges);
```

Add `onEdgesChange` handler (mirrors `onNodesChange`):

```ts
const handleEdgesChange = useCallback(
  (changes: EdgeChange[]) => {
    const store = useCanvasStore.getState();
    const currentEdges = store.file.canvases[store.currentCanvasId]?.edges;
    if (!currentEdges) return;
    const updated = applyEdgeChanges(changes, currentEdges) as ClassEdgeSchema[];
    setCanvasEdges(updated);
  },
  [setCanvasEdges]
);
```

Add `onReconnect` handler:

```ts
const handleReconnect: OnReconnect = useCallback(
  (oldEdge, newConnection) => {
    pushUndoSnapshot();
    const store = useCanvasStore.getState();
    const currentEdges = store.file.canvases[store.currentCanvasId]?.edges;
    if (!currentEdges) return;
    const updated = reconnectEdge(oldEdge, newConnection, currentEdges) as ClassEdgeSchema[];
    setCanvasEdges(updated);
  },
  [pushUndoSnapshot, setCanvasEdges]
);
```

**Step 3: Update ReactFlow JSX**

```tsx
<ReactFlow
  nodes={canvas.nodes}
  edges={canvas.edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  onNodesChange={handleNodesChange}
  onEdgesChange={handleEdgesChange}
  onConnect={handleConnect}
  onReconnect={handleReconnect}
  onNodeDragStart={handleNodeDragStart}
  onNodeDrag={handleNodeDrag}
  onNodeDragStop={handleNodeDragStop}
  onNodesDelete={handleNodesDelete}
  onEdgesDelete={handleEdgesDelete}
  onNodeContextMenu={handleNodeContextMenu}
  onEdgeContextMenu={handleEdgeContextMenu}
  onPaneClick={() => setContextMenu(null)}
  onDoubleClick={handlePaneDoubleClick}
  connectionMode={ConnectionMode.Loose}
  snapToGrid
  snapGrid={[20, 20]}
  defaultEdgeOptions={{ type: 'uml' }}
  fitView
  deleteKeyCode="Backspace"
>
  <Background variant="dots" gap={20} />
  <Controls />
  <MiniMap />
</ReactFlow>
```

Note: `<Background>`, `<Controls>`, `<MiniMap>` go INSIDE `<ReactFlow>` as children (not siblings).

Remove `import type { RelationshipType }` if no longer needed at top level (check — it's used in `handleEdgeTypeSelect`). Keep it.

Add `ClassEdgeSchema` to the type import if not already there.

**Step 4: Run type check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: Clean compile, all tests pass.

**Step 5: Commit**

```
feat: add onEdgesChange, onReconnect, Background, Controls, MiniMap, connectionMode loose
```

---

### Task 7: Viewport persistence

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/CanvasSelector.tsx`

**Step 1: Save viewport when switching canvas**

In `src/components/CanvasSelector.tsx`, add viewport saving before switching:

Add `useReactFlow` import and hook:

```ts
import { useReactFlow } from '@xyflow/react';
```

In the component:

```ts
const { getViewport, setViewport } = useReactFlow();
const saveViewport = useCanvasStore((s) => s.saveViewport);
```

Update `handleSelect`:

```ts
const handleSelect = useCallback(
  (id: string) => {
    // Save current canvas viewport before switching
    saveViewport(getViewport());
    setCurrentCanvas(id);
    setOpen(false);
  },
  [setCurrentCanvas, saveViewport, getViewport]
);
```

**Step 2: Restore viewport when canvas changes**

In `src/App.tsx`, in `FlowCanvas`, add viewport restoration when `currentCanvasId` changes:

```ts
const { screenToFlowPosition, setViewport } = useReactFlow();
```

Add effect to restore viewport:

```ts
useEffect(() => {
  if (canvas?.viewport) {
    setViewport(canvas.viewport);
  }
}, [currentCanvasId]);
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: Clean.

**Step 4: Commit**

```
feat: save and restore viewport per canvas
```

---

### Task 8: Dark mode — State, toggle, ReactFlow colorMode

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Toolbar.tsx`

**Step 1: Add colorMode state to App**

In `src/App.tsx`, in the `App` component:

```ts
type ColorModeSetting = 'light' | 'dark' | 'system';

const [colorMode, setColorMode] = useState<ColorModeSetting>(() => {
  return (localStorage.getItem('schemata-color-mode') as ColorModeSetting) || 'system';
});

const handleColorModeChange = useCallback((mode: ColorModeSetting) => {
  setColorMode(mode);
  localStorage.setItem('schemata-color-mode', mode);
}, []);
```

Pass `colorMode` into the ReactFlowProvider area and to Toolbar:

```tsx
<Toolbar colorMode={colorMode} onColorModeChange={handleColorModeChange} />
```

And pass `colorMode` to FlowCanvas:

```tsx
<FlowCanvas colorMode={colorMode} />
```

Update `FlowCanvas` to accept and pass `colorMode`:

```ts
function FlowCanvas({ colorMode }: { colorMode: ColorModeSetting }) {
```

Add `colorMode` prop to `<ReactFlow>`:

```tsx
<ReactFlow
  colorMode={colorMode}
  ...
```

**Step 2: Add toggle to Toolbar**

In `src/components/Toolbar.tsx`, add props and toggle button:

```ts
type ColorModeSetting = 'light' | 'dark' | 'system';

interface ToolbarProps {
  colorMode: ColorModeSetting;
  onColorModeChange: (mode: ColorModeSetting) => void;
}

export default function Toolbar({ colorMode, onColorModeChange }: ToolbarProps) {
```

Add a cycle button (light → dark → system → light):

```tsx
<div className="toolbar-separator" />
<button
  className="toolbar-btn"
  onClick={() => {
    const next: Record<ColorModeSetting, ColorModeSetting> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    onColorModeChange(next[colorMode]);
  }}
  title={`Color mode: ${colorMode}`}
>
  {colorMode === 'light' ? 'Light' : colorMode === 'dark' ? 'Dark' : 'System'}
</button>
```

**Step 3: Add dark class to root wrapper**

In `src/App.tsx`, apply a class to the root div so custom components can style themselves:

We need to resolve the actual dark/light value from `'system'`. Add a hook:

```ts
const [resolvedDark, setResolvedDark] = useState(false);

useEffect(() => {
  if (colorMode === 'dark') {
    setResolvedDark(true);
  } else if (colorMode === 'light') {
    setResolvedDark(false);
  } else {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setResolvedDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setResolvedDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }
}, [colorMode]);
```

Apply to root div:

```tsx
<div
  className={resolvedDark ? 'dark' : ''}
  style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}
  ...
>
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: Clean.

**Step 5: Commit**

```
feat: add dark mode toggle with light/dark/system modes
```

---

### Task 9: Dark mode CSS — Custom components

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/ClassNode.css`
- Modify: `src/components/Toolbar.css`
- Modify: `src/components/ContextMenu.css`
- Modify: `src/components/EdgeTypePopup.css`
- Modify: `src/components/CanvasSelector.css`
- Modify: `src/components/edges/UmlEdge.css`
- Modify: `src/components/AlignmentGuides.css`

**Step 1: Add CSS custom properties in index.css**

Add to `src/index.css`:

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #fafafa;
  --bg-hover: #f0f0f0;
  --bg-active: #eef2ff;
  --bg-input: #f5f5ff;
  --bg-comment: #fffef0;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-muted: #888888;
  --border-primary: #d0d0d0;
  --border-secondary: #e2e2e2;
  --border-comment: #e8e4c0;
  --shadow: rgba(0, 0, 0, 0.1);
  --shadow-heavy: rgba(0, 0, 0, 0.15);
  --danger: #cc0000;
  --danger-bg: #fee;
  --node-bg: #ffffff;
  --edge-label-border: #e2e2e2;
  --edge-label-bg: #ffffff;
  --guide-color: #4A90D9;
}

.dark {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-hover: #2a2d2e;
  --bg-active: #2a2d3e;
  --bg-input: #2d2d3a;
  --bg-comment: #2d2c24;
  --text-primary: #cccccc;
  --text-secondary: #999999;
  --text-muted: #777777;
  --border-primary: #444444;
  --border-secondary: #333333;
  --border-comment: #4a4830;
  --shadow: rgba(0, 0, 0, 0.3);
  --shadow-heavy: rgba(0, 0, 0, 0.4);
  --danger: #f44747;
  --danger-bg: #3a2020;
  --node-bg: #2d2d2d;
  --edge-label-border: #444444;
  --edge-label-bg: #2d2d2d;
  --guide-color: #569cd6;
}
```

**Step 2: Update ClassNode.css**

Replace hardcoded colors with CSS variables:

```css
.class-node {
  background: var(--node-bg);
  border: 2px solid var(--border-primary);
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-width: 200px;
  box-shadow: 0 1px 4px var(--shadow);
}

.class-node.selected {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 1px var(--text-primary);
}

.class-node-header {
  padding: 8px 12px;
  text-align: center;
  border-bottom: 1px solid var(--border-secondary);
  position: relative;
}

.class-node-stereotype {
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
}

.class-node-name {
  font-weight: 700;
  font-size: 14px;
  cursor: text;
  color: var(--text-primary);
}

.class-node-comment-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  opacity: 0.3;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.class-node-comment-icon:hover {
  opacity: 1;
  background: var(--bg-hover);
}

.class-node-comment-icon.has-comment {
  opacity: 0.7;
}

.class-node-section {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-secondary);
  min-height: 24px;
}

.class-node-section:last-child {
  border-bottom: none;
}

.class-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  padding: 2px 0;
  position: relative;
  color: var(--text-primary);
}

.class-node-row:hover .class-node-row-remove {
  opacity: 1;
}

.class-node-row-remove {
  position: absolute;
  right: -4px;
  opacity: 0;
  cursor: pointer;
  color: var(--danger);
  font-size: 10px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.class-node-row-remove:hover {
  background: var(--danger-bg);
}

.class-node-row-comment {
  opacity: 0;
  cursor: pointer;
  font-size: 10px;
  margin-left: 2px;
}

.class-node-row:hover .class-node-row-comment {
  opacity: 0.4;
}

.class-node-row-comment.has-comment {
  opacity: 0.7;
}

.class-node-add-btn {
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 0;
  text-align: center;
}

.class-node-add-btn:hover {
  color: var(--text-primary);
}

.class-node-inline-input {
  border: none;
  outline: none;
  background: var(--bg-input);
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  padding: 0;
  width: 100%;
  color: var(--text-primary);
}

.class-node-comment-area {
  background: var(--bg-comment);
  border: 1px solid var(--border-comment);
  border-radius: 3px;
  padding: 6px 8px;
  font-size: 11px;
  font-family: inherit;
  resize: vertical;
  width: 100%;
  min-height: 40px;
  outline: none;
  margin-top: 4px;
  color: var(--text-primary);
}
```

**Step 3: Update Toolbar.css**

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-secondary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  height: 44px;
  flex-shrink: 0;
}

.toolbar-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  border-color: var(--text-muted);
}

.toolbar-separator {
  width: 1px;
  height: 24px;
  background: var(--border-secondary);
}

.toolbar-project-name {
  font-weight: 600;
  margin-right: 8px;
  cursor: text;
  color: var(--text-primary);
}

.toolbar-project-name input {
  border: 1px solid var(--border-primary);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

**Step 4: Update ContextMenu.css**

```css
.context-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  box-shadow: 0 2px 12px var(--shadow-heavy);
  min-width: 160px;
  z-index: 1000;
  padding: 4px 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: var(--text-primary);
}

.context-menu-item {
  padding: 6px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.context-menu-item:hover {
  background: var(--bg-hover);
}

.context-menu-separator {
  height: 1px;
  background: var(--border-secondary);
  margin: 4px 0;
}

.context-menu-item.danger {
  color: var(--danger);
}

.context-menu-color-row {
  display: flex;
  gap: 4px;
  padding: 6px 16px;
}

.context-menu-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--border-primary);
  cursor: pointer;
}

.context-menu-color-swatch:hover {
  border-color: var(--text-primary);
}
```

**Step 5: Update EdgeTypePopup.css**

```css
.edge-type-popup {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  box-shadow: 0 2px 12px var(--shadow-heavy);
  padding: 4px 0;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  min-width: 150px;
  color: var(--text-primary);
}

.edge-type-popup-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.edge-type-popup-item:hover {
  background: var(--bg-hover);
}

.edge-type-popup-item-icon {
  width: 24px;
  font-size: 10px;
  color: var(--text-muted);
}
```

**Step 6: Update CanvasSelector.css**

```css
.canvas-selector {
  position: relative;
}

.canvas-selector-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.canvas-selector-btn:hover {
  background: var(--bg-hover);
}

.canvas-selector-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  box-shadow: 0 2px 8px var(--shadow);
  min-width: 180px;
  z-index: 100;
}

.canvas-selector-item {
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-primary);
}

.canvas-selector-item:hover {
  background: var(--bg-hover);
}

.canvas-selector-item.active {
  background: var(--bg-active);
  font-weight: 600;
}

.canvas-selector-item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
}

.canvas-selector-item:hover .canvas-selector-item-actions {
  opacity: 1;
}

.canvas-selector-item-action {
  font-size: 10px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
}

.canvas-selector-item-action:hover {
  color: var(--text-primary);
}

.canvas-selector-new {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border-top: 1px solid var(--border-secondary);
}

.canvas-selector-new:hover {
  background: var(--bg-hover);
}
```

**Step 7: Update UmlEdge.css**

```css
.uml-edge-label {
  font-size: 11px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--edge-label-bg);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--edge-label-border);
  pointer-events: all;
  cursor: text;
  position: absolute;
  color: var(--text-primary);
}

.uml-edge-label .class-node-comment-icon {
  position: static;
  display: inline;
  margin-left: 4px;
}
```

**Step 8: Update AlignmentGuides.css**

```css
.alignment-guide {
  position: absolute;
  pointer-events: none;
  z-index: 5;
}

.alignment-guide.horizontal {
  left: 0;
  right: 0;
  height: 1px;
  border-top: 1px dashed var(--guide-color);
}

.alignment-guide.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
  border-left: 1px dashed var(--guide-color);
}
```

**Step 9: Run type check + visual verification**

Run: `npx tsc --noEmit && npm test`
Expected: All pass.

**Step 10: Commit**

```
feat: dark mode CSS with custom properties for all components
```

---

### Task 10: Final — Run full test suite and build

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass.

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit any remaining fixes**

If any tests or build issues found, fix and commit.
